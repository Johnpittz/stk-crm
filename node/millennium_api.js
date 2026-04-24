var httpntlm = require('httpntlm');

httpntlm.get({
    url: "http://millennium.iwise.com.br:888/api/millenium_eco/filiais/lista_simples?$format=json",
    username: 'odata',
    password: '0d@t@123',
    workstation: '',
    domain: ''
}, function (err, res){
    if(err) return err;

    var filiais = JSON.parse(res.body);
    console.log(filiais);
});
