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
- [~] Plano único sem limites comerciais: política definida; cadastro e cobrança pendentes
- [ ] Integração com gateway (criar customer + assinatura)
- [~] Trial grátis de 7 dias sem cobrança: política definida; controle de assinatura pendente. A página pública já verifica o vencimento do trial via `canTakeBookings`.
- [ ] Webhook de pagamento (idempotente)
- [ ] Middleware de status da assinatura (`trialing/active/past_due/canceled`) para o painel
- [ ] Tela de assinatura no painel

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
