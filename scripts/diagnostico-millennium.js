// Diagnóstico: descobre a URL correta da API Millennium
const http = require("http");

const USER = "roma_integracao";
const PASS = "@1Hfu2AVb9Q";
const auth = Buffer.from(`${USER}:${PASS}`).toString("base64");

function testar(host, porta, caminho) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: porta,
      path: caminho,
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, data: data.substring(0, 300) });
      });
    });

    req.on("error", (err) => {
      resolve({ status: "ERRO", data: err.message });
    });

    req.end();
  });
}

async function main() {
  const baseUrls = [
    { host: "roma.millenniumhosting.com.br", port: 6017, base: "/api/millennium_eco" },
    { host: "roma.millenniumhosting.com.br", port: 6017, base: "/api/millenium_eco" },
  ];

  const endpoints = ["/PRODUTOS", "/produtos", "/produtos/lista", "/$help"];

  console.log("Testando combinações de URL...\n");

  for (const url of baseUrls) {
    for (const endpoint of endpoints) {
      const caminho = url.base + endpoint;
      console.log(`Testando: http://${url.host}:${url.port}${caminho}`);
      const resultado = await testar(url.host, url.port, caminho);
      console.log(`  → Status: ${resultado.status}`);
      if (resultado.status === 200) {
        console.log(`  → Resposta: ${resultado.data.substring(0, 200)}`);
      }
      console.log("");
    }
  }
}

main();
