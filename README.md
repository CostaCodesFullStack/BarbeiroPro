# BarbeiroPro

SaaS de gestao para barbearias (multi-tenant). **Leia `AGENTS.md` primeiro**: ele tem escopo, status e regras.

## Rodando localmente

Requisitos: Node 20+ e Docker.

```bash
cp .env.example .env
# gere o segredo e cole em AUTH_SECRET:
openssl rand -base64 48

npm install
npm run db:setup      # sobe o Postgres, roda as migrations e aplica RLS + constraints
npm run typecheck
npm test
npm run dev
```

## Testando a API

```bash
# health
curl localhost:3000/api/health

# cadastro (cria barbearia + trial de 7 dias e ja loga)
curl -i -c cookies.txt -X POST localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Joao","email":"joao@teste.com","password":"senha12345","barbershopName":"Barbearia do Joao","slug":"barbearia-do-joao"}'

# quem sou eu
curl -b cookies.txt localhost:3000/api/v1/me

# login / logout
curl -c cookies.txt -X POST localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@teste.com","password":"senha12345"}'
curl -b cookies.txt -X POST localhost:3000/api/v1/auth/logout
```

## Convencoes
- Dinheiro em centavos, datas em UTC.
- Consultas a tabelas de negocio SEMPRE dentro de `withTenant(tenantId, tx => ...)`.
- Permissoes SEMPRE via `requireAuth("acao:recurso")`.
