-- Rodar DEPOIS do `prisma migrate`, como usuario dono do banco (postgres).
-- Idempotente: pode ser executado varias vezes.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Role de runtime SEM superuser (superuser ignora RLS).
--    TROQUE A SENHA em producao.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- 2) Impede dois agendamentos sobrepostos para o mesmo profissional
--    (cancelados e faltas nao bloqueiam o horario).
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tsrange(start_at, end_at) WITH &&
  ) WHERE (status NOT IN ('CANCELED', 'NO_SHOW'));

-- 3) Row Level Security nas tabelas de negocio.
--    O app deve rodar cada operacao dentro de withTenant() (src/lib/db.ts),
--    que define app.tenant_id na transacao.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'professionals', 'services', 'professional_services', 'working_hours',
    'time_blocks', 'clients', 'appointments', 'transactions',
    'commissions', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = app_current_tenant())
         WITH CHECK (tenant_id = app_current_tenant())', t);
  END LOOP;
END $$;

-- Nota: users, tenants, memberships, subscriptions, plans e webhook_events
-- ficam SEM RLS de proposito: sao acessados por login, cobranca e webhooks,
-- sempre por codigo de servidor confiavel.
