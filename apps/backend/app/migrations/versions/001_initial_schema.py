"""Initial database schema with pgvector and tenant isolation

Revision ID: 001
Revises: 
Create Date: 2026-07-03 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable necessary extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"vector\"")

    # 1. tenants
    op.create_table(
        'tenants',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('industry', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tone_preferences', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('general_policies', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('role', sa.String(length=50), server_default='owner', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_users_tenant_id', 'users', ['tenant_id'], unique=False)
    op.create_index('idx_users_email', 'users', ['email'], unique=True)

    # 3. customers
    op.create_table(
        'customers',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('phone_number', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('preferences', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_customers_tenant_id', 'customers', ['tenant_id'], unique=False)
    # Conditional unique indexes for multi-tenant customer scoping
    op.execute(
        "CREATE UNIQUE INDEX idx_cust_phone_tenant ON customers (tenant_id, phone_number) WHERE phone_number IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX idx_cust_email_tenant ON customers (tenant_id, email) WHERE email IS NOT NULL"
    )

    # 4. conversations
    op.create_table(
        'conversations',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_conversations_tenant_id', 'conversations', ['tenant_id'], unique=False)
    op.create_index('idx_conversations_customer_id', 'conversations', ['customer_id'], unique=False)

    # 5. messages
    op.create_table(
        'messages',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('direction', sa.String(length=20), nullable=False),
        sa.Column('sender_type', sa.String(length=50), nullable=False),
        sa.Column('message_text', sa.Text(), nullable=False),
        sa.Column('raw_payload', sa.JSON(), nullable=True),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('resolution_type', sa.String(length=50), nullable=True),
        sa.Column('confidence_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_messages_tenant_id', 'messages', ['tenant_id'], unique=False)
    op.create_index('idx_messages_conversation_id', 'messages', ['conversation_id'], unique=False)
    # HNSW index for messages embedding
    op.execute(
        "CREATE INDEX idx_messages_vector ON messages USING hnsw (embedding vector_cosine_ops)"
    )

    # 6. business_state_items
    op.create_table(
        'business_state_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('item_type', sa.String(length=100), nullable=False),
        sa.Column('current_value', sa.Text(), nullable=False),
        sa.Column('data_type', sa.String(length=50), server_default='string', nullable=False),
        sa.Column('last_confirmed_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('confirmed_by', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_business_state_items_tenant_id', 'business_state_items', ['tenant_id'], unique=False)
    op.create_index('idx_bs_items_tenant_name', 'business_state_items', ['tenant_id', 'name'], unique=True)

    # 7. corrections
    op.create_table(
        'corrections',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('inbound_query', sa.Text(), nullable=False),
        sa.Column('ai_draft', sa.Text(), nullable=False),
        sa.Column('human_correction', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_corrections_tenant_id', 'corrections', ['tenant_id'], unique=False)
    # HNSW index for corrections embedding
    op.execute(
        "CREATE INDEX idx_corrections_vector ON corrections USING hnsw (embedding vector_cosine_ops)"
    )

    # 8. channel_connections
    op.create_table(
        'channel_connections',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('channel_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='disconnected', nullable=False),
        sa.Column('credentials', sa.LargeBinary(), nullable=False),
        sa.Column('config', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_channel_connections_tenant_id', 'channel_connections', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_table('channel_connections')
    op.drop_table('corrections')
    op.drop_table('business_state_items')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('customers')
    op.drop_table('users')
    op.drop_table('tenants')
