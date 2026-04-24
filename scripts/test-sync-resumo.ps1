# Teste de sincronizacao - mostra resumo sem enviar para o CRM

$MillenniumUrl = "http://roma.millenniumhosting.com.br:6017/api/millenium_eco"
$MillenniumUser = "roma_integracao"
$MillenniumPass = "@1Hfu2AVb9Q"

$secpass = ConvertTo-SecureString $MillenniumPass -AsPlainText -Force
$millenniumCred = New-Object System.Management.Automation.PSCredential($MillenniumUser, $secpass)

# Busca ultimo ano
$DiasAtras = 365
$DataInicial = (Get-Date).AddDays(-$DiasAtras).ToString("yyyy-MM-dd")
$DataFinal = (Get-Date).ToString("yyyy-MM-dd")

Write-Host ""
Write-Host "=========================================="
Write-Host "     TESTE DE SINCRONIZACAO - RESUMO    "
Write-Host "=========================================="
Write-Host ""
Write-Host "Buscando vendas de $DataInicial ate $DataFinal..."

function Convert-DotNetDate {
    param([string]$dateStr)
    if (-not $dateStr) { return $null }
    if ($dateStr -match '/Date\((\d+)([+-]\d+)?\)/') {
        $timestamp = [long]$matches[1]
        $epoch = [datetime]::new(1970, 1, 1, 0, 0, 0, [System.DateTimeKind]::Utc)
        $dt = $epoch.AddMilliseconds($timestamp)
        return $dt.ToString("yyyy-MM-dd")
    }
    return $dateStr
}

$VendasUrl = "$MillenniumUrl/pedido_venda/listafaturamentos?`$format=json&data_emissao_inicial=$DataInicial&data_emissao_final=$DataFinal&aprovado=true&lancamentos_pedido=true&`$top=5000"

try {
    $response = Invoke-WebRequest -Uri $VendasUrl -Credential $millenniumCred -UseBasicParsing -TimeoutSec 60
    $data = $response.Content | ConvertFrom-Json
    $vendas = $data.value
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Pressione Enter"
    exit 1
}

Write-Host "$($vendas.Count) faturamentos encontrados" -ForegroundColor Green
Write-Host ""

if ($vendas.Count -eq 0) {
    Write-Host "Nenhuma venda no periodo."
    Read-Host "Pressione Enter"
    exit 0
}

# Resumo por mes
$porMes = @{}
$clientesUnicos = @{}
$valorTotal = 0

foreach ($v in $vendas) {
    $data = Convert-DotNetDate $v.data
    if ($data) {
        $mes = $data.Substring(0, 7)
        if (-not $porMes[$mes]) { $porMes[$mes] = @{ qtd = 0; valor = 0 } }
        $porMes[$mes].qtd++
        $porMes[$mes].valor += [decimal]($v.total -or $v.valor_final -or 0)
    }
    
    if ($v.cliente -and $v.cliente.Count -gt 0) {
        $cod = $v.cliente[0].cod_cliente
        $nome = $v.cliente[0].nome
        $clientesUnicos[$cod] = $nome
    }
    
    $valorTotal += [decimal]($v.total -or $v.valor_final -or 0)
}

Write-Host "--- Resumo por mes ---"
foreach ($mes in ($porMes.Keys | Sort-Object)) {
    $m = $porMes[$mes]
    Write-Host "$mes : $($m.qtd) vendas | R$ $([math]::Round($m.valor, 2))"
}

Write-Host ""
Write-Host "--- Total ---"
Write-Host "Vendas: $($vendas.Count)"
Write-Host "Clientes unicos: $($clientesUnicos.Count)"
Write-Host "Valor total: R$ $([math]::Round($valorTotal, 2))"

Write-Host ""
Write-Host "--- Primeiras 5 vendas ---"
for ($i = 0; $i -lt [Math]::Min(5, $vendas.Count); $i++) {
    $v = $vendas[$i]
    $data = Convert-DotNetDate $v.data
    $cliente = if ($v.cliente -and $v.cliente.Count -gt 0) { $v.cliente[0].nome } else { "N/A" }
    $nf = $v.saida
    $valor = $v.total
    Write-Host "$data | NF $nf | $cliente | R$ $valor"
}

Write-Host ""
Read-Host "Pressione Enter para fechar"
