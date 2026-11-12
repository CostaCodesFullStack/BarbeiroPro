# Configurando o Asaas (cobrança do BarbeiroPro)

Fluxo: o dono cria a conta → cadastra o cartão → o Asaas valida o cartão e cria a assinatura com a
**primeira cobrança em 7 dias** (`nextDueDate`) → mensal a partir daí. O painel só libera o cadastro de
serviços e profissionais depois do cartão aceito.

> Confira sempre a documentação oficial (https://docs.asaas.com): URLs, campos e eventos podem mudar.

## 1. Sandbox (use SEMPRE em desenvolvimento)
1. Crie uma conta no **sandbox** do Asaas e gere uma **chave de API** de sandbox.
2. No `.env`:
   ```
   ASAAS_API_KEY=<chave do sandbox>
   ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
   ASAAS_WEBHOOK_TOKEN=<gere: openssl rand -hex 24>
   ```
   O token do webhook é um segredo **diferente** da chave de API. Nunca reutilize a chave de API.
   Em desenvolvimento, testes e servidor local, o cliente aceita somente essa URL oficial e uma chave Sandbox com prefixo `$aact_hmlg_`. Chaves antigas sem prefixo identificável precisam ser substituídas por uma chave Sandbox atual; não use chave de produção localmente.
3. Para testar o cartão, use os **cartões de teste do sandbox** listados na documentação do Asaas.

O cliente não escolhe nem substitui o ambiente automaticamente. Sem configuração válida, a operação falha antes de fazer uma requisição. A configuração de produção continua sendo fornecida pelo ambiente de produção, sem fallback a partir das variáveis locais.

## 2. Webhook
No painel do Asaas (Integrações → Webhooks), crie um webhook:
- **URL:** `https://<endereço público>/api/v1/webhooks/asaas`
- **Token de autenticação:** o mesmo valor de `ASAAS_WEBHOOK_TOKEN` (o Asaas envia no header `asaas-access-token`)
- **Envio:** sequencial
- **Eventos:** `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`,
  `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`

Em desenvolvimento local o Asaas não alcança `localhost`: use um túnel (ngrok, cloudflared) para expor a porta 3000.

## 3. Testar o webhook SEM o Asaas (PowerShell)
Pegue o `gateway_subscription_id` da tabela `subscriptions` (Prisma Studio: `npm run db:studio`) e rode:
```powershell
$h = @{ "asaas-access-token" = "<ASAAS_WEBHOOK_TOKEN>" }
$body = @{
  id = "evt_teste_001"; event = "PAYMENT_CONFIRMED"
  payment = @{ id = "pay_teste"; subscription = "<gateway_subscription_id>"; dueDate = "2026-11-09" }
} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri http://localhost:3000/api/v1/webhooks/asaas -Method Post -Headers $h -ContentType "application/json" -Body $body
```
Esperado: `received = True`, e a assinatura passa a `ACTIVE`. Reenviar o mesmo `id` deve responder `duplicate = True`.
Troque `event` por `PAYMENT_OVERDUE` (vira `PAST_DUE`) ou `SUBSCRIPTION_DELETED` (vira `CANCELED`) para testar os outros casos.
Sem o header ou com token errado a resposta é `401`.

## 4. Atenção: dados de cartão
O cartão sai do navegador, passa pelo servidor do BarbeiroPro e vai ao Asaas. O sistema **não grava nem registra** esses
dados, mas só de trafegarem pelo servidor há exigências de segurança (PCI). Antes de produção, avaliar tokenização ou
checkout hospedado pelo Asaas. Registrado em AGENTS.md, seção 14.
