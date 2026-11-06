SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at;
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'SubscriptionStatus' ORDER BY e.enumsortorder;
SELECT column_default FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'status';
