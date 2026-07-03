# Clerkey — Data Model

This document outlines the detailed database schema for Clerkey.
The database is built on PostgreSQL (ApsaraDB for PostgreSQL locally and in production), and includes support for `pgvector` to enable semantic search over past conversation history and human corrections.

---

## 1. Multi-Tenant Isolation Rule

Every table holding tenant-specific data **must** have a non-nullable `tenant_id` column.
All queries must filter on this column to ensure strict tenant-level isolation.
No cross-tenant joins or queries are allowed in the application code.

---

## 2. Entity Relationship Diagram (Conceptual)

```
 [tenants]
   │
   ├───(1:N)───> [users] (owners and staff)
   ├───(1:N)───> [customers]
   ├───(1:N)───> [conversations] ────(1:N)────> [messages] (with embedding vector)
   ├───(1:N)───> [business_state_items]
   ├───(1:N)───> [corrections] (with embedding vector)
   └───(1:N)───> [channel_connections]
```

---

## 3. Detailed Schema Specification

### 3.1 `tenants`
Stores the business profile, tone/policy preferences, and general settings.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier for the tenant |
| `name` | VARCHAR(255) | NOT NULL | Business name |
| `industry` | VARCHAR(100) | NOT NULL | Industry category (e.g., retail, legal, consulting) |
| `description` | TEXT | | Brief overview of what the business does |
| `tone_preferences` | JSONB | DEFAULT '{}'::jsonb | Guidelines for AI replies (e.g., "formal", "friendly", "concise") |
| `general_policies` | TEXT | | General rules (e.g., return policy, consult duration) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

### 3.2 `users`
Accounts belonging to business owners or staff.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier for the user |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login credential |
| `password_hash`| VARCHAR(255) | NOT NULL | Bcrypt-hashed password |
| `first_name` | VARCHAR(100) | | First name |
| `last_name` | VARCHAR(100) | | Last name |
| `role` | VARCHAR(50) | NOT NULL DEFAULT 'owner' | Authorization role ('owner', 'staff', 'admin') |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

### 3.3 `customers`
Profiles of end customers messaging the business.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `name` | VARCHAR(255) | | Customer name (if known) |
| `phone_number` | VARCHAR(50) | | WhatsApp/SMS number (nullable if email-only) |
| `email` | VARCHAR(255) | | Email address (nullable if WhatsApp-only) |
| `preferences` | JSONB | DEFAULT '{}'::jsonb | Discovered customer preferences (e.g., contact hours) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation timestamp |

*Note: Unique constraints on customer identifiers are scoped per tenant (`tenant_id, phone_number` or `tenant_id, email`).*

---

### 3.4 `conversations`
Represents an ongoing interaction thread with an end customer.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `customer_id` | UUID | REFERENCES customers(id) ON DELETE CASCADE, NOT NULL | Linked customer |
| `channel` | VARCHAR(50) | NOT NULL | Ingestion source ('whatsapp', 'email', 'instagram') |
| `status` | VARCHAR(50) | NOT NULL DEFAULT 'active' | Thread status ('active', 'escalated', 'resolved') |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Thread start timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last message timestamp |

---

### 3.5 `messages`
The individual messages flowing back and forth within a conversation.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `conversation_id`| UUID | REFERENCES conversations(id) ON DELETE CASCADE, NOT NULL | Linked conversation |
| `direction` | VARCHAR(20) | NOT NULL | 'inbound' (from customer) or 'outbound' (to customer) |
| `sender_type` | VARCHAR(50) | NOT NULL | 'customer', 'ai_agent', 'human_owner' |
| `message_text` | TEXT | NOT NULL | Cleaned text body |
| `raw_payload` | JSONB | | Exact payload received from / sent to the channel API |
| `embedding` | vector(1536) | | Semantic vector representation of the message text (pgvector) |
| `resolution_type`| VARCHAR(50) | | 'auto_resolved', 'escalated_to_human', 'human_approved' |
| `confidence_score`| NUMERIC(3, 2) | | Model's confidence score for auto-replies |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Ingestion/sending timestamp |

---

### 3.6 `business_state_items`
Represents anything that can go stale about a business (stock, availability, capacity, pricing).
This table uses a single generalized format to handle multiple industry domains.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `name` | VARCHAR(255) | NOT NULL | Fact name (e.g., '50kg maize bags', 'new client intake', 'hourly rate') |
| `item_type` | VARCHAR(100) | NOT NULL | Category classification ('stock', 'availability', 'rate', 'custom') |
| `current_value` | TEXT | NOT NULL | Stored representation of current state (as raw text or JSON string to support quantity, boolean, or price/text values without needing separate columns per type) |
| `data_type` | VARCHAR(50) | NOT NULL DEFAULT 'string' | Schema hinting for representation ('integer', 'boolean', 'decimal', 'string') |
| `last_confirmed_at`| TIMESTAMP | NOT NULL, DEFAULT NOW() | Timestamp of last manual reconfirmation |
| `confirmed_by` | VARCHAR(100) | NOT NULL | 'onboarding', 'dashboard_edit', 'whatsapp_checkin' |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Row creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Row update timestamp |

---

### 3.7 `corrections`
Captures historical instances where a human edited or rejected an AI-drafted reply.
These drafts and their edited counterparts are vector-indexed to allow semantic retrieval, enabling the reasoning agent to "learn" from its mistakes.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `inbound_query` | TEXT | NOT NULL | The customer query that triggered the draft |
| `ai_draft` | TEXT | NOT NULL | The original draft prepared by the agent |
| `human_correction`| TEXT | NOT NULL | The final, edited response sent by the owner |
| `embedding` | vector(1536) | | Semantic vector representing the query + draft (pgvector) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Time of correction |

---

### 3.8 `channel_connections`
Credentials and status for connected messaging networks.

| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | REFERENCES tenants(id) ON DELETE CASCADE, NOT NULL | Tenant scoping |
| `channel_type` | VARCHAR(50) | NOT NULL | 'whatsapp', 'email', 'instagram' , 'Facebook'|
| `status` | VARCHAR(50) | NOT NULL DEFAULT 'disconnected'| Connection status ('connected', 'disconnected', 'error') |
| `credentials` | BYTEA | NOT NULL | Encrypted tokens or API keys (using AES-256-GCM) |
| `config` | JSONB | DEFAULT '{}'::jsonb | Settings (e.g. phone number ID, email server port) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Row creation |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Row update |

---

## 4. Key Database Optimization & Security Constraints

1. **Unique Indexes for Multi-Tenant Scoping:**
   - Customers: `CREATE UNIQUE INDEX idx_cust_phone_tenant ON customers (tenant_id, phone_number) WHERE phone_number IS NOT NULL;`
   - Customers: `CREATE UNIQUE INDEX idx_cust_email_tenant ON customers (tenant_id, email) WHERE email IS NOT NULL;`
   - Business State Items: `CREATE UNIQUE INDEX idx_bs_items_tenant_name ON business_state_items (tenant_id, name);`

2. **Index Strategy for Isolation and Fast Retrieval:**
   - Every foreign key on `tenant_id` should be explicitly indexed:
     `CREATE INDEX idx_conversations_tenant ON conversations (tenant_id);`
     `CREATE INDEX idx_messages_tenant ON messages (tenant_id);`
     `CREATE INDEX idx_business_state_tenant ON business_state_items (tenant_id);`
     `CREATE INDEX idx_corrections_tenant ON corrections (tenant_id);`

3. **Vector Indices (pgvector):**
   - HNSW index on `messages` embedding:
     `CREATE INDEX idx_messages_vector ON messages USING hnsw (embedding vector_cosine_ops);`
   - HNSW index on `corrections` embedding:
     `CREATE INDEX idx_corrections_vector ON corrections USING hnsw (embedding vector_cosine_ops);`
