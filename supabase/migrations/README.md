# Supabase migrations

Put ordered SQL migration files in this directory (for example `202610200001_initial_schema.sql`). The coding agent must create the actual schema, constraints, indexes, RLS policies and server-authoritative functions here.

Do not treat this README as a database implementation. Apply migrations to a development project first, test RLS and concurrency, then apply them to production using a documented process. Never put credentials in migration files.
