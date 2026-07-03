-- Initialize Database Extensions
-- Since we are building a multi-tenant semantic memory system using pgvector,
-- we must ensure the 'vector' extension is registered and active in Postgres.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
