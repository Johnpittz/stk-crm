require('dotenv').config();

var httpntlm = require('httpntlm');

const username = process.env.MILLENNIUM_USERNAME || '';
const password = process.env.MILLENNIUM_PASSWORD || '';

if (!username || !password) {
  console.error('Erro: configure MILLENNIUM_USERNAME e MILLENNIUM_PASSWORD no .env.local');
  process.exit(1);
}

httpntlm.get({
    url: "http://millennium.iwise.com.br:888/api/millenium_eco/filiais/lista_simples?$format=json",
    username: username,
    password: password,
    workstation: '',
    domain: ''
}, function (err, res){
    if(err) return err;

    var filiais = JSON.parse(res.body);
    console.log(filiais);
});
