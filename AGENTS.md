# AGENTS.md — Memória do Projeto

> **LEIA ESTE ARQUIVO ANTES DE QUALQUER AÇÃO.**
> Ele é a fonte única de verdade sobre o que o projeto é, o que já foi feito e o que falta fazer.
> **Ao terminar qualquer tarefa, ATUALIZE as seções 4 (Status), 12 (Decisões) e 13 (Diário).**
> (Se sua ferramenta espera outro nome, copie este arquivo para `CLAUDE.md`, `GEMINI.md` ou `.cursorrules`, mantendo o conteúdo idêntico.)

Última atualização: 2026-11-02
Fase atual: **REPLANEJAMENTO (2026-11-02): o produto é uma vitrine/marketplace de barbearias + sistema de gestão. Fase A (cobrança antes do cadastro) escrita, aguardando validação. Antes disso:** 3 — Núcleo (agenda) + telas. Painel do dono validado no navegador (login, cadastro, agenda, serviços, profissionais, horários, bloqueios; typecheck sem erros). Página pública de agendamento `/b/[slug]` escrita, aguardando validação** (ver seção 14)

---

## 1. O que é o projeto

SaaS de gestão para barbearias (multi-tenant), inspirado no BarbeiroVip (https://www.barbeirovip.com).

**Proposta:** o dono da barbearia assina o sistema (teste grátis de 7 dias) e gerencia agenda, clientes, serviços, profissionais, comissões e financeiro. O cliente final agenda online 24h por uma página pública da barbearia.

**Modelo de negócio (definido pelo dono em 2026-11-02, como no BarbeiroVip):** o barbeiro assina o plano (cartão cadastrado, 7 dias grátis, cobrança mensal a partir do 8º dia) e só então libera o cadastro de serviços e profissionais. Depois de cadastrar, a barbearia aparece na **página principal** (vitrine de cards) e ganha um **perfil público** (`/barbearia/[slug]`) com fotos, cidade, busca de serviços/produtos, botão de agendar, equipe, informações, comodidades e avaliações.

**Nome do produto:** BarbeiroPro
**Idioma do produto e do código de negócio:** português do Brasil (UI, e-mails, mensagens). Nomes técnicos de código em inglês.
**Mercado:** Brasil (moeda BRL, fuso `America/Sao_Paulo`, Pix/boleto/cartão, LGPD).

### Personas
- **Dono / Gerente:** configura a barbearia, vê financeiro e assinatura.
- **Barbeiro:** vê a própria agenda e as próprias comissões.
- **Recepção:** gerencia agenda e clientes.
- **Cliente final:** agenda pela página pública, sem criar senha.

---

## 2. Escopo

### Dentro do MVP
1. Cadastro da barbearia + trial de 7 dias
2. Login, recuperação de senha, permissões por papel
3. Serviços, profissionais, horários de trabalho e bloqueios
4. Motor de disponibilidade (`/availability`)
5. Agenda no painel
6. Página pública de agendamento (`/b/[slug]`)
7. Clientes
8. Financeiro simples (entradas/saídas) e comissões
9. Assinatura recorrente (gateway + webhook)
10. E-mails transacionais e lembretes
11. Monitoramento e backup diário
12. **Vitrine na página principal** (cards, busca por nome/cidade) e **perfil público da barbearia** (ver seção 4, Fases B–D)
13. Avaliações dos clientes

### FORA do MVP (não implementar sem autorização explícita)
PDV completo com estoque e venda online de produtos (produtos ficam só como catálogo para exibição), app nativo, WhatsApp automático, programa de fidelidade, multi-unidade, nota fiscal.

---

## 3. Stack e arquitetura

> Stack **decidida em 2026-10-30** (ver seção 12). Itens ainda marcados **(proposto)** continuam em aberto.

| Camada | Tecnologia | Situação |
|---|---|---|
| App (front + back) | Next.js 15 (App Router) + TypeScript, PWA depois | **decidido** |
| Banco | PostgreSQL 16 (Docker local; gerenciado em prod) | **decidido** |
| ORM | Prisma 6 | **decidido** |
| Auth | Próprio: bcryptjs + JWT (jose) em cookie httpOnly | **decidido** |
| Validação | Zod | **decidido** |
| Gateway de pagamento | Asaas | **decidido** |
| E-mail transacional | Resend ou Amazon SES + React Email | (proposto) |
| Erros | Sentry | (proposto) |
| Uptime | Better Stack ou UptimeRobot | (proposto) |
| Hospedagem | Vercel + banco gerenciado (ou VPS com Docker) | (proposto) |
| Backup | `pg_dump` diário → bucket S3/R2 criptografado | (proposto) |

### Princípios de arquitetura
- **Multi-tenant:** toda tabela de negócio tem `tenant_id`. Isolamento por Row Level Security e/ou filtro obrigatório na camada de dados.
- **API:** REST em `/api/v1`, validação de entrada com Zod, respostas JSON padronizadas.
- **Permissões:** checagem centralizada em um único ponto (`can(user, acao, recurso)`), nunca espalhada em `if` soltos.
- **Datas:** armazenar em UTC, exibir em `America/Sao_Paulo`. Dinheiro em **centavos (inteiro)**.
- **Webhooks:** sempre idempotentes (tabela `webhook_events` com `id_externo` único).
- **Segredos:** somente em variáveis de ambiente. Nunca no Git.
- **API Gateway dedicado:** não necessário no MVP (rate limit/CORS no próprio app ou Cloudflare).
- **Criação de agendamento:** regra única em `src/lib/appointments/create.ts` (`createAppointment`), usada pelo painel e pela página pública. Não duplicar essa lógica em rotas.

---

## 4. STATUS DO PROJETO (atualizar sempre)

Legenda: `[ ]` não iniciado · `[~]` em andamento · `[x]` concluído

### Planejamento
- [x] Análise do produto de referência
- [x] Definição de escopo do MVP
- [x] Proposta de stack
- [x] Proposta de modelo de dados
- [x] Proposta de matriz de permissões
- [x] Proposta de endpoints
- [x] Este arquivo de memória (AGENTS.md)
- [x] Confirmar stack definitiva
- [x] Definir nome do produto (BarbeiroPro)
- [ ] Definir domínio
- [x] Definir política comercial e preços da assinatura

### Redesign visual
- [x] Correção pontual dos preços em `/b/[slug]` concluída em 2026-11-07: antes da escolha do profissional, exibe preço único ou faixa dos preços efetivos; depois, mostra o valor do profissional selecionado. O cálculo do agendamento não foi alterado.
- [~] Fase 1 — Fundação visual: shells público e administrativo e componentes base implementados em 2026-11-06. Correção pontual de contraste, estados de interação e stack tipográfica nativa aplicada em 2026-11-06. `npm.cmd run typecheck -- --incremental false` e `npm.cmd run build` passaram; validação visual manual em desktop, tablet e mobile continua pendente porque o Chrome headless não iniciou a renderização gráfica nesta sessão.

### Marketplace público
- [x] Fase 1 — Consultas públicas server-side para vitrine e perfil implementadas em 2026-11-06, com paginação por cursor, filtros de nome/serviço, seleção explícita e `canTakeBookings()` sem expor assinatura. Typecheck, build e `git diff --check` passaram; validação de dados reais ainda pendente. Sem alterações em schema, migrations ou APIs.
- [x] Fase 2 — Homepage marketplace `/` implementada em 2026-11-07, com busca GET por nome/serviço, paginação cursor, cards com dados reais, loading/erro/vazio e CTA para cadastro. Typecheck, build, `git diff --check`, SSR de busca e responsividade em desktop/tablet/mobile validados. O banco local não tem barbearias publicadas, então cards e avanço de página não foram exercitados com registros reais.
- [x] Fase 3 — Perfil público `/barbearia/[slug]` implementado em 2026-11-07 com dados de `getPublicBarbershopProfile()`, preços efetivos, equipe, horários disponíveis e CTA condicionado a `bookingAllowed`; slugs sem perfil retornam 404. Typecheck, build e `git diff --check` passaram.
- [~] Validação positiva do perfil — a base local não possui barbearia publicada; CTA habilitado/desabilitado, renderização com dados reais, responsividade e navegação por teclado no perfil aguardam registro elegível.
- [x] Fase 4 — Landing comercial `/para-barbearias` implementada em 2026-11-07; apresenta somente recursos existentes, com CTAs para `/cadastro` e preço mensal configurado de R$ 79,90 após 7 dias grátis. Typecheck, build, `git diff --check`, resposta HTTP 200, links, foco de teclado e ausência de overflow em 1440 px, 768 px e 390 px validados.

### Fundação (Semana 1)
- [x] Repositório criado e estrutura de pastas
- [ ] Ambientes (dev / staging / prod)
- [x] `.env.example`
- [x] Banco: schema, migration `init` e SQL de RLS aplicados no Postgres local; `/api/health` e fluxos básicos validados manualmente pelo dono em 2026-10-30. Setup repetido em 2026-11-01.
- [x] Multi-tenant + RLS aplicados; constraint anti-sobreposição confirmada no PostgreSQL. Teste automatizado de isolamento em `src/lib/rls.integration.test.ts` passou, conforme validação reportada pelo dono.
- [~] Auth: registro, login, logout, `/me` e telas de login/cadastro validados pelo dono. Faltam recuperação de senha, confirmação de e-mail e rate limit nas rotas de auth (o limitador em memória existe, mas é usado nas rotas públicas).

### Núcleo (Semanas 2–4)
- [x] Permissões (RBAC): `can()` aplicado via `requireAuth()` nas rotas de serviços e profissionais; testes unitários passando, conforme validação reportada pelo dono.
- [x] CRUD de serviços: `/api/v1/services` e `/services/:id` (DELETE desativa). Typecheck validado; teste manual das rotas ainda pendente.
- [x] CRUD de profissionais: `/api/v1/professionals`, `/professionals/:id` e `PUT /professionals/:id/services`. Typecheck validado; teste manual das rotas ainda pendente.
- [x] Horários de trabalho: `GET/PUT /professionals/:id/working-hours`, com 7 testes unitários passando.
- [x] Bloqueios de horário: `GET/POST /professionals/:id/time-blocks` e `DELETE /time-blocks/:id`; POST validado manualmente.
- [x] Motor de disponibilidade: `src/lib/availability/` e `GET /api/v1/availability`; 10 testes passando e rota validada manualmente em três cenários. O slot 09:30 ausente foi atribuído a uma perda de cópia, não a bug.
- [x] Agendamentos (API): `GET/POST /appointments` e `PATCH /appointments/:id/status`; criação, listagem, confirmação e resposta `409` para horário repetido validadas manualmente.
- [x] Telas do painel: `/`, `/login`, `/cadastro`, `/painel`, `/painel/servicos`, `/painel/profissionais` e `/painel/profissionais/[id]`; login/cadastro/agenda e configuração de serviços, profissionais, horários e bloqueios validados pelo dono no navegador. Typecheck sem erros, conforme validação reportada pelo dono.
- [~] Página pública `/b/[slug]`: implementada em 2026-11-02, ainda não executada. Inclui APIs públicas para dados da barbearia, disponibilidade e agendamentos; regra de acesso por trial/assinatura, rate limit, antecedência mínima de 1h, horizonte de 60 dias e limite de 3 agendamentos futuros em aberto por telefone. Testes novos de billing/access e rate limit aguardam validação.
- [ ] CRUD de clientes

### Financeiro (Semana 5)
- [ ] Transações (entradas/saídas)
- [ ] Cálculo e listagem de comissões
- [ ] Relatórios básicos

### Cobrança (Semana 6)
- [x] Plano mensal de R$ 79,90 sem limites comerciais; checkout por cartão via Asaas disponível. Planos anual e de lançamento não estão no checkout.
- [~] Integração Asaas: customer e assinatura mensal por cartão implementados; Pix e validação em sandbox/produção ainda pendentes.
- [x] Trial grátis de 7 dias: vencimento agendado por data para garantir ao menos 168 horas desde o envio dos dados ao Asaas; painel exibe a data da primeira cobrança.
- [~] Correções de confiabilidade do checkout: reserva local por tenant, referência estável para recuperação, serialização da criação de assinatura e estado pendente após timeout/falha local; migrations `20261108170000_trial_and_cancellation_access` e `20261108193000_billing_reliability` aplicadas somente no PostgreSQL local `localhost:5432/barbearia`, sem reset, em 2026-11-08.
- [x] Idempotência do customer Asaas: reserva transacional por tenant, busca por `externalReference`, persistência do ID antes da assinatura e reconciliação fail-closed em timeout/listagem ambígua; sem nova migration.
- [x] Webhooks Asaas persistidos por evento e processados com lock transacional; eventos sem vínculo ficam pendentes, pagamento confirmado sem `dueDate` exige consulta confiável e a corrida de `upsert` para o mesmo evento recupera a linha criada pela requisição vencedora. Testes PostgreSQL reais cobrem duplicidade concorrente, evento anterior ao vínculo, vencimento e corrida com checkout/cancelamento; a suíte completa passou (17 arquivos/124 testes), com todas as chamadas ao Asaas mockadas.
- [x] Validação local de billing (2026-11-08): PostgreSQL Docker `localhost:5432/barbearia` confirmado; `prisma validate`, `prisma migrate status` (4 migrations, schema em dia), typecheck, build, `git diff --check` e a suíte completa passaram. A execução padrão no sandbox ainda falha ao carregar Vitest/esbuild por acesso a `../..`, mas a mesma suíte foi executada integralmente com acesso autorizado ao ambiente local. `prisma generate` não foi necessário nesta etapa porque o schema não mudou. Nenhuma chamada real ao Asaas ou acesso à produção.
- [x] Etapa 7.1.1 — cliente Asaas bloqueia requisições locais sem a URL Sandbox oficial e chave com prefixo `$aact_hmlg_`; configuração inválida falha antes do `fetch`, centralmente para checkout, cancelamento, consultas e recuperação. Configuração pública de produção mantém o fluxo atual. Os 17 testes focados passaram via Vitest inline com `fetch` mockado; o comando padrão continua bloqueado pelo esbuild ao acessar `../..`. Typecheck e diff-check passaram; nenhuma chamada ao Asaas, escrita no banco ou credencial real. Sandbox real ainda não validado.
- [~] Etapa 7.2.1 — pré-verificações retomadas em 2026-11-09; checkout não executado. O loader oficial `@next/env`, em processo limpo, carregou `ASAAS_API_KEY` sem exibir o valor; o prefixo Sandbox e a URL `https://api-sandbox.asaas.com/v3` são válidos, e o token de webhook está presente separadamente. Isso confirma o carregamento atual do `.env`, mas não comprova que o processo Next.js já em execução foi reiniciado com essa configuração. A guarda central contra produção está ativa. Consulta local somente de leitura confirmou PostgreSQL `localhost:5432/barbearia`, `costabarber` como único tenant (`ACTIVE`) com uma associação `OWNER`, e assinatura `PENDING_PAYMENT` sem IDs remotos ou reserva de checkout; a associação não comprova sessão OWNER ativa, que não pôde ser verificada sem sessão de navegador acessível. Um único GET de leitura ao endpoint de webhooks Sandbox falhou com `TypeError`, sem status HTTP; não houve retry. A configuração do webhook na conta autenticada permanece sem confirmação. Nenhum checkout, pagamento, escrita no banco ou acesso à produção.
- [x] Controle de acesso no painel, escritas e agendamento público usa `canTakeBookings()`; cancelamento confirmado usa o prazo `accessEndsAt` e atraso mantém tolerância de 5 dias.
- [x] Tela de assinatura no painel permite cancelar a renovação e informa o prazo de acesso resultante.

### Operação (Semanas 7–8)
- [ ] E-mails transacionais
- [ ] Lembrete de agendamento 24h antes (job)
- [ ] Monitoramento (Sentry + uptime + `/api/health`)
- [ ] Backup diário + teste de restauração
- [ ] Testes, revisão de segurança e LGPD
- [ ] Deploy de produção
- [ ] Beta com 3–5 barbearias

---

## 5. Modelo de dados (proposto)

Fonte da verdade: `prisma/schema.prisma` (a tabela abaixo é resumo). Têm `tenant_id` todas as tabelas de negócio. RLS ativo em: professionals, services, professional_services, working_hours, time_blocks, clients, appointments, transactions, commissions, audit_logs. **Sem RLS de propósito:** users, tenants, memberships, subscriptions, plans, webhook_events (acessadas por login/cobrança/webhook em código de servidor).

Diferenças em relação ao resumo: comissão é `commission_bps` (basis points, 3000 = 30%); `working_hours`, `time_blocks`, `professional_services` e `commissions` também têm `tenant_id` (para o RLS); `appointments.status` usa `SCHEDULED/CONFIRMED/COMPLETED/CANCELED/NO_SHOW` e `appointments.source` usa `PANEL/ONLINE`.

| Tabela | Campos principais |
|---|---|
| tenants | id, nome, slug (único), telefone, endereço, status, trial_ends_at |
| users | id, nome, email (único), auth_id |
| memberships | user_id, tenant_id, role (`owner`, `manager`, `barber`, `reception`) |
| professionals | tenant_id, user_id, nome, comissao_percent, ativo |
| services | tenant_id, nome, duracao_min, preco_centavos, ativo |
| professional_services | professional_id, service_id, preco_custom_centavos |
| working_hours | professional_id, dia_semana, inicio, fim, intervalo_inicio, intervalo_fim |
| time_blocks | professional_id, inicio, fim, motivo |
| clients | tenant_id, nome, telefone, email, observacoes |
| appointments | tenant_id, client_id, professional_id, service_id, inicio, fim, status, origem, preco_centavos |
| transactions | tenant_id, tipo (`entrada`/`saida`), categoria, valor_centavos, forma_pagamento, appointment_id, data |
| commissions | appointment_id, professional_id, valor_centavos, status (`pendente`/`paga`) |
| plans | nome, preco_centavos, limite_profissionais, limite_agendamentos |
| subscriptions | tenant_id, plan_id, status, gateway_customer_id, gateway_subscription_id, current_period_end |
| webhook_events | id_externo (único), provider, payload, processado_em |
| audit_logs | tenant_id, user_id, acao, entidade, antes, depois |

**Status de `appointments`:** `agendado`, `confirmado`, `concluido`, `cancelado`, `faltou`
**Origem de `appointments`:** `online`, `painel`

**Regras críticas:**
- Índice em `appointments (professional_id, inicio)`.
- Impedir sobreposição de horários do mesmo profissional (constraint de exclusão ou transação com lock).
- RLS por `tenant_id` em todas as tabelas de negócio.

---

## 6. Permissões (RBAC)

| Ação | Dono | Gerente | Barbeiro | Recepção |
|---|---|---|---|---|
| Assinatura e plano | ✅ | ❌ | ❌ | ❌ |
| Financeiro completo | ✅ | ✅ | ❌ | ❌ |
| Serviços e profissionais | ✅ | ✅ | ❌ | ❌ |
| Agenda de todos | ✅ | ✅ | só a própria | ✅ |
| Clientes | ✅ | ✅ | ✅ | ✅ |
| Ver comissões | ✅ | ✅ | só as próprias | ❌ |

Cliente final não tem conta: agenda com nome + telefone (e, se preciso, código por e-mail).

---

## 7. API (proposta)

Base: `/api/v1`

```
POST  /auth/register | /auth/login | /auth/logout | /auth/forgot-password
CRUD  /services
CRUD  /professionals
GET/PUT /professionals/:id/working-hours
GET/POST /professionals/:id/time-blocks
DELETE /time-blocks/:id
CRUD  /clients
GET/POST /appointments
PATCH /appointments/:id/status
GET   /availability?professionalId=&serviceId=&date=YYYY-MM-DD
GET   /public/:slug
GET   /public/:slug/availability?professionalId=&serviceId=&date=YYYY-MM-DD
POST  /public/:slug/appointments
GET/POST /transactions
GET   /commissions?from=&to=
GET   /subscription
POST  /subscription/checkout
POST  /subscription/cancel
POST  /webhooks/asaas
GET   /health
```

### Regras do `/availability`
Cruza: horário de trabalho do profissional + intervalos + `time_blocks` + agendamentos existentes + duração do serviço. Retorna slots livres.
Implementação atual em `/api/v1/availability` exige login; a versão pública está em `/api/v1/public/:slug/availability`.

### Regras da API pública
- Sem login; identifica a barbearia pelo `slug`. Retorna 404 para slug inexistente e 403 `BOOKING_UNAVAILABLE` quando trial/assinatura não permite novos agendamentos (`canTakeBookings`).
- Disponibiliza apenas serviços e profissionais ativos com horário de trabalho e ao menos um serviço ativo.
- O agendamento público não aceita `clientId`; a resposta de confirmação não expõe telefone nem dados de cadastro.
- Limites atuais: 60 requisições/min para informações, 120/min para horários, 10 agendamentos/hora por IP e 5/hora por telefone.
- Disponibilidade pública exige antecedência mínima de 60 minutos e limita datas aos próximos 60 dias.
- Cada telefone pode manter no máximo 3 agendamentos futuros em aberto.

---

## 8. Assinatura e cobrança

- Produto: BarbeiroPro. Um plano, sem limites comerciais.
- Mensal padrão: R$ 79,90 (7.990 centavos).
- Anual: R$ 718,80 (71.880 centavos), equivalente a R$ 59,90/mês.
- Lançamento: R$ 49,90 para os primeiros 20 estabelecimentos; duração e critérios da oferta ainda precisam ser definidos.
- Trial grátis de 7 dias, sem cobrança durante o teste.
- Pagamento por Pix ou cartão de crédito, com renovação mensal ou anual pelo Asaas.
- Ciclo: `trialing` (7 dias) → `active` → `past_due` (tolerância de 5 dias) → `canceled`.
- Em `past_due`: aviso no painel. Após os 5 dias de tolerância: modo somente leitura (**nunca apagar dados**).
- Após cancelamento, os dados são preservados.
- Webhook: validar token/assinatura → gravar em `webhook_events` (idempotente) → responder 200 rápido → processar → atualizar `subscriptions`.
- Eventos tratados: pagamento confirmado, pagamento em atraso, assinatura cancelada.
- A página pública usa `src/lib/billing/access.ts` (`canTakeBookings`) para bloquear tenant suspenso, trial vencido, assinatura cancelada ou atraso além da tolerância de 5 dias. Ao implementar webhooks, `current_period_end` em `past_due` deve representar o vencimento não pago.

### E-mails transacionais
Confirmação de cadastro · recuperação de senha · agendamento confirmado · lembrete 24h · trial acabando (dia 5 e 7) · pagamento falhou · recibo.
Domínio com SPF, DKIM e DMARC configurados.

---

## 9. Variáveis de ambiente

Mantenha `.env.example` atualizado (sem valores reais).

```env
NODE_ENV=
APP_URL=
DATABASE_URL=
DIRECT_DATABASE_URL=
AUTH_SECRET=
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_BASE_URL=
RESEND_API_KEY=
EMAIL_FROM=
SENTRY_DSN=
CRON_SECRET=
BACKUP_BUCKET=
BACKUP_ACCESS_KEY=
BACKUP_SECRET_KEY=
```

Chaves separadas para dev, staging e produção.

---

## 10. Monitoramento e backup

- Sentry (front e back), uptime em `/api/health` (testa o banco), logs estruturados.
- Alertas: falha de webhook, falha de e-mail, erro de cobrança, backup falhou.
- Métricas de negócio: novos trials, conversão trial→pago, cancelamentos.
- Backup: `pg_dump` diário às 03:00, comprimido e **criptografado**, enviado ao bucket. Retenção: 7 diários, 4 semanais, 3 mensais. **Testar restauração 1x por mês.**

---

## 11. REGRAS PARA QUALQUER IA / DEV

1. **Leia este arquivo inteiro antes de agir** e confira a seção 4 para saber onde o projeto está.
2. **Não invente escopo.** Se algo não está na seção 2 (dentro do MVP), pergunte antes.
3. **Não mude a stack** sem registrar a decisão na seção 12.
4. **Não trabalhe em itens fora de ordem** sem motivo; siga as fases da seção 4.
5. **Segurança primeiro:** nunca commitar segredos, sempre validar entrada, sempre filtrar por `tenant_id`.
6. **Dinheiro em centavos, datas em UTC.**
7. **Migrations versionadas;** nunca alterar o banco "na mão".
8. **Webhooks idempotentes,** sempre.
9. **Escreva testes** para: disponibilidade, permissões, webhook, cálculo de comissão.
10. **Ao terminar uma tarefa:** marque o item na seção 4, registre decisões na seção 12 e adicione uma linha no diário (seção 13).
11. Se este arquivo estiver desatualizado em relação ao código, **o código vence**: corrija o arquivo.
12. Em dúvida entre duas abordagens, escolha a mais simples que funcione no MVP e anote o débito técnico na seção 14.

---

## 12. Registro de decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-30 | Produto multi-tenant, MVP enxuto sem marketplace/PDV completo | Validar rápido com barbearias reais |
| 2026-10-30 | Gateway de pagamento definido: Asaas (Pix e cartão de crédito; renovação mensal ou anual) | Foco no mercado brasileiro e política comercial definida pelo usuário |
| 2026-10-30 | Sem API Gateway dedicado no MVP | Complexidade desnecessária |
| 2026-10-30 | Dinheiro em centavos; datas em UTC | Evitar erros de arredondamento e fuso |

| 2026-10-30 | Stack confirmada: Next.js 15 + Prisma 6 + PostgreSQL 16 | Um único projeto, tipado, rápido para o MVP |
| 2026-10-30 | Auth próprio (bcryptjs + JWT/jose em cookie httpOnly, 7 dias) | Sem dependência de vendor; controle total do multi-tenant |
| 2026-10-30 | App roda com role `app_user` (não superuser); migrations com `postgres` (`DIRECT_DATABASE_URL`) | Superuser ignora RLS |
| 2026-10-30 | Comissão em basis points (inteiro) | Evita decimais |
| 2026-10-30 | Exclusion constraint (btree_gist) impede agendamentos sobrepostos por profissional | Garantia no banco, não só no código |
| 2026-10-30 | Sessão guarda 1 tenant (o primeiro ativo) | Simplifica o MVP; troca de barbearia fica para depois |
| 2026-10-30 | Nome do produto: BarbeiroPro | Definição de marca informada pelo usuário |
| 2026-10-30 | Política comercial: plano único sem limites; mensal R$ 79,90, anual R$ 718,80, lançamento R$ 49,90 para os primeiros 20 estabelecimentos; trial de 7 dias; Pix/cartão via Asaas; tolerância de 5 dias; dados preservados após cancelamento | Preços e condições informados pelo usuário; duração e critérios da oferta de lançamento ainda serão definidos |
| 2026-10-30 | DELETE de serviços e profissionais desativa o registro (`active=false`); PUT de horários e serviços do profissional substitui a lista inteira | Preservar referências históricas e simplificar a atualização completa pelo painel |
| 2026-11-01 | Constraint de sobreposição usa `tsrange` com os campos PostgreSQL `TIMESTAMP` do Prisma | `tstzrange` exigia conversão dependente de timezone, não imutável para índice GiST |
| 2026-11-01 | Disponibilidade calculada sob demanda; passo padrão de 30 minutos a partir da abertura | Evitar persistência e sincronização de slots; manter o passo configurável no futuro |
| 2026-11-01 | Motor de disponibilidade implementado como função pura `computeSlots`, separado do acesso ao banco | Testar a lógica sem banco e reutilizá-la na página pública |
| 2026-11-01 | Fuso fixo `America/Sao_Paulo`, com conversão via `Intl` em `availability/tz.ts` | Evitar cálculos manuais de offset; considerar fuso por tenant se houver operação em outras regiões |
| 2026-11-01 | Profissional só oferece serviços associados em `professional_services` | Evitar disponibilizar serviço que o profissional não realiza |
| 2026-11-01 | Escrita de agenda por barbeiro limitada ao profissional associado ao próprio `userId`, via `assertAgendaWrite` | Restringir barbeiros à própria agenda; vínculo profissional-usuário por convite ainda não existe |
| 2026-11-01 | `POST /appointments` aceita somente horário retornado por `getAvailableSlots`; constraint de exclusão do banco protege contra corridas simultâneas e retorna `409 SLOT_UNAVAILABLE` | Validar disponibilidade e manter a integridade mesmo com requisições concorrentes |
| 2026-11-01 | Agendamento aceita `clientId` ou dados `client{name, phone}`; telefone é normalizado para dígitos e reutiliza cliente existente do tenant | Evitar duplicidade de clientes sem permitir referência entre tenants |
| 2026-11-01 | Estados finais de agendamento (`COMPLETED`, `CANCELED`, `NO_SHOW`) não permitem transições posteriores | Preservar a integridade do histórico |
| 2026-11-01 | Concluir agendamento ainda não cria transação nem comissão | Cálculos financeiros ficam para a Semana 5 e exigem testes próprios |
| 2026-11-01 | Front-end inicial usa componentes client-side que chamam a API interna; `/painel` é protegido no layout de servidor | Reutilizar as regras existentes na API e impedir acesso anônimo ao painel |
| 2026-11-01 | Interface inicial usa CSS próprio e variáveis de tema, sem biblioteca de UI | Manter poucas dependências no MVP |
| 2026-11-01 | Telas de configuração ficam em `/painel/servicos`, `/painel/profissionais` e `/painel/profissionais/[id]`; navegação é exibida conforme permissões `services:manage` e `professionals:manage` | Manter gestão do catálogo e equipe acessível apenas a papéis autorizados |
| 2026-11-01 | Formulários de configuração convertem valores BRL em centavos e exibem datas/horários no formato local | Preservar a regra de dinheiro em centavos e facilitar o uso no Brasil |
| 2026-11-02 | Replanejamento do produto: o barbeiro assina antes do cadastro da barbearia e só então libera serviços/profissionais; depois de ativado, a barbearia entra na vitrine principal e ganha perfil público | Ajustar a jornada de conversão ao modelo de marketplace de barbearias e reduzir risco de cadastro sem pagamento |
| 2026-11-02 | Criação de agendamento centralizada em `createAppointment` (`src/lib/appointments/create.ts`), usada pelo painel (`source: PANEL`) e pela página pública (`source: ONLINE`) | Uma única regra de disponibilidade, conflito e preço; evitar divergência entre os fluxos |
| 2026-11-02 | Página pública: antecedência mínima de 60 minutos, horizonte de 60 dias e máximo de 3 agendamentos futuros em aberto por telefone | Reduzir agendamentos de última hora, spam e bloqueio de agenda por abuso |
| 2026-11-02 | Página pública fica indisponível quando `canTakeBookings` é falso (trial vencido, assinatura cancelada, atraso após 5 dias ou tenant suspenso) | Aplicar política comercial ao agendamento online |
| 2026-11-02 | API pública não aceita `clientId`; confirmação não devolve telefone nem dados de cadastro | Evitar exposição de identificadores internos e dados pessoais |
| 2026-11-02 | Rate limit em memória nas rotas públicas | Adequado para uma instância no MVP; trocar por Redis/Upstash em deploy com múltiplas instâncias |
| 2026-11-02 | Cliente não cancela nem remarca pela página pública; confirmação orienta contato com a barbearia | Política de cancelamento ainda será definida |
| 2026-11-06 | Fundação visual separa tema claro público e tema escuro administrativo com tokens CSS locais, sem dependências novas; `/b/[slug]` usa o tema público sem header ou footer | Preparar o redesign visual mantendo navegação, checkout e fluxo de agendamento existentes |
| 2026-11-06 | Cor de ação pública definida como `#a84e26`, com hover escurecido e foco visível; stack `system-ui` nativa adotada por não haver fonte Inter ou recurso local disponível | Atingir contraste WCAG AA sem dependências ou carregamento externo, mantendo a identidade laranja e o tema escuro administrativo |
| 2026-11-06 | Visibilidade pública baseada em tenant ativo, nome/slug válidos e associação no mesmo tenant entre profissional e serviço ativos; assinatura não filtra perfil e `canTakeBookings()` controla somente a permissão de agendar | Manter perfis vencidos/cancelados públicos sem contornar RLS ou alterar as regras de agendamento |
| 2026-11-07 | Homepage `/` usa formulário GET e a consulta `listPublicBarbershops()` para filtros/paginação server-side; CTA de proprietários aponta ao cadastro existente e o CTA de agendamento só aparece quando `bookingAllowed` | Evitar API ou JavaScript de busca novo, respeitar o gate de agendamento e não apontar para a landing ainda não criada |
| 2026-11-07 | Perfil `/barbearia/[slug]` renderiza exclusivamente `getPublicBarbershopProfile()`; `null` vira 404, assinatura não filtra o perfil e o link `/b/[slug]` só aparece quando `bookingAllowed` é verdadeiro. Intervalos internos de pausa não são exibidos | Preservar o contrato público aprovado, não revelar estado de cobrança e deixar a decisão de acesso ao agendamento no servidor |
| 2026-11-07 | Landing `/para-barbearias` apresenta recursos já implementados e o plano mensal em vigor (R$ 79,90 após 7 dias grátis); CTAs seguem para `/cadastro` | Manter a comunicação comercial alinhada ao fluxo real; valores anual e de lançamento não aparecem porque ainda não estão implementados |
| 2026-11-07 | Preço efetivo na escolha do serviço em `/b/[slug]`; mostrar faixa antes da escolha do profissional e valor individual após a seleção | Não apresentar o preço base como definitivo quando há preços personalizados; preservar `customPriceCents ?? priceCents` e o cálculo atual do agendamento |
| 2026-11-08 | O trial começa no envio dos dados do cartão ao Asaas; `nextDueDate` é o próximo dia local compatível com pelo menos 168 horas, podendo resultar em até 8 dias por ser date-only. `accessEndsAt` e `cancellationConfirmed` separam cancelamento da recorrência e fim do acesso; trial encerra imediatamente, período pago segue até seu fim e `PAST_DUE` preserva a tolerância de 5 dias | Evitar cobrança antes do prazo anunciado, bloqueio prematuro de clientes pagos e sucesso local sem confirmação do Asaas |
| 2026-11-08 | Checkout usa uma reserva transacional por tenant e `externalReference` estável para consultar e recuperar uma assinatura inconclusiva; como a referência não garante idempotência do POST no Asaas, timeout ou resultado ambíguo permanece pendente e não gera novo POST automaticamente. Webhooks bloqueiam evento e assinatura em transação, conservam eventos sem vínculo e só aplicam pagamento confirmado com `dueDate` validado/reconciliado | Evitar recorrências duplicadas e regressões concorrentes sem inventar garantia de idempotência do gateway; a migration local ainda precisa ser validada e aplicada antes da execução da nova rota |
| 2026-11-08 | Migrations de trial/cancelamento e confiabilidade de billing aplicadas exclusivamente no PostgreSQL Docker local (`localhost:5432/barbearia`); validação de schema, typecheck, build e diff-check concluída. A suíte Vitest não iniciou por erro de acesso do esbuild; Prisma generate encontrou `EPERM` ao substituir a DLL do engine, mas os tipos locais incluem todos os novos campos | Registrar a validação local sem inferir cobertura de testes nem validar chamadas reais ao Asaas; manter os testes de billing pendentes até execução em ambiente compatível |
| 2026-11-08 | Customer Asaas é reservado por tenant antes do POST, consultado por `externalReference` e persistido antes da criação da assinatura; resultado remoto incerto permanece pendente, duplicidade ou listagem incompleta exige reconciliação. Checkout e cancelamento compartilham estados e verificam cancelamento pendente sob lock | Evitar customer duplicado/órfão e associação divergente entre customer e assinatura, sem alteração de schema, migrations, APIs ou política comercial |
| 2026-11-08 | A configuração do Vitest não foi alterada; a execução padrão no sandbox falha quando esbuild precisa acessar `../..`, mas a suíte completa passou no mesmo Windows com acesso autorizado. WSL não foi confirmado porque a enumeração retornou acesso negado | Não mascarar a restrição nem alterar a configuração para contorná-la; executar testes somente em contexto autorizado |
| 2026-11-08 | Testes PostgreSQL de billing usam rotas e Prisma reais, mocks em todas as fronteiras Asaas e limpeza por IDs aleatórios; webhook concorrente recupera a linha persistida após conflito `P2002` no `upsert` | Validar locks e recuperação sem efeitos externos e manter idempotência sob entregas simultâneas, sem alterar schema, migrations, script Vitest ou regras comerciais |
| 2026-11-08 | Em desenvolvimento, testes e `APP_URL` local, o cliente Asaas exige `https://api-sandbox.asaas.com/v3` e chave com prefixo `$aact_hmlg_`; configuração ausente, malformada, desconhecida ou incompatível falha antes da rede. Não há fallback automático. Com `NODE_ENV=production` e `APP_URL` público, o fluxo e as variáveis existentes de produção permanecem sem alteração; chaves legadas continuam aceitas nesse caminho | Impedir que checkout, cancelamento ou consultas locais atinjam produção sem impor nova variável nem formato de credencial à produção existente |
| 2026-11-08 | A Etapa 7.2.1 exige confirmação local da URL/chave Sandbox, token de webhook separado da mesma conta e tenant/dados de teste antes de qualquer escrita ou chamada de checkout; se qualquer item não puder ser comprovado, a execução para sem tentar o Sandbox | Evitar operações externas ou registros persistentes em ambiente ou conta não confirmados |
| 2026-11-08 | A auditoria pré-checkout pode fazer consultas locais somente de leitura; nenhum checkout, escrita ou chamada remota ocorre antes da apresentação do plano e autorização explícita. A confirmação da mesma conta do webhook precisa vir do painel Sandbox, e a escolha do tenant autorizado cabe ao proprietário | Evitar que dois tenants estruturalmente elegíveis sejam confundidos e não tratar o HTTP 200 de um evento `TEST` como prova de assinatura criada |
| 2026-11-08 | Limpeza autorizada somente no PostgreSQL local: remover `costabarber-2` pelo ID confirmado após buscar pelo slug exato, usando `Tenant.delete` em transação serializável; cascatas esperadas limitadas à associação e assinatura pendente sem IDs Asaas. Preservar usuários, dados globais e `costabarber` | Remover apenas o tenant de teste duplicado depois de conferir o banco e todas as relações |
| 2026-11-09 | Etapa 7.2.1: `@next/env` carregou a chave sem revelar valor, com prefixo Sandbox esperado e URL oficial; token do webhook presente e separado. O ambiente do processo Next.js já ativo não foi comprovado. Tenant local `costabarber` é o único, ACTIVE, com uma associação OWNER e assinatura PENDING_PAYMENT sem vínculo remoto; sessão OWNER ativa não pôde ser verificada. Um único GET de leitura a `/webhooks` falhou com `TypeError` sem status HTTP; sem retry, não se confirmou a configuração do webhook na conta autenticada. Nenhum checkout, pagamento, escrita no banco ou acesso à produção | Evitar checkout sem configuração efetiva no processo, sessão OWNER e conta Sandbox verificadas
_(Adicione novas linhas no fim, sempre com data.)_

---

## 13. Diário de sessões

| Data | Quem | O que foi feito | Próximo passo |
|---|---|---|---|
| 2026-10-30 | Claude | Análise do produto de referência, definição de escopo, stack, modelo de dados, permissões, API, cronograma. Criado este AGENTS.md. | Confirmar stack e nome; criar repositório e fundação (Semana 1) |

| 2026-10-30 | Claude | Criado projeto base (`package.json`, `tsconfig`, Docker Postgres, `.env.example`), `schema.prisma` completo, SQL de RLS + constraint anti-sobreposição, `withTenant()`, auth (register/login/logout/me), `can()` + testes, `/api/health`. **Sem acesso à internet na sessão: `npm install`, typecheck, testes e migrations NÃO foram rodados.** | Rodar `npm install`, `npm run typecheck`, `npm test`, `npm run db:setup` e corrigir o que falhar; depois testar register/login via curl |
| 2026-10-30 | Codex | Registrado o nome BarbeiroPro e a política comercial; atualizados `README.md`, título e metadados do app. Sincronizados `CLAUDE.md` e `GEMINI.md` com a fonte de verdade. | Validar a Fundação; depois implementar catálogo e cobrança Asaas. Definir domínio e regras restantes da oferta de lançamento |
| 2026-10-30 | Claude | Segundo o registro fornecido pelo dono, Fundação validada manualmente (registro, login, `/me` e health); escritos CRUD de serviços e profissionais, associação de serviços, horários, schemas Zod e testes de RLS/horários. Código da Semana 2 ainda sem execução confirmada. | Rodar typecheck e testes; executar as rotas e o teste de integração de RLS; implementar API de bloqueios e disponibilidade |
| 2026-11-01 | Copilot | Corrigido `rls_and_constraints.sql` para usar `tsrange`; migration inicial executada e SQL aplicado. Verificados a constraint `appointments_no_overlap` e RLS forçado nas tabelas consultadas. | Validar typecheck, testes unitários, integração RLS e rotas da Semana 2 |
| 2026-11-01 | Claude | Conforme validação reportada pelo dono, typecheck e 17 testes passaram, incluindo teste real de isolamento RLS; CRUDs de serviços, profissionais e horários validados. Escritos API de bloqueios, motor de disponibilidade (`computeSlots`, fuso e acesso ao banco), rota `GET /availability`, `assertAgendaWrite` e testes do motor. Lógica do motor conferida diretamente no Node; novos testes Vitest e rotas ainda não executados pelo dono. | Validar `npm run typecheck`, `npm test` e `GET /api/v1/availability`; depois implementar criação de agendamento com checagem anti-conflito |
| 2026-11-01 | Claude | Dono validou typecheck e 27 testes; validou serviços, profissional, horários, vínculo, bloqueio e disponibilidade. Implementados `GET/POST /appointments`, `PATCH /appointments/:id/status`, regras de transição, schemas e teste de integração da constraint anti-sobreposição (incluindo concorrência). | Validar manualmente os endpoints; investigar o slot 09:30; depois implementar telas da agenda ou avançar para clientes/financeiro |
| 2026-11-01 | Claude | Dono validou criação de agendamento com cliente novo, preço e horário UTC, listagem, confirmação, `409` ao repetir horário e disponibilidade em três cenários; o slot 09:30 faltante foi perda de cópia, não bug. Escritas landing, login, cadastro e painel com agenda diária, novo agendamento e mudança de status; telas ainda sem validação. | Rodar typecheck e abrir `/cadastro`, `/login` e `/painel`; depois criar telas de serviços/profissionais/horários e avançar para financeiro/comissões |
| 2026-11-01 | Claude | Dono validou no navegador login, agendamento, confirmação, logout e cadastro de nova conta. Escritas telas de configuração de serviços e profissionais, detalhe com associação de serviços/preço, horários e bloqueios, e navegação por permissões; typecheck e execução dessas telas ainda pendentes. | Rodar `npm run typecheck`; criar serviço e profissional numa conta de teste e validar horários/bloqueios; depois avançar para financeiro/comissões e página pública |
| 2026-11-01 | Claude | Dono validou typecheck sem erros e telas de configuração em conta nova (serviço → profissional → serviços/horários/bloqueio → agenda). Corrigidos avisos explicativos, carregamento e acentuação na agenda. | Implementar página pública de agendamento |
| 2026-11-02 | Claude | Implementada página pública `/b/[slug]`, com `createAppointment` compartilhado, APIs públicas de informações/disponibilidade/agendamento, controle por trial/assinatura, rate limit e fluxo de seleção até confirmação. Testes unitários de billing/access e rate limit adicionados; typecheck, Vitest e fluxo público ainda não executados. | Rodar `npm run typecheck` e `npm test`; validar `/b/<slug>` em desktop/mobile e revalidar agendamento pelo painel após refatoração; depois CRUD de clientes e financeiro/comissões |
| 2026-11-02 | Copilot | Atualizada a memória do projeto com o novo replanejamento: produto vira vitrine/marketplace de barbearias + SaaS de gestão, com cobrança antes do cadastro e perfil público da barbearia. Mantém o núcleo do painel validado e registra o próximo foco em vitrine, perfil público e validação da jornada de conversão. | Validar a Fase A (assinatura antes do cadastro), implementar a vitrine principal e o perfil público, sem perder o alinhamento com o painel já validado. |
| 2026-11-06 | Codex | Implementados tokens e estilos responsivos, shells público e administrativo, navegação lateral e componentes UI base. Mantidos o fluxo de checkout e o booking sem header/footer; nenhuma API, regra de negócio ou banco alterado. TypeScript e build passaram; Vitest não iniciou porque esbuild recebeu acesso negado ao diretório `../..`; testes de integração não executados para evitar escrita no banco. | Validar visualmente desktop/tablet/mobile e executar Vitest em ambiente que permita carregar a configuração; depois seguir para as próximas páginas públicas mediante aprovação |
| 2026-11-06 | Codex | Ajustados contraste de ações públicas, hover, foco e estados desativados em `src/app/globals.css`; adotada stack `system-ui` porque Inter e recursos locais para carregá-la não existem no projeto. Tema laranja do dashboard preservado. `npm.cmd run typecheck -- --incremental false`, `npm.cmd run build` e `git diff --check` passaram. | Repetir auditoria visual em navegador com renderização disponível; validar as telas autenticadas e o booking quando banco e sessão de teste estiverem acessíveis |
| 2026-11-06 | Codex | Criado `src/lib/public/marketplace.ts` com consultas server-side de listagem cursor-paginada e perfil por slug; filtros de nome/serviço; associação e RLS validados no escopo de `withTenant()`; preço personalizado aplicado; assinatura reduzida a `bookingAllowed`. Typecheck e build passaram; nenhum teste de banco executado. | Validar consultas em banco existente sem escrita; implementar páginas públicas somente após autorização explícita |
| 2026-11-07 | Codex | Substituído o placeholder de `/` por marketplace em `src/app/page.tsx`, `src/components/public/MarketplaceExperience.tsx` e `MarketplaceExperience.module.css`. Reutilizados shell público, campos, botões e estados UI. Filtros GET por nome/serviço, cards com campos públicos, links de perfil e agendamento condicional, paginação cursor, skeleton, erro e vazio. Typecheck/build/diff-check passaram; Chrome confirmou layout sem overflow em desktop/tablet/mobile e SSR retornou 200 para busca por nome/serviço. A base local não tem estabelecimentos publicados, então paginação/card com registros não foram testados. | Aguardar autorização para perfil e landing; validar cards e paginação com dados reais elegíveis quando disponíveis |
| 2026-11-07 | Codex | Criados `src/app/barbearia/[slug]/page.tsx`, `src/components/public/BarbershopProfile.tsx` e `BarbershopProfile.module.css`, reutilizando shell/tokens e `getPublicBarbershopProfile()`. Serviços exibem faixa de preços efetivos; profissionais, vínculos de serviços e horários públicos; CTA para `/b/[slug]` depende de `bookingAllowed`. Typecheck/build/diff-check passaram; slugs inválido e válido sem registro responderam 404. A base local não tem perfil publicado; fluxo positivo, teclado e CTA não puderam ser exercitados com perfil real. | Aguardar perfil publicado real para a validação positiva; implementar `/para-barbearias` somente após autorização |
| 2026-11-07 | Codex | Criados `src/app/para-barbearias/page.tsx`, `src/components/public/ForBarbersLanding.tsx` e `ForBarbersLanding.module.css`. Página comercial reaproveita `PublicShell`, apresenta agenda, catálogo/equipe e agendamento online, informa o fluxo de 7 dias grátis e R$ 79,90/mês e direciona para o cadastro; sem dados, depoimentos ou recursos inventados. Typecheck, build, diff-check e rota HTTP 200 passaram; Chrome em desktop/tablet/mobile confirmou ausência de overflow e foco por teclado visível. | Aguardar autorização para a próxima fase |
| 2026-11-07 | Codex | Corrigida a apresentação de preços em `src/components/BookingClient.tsx`: valores iguais mostram um preço; valores efetivos diferentes mostram uma faixa; após escolher profissional, mostra o preço efetivo dele. Typecheck, build e diff-check passaram; cenários de preços iguais, diferentes, profissional selecionado e fallback ao preço base passaram com dados em memória. Estilos responsivos e foco visível existentes foram preservados; a base local não tem barbearia publicada para validar o fluxo completo no navegador. | Aguardar autorização para a próxima etapa |
| 2026-11-08 | Codex | Implementadas datas seguras de trial, estado local de cancelamento e fim de acesso (`accessEndsAt`, `cancellationConfirmed`), cancelamento no Asaas com erro pendente explícito, preservação do período pago e tolerância `PAST_DUE`, tratamento de webhooks fora de ordem e mensagens de trial/cancelamento em cadastro, checkout, landing e painel. Adicionada migration, não aplicada. Typecheck, build, `prisma validate` e `git diff --check` passaram; Vitest não iniciou por bloqueio de acesso do esbuild a `../..`; geração do Prisma tentou substituir engine DLL bloqueada, mas tipos locais já continham os campos. Nenhuma operação real no Asaas ou banco. | Validar migration e fluxos em ambiente local/sandbox com casos próximos à meia-noite, cancelamentos e webhooks; sem aplicar em produção |
| 2026-11-08 | Codex | Implementadas reserva local e recuperação conservadora do checkout (`src/app/api/v1/subscription/checkout/route.ts`, `src/lib/billing/checkout-recovery.ts`), locks compartilhados com cancelamento, processamento transacional de webhooks (`src/lib/billing/webhook-processor.ts`) e consulta de pagamento confirmado sem `dueDate`. Adicionados campos e migration `20261108193000_billing_reliability`, sem aplicação; copy sobre remoção de cobrança pendente foi mantida após conferência da documentação oficial do Asaas. Typecheck, build, `prisma validate` e `git diff --check` passaram. Vitest focado não iniciou por `Acesso negado` do esbuild ao diretório `../..`; sem migration, geração Prisma, dados locais de billing ou chamadas reais ao Asaas. | Validar os locks e recuperação com a migration em banco local e cenários de timeout/duplicidade; rodar testes e sandbox Asaas em ambiente autorizado |
| 2026-11-08 | Codex | Validado o histórico das quatro migrations e aplicadas localmente `20261108170000_trial_and_cancellation_access` e `20261108193000_billing_reliability` no banco PostgreSQL Docker `localhost:5432/barbearia`, sem reset. `prisma validate`, typecheck, build (segunda execução sequencial) e `git diff --check` passaram; `migrate status` confirmou banco atualizado e as declarações do Prisma Client contêm `accessEndsAt`, `cancellationConfirmed` e os três campos de checkout. Vitest não iniciou: esbuild negou acesso a `../..`; `prisma generate` falhou ao renomear `query_engine-windows.dll.node` com `EPERM`, sem processo Node visível na inspeção. Nenhuma operação no Asaas nem acesso à produção. | Reexecutar testes de billing em ambiente onde Vitest/esbuild carregue a configuração; destravar e concluir `prisma generate`; só então decidir sobre sandbox. Auditoria estática também observou que a criação do customer Asaas antecede a reserva de checkout, permitindo customer duplicado/orfão em concorrência/falha; não causa nova assinatura por si só, mas pede proteção idempotente futura |
| 2026-11-08 | Codex | Etapa 6.1: checkout reserva o customer por tenant, recupera pelo `externalReference` Asaas e só segue a assinatura com o ID persistido; POST incerto fica pendente e resultados duplicados/incompletos exigem reconciliação. Cancelamento bloqueia durante claims ativos de customer/assinatura; o checkout respeita solicitação de cancelamento em curso. Criados `src/lib/billing/customer-recovery.ts` e testes concorrentes/de recuperação; ajustados checkout, cancelamento, cliente Asaas e testes de webhook. `prisma generate`, `prisma validate`, typecheck, build e diff-check passaram; 14 arquivos de teste unitário (99 testes) passaram via API inline do Vitest. `npm test` padrão continua bloqueado porque o esbuild não pode enumerar `../..`; testes de integração que escrevem no banco foram excluídos. A causa do EPERM anterior não foi confirmada; `prisma generate` passou sem alteração de permissões ou remoção de arquivos. Sem chamadas ao Asaas ou alterações no banco nesta etapa. | Rodar o comando padrão do Vitest em ambiente que permita a enumeração exigida pelo esbuild; concluir a preparação do sandbox Asaas depois da validação completa |
| 2026-11-08 | Codex | Etapa 6.2: adicionados 13 testes PostgreSQL em `src/lib/billing/postgres.integration.test.ts`, chamando as rotas reais e mantendo todas as operações Asaas mockadas. Cobertos claims simultâneos, isolamento de tenants, recuperação após timeouts, checkout/cancelamento concorrentes, webhooks pendentes/duplicados, vencimento e retries de cancelamento. A concorrência real revelou `P2002` possível no `upsert` de webhook; `src/lib/billing/webhook-processor.ts` agora recupera a linha já criada pela requisição concorrente e processa sob o lock existente. Suíte completa: 17 arquivos/124 testes aprovados; `prisma validate`, migration status (4 migrations em dia), typecheck, build e diff-check passaram. O container e banco eram locais; fixtures aleatórias foram limpas por IDs e não houve chamadas ao Asaas, migrations, reset, produção ou deploy. A suíte padrão foi bloqueada no sandbox, mas passou em execução autorizada; WSL não foi confirmado porque a enumeração retornou acesso negado. | Aguardar autorização para a Etapa 7 — validação com sandbox Asaas |
| 2026-11-08 | Codex | Etapa 7.1.1: centralizada em `src/lib/billing/asaas.ts` a validação de ambiente antes do `fetch`; desenvolvimento/testes e `APP_URL` loopback exigem URL Sandbox oficial e chave `$aact_hmlg_`. Configuração ausente, malformada, endpoint desconhecido ou chave incompatível não alcança a rede. Criados testes de configuração e de todos os métodos exportados; atualizada `docs/ASAAS.md` com URL e requisito local. 17 testes focados passaram via Vitest inline, todos com `fetch` mockado; o comando padrão falhou antes de carregar testes por `Acesso negado` do esbuild ao diretório `../..`. Typecheck e `git diff --check` passaram. Nenhuma chamada ao Asaas, uso de credencial real, escrita no banco ou mudança em produção. | Configurar credenciais Sandbox atuais fora do repositório e aguardar autorização antes da Etapa 7.2 |
| 2026-11-08 | Codex | Iniciada a auditoria pré-checkout da Etapa 7.2.1. Git inicial registrado e alterações locais preservadas. A inspeção sem revelar segredos confirmou `APP_URL` e `DATABASE_URL` em localhost, mas não encontrou `ASAAS_BASE_URL`, `ASAAS_API_KEY` ou `ASAAS_WEBHOOK_TOKEN` na configuração efetiva; por isso não foi possível provar a conta Sandbox nem prosseguir à inspeção de tenant. Nenhuma consulta ao Asaas, leitura de tenants, escrita no banco ou checkout foi realizada. | Configurar URL/chave/token Sandbox fora do Git, confirmar pelo painel que pertencem à mesma conta e então retomar a validação do tenant de teste |
| 2026-11-08 | Codex | Retomada da Etapa 7.2.1: configuração local validada sem exibir segredos (ambiente `development`, URL oficial Sandbox, prefixo de chave Sandbox, token distinto e banco local). Revisados cliente Asaas, checkout e webhook. Consultas locais somente de leitura encontraram dois tenants `CostaBarber` ativos, cada um com membro `OWNER`, assinatura `PENDING_PAYMENT` sem IDs remotos e sem dados operacionais; nenhum pôde ser identificado como o tenant autorizado. Há um evento Asaas `TEST` processado, sem referência a assinatura; ele não alterou assinatura local. Não houve chamada ao Asaas/túnel, checkout, escrita no banco, alteração de código ou operação de produção; worktree local foi preservado. | Proprietário deve escolher o slug autorizado, confirmar no painel que o webhook está na mesma conta Sandbox da chave e autorizar explicitamente o primeiro checkout controlado |
| 2026-11-08 | Codex | Limpeza local autorizada: confirmados `DATABASE_URL` e `DIRECT_DATABASE_URL` em `localhost:5432/barbearia`, container PostgreSQL 16 local e conexão Prisma da aplicação como `app_user`. A inspeção do slug exato `costabarber-2` encontrou apenas um `OWNER` e uma assinatura `PENDING_PAYMENT` sem vínculo Asaas; demais relações e tabelas `tenant_id` sem registros. Removido pelo Prisma em transação serializável, com verificação de ID e slug; apenas a associação e a assinatura foram apagadas em cascata. Verificação pós-commit confirmou que `costabarber` (ID `68a2d93f-b7e8-485a-91da-66725071a31d`) não mudou, o usuário global foi preservado, planos e webhooks permaneceram iguais e restou somente `costabarber`. Nenhuma chamada externa ou alteração no Asaas. | Manter o tenant restante; seguir com a Etapa 7.2.1 apenas após confirmar no painel Sandbox que chave e webhook pertencem à mesma conta e obter autorização para o checkout |
| 2026-11-09 | Codex | Retomada da Etapa 7.2.1: lidos `AGENTS.md` e `docs/ASAAS.md`; Git inicial/final preservado. Configuração conferida sem imprimir segredos: `.env` aponta ao PostgreSQL local `localhost:5432/barbearia`, `APP_URL` loopback, URL oficial Sandbox e token separado; o loader do Next.js, porém, não disponibiliza a chave API porque seu valor começa por `$` sem escape. Revisada a proteção central, que bloqueia billing local sem URL/chave válidas. Consulta Prisma somente de leitura confirmou `costabarber` como único tenant, ACTIVE, com uma associação OWNER, assinatura PENDING_PAYMENT e sem IDs remotos/reserva. Associação OWNER não comprovou sessão autenticada. Um GET somente leitura a `/webhooks` foi tentado no Sandbox usando a chave lida em memória, mas falhou com `TypeError` sem resposta; sem retry, não foram consultados customers/assinaturas, não se confirmou a conta do webhook nem estado remoto. Nenhum POST, checkout ou escrita no banco. | Ajustar a configuração local fora do chat, comprovar a sessão OWNER e verificar o webhook/assinatura via Sandbox; revalidar tudo antes de um POST único. |
| 2026-11-09 | Codex | Retomadas as pré-verificações da Etapa 7.2.1. `@next/env` confirmou carregamento da chave com prefixo Sandbox e URL oficial, sem expor credenciais; token separado presente. Consulta local somente de leitura confirmou tenant `costabarber` único, OWNER associado e assinatura pendente sem vínculos remotos. A sessão autenticada não foi verificável. Foi feita uma consulta GET ao Sandbox para listar webhooks; falhou com `TypeError` sem status HTTP, sem retry. A configuração remota do webhook e sua associação à mesma conta da chave permanecem pendentes. Nenhum checkout, pagamento ou escrita no banco; produção não consultada. Worktree preexistente preservado; somente esta atualização autorizada do `AGENTS.md` foi feita | Confirmar sessão OWNER e webhook na conta Sandbox; checkout segue aguardando autorização operacional explícita |
_(Uma linha por sessão de trabalho. Seja específico: arquivos criados, o que ficou pendente.)_

---

## 14. Débitos técnicos e pendências abertas

- [ ] **PRIORIDADE:** rodar `npm run typecheck` e `npm test`; validar `/b/<slug>` de ponta a ponta (incluindo `409`, rate limit `429` e bloqueio após trial vencido) e revalidar agendamento pelo painel após a refatoração para `createAppointment`
- [ ] Executar teste de integração da constraint anti-sobreposição (inclui concorrência); os fluxos de criação/listagem/confirmação e `409` foram validados manualmente
- [ ] Vincular profissional a usuário (convite) para barbeiros enxergarem só a própria agenda
- [ ] Painel: sem seleção de barbearia, visão semanal ou atualização em tempo real
- [ ] UX: cada bloco da tela do profissional salva separado; avaliar aviso de alterações não salvas
- [ ] Revisar textos antigos das telas de login/cadastro, que ainda estão sem acentos
- [ ] Agendamentos: falta `GET /appointments/:id` e reagendamento
- [ ] Página pública: definir política de cancelamento/remarcação; adicionar link de privacidade; avaliar opção “qualquer profissional”; tratar slugs reservados
- [ ] Rate limit em memória funciona por instância; migrar para Redis/Upstash em implantação multi-instância. Aplicar também em `/auth/login` e `/auth/register` (anti brute-force)
- [ ] Proteção CSRF além de `sameSite=lax` (revisar antes do beta)
- [ ] Rotas de escrita ainda não bloqueiam operações quando a assinatura está `past_due`/`canceled` (implementar na Semana 6)
- [ ] Em produção, trocar a senha do `app_user` (SQL tem senha de dev)
- [ ] Definir domínio do produto
- [ ] Formalizar duração e critérios da oferta de lançamento (R$ 49,90 para os 20 primeiros estabelecimentos)
- [ ] Adaptar o modelo `Plan` para representar o plano sem limites (`maxProfessionals` atualmente é obrigatório)
- [ ] Política de privacidade e termos de uso (LGPD) a redigir

---

## 15. Glossário

- **Tenant:** uma barbearia cliente do SaaS.
- **Slot:** horário livre disponível para agendamento.
- **Trial:** período de teste grátis de 7 dias.
- **Past due:** assinatura com pagamento em atraso.
- **RBAC:** controle de acesso por papel.
- **RLS:** Row Level Security, isolamento de dados por linha no PostgreSQL.
