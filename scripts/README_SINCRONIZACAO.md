# 🔗 Mediador Local: Millennium → CRM ROMA

## O que é isso?

O Millennium roda na **rede interna** da empresa e usa autenticação Windows (NTLM). O CRM ROMA roda na internet (Vercel/Supabase).

Este "mediador" é um script que roda **localmente** na máquina da empresa, busca os dados no Millennium e envia para o CRM.

## 📁 Arquivos

| Arquivo | Função |
|---------|--------|
| `TESTAR_CONEXAO.bat` | **Duplo-clique aqui primeiro** — testa se consegue ler o Millennium |
| `SINCRONIZAR.bat` | **Duplo-clique aqui depois** — sincroniza vendas do Millennium → CRM |
| `sync-millennium.ps1` | Script de sincronização (PowerShell) |
| `test-millennium-local.ps1` | Teste de conexão (PowerShell) |
| `.env` | Configuração com a chave do Supabase (já está configurado) |

## 🚀 Como usar (3 passos)

### Passo 1: Teste a conexão
Duplo-clique em **`TESTAR_CONEXAO.bat`**

- Se mostrar **"✅ SUCESSO!"** → vai para o passo 2
- Se der **"❌ FALHA"** → verifique se está na rede da empresa (ou VPN)

### Passo 2: Sincronize
Duplo-clique em **`SINCRONIZAR.bat`**

O script vai:
1. Buscar vendas faturadas dos últimos 30 dias no Millennium
2. Enviar para o CRM (tabela `vendas`)
3. Atualizar a `data_ultima_compra` dos clientes

### Passo 3: Agende (opcional)

Quando funcionar, use o **Agendador de Tarefas do Windows** para rodar automaticamente todo dia:

1. Pressione `Win + R`, digite `taskschd.msc` e Enter
2. Ação → Criar Tarefa Básica
3. Nome: `Sincronizar Millennium → CRM`
4. Disparador: `Diariamente` às `08:00`
5. Ação: `Iniciar um programa`
6. Programa: `powershell.exe`
7. Argumentos: `-ExecutionPolicy Bypass -File "C:\Users\Marketing\Documents\CRM-ROMA\crm-roma\scripts\sync-millennium.ps1"`

## ⚙️ Configurações

O arquivo `.env` já está configurado com a chave do Supabase. Se precisar trocar, edite o arquivo `.env`.

Para mudar o período de sincronização, edite o arquivo `sync-millennium.ps1` e altere:
```powershell
$DiasAtras = 30   # sincroniza últimos X dias
```

## ❓ Problemas comuns

| Problema | Solução |
|----------|---------|
| "401 Não Autorizado" | Você precisa estar logado no domínio da empresa. Rode na sua máquina de trabalho. |
| "Timeout" | Verifique se está conectado na rede da empresa (VPN se estiver remoto) |
| PowerShell bloqueia scripts | O `.bat` já configura `-ExecutionPolicy Bypass`, mas se der erro, rode como administrador |
| "Nenhum dado retornado" | Pode ser que não haja vendas no período. Tente aumentar `$DiasAtras` |

## 🔒 Segurança

- O script usa `-UseDefaultCredentials` → pega seu login do Windows automaticamente (igual o navegador)
- A chave do Supabase está no arquivo `.env` local — não é enviada para lugar nenhum
- O script só funciona na rede interna da empresa
