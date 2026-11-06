# AGENTS.md — Memória do Projeto

> **LEIA ESTE ARQUIVO ANTES DE QUALQUER AÇÃO.**
> Ele é a fonte única de verdade sobre o que o projeto é, o que já foi feito e o que falta fazer.
> **Ao terminar qualquer tarefa, ATUALIZE as seções 4 (Status), 9 (Decisões) e 10 (Diário).**
> (Se sua ferramenta espera outro nome, copie este arquivo para `CLAUDE.md`, `GEMINI.md` ou `.cursorrules`, mantendo o conteúdo idêntico.)

Última atualização: 2026-11-01
Fase atual: **1 — Fundação: migration e SQL de RLS aplicados; validação do app ainda pendente** (ver seção 14)

---

## 1. O que é o projeto

SaaS de gestão para barbearias (multi-tenant), inspirado no BarbeiroVip (https://www.barbeirovip.com).

**Proposta:** o dono da barbearia assina o sistema (teste grátis de 7 dias) e gerencia agenda, clientes, serviços, profissionais, comissões e financeiro. O cliente final agenda online 24h por uma página pública da barbearia.

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

### FORA do MVP (não implementar sem autorização explícita)
Marketplace, PDV completo com estoque, app nativo, WhatsApp automático, programa de fidelidade, multi-unidade, nota fiscal.

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
- [x] Banco: migration inicial gerada e aplicada via Prisma
- [~] Multi-tenant + RLS: SQL aplicado; constraint anti-sobreposição e RLS confirmados no PostgreSQL; helper `withTenant()` ainda não testado
- [~] Auth: registro, login, logout e `/me` escritos (**não testados**). Faltam: recuperação de senha, confirmação de e-mail, rate limit no login, telas de login/cadastro

### Núcleo (Semanas 2–4)
- [~] Permissões (RBAC): `can()` + testes unitários escritos (**não executados**). Falta aplicar nas rotas de negócio
- [ ] CRUD de serviços
- [ ] CRUD de profissionais
- [ ] Horários de trabalho e bloqueios
- [ ] Motor de disponibilidade
- [ ] Agenda do painel
- [ ] Página pública de agendamento
- [ ] CRUD de clientes

### Financeiro (Semana 5)
- [ ] Transações (entradas/saídas)
- [ ] Cálculo e listagem de comissões
- [ ] Relatórios básicos

### Cobrança (Semana 6)
- [~] Plano único sem limites comerciais: política definida; cadastro e cobrança pendentes
- [ ] Integração com gateway (criar customer + assinatura)
- [~] Trial grátis de 7 dias sem cobrança: política definida; controle de assinatura pendente
- [ ] Webhook de pagamento (idempotente)
- [ ] Middleware de status da assinatura (`trialing/active/past_due/canceled`)
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

Diferenças em relação ao resumo: comissão é `commission_bps` (basis points, 3000 = 30%); `working_hours`, `time_blocks`, `professional_services` e `commissions` também têm `tenant_id` (para o RLS); `appointments.status` usa `SCHEDULED/CONFIRMED/COMPLETED/CANCELED/NO_SHOW`.

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
POST  /auth/register | /auth/login | /auth/forgot-password
CRUD  /services
CRUD  /professionals
GET/PUT /professionals/:id/working-hours
CRUD  /clients
CRUD  /appointments
GET   /availability?professional=&service=&date=
GET/POST /transactions
GET   /commissions?from=&to=
GET   /subscription
POST  /subscription/checkout
POST  /subscription/cancel
GET   /public/:slug
POST  /public/:slug/appointments
POST  /webhooks/asaas
GET   /health
```

### Regras do `/availability`
Cruza: horário de trabalho do profissional + intervalos + `time_blocks` + agendamentos existentes + duração do serviço. Retorna slots livres.

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
| 2026-11-01 | Constraint de sobreposição usa `tsrange` com os campos PostgreSQL `TIMESTAMP` do Prisma | `tstzrange` exigia conversão dependente de timezone, não imutável para índice GiST |

_(Adicione novas linhas no fim, sempre com data.)_

---

## 13. Diário de sessões

| Data | Quem | O que foi feito | Próximo passo |
|---|---|---|---|
| 2026-10-30 | Claude | Análise do produto de referência, definição de escopo, stack, modelo de dados, permissões, API, cronograma. Criado este AGENTS.md. | Confirmar stack e nome; criar repositório e fundação (Semana 1) |

| 2026-10-30 | Claude | Criado projeto base (`package.json`, `tsconfig`, Docker Postgres, `.env.example`), `schema.prisma` completo, SQL de RLS + constraint anti-sobreposição, `withTenant()`, auth (register/login/logout/me), `can()` + testes, `/api/health`. **Sem acesso à internet na sessão: `npm install`, typecheck, testes e migrations NÃO foram rodados.** | Rodar `npm install`, `npm run typecheck`, `npm test`, `npm run db:setup` e corrigir o que falhar; depois testar register/login via curl |
| 2026-10-30 | Codex | Registrado o nome BarbeiroPro e a política comercial; atualizados `README.md`, título e metadados do app. Sincronizados `CLAUDE.md` e `GEMINI.md` com a fonte de verdade. | Validar a Fundação; depois implementar catálogo e cobrança Asaas. Definir domínio e regras restantes da oferta de lançamento |
| 2026-11-01 | Copilot | Corrigido `rls_and_constraints.sql` para usar `tsrange`; migration inicial executada e SQL aplicado. Verificados a constraint `appointments_no_overlap` e RLS forçado nas tabelas consultadas. | Rodar typecheck, testes e os testes de integração de auth/RLS |

_(Uma linha por sessão de trabalho. Seja específico: arquivos criados, o que ficou pendente.)_

---

## 14. Débitos técnicos e pendências abertas

- [ ] **PRIORIDADE:** validar typecheck, testes e fluxos de auth/RLS via integração; migration e SQL do banco já foram aplicados
- [ ] Rate limit em `/auth/login` e `/auth/register` (anti brute-force)
- [ ] Proteção CSRF além de `sameSite=lax` (revisar antes do beta)
- [ ] Escrever teste de integração provando que o RLS isola tenants
- [ ] Em produção, trocar a senha do `app_user` (SQL tem senha de dev)
- [ ] Definir domínio do produto
- [ ] Formalizar duração e critérios da oferta de lançamento (R$ 49,90 para os 20 primeiros estabelecimentos)
- [ ] Adaptar o modelo `Plan` para representar o plano sem limites (`maxProfessionals` atualmente é obrigatório)
- [ ] Política de privacidade e termos de uso (LGPD) a redigir
- [ ] Definir política de cancelamento de agendamento pelo cliente (prazo mínimo?)

---

## 15. Glossário

- **Tenant:** uma barbearia cliente do SaaS.
- **Slot:** horário livre disponível para agendamento.
- **Trial:** período de teste grátis de 7 dias.
- **Past due:** assinatura com pagamento em atraso.
- **RBAC:** controle de acesso por papel.
- **RLS:** Row Level Security, isolamento de dados por linha no PostgreSQL.
