# Teste rapido - verifica se consegue acessar o Millennium pela rede local
Write-Host ""
Write-Host "=== Teste de conexao com Millennium ==="
Write-Host ""

$Url = "http://roma.millenniumhosting.com.br:6017/api/millenium_eco/filiais/lista_simples?`$format=json&`$top=2"

# Tenta com credenciais explicitas (NTLM)
$secpass = ConvertTo-SecureString "@1Hfu2AVb9Q" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("roma_integracao", $secpass)

try {
    $response = Invoke-WebRequest -Uri $Url -Credential $cred -UseBasicParsing -TimeoutSec 30
    Write-Host "SUCESSO com credenciais explicitas! Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Registros: $($data.value.Count)" -ForegroundColor Green
    $data.value | Select-Object -First 1 | Format-List
    Read-Host "Pressione Enter para fechar"
    exit 0
} catch {
    Write-Host "Credenciais explicitas falharam: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Tenta com UseDefaultCredentials (Windows atual)
try {
    $response = Invoke-WebRequest -Uri $Url -UseDefaultCredentials -UseBasicParsing -TimeoutSec 30
    Write-Host "SUCESSO com Windows Auth! Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Registros: $($data.value.Count)" -ForegroundColor Green
    $data.value | Select-Object -First 1 | Format-List
} catch {
    Write-Host ""
    Write-Host "FALHA: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status HTTP: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Verifique se:" -ForegroundColor Yellow
    Write-Host "   - Esta conectado na rede da empresa" -ForegroundColor Yellow
    Write-Host "   - Se estiver remoto, conecte a VPN" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Pressione Enter para fechar"
