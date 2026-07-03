import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field

# Tenant Schemas
class TenantBase(BaseModel):
    name: str = Field(..., max_length=255)
    industry: str = Field(..., max_length=100)
    description: Optional[str] = None
    tone_preferences: dict = Field(default_factory=dict)
    general_policies: Optional[str] = None

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    tone_preferences: Optional[dict] = None
    general_policies: Optional[str] = None

class TenantResponse(TenantBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "owner"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    tenant_name: str = Field(..., description="Used to create tenant during signup")
    industry: str = Field(..., description="Used to create tenant during signup")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    tenant_id: uuid.UUID
    role: str

class TokenData(BaseModel):
    email: Optional[str] = None
    tenant_id: Optional[uuid.UUID] = None
    role: Optional[str] = None


# Customer Schemas
class CustomerBase(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    preferences: dict = Field(default_factory=dict)

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Business State Item Schemas
class BusinessStateItemBase(BaseModel):
    name: str = Field(..., max_length=255)
    category: str = Field(..., max_length=100)  # 'stock', 'availability', 'pricing', 'capacity'
    current_value: str = Field(..., max_length=255)
    data_type: str = "string"  # 'integer', 'boolean', 'decimal', 'string'
    confirmation_source: str = "onboarding"

class BusinessStateItemCreate(BusinessStateItemBase):
    pass

class BusinessStateItemUpdate(BaseModel):
    current_value: Optional[str] = None
    confirmation_source: Optional[str] = "dashboard_edit"

class BusinessStateItemResponse(BusinessStateItemBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    last_confirmed_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Message Schemas
class MessageBase(BaseModel):
    direction: str  # 'inbound', 'outbound'
    sender_type: str  # 'customer', 'ai_agent', 'human_owner'
    message_text: str
    resolution_type: Optional[str] = None
    confidence_score: Optional[float] = None

class MessageCreate(MessageBase):
    raw_payload: Optional[dict] = None

class MessageResponse(MessageBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    conversation_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Conversation Schemas
class ConversationBase(BaseModel):
    channel: str
    status: str = "active"

class ConversationCreate(ConversationBase):
    customer_id: uuid.UUID

class ConversationResponse(ConversationBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True
