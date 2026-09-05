#!/usr/bin/env python3
"""
Replace text in the Sustentalski proposal template using PyMuPDF redaction.
Usage: python3 replace_proposta.py <template_path> <output_path> <json_data>
"""
import sys
import json
import pymupdf

def fmt(v):
    """Format as Brazilian currency: R$ X.XXX,XX"""
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def main():
    template_path = sys.argv[1]
    output_path = sys.argv[2]
    data = json.loads(sys.argv[3])

    cliente_name = data["cliente_name"].upper()
    proposta_number = data["proposta_number"]
    valor_atual = fmt(data["valor_atual"])
    estimativa = fmt(data["estimativa_recuperacao"])
    gfat = fmt(data["gfat_estimativa"])
    total_bruto = fmt(data["estimativa_recuperacao"] + data["gfat_estimativa"])
    total_liquido = fmt((data["estimativa_recuperacao"] + data["gfat_estimativa"]) * 0.625)

    doc = pymupdf.open(template_path)

    # ===== PAGE 2 (index 1): Introduction letter =====
    page2 = doc[1]
    for inst in page2.search_for("AGROCENTRAL INDÚSTRIA E COMÉRCIO-NUTRIRAÇÃO."):
        page2.add_redact_annot(inst, text=cliente_name + ".", fontname="helv",
                               fontsize=32, text_color=(0.1, 0.1, 0.1), fill=(1, 1, 1))
    page2.apply_redactions()

    # ===== PAGE 8 (index 7): Proposal data =====
    page8 = doc[7]

    # Proposta number
    for inst in page8.search_for("115953909261457"):
        page8.add_redact_annot(inst, text=proposta_number, fontname="helv",
                               fontsize=17, fill=(1, 1, 1))
    page8.apply_redactions()

    # Cliente name
    for inst in page8.search_for("JOAOPEDROLG"):
        page8.add_redact_annot(inst, text=cliente_name, fontname="helv",
                               fontsize=17, fill=(1, 1, 1))
    page8.apply_redactions()

    # Valor atual
    for inst in page8.search_for("5.639,26"):
        page8.add_redact_annot(inst, text=valor_atual, fontname="helv",
                               fontsize=16, fill=(1, 1, 1))
    page8.apply_redactions()

    # Estimativa RECIEE
    for inst in page8.search_for("5.853,55"):
        page8.add_redact_annot(inst, text=estimativa, fontname="helv",
                               fontsize=16, fill=(1, 1, 1))
    page8.apply_redactions()

    # GFAT
    for inst in page8.search_for("6.090,40"):
        page8.add_redact_annot(inst, text=gfat, fontname="helv",
                               fontsize=16, fill=(1, 1, 1))
    page8.apply_redactions()

    # ===== PAGE 9 (index 8): Financial estimates =====
    page9 = doc[8]

    for inst in page9.search_for("R$ 5.853,55"):
        page9.add_redact_annot(inst, text=estimativa, fontname="helv",
                               fontsize=20, fill=(1, 1, 1))
    page9.apply_redactions()

    for inst in page9.search_for("R$ 6.090,40"):
        page9.add_redact_annot(inst, text=gfat, fontname="helv",
                               fontsize=20, fill=(1, 1, 1))
    page9.apply_redactions()

    for inst in page9.search_for("R$ 38.760,00"):
        page9.add_redact_annot(inst, text=total_bruto, fontname="helv",
                               fontsize=20, fill=(1, 1, 1))
    page9.apply_redactions()

    for inst in page9.search_for("R$ 24.396,00"):
        page9.add_redact_annot(inst, text=total_liquido, fontname="helv",
                               fontsize=20, fill=(1, 1, 1))
    page9.apply_redactions()

    doc.save(output_path)
    doc.close()
    print("OK")

if __name__ == "__main__":
    main()
