#!/usr/bin/env python3
"""
bateria_waha.py — Bateria de testes E2E do pipeline WAHA do STK-CRM.

Para cada tipo de mídia/texto:
  1. ENVIO real pela API de produção (Vercel → WAHA → WhatsApp)
  2. RECEBIDO real no outro aparelho (WAHA → webhook → Supabase Storage/DB)

O envio vai da sessão STK-1 para o número da STK-2; a mensagem recebida chega
na sessão STK-2 e é gravada pelo webhook — logo, cada caso valida os dois
sentidos de uma vez, com assert no banco (não só HTTP 200).

Cobertura: texto, imagem, áudio (ptt), vídeo, pdf, docx, xlsx, pptx, txt.

Uso:  . /app/stk-worker/env && python3 bateria_waha.py [--skip-send]
  --skip-send  só re-asserção (útil p/ re-verificar sem mandar de novo)

Saída: linhas PASS/FAIL + resumo; exit 1 se algum falhar.
"""

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from io import BytesIO

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PRODUCAO = os.environ.get("BATERIA_URL", "https://stk-crm-amber-delta.vercel.app").rstrip("/")

ORIGEM = "STK-1"                       # sessão que envia
DESTINO_NUM = "556299961553"           # número da STK-2 (aparelho receptor)
DESTINO_INST = "STK-2"
ORIGEM_NUM = "556295094949"            # número da STK-1 (constelação p/ cleanup)
SKIP_SEND = "--skip-send" in sys.argv

MARCADOR = f"bateria-{int(time.time())}"


# ==================== helpers HTTP ====================

def http(method, url, payload=None, headers=None, raw=False, timeout=90):
    hdrs = dict(headers or {})
    data = None
    if payload is not None:
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            if raw:
                return resp.status, body
            try:
                return resp.status, json.loads(body) if body else None
            except json.JSONDecodeError:
                return resp.status, body.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            return e.code, json.loads(b) if b else b.decode("utf-8", "replace")
        except Exception:
            return e.code, b.decode("utf-8", "replace")


def sb(method, table, query="", payload=None):
    return http(
        method, f"{SUPABASE_URL}/rest/v1/{table}{query}", payload,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )


# ==================== geradores de arquivo ====================

def png_bytes() -> bytes:
    # PNG 1x1 válido (pixels vermelhos via ffmpeg p/ garantir mídia real)
    import subprocess, tempfile
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
             "-i", "color=c=red:s=64x64:d=1", "-frames:v", "1", f.name],
            check=True,
        )
        return open(f.name, "rb").read()


def ogg_bytes() -> bytes:
    import subprocess, tempfile
    with tempfile.NamedTemporaryFile(suffix=".ogg") as f:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
             "-i", "sine=frequency=440:duration=1", "-c:a", "libopus", f.name],
            check=True,
        )
        return open(f.name, "rb").read()


def mp4_bytes() -> bytes:
    import subprocess, tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4") as f:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
             "-i", "testsrc=size=128x128:rate=10:duration=1",
             "-pix_fmt", "yuv420p", "-c:v", "libx264", "-movflags", "+faststart", f.name],
            check=True,
        )
        return open(f.name, "rb").read()


def pdf_bytes() -> bytes:
    stream = b"BT /F1 18 Tf 20 60 Td (Bateria STK-CRM) Tj ET\n"
    objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R"
        b"/Resources<</Font<</F1 5 0 R>>>>>>",
        b"<</Length " + str(len(stream)).encode() + b">>stream\n" + stream + b"endstream",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objs)+1}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<</Size {len(objs)+1}/Root 1 0 R>>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    return bytes(out)


def _zip(files: dict) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buf.getvalue()


def docx_bytes() -> bytes:
    return _zip({
        "[Content_Types].xml":
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        "_rels/.rels":
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml":
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body><w:p><w:r><w:t>Bateria STK-CRM {MARCADOR}</w:t></w:r></w:p></w:body></w:document>",
    })


def xlsx_bytes() -> bytes:
    return _zip({
        "[Content_Types].xml":
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels":
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml":
            '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Bateria" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels":
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml":
            '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Bateria ' + MARCADOR + "</t></is></c></row></sheetData></worksheet>",
    })


def pptx_bytes() -> bytes:
    return _zip({
        "[Content_Types].xml":
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
            '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
        "_rels/.rels":
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
        "ppt/presentation.xml":
            '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
        "ppt/_rels/presentation.xml.rels":
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
        "ppt/slides/slide1.xml":
            '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:cSld><p:spTree><p:sp><p:txBody><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            f"<a:r><a:t>Bateria {MARCADOR}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>",
    })


def txt_bytes() -> bytes:
    return f"Bateria STK-CRM texto {MARCADOR}\n".encode()


# ==================== casos ====================

def casos() -> list:
    return [
        {"label": "texto", "kind": "text",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "text": f"Bateria texto {MARCADOR}"}},
        {"label": "imagem (png)", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "image", "mimetype": "image/png",
                          "media": base64.b64encode(png_bytes()).decode(),
                          "fileName": f"{MARCADOR}.png"}},
        {"label": "audio ptt (ogg/opus)", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "audio", "mimetype": "audio/ogg; codecs=opus",
                          "media": base64.b64encode(ogg_bytes()).decode(),
                          "fileName": f"{MARCADOR}.ogg"}},
        {"label": "video (mp4)", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "video", "mimetype": "video/mp4",
                          "media": base64.b64encode(mp4_bytes()).decode(),
                          "fileName": f"{MARCADOR}.mp4"}},
        {"label": "documento pdf", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "document", "mimetype": "application/pdf",
                          "media": base64.b64encode(pdf_bytes()).decode(),
                          "fileName": f"{MARCADOR}.pdf"}},
        {"label": "documento docx", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "document",
                          "mimetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                          "media": base64.b64encode(docx_bytes()).decode(),
                          "fileName": f"{MARCADOR}.docx"}},
        {"label": "documento xlsx", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "document",
                          "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                          "media": base64.b64encode(xlsx_bytes()).decode(),
                          "fileName": f"{MARCADOR}.xlsx"}},
        {"label": "documento pptx", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "document",
                          "mimetype": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                          "media": base64.b64encode(pptx_bytes()).decode(),
                          "fileName": f"{MARCADOR}.pptx"}},
        {"label": "documento txt", "kind": "media",
         "body": lambda: {"number": DESTINO_NUM, "instance": ORIGEM,
                          "mediatype": "document", "mimetype": "text/plain",
                          "media": base64.b64encode(txt_bytes()).decode(),
                          "fileName": f"{MARCADOR}.txt"}},
    ]


def atendimento_receptor():
    st, rows = sb("GET", "atendimentos",
                  f"?telefone_cliente=eq.{ORIGEM_NUM}&instancia=eq.{DESTINO_INST}&select=id,nome_cliente&limit=1")
    return rows[0] if rows else None


def espera_chegada(at_id, alvo, esperado, consumidas, timeout=75):
    """Espera a mensagem NO RECEPTOR (webhook da STK-2 gravou no banco).

    Na recepção, mídia image/audio/video chega como "[image]" etc. SEM
    file_name (o filename só vem em documentos) — a asserção casa por
    marcador (texto/documento) OU placeholder do tipo, sem reaproveitar
    linhas já consumidas por outros casos.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        if at_id is None:
            at = atendimento_receptor()
            if not at:
                time.sleep(3)
                continue
            at_id = at["id"]
        st, rows = sb(
            "GET", "atendimento_mensagens",
            f"?atendimento_id=eq.{at_id}&created_at=gte.{INICIO_ISO}"
            f"&select=id,conteudo,media_url,media_type,file_name,remetente,whatsapp_message_id&limit=50",
        )
        if not isinstance(rows, list):
            rows = []
        for m in rows:
            if m.get("remetente") != "cliente" or m["id"] in consumidas:
                continue
            conteudo = m.get("conteudo") or ""
            file_name = m.get("file_name") or ""
            bate_marcador = alvo and (alvo in conteudo or alvo in file_name)
            bate_tipo = esperado in ("image", "audio", "video") and conteudo == f"[{esperado}]"
            if bate_marcador or bate_tipo:
                consumidas.add(m["id"])
                return m
        time.sleep(3)
    return None


def main():
    print(f"[Bateria] marcador={MARCADOR} | origem={ORIGEM} → destino={DESTINO_NUM}@{DESTINO_INST}")

    at = atendimento_receptor()
    print(f"[Bateria] atendimento receptor: {at['id'] if at else 'ainda não existe (será criado pelo 1º caso)'}")

    global INICIO_ISO
    consumidas: set = set()
    INICIO_ISO = urllib.parse.quote(time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()))

    resultados = []
    for caso in casos():
        label = caso["label"]
        payload = caso["body"]()
        alvo = payload.get("text") or payload.get("fileName")
        if SKIP_SEND:
            print(f"  [skip-send] {label}")
        else:
            endpoint = "/api/send/text" if caso["kind"] == "text" else "/api/send/media"
            st, resp = http("POST", PRODUCAO + endpoint, payload, timeout=120)
            if st != 200 or not (isinstance(resp, dict) and resp.get("success")):
                resultados.append((label, False, f"envio HTTP {st}: {str(resp)[:160]}"))
                print(f"  FAIL {label} — envio: HTTP {st} {str(resp)[:160]}")
                continue
            print(f"  enviado {label} (id={resp.get('message_id')})")

        recebida = espera_chegada(at["id"] if at else None, alvo,
                                payload.get("mediatype"), consumidas)
        if not recebida:
            resultados.append((label, False, "não chegou ao receptor em 75s"))
            print(f"  FAIL {label} — não chegou ao receptor")
            continue

        detalhes = []
        ok = True
        if caso["kind"] == "text":
            ok = MARCADOR in (str(recebida.get("conteudo") or ""))
            detalhes.append(f"conteudo ok={ok}")
        else:
            esperado_tipo = {"image": "image", "audio": "audio", "video": "video"}.get(
                payload.get("mediatype"), "document")
            # mídia recebida deve ter URL no Storage + tipo certo
            ok = bool(recebida.get("media_url"))
            detalhes.append(f"media_url={'sim' if ok else 'NAO'}")
            detalhes.append(f"media_type={recebida.get('media_type')}")
            if recebida.get("media_type") not in (esperado_tipo, None):
                # tipo pode vir como mimetype cheio em alguns fluxos
                if esperado_tipo not in str(recebida.get("media_type")):
                    ok = False
                    detalhes.append(f"tipo esperado={esperado_tipo}")
        resultados.append((label, ok, ", ".join(detalhes)))
        print(f"  {'PASS' if ok else 'FAIL'} {label} — {', '.join(detalhes)}")

    print("\n[Bateria] resumo:")
    falhas = 0
    for label, ok, det in resultados:
        print(f"  {'PASS' if ok else 'FAIL'}  {label}: {det}")
        if not ok:
            falhas += 1
    print(f"[Bateria] {len(resultados) - falhas}/{len(resultados)} OK — marcador {MARCADOR}")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
