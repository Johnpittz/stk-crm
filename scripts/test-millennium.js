const { NtlmClient } = require('axios-ntlm');

const client = NtlmClient({
  username: 'odata',
  password: '0d@t@123',
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
