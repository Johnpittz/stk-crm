# Mediador Local - Sincronizacao Millennium -> CRM ROMA

# Le o .env da mesma pasta
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^(.+?)=(.+)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

$SupabaseUrl = $env:SUPABASE_URL
$SupabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SupabaseKey) {
    Write-Host "ERRO: Arquivo .env nao encontrado ou sem SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

$MillenniumUrl = "http://roma.millenniumhosting.com.br:6017/api/millenium_eco"
$MillenniumUser = "roma_integracao"
$MillenniumPass = "@1Hfu2AVb9Q"

$secpass = ConvertTo-SecureString $MillenniumPass -AsPlainText -Force
$millenniumCred = New-Object System.Management.Automation.PSCredential($MillenniumUser, $secpass)

$DiasAtras = 30
$DataInicial = (Get-Date).AddDays(-$DiasAtras).ToString("yyyy-MM-dd")
$DataFinal = (Get-Date).ToString("yyyy-MM-dd")

Write-Host ""
Write-Host "=========================================="
Write-Host "     MEDIADOR MILLENNIUM -> CRM ROMA    "
Write-Host "=========================================="
Write-Host ""
Write-Host "Buscando vendas de $DataInicial ate $DataFinal..."

# Funcao para converter /Date(timestamp)/ para string YYYY-MM-DD
function Convert-DotNetDate {
    param([string]$dateStr)
    if (-not $dateStr) { return $null }
    if ($dateStr -match '/Date\((\d+)([+-]\d+)?\)/') {
        $timestamp = [long]$matches[1]
        # O timestamp .NET ja esta em milisegundos desde 1970-01-01
        # Mas o PowerShell espera ticks (100-nanossegundos desde 0001-01-01)
        $epoch = [datetime]::new(1970, 1, 1, 0, 0, 0, [System.DateTimeKind]::Utc)
        $dt = $epoch.AddMilliseconds($timestamp)
        return $dt.ToString("yyyy-MM-dd")
    }
    return $dateStr
}

# Busca vendas no Millennium
$VendasUrl = "$MillenniumUrl/pedido_venda/listafaturamentos?`$format=json&data_emissao_inicial=$DataInicial&data_emissao_final=$DataFinal&aprovado=true&lancamentos_pedido=true&`$top=5000"

try {
    $response = Invoke-WebRequest -Uri $VendasUrl -Credential $millenniumCred -UseBasicParsing -TimeoutSec 60
    $data = $response.Content | ConvertFrom-Json
    $vendas = $data.value
    Write-Host "$($vendas.Count) faturamentos encontrados" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERRO ao buscar no Millennium: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status HTTP: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    Read-Host "Pressione Enter para sair"
    exit 1
}

if ($vendas.Count -eq 0) {
    Write-Host "Nada para sincronizar" -ForegroundColor Green
    Read-Host "Pressione Enter para sair"
    exit 0
}

# Mapeia vendas
$vendasMapeadas = @()
foreach ($v in $vendas) {
    $numero = [string]($v.saida -or $v.nf -or "")
    if (-not $numero) { continue }
    
    $dataVenda = Convert-DotNetDate $v.data
    if (-not $dataVenda) { continue }
    
    # Cliente vem dentro de um array
    $codCliente = $null
    if ($v.cliente -and $v.cliente.Count -gt 0) {
        $codCliente = $v.cliente[0].cod_cliente
    }
    
    $vendasMapeadas += @{
        numero_pedido = $numero
        codigo_erp = $numero
        data_venda = $dataVenda
        valor_total = [decimal]($v.total -or $v.valor_nf -or 0)
        valor_desconto = [decimal]($v.v_desconto -or $v.valor_desconto -or 0)
        valor_frete = [decimal]($v.v_frete -or $v.valor_frete -or 0)
        valor_final = [decimal]($v.valor_final -or $v.total -or 0)
        status = "faturada"
        forma_pagamento = $null
        sincronizado_erp = $true
        _cod_cliente = $codCliente
    }
}

Write-Host "$($vendasMapeadas.Count) vendas validas para importar"

# Busca clientes do CRM
$headers = @{ 
    "apikey" = $SupabaseKey 
    "Authorization" = "Bearer $SupabaseKey" 
    "Content-Type" = "application/json" 
}

try {
    $clientesResp = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/clientes?select=id,codigo_erp" -Headers $headers -UseBasicParsing
    $clientes = $clientesResp.Content | ConvertFrom-Json
} catch {
    Write-Host "ERRO ao buscar dados do CRM: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Resolve referencias
$clienteMap = @{}
foreach ($c in $clientes) { $clienteMap[[string]$c.codigo_erp] = $c.id }

# Prepara vendas finais
$vendasFinais = @()
foreach ($v in $vendasMapeadas) {
    $vendasFinais += @{
        numero_pedido = $v.numero_pedido
        codigo_erp = $v.codigo_erp
        data_venda = $v.data_venda
        valor_total = $v.valor_total
        valor_desconto = $v.valor_desconto
        valor_frete = $v.valor_frete
        valor_final = $v.valor_final
        status = $v.status
        forma_pagamento = $v.forma_pagamento
        sincronizado_erp = $v.sincronizado_erp
        cliente_id = $clienteMap[[string]$v._cod_cliente]
    }
}

# Envia para o Supabase (upsert)
try {
    $upsertHeaders = @{ 
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
        "Content-Type" = "application/json"
        "Prefer" = "resolution=merge-duplicates"
    }
    
    $body = $vendasFinais | ConvertTo-Json -Depth 3
    $result = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/vendas" -Method POST -Headers $upsertHeaders -Body $body -UseBasicParsing
    Write-Host "$($vendasFinais.Count) vendas sincronizadas!" -ForegroundColor Green
} catch {
    Write-Host "ERRO ao salvar no Supabase: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errBody = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errBody)
        Write-Host "Detalhe: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Atualiza data_ultima_compra dos clientes
$clientesAtualizados = ($vendasFinais | Where-Object { $_.cliente_id } | Select-Object -Property cliente_id -Unique).cliente_id
Write-Host "Atualizando data da ultima compra de $($clientesAtualizados.Count) clientes..."

foreach ($cid in $clientesAtualizados) {
    $ultima = ($vendasFinais | Where-Object { $_.cliente_id -eq $cid } | Sort-Object data_venda -Descending | Select-Object -First 1).data_venda
    if ($ultima) {
        $patchBody = @{ data_ultima_compra = $ultima } | ConvertTo-Json
        Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/clientes?id=eq.$cid" -Method PATCH -Headers $upsertHeaders -Body $patchBody -UseBasicParsing | Out-Null
    }
}

Write-Host ""
Write-Host "Sincronizacao concluida com sucesso!" -ForegroundColor Green
Write-Host ""
Read-Host "Pressione Enter para sair"
