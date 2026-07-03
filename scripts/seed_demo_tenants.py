import os
import sys
import uuid
import bcrypt
from datetime import datetime

# Add apps/backend to sys.path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), "../apps/backend"))

from app.database import SessionLocal
from app import models

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def seed_data():
    db = SessionLocal()
    print("Database session initialized. Seeding demo tenants...")

    try:
        # Check if we have already seeded (to prevent duplication)
        existing_tenant = db.query(models.Tenant).filter(models.Tenant.name == "Organic Feeds Ltd").first()
        if existing_tenant:
            print("Demo tenants are already seeded. Skipping seeding.")
            return

        # ==============================================================================
        # 1. Tenant A: Organic Feeds Ltd (Product-based Retail)
        # ==============================================================================
        print("\nCreating Tenant A: Organic Feeds Ltd...")
        tenant_a = models.Tenant(
            id=uuid.UUID("a0000000-0000-0000-0000-000000000000"),
            name="Organic Feeds Ltd",
            industry="Agricultural Retail",
            description="Premium organic feed, seeds, and farm supply supplier.",
            tone_preferences={"tone": "Friendly, direct, focus on stock count details"},
            general_policies="Delivery is $15 flat rate. Standard return policy within 14 days on dry, unopened bags."
        )
        db.add(tenant_a)
        
        # User A: Owner
        user_a = models.User(
            id=uuid.UUID("a1111111-1111-1111-1111-111111111111"),
            tenant_id=tenant_a.id,
            email="owner@organicfeeds.com",
            password_hash=hash_password("password123"),
            first_name="Mercy",
            last_name="Munzenzi",
            role="owner"
        )
        db.add(user_a)

        # Business State Items A: Stock type items
        bs_a1 = models.BusinessStateItem(
            id=uuid.UUID("a2222222-2222-2222-2222-222222222221"),
            tenant_id=tenant_a.id,
            name="50kg Organic Chicken Feed",
            item_type="stock",
            current_value="42",
            data_type="integer",
            confirmed_by="whatsapp_checkin"
        )
        bs_a2 = models.BusinessStateItem(
            id=uuid.UUID("a2222222-2222-2222-2222-222222222222"),
            tenant_id=tenant_a.id,
            name="25kg High-Protein Pig Feed",
            item_type="stock",
            current_value="8",
            data_type="integer",
            confirmed_by="dashboard_edit"
        )
        bs_a3 = models.BusinessStateItem(
            id=uuid.UUID("a2222222-2222-2222-2222-222222222223"),
            tenant_id=tenant_a.id,
            name="Maize Seeds premium blend",
            item_type="stock",
            current_value="115",
            data_type="integer",
            confirmed_by="onboarding"
        )
        bs_a4 = models.BusinessStateItem(
            id=uuid.UUID("a2222222-2222-2222-2222-222222222224"),
            tenant_id=tenant_a.id,
            name="Organic Feed Delivery Fee",
            item_type="rate",
            current_value="15",
            data_type="decimal",
            confirmed_by="dashboard_edit"
        )
        db.add_all([bs_a1, bs_a2, bs_a3, bs_a4])

        # Customer A1
        cust_a1 = models.Customer(
            id=uuid.UUID("a3333333-3333-3333-3333-333333333331"),
            tenant_id=tenant_a.id,
            name="Amara (Farmer)",
            phone_number="+254711111111",
            preferences={"delivery_required": True}
        )
        # Customer A2
        cust_a2 = models.Customer(
            id=uuid.UUID("a3333333-3333-3333-3333-333333333332"),
            tenant_id=tenant_a.id,
            name="John Kamau",
            phone_number="+254722222222",
            preferences={"prefers_whatsapp": True}
        )
        db.add_all([cust_a1, cust_a2])
        db.flush() # Flush to generate relationships for conversations

        # Conversation A1: Resolved WhatsApp
        conv_a1 = models.Conversation(
            id=uuid.UUID("a4444444-4444-4444-4444-444444444441"),
            tenant_id=tenant_a.id,
            customer_id=cust_a1.id,
            channel="whatsapp",
            status="resolved"
        )
        db.add(conv_a1)
        db.flush()

        msg_a1_in = models.Message(
            id=uuid.UUID("a5555555-5555-5555-5555-555555555511"),
            tenant_id=tenant_a.id,
            conversation_id=conv_a1.id,
            direction="inbound",
            sender_type="customer",
            message_text="Do you have 50kg chicken feed in stock?",
            resolution_type="auto_resolved"
        )
        msg_a1_out = models.Message(
            id=uuid.UUID("a5555555-5555-5555-5555-555555555512"),
            tenant_id=tenant_a.id,
            conversation_id=conv_a1.id,
            direction="outbound",
            sender_type="ai_agent",
            message_text="Yes! We currently have 42 bags of 50kg Organic Chicken Feed in stock at our main warehouse. We also offer delivery for a $15 flat rate.",
            confidence_score=0.98,
            resolution_type="auto_resolved"
        )
        db.add_all([msg_a1_in, msg_a1_out])

        # Conversation A2: Escalated WhatsApp
        conv_a2 = models.Conversation(
            id=uuid.UUID("a4444444-4444-4444-4444-444444444442"),
            tenant_id=tenant_a.id,
            customer_id=cust_a2.id,
            channel="whatsapp",
            status="escalated"
        )
        db.add(conv_a2)
        db.flush()

        msg_a2_in = models.Message(
            id=uuid.UUID("a5555555-5555-5555-5555-555555555521"),
            tenant_id=tenant_a.id,
            conversation_id=conv_a2.id,
            direction="inbound",
            sender_type="customer",
            message_text="I bought pig feed yesterday but it looks damp. Can I get a refund?",
            resolution_type="escalated_to_human"
        )
        msg_a2_draft = models.Message(
            id=uuid.UUID("a5555555-5555-5555-5555-555555555522"),
            tenant_id=tenant_a.id,
            conversation_id=conv_a2.id,
            direction="outbound",
            sender_type="ai_agent",
            message_text="[Drafted] I understand you have a concern with the feed quality. I am transferring you directly to our store owner Mercy to resolve this refund right away.",
            confidence_score=0.45,
            resolution_type="escalated_to_human"
        )
        db.add_all([msg_a2_in, msg_a2_draft])

        # ==============================================================================
        # 2. Tenant B: Apex Law Partners (Service-based Legal)
        # ==============================================================================
        print("Creating Tenant B: Apex Law Partners...")
        tenant_b = models.Tenant(
            id=uuid.UUID("b0000000-0000-0000-0000-000000000000"),
            name="Apex Law Partners",
            industry="Legal Services",
            description="Corporate, real estate, and civil litigation services.",
            tone_preferences={"tone": "Professional, formal, clear intake requirements"},
            general_policies="Consultation intake requires business name. Initial consultations are up to 60 mins."
        )
        db.add(tenant_b)
        
        # User B: Owner
        user_b = models.User(
            id=uuid.UUID("b1111111-1111-1111-1111-111111111111"),
            tenant_id=tenant_b.id,
            email="owner@apexlaw.com",
            password_hash=hash_password("password123"),
            first_name="Mercy",
            last_name="Legal",
            role="owner"
        )
        db.add(user_b)

        # Business State Items B: Availability and rates
        bs_b1 = models.BusinessStateItem(
            id=uuid.UUID("b2222222-2222-2222-2222-222222222221"),
            tenant_id=tenant_b.id,
            name="New Client Consultation Intake",
            item_type="availability",
            current_value="Accepting new clients",
            data_type="boolean",
            confirmed_by="whatsapp_checkin"
        )
        bs_b2 = models.BusinessStateItem(
            id=uuid.UUID("b2222222-2222-2222-2222-222222222222"),
            tenant_id=tenant_b.id,
            name="Corporate Consultation Hourly Rate",
            item_type="rate",
            current_value="250",
            data_type="decimal",
            confirmed_by="dashboard_edit"
        )
        bs_b3 = models.BusinessStateItem(
            id=uuid.UUID("b2222222-2222-2222-2222-222222222223"),
            tenant_id=tenant_b.id,
            name="Next available corporate consult date",
            item_type="custom",
            current_value="Monday, July 6",
            data_type="string",
            confirmed_by="onboarding"
        )
        db.add_all([bs_b1, bs_b2, bs_b3])

        # Customer B1
        cust_b1 = models.Customer(
            id=uuid.UUID("b3333333-3333-3333-3333-333333333331"),
            tenant_id=tenant_b.id,
            name="Sarah Jenkins (SaaS founder)",
            email="sarah@saasstartup.io",
            preferences={"needs_nda": True}
        )
        # Customer B2
        cust_b2 = models.Customer(
            id=uuid.UUID("b3333333-3333-3333-3333-333333333332"),
            tenant_id=tenant_b.id,
            name="David Vance",
            phone_number="+15555551234",
            preferences={"urgent": True}
        )
        db.add_all([cust_b1, cust_b2])
        db.flush()

        # Conversation B1: Resolved Email
        conv_b1 = models.Conversation(
            id=uuid.UUID("b4444444-4444-4444-4444-444444444441"),
            tenant_id=tenant_b.id,
            customer_id=cust_b1.id,
            channel="email",
            status="resolved"
        )
        db.add(conv_b1)
        db.flush()

        msg_b1_in = models.Message(
            id=uuid.UUID("b5555555-5555-5555-5555-555555555511"),
            tenant_id=tenant_b.id,
            conversation_id=conv_b1.id,
            direction="inbound",
            sender_type="customer",
            message_text="Are you accepting new clients for contract drafting and what are your rates?",
            resolution_type="auto_resolved"
        )
        msg_b1_out = models.Message(
            id=uuid.UUID("b5555555-5555-5555-5555-555555555512"),
            tenant_id=tenant_b.id,
            conversation_id=conv_b1.id,
            direction="outbound",
            sender_type="ai_agent",
            message_text="Yes, Apex Law Partners is currently accepting new clients for corporate services. Our consultation rate is $250/hour, and our next available session is Monday, July 6.",
            confidence_score=0.96,
            resolution_type="auto_resolved"
        )
        db.add_all([msg_b1_in, msg_b1_out])

        # Conversation B2: Escalated WhatsApp
        conv_b2 = models.Conversation(
            id=uuid.UUID("b4444444-4444-4444-4444-444444444442"),
            tenant_id=tenant_b.id,
            customer_id=cust_b2.id,
            channel="whatsapp",
            status="escalated"
        )
        db.add(conv_b2)
        db.flush()

        msg_b2_in = models.Message(
            id=uuid.UUID("b5555555-5555-5555-5555-555555555521"),
            tenant_id=tenant_b.id,
            conversation_id=conv_b2.id,
            direction="inbound",
            sender_type="customer",
            message_text="My business is being sued by a former contractor. I need a trial attorney immediately.",
            resolution_type="escalated_to_human"
        )
        msg_b2_draft = models.Message(
            id=uuid.UUID("b5555555-5555-5555-5555-555555555522"),
            tenant_id=tenant_b.id,
            conversation_id=conv_b2.id,
            direction="outbound",
            sender_type="ai_agent",
            message_text="[Drafted] This sounds like an urgent litigation issue. Our litigation lead is being notified of this immediately to review your details and schedule an emergency call.",
            confidence_score=0.35,
            resolution_type="escalated_to_human"
        )
        db.add_all([msg_b2_in, msg_b2_draft])

        # Commit all entities!
        db.commit()
        print("\nDatabase seeded successfully!")
        print("Tenant A Owner User: owner@organicfeeds.com (pwd: password123)")
        print("Tenant B Owner User: owner@apexlaw.com (pwd: password123)")

    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        print(f"Error seeding database: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
