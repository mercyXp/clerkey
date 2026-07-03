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
    tenant_name: Optional[str] = None  # To fetch actual workspace details on load
    industry: Optional[str] = None     # To capture actual tenant metadata on load
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Token Schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    tenant_id: uuid.UUID
    role: str

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class TokenData(BaseModel):
    email: Optional[str] = None
    tenant_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
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
    item_type: str = Field(..., max_length=100)  # 'stock', 'availability', 'rate', 'custom'
    current_value: str = Field(...)
    data_type: str = "string"  # 'integer', 'boolean', 'decimal', 'string'
    confirmed_by: str = "onboarding"

    @classmethod
    def validate_value_type(cls, item_type: str, current_value: str, data_type: str) -> None:
        """
        Enforce lightweight validation so value formats align with their categories/data_types.
        """
        val_strip = current_value.strip()
        
        # 1. Validate based on standard system item_types
        if item_type == "stock":
            # Stock must parse as a solid integer count
            try:
                int(val_strip)
            except ValueError:
                raise ValueError("A 'stock' type item must have a valid integer count (e.g., '42').")
        
        elif item_type == "availability":
            # Availability should represent a clean boolean status or plain state
            lower_val = val_strip.lower()
            if lower_val not in ["true", "false", "yes", "no", "available", "unavailable", "accepting clients", "fully booked"]:
                raise ValueError("An 'availability' item must be a clean state flag (e.g., 'yes', 'no', 'available', 'true', 'false').")
                
        elif item_type == "rate":
            # Rates must represent standard decimal pricing models
            try:
                # Strip out any currency markers for pure parsing verification
                clean_num = val_strip.replace("$", "").replace("€", "").replace("£", "").strip()
                float(clean_num)
            except ValueError:
                raise ValueError("A 'rate' type item must parse as a valid numerical price or rate (e.g., '150.00').")

        # 2. Check schema-hinting compliance
        if data_type == "integer":
            try:
                int(val_strip)
            except ValueError:
                raise ValueError(f"Value '{current_value}' does not match specified type 'integer'.")
        elif data_type == "boolean":
            if val_strip.lower() not in ["true", "false", "yes", "no", "1", "0"]:
                raise ValueError(f"Value '{current_value}' does not match specified type 'boolean'.")
        elif data_type == "decimal":
            try:
                clean_num = val_strip.replace("$", "").replace("€", "").replace("£", "").strip()
                float(clean_num)
            except ValueError:
                raise ValueError(f"Value '{current_value}' does not match specified type 'decimal'.")

class BusinessStateItemCreate(BusinessStateItemBase):
    pass

class BusinessStateItemUpdate(BaseModel):
    current_value: Optional[str] = None
    confirmed_by: Optional[str] = "dashboard_edit"

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
