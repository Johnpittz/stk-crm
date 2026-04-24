# Diagnostico - mostra o formato bruto dos dados do Millennium

$MillenniumUrl = "http://roma.millenniumhosting.com.br:6017/api/millenium_eco"
$MillenniumUser = "roma_integracao"
$MillenniumPass = "@1Hfu2AVb9Q"

$secpass = ConvertTo-SecureString $MillenniumPass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($MillenniumUser, $secpass)

Write-Host ""
Write-Host "=== TESTE 1: CLIENTES (top 2) ==="
try {
    $r = Invoke-WebRequest -Uri "$MillenniumUrl/clientes/lista?`$format=json&`$top=2" -Credential $cred -UseBasicParsing -TimeoutSec 30
    $data = $r.Content | ConvertFrom-Json
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Registros: $($data.value.Count)"
    if ($data.value.Count -gt 0) {
        Write-Host ""
        Write-Host "Campos do primeiro cliente:"
        $data.value[0] | Get-Member -MemberType NoteProperty | Select-Object Name | Format-Table
        Write-Host ""
        Write-Host "Primeiro cliente (JSON):"
        $data.value[0] | ConvertTo-Json -Depth 2
    }
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTE 2: VENDAS/FATURAMENTOS (top 3) ==="
try {
    $DataInicial = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $DataFinal = (Get-Date).ToString("yyyy-MM-dd")
    $url = "$MillenniumUrl/pedido_venda/listafaturamentos?`$format=json&data_emissao_inicial=$DataInicial&data_emissao_final=$DataFinal&aprovado=true&lancamentos_pedido=true&`$top=3"
    
    $r = Invoke-WebRequest -Uri $url -Credential $cred -UseBasicParsing -TimeoutSec 30
    $data = $r.Content | ConvertFrom-Json
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Registros: $($data.value.Count)"
    if ($data.value.Count -gt 0) {
        Write-Host ""
        Write-Host "Campos do primeiro faturamento:"
        $data.value[0] | Get-Member -MemberType NoteProperty | Select-Object Name | Format-Table
        Write-Host ""
        Write-Host "Primeiro faturamento (JSON):"
        $data.value[0] | ConvertTo-Json -Depth 2
    }
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Read-Host "Pressione Enter para fechar"
