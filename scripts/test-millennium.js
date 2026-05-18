require('dotenv').config();

const { NtlmClient } = require('axios-ntlm');

const username = process.env.MILLENNIUM_USERNAME || '';
const password = process.env.MILLENNIUM_PASSWORD || '';

if (!username || !password) {
  console.error('Erro: configure MILLENNIUM_USERNAME e MILLENNIUM_PASSWORD no .env.local');
  process.exit(1);
}

const client = NtlmClient({
  username: username,
  password: password,
  domain: '',
  workstation: '',
});

const baseUrl = "http://roma.millenniumhosting.com.br:6017/api/millenium_eco";

async function test() {
  try {
    console.log('=== Teste com axios-ntlm ===');
    const res = await client.get(`${baseUrl}/filiais/lista_simples?$format=json&$top=2`);
    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('Erro:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data?.substring?.(0, 300) || err.response.data);
    }
  }
}

test();
