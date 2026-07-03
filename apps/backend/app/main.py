import uuid
import secrets
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import jwt
import bcrypt

from app import models, schemas
from app.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db, engine, Base
from app.repository import BaseRepository

# Auto-create tables in development if offline/unmigrated (Alembic is primary)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    import sys
    print(f"Warning: Could not connect to database on startup. Starting app anyway. Error: {e}", file=sys.stderr)

app = FastAPI(
    title="Clerkey API",
    description="Multi-tenant AI agent platform backend, powered by FastAPI & ApsaraDB PostgreSQL",
    version="1.0.0"
)

# Enable CORS for the dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to the dashboard URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

# Instantiate repositories to structurally enforce tenant_id scoping
tenant_repo = BaseRepository(models.Tenant)
user_repo = BaseRepository(models.User)
customer_repo = BaseRepository(models.Customer)
conversation_repo = BaseRepository(models.Conversation)
message_repo = BaseRepository(models.Message)
business_state_repo = BaseRepository(models.BusinessStateItem)
correction_repo = BaseRepository(models.Correction)
channel_connection_repo = BaseRepository(models.ChannelConnection)


# Helper Functions for Auth
def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(db: Session, tenant_id: uuid.UUID, user_id: uuid.UUID) -> str:
    """Generate a secure random refresh token, save to database, and return it."""
    token_str = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(days=30)  # Refresh token valid for 30 days
    
    db_refresh_token = models.RefreshToken(
        tenant_id=tenant_id,
        user_id=user_id,
        token=token_str,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    db.commit()
    return token_str


# Security Dependencies (Enforcing Strict Tenant Isolation)

def get_current_tenant(token: str = Depends(oauth2_scheme)) -> schemas.TokenData:
    """
    The single security chokepoint that extracts and enforces the tenant scope.
    Every protected endpoint depends on this to resolve tenant_id and user_id.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        tenant_id_str: str = payload.get("tenant_id")
        user_id_str: str = payload.get("user_id")
        role: str = payload.get("role")
        
        if email is None or tenant_id_str is None or user_id_str is None:
            raise credentials_exception
            
        tenant_id = uuid.UUID(tenant_id_str)
        user_id = uuid.UUID(user_id_str)
        
        return schemas.TokenData(
            email=email,
            tenant_id=tenant_id,
            user_id=user_id,
            role=role
        )
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception


# Endpoints

@app.get("/api/health")
def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "platform": "Clerkey Multi-Tenant AI Platform"
    }


# Auth Router Endpoints

@app.post("/api/auth/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """Sign up a new business owner, creating both the Tenant and User record."""
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )
    
    try:
        # 1. Create the Tenant
        tenant = models.Tenant(
            name=user_in.tenant_name,
            industry=user_in.industry,
            tone_preferences={"tone": "friendly", "length": "concise"},
            general_policies="Standard customer service rules apply."
        )
        db.add(tenant)
        db.flush()  # Generate tenant ID

        # 2. Create the Owner User
        hashed_password = get_password_hash(user_in.password)
        user = models.User(
            tenant_id=tenant.id,
            email=user_in.email,
            password_hash=hashed_password,
            first_name=user_in.first_name,
            last_name=user_in.last_name,
            role="owner"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during signup: {str(e)}"
        )

    # 3. Issue Tokens
    access_token = create_access_token(
        data={
            "sub": user.email,
            "tenant_id": str(user.tenant_id),
            "user_id": str(user.id),
            "role": user.role
        }
    )
    refresh_token = create_refresh_token(db, user.tenant_id, user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "tenant_id": user.tenant_id,
        "role": user.role
    }


@app.post("/api/auth/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate via OAuth2 standard form login."""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={
            "sub": user.email,
            "tenant_id": str(user.tenant_id),
            "user_id": str(user.id),
            "role": user.role
        }
    )
    refresh_token = create_refresh_token(db, user.tenant_id, user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "tenant_id": user.tenant_id,
        "role": user.role
    }


@app.post("/api/auth/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user with JSON payload."""
    user = db.query(models.User).filter(models.User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={
            "sub": user.email,
            "tenant_id": str(user.tenant_id),
            "user_id": str(user.id),
            "role": user.role
        }
    )
    refresh_token = create_refresh_token(db, user.tenant_id, user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "tenant_id": user.tenant_id,
        "role": user.role
    }


@app.post("/api/auth/refresh", response_model=schemas.Token)
def refresh_token(refresh_in: schemas.TokenRefreshRequest, db: Session = Depends(get_db)):
    """Refresh an access token using a valid, unexpired, and unrevoked refresh token."""
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == refresh_in.refresh_token,
        models.RefreshToken.revoked == False,
        models.RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token"
        )
    
    user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token no longer exists"
        )
    
    # Revoke old refresh token (one-time use rotation strategy)
    db_token.revoked = True
    db.commit()
    
    # Issue new token pair
    access_token = create_access_token(
        data={
            "sub": user.email,
            "tenant_id": str(user.tenant_id),
            "user_id": str(user.id),
            "role": user.role
        }
    )
    new_refresh_token = create_refresh_token(db, user.tenant_id, user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "tenant_id": user.tenant_id,
        "role": user.role
    }


@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: schemas.TokenData = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Get profile of the currently logged-in user, joining the active tenant metadata."""
    user = user_repo.get(db, current_user.tenant_id, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Resolve and attach the linked Tenant model details for frontend isolation matching
    tenant = tenant_repo.get(db, current_user.tenant_id, current_user.tenant_id)
    if not tenant:
        tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
        
    response_data = schemas.UserResponse.from_orm(user)
    if tenant:
        response_data.tenant_name = tenant.name
        response_data.industry = tenant.industry
    return response_data


# Business State Items Router (Strictly Scoped by tenant_id)

@app.get("/api/business-state", response_model=List[schemas.BusinessStateItemResponse])
def list_business_state_items(
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Retrieve all business-state items for the authenticated tenant."""
    return business_state_repo.list(db, current_user.tenant_id)


@app.post("/api/business-state", response_model=schemas.BusinessStateItemResponse, status_code=status.HTTP_201_CREATED)
def create_business_state_item(
    item_in: schemas.BusinessStateItemCreate,
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new business-state item for the authenticated tenant."""
    # Perform lightweight schema/type checking before creation
    try:
        schemas.BusinessStateItemBase.validate_value_type(
            item_type=item_in.item_type,
            current_value=item_in.current_value,
            data_type=item_in.data_type
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Check if item with this name already exists for tenant
    existing_item = db.query(models.BusinessStateItem).filter(
        models.BusinessStateItem.tenant_id == current_user.tenant_id,
        models.BusinessStateItem.name == item_in.name
    ).first()
    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An item named '{item_in.name}' already exists in your workspace."
        )

    return business_state_repo.create(db, current_user.tenant_id, item_in)


@app.patch("/api/business-state/{item_id}", response_model=schemas.BusinessStateItemResponse)
def update_business_state_item(
    item_id: uuid.UUID,
    item_update: schemas.BusinessStateItemUpdate,
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a specific business-state item's value and re-confirm it."""
    # Retrieve existing item to get item_type/data_type for validation
    item_model = business_state_repo.get(db, current_user.tenant_id, item_id)
    if not item_model:
        raise HTTPException(status_code=404, detail="Business state item not found")

    # If updating current_value, run type check
    if item_update.current_value is not None:
        try:
            schemas.BusinessStateItemBase.validate_value_type(
                item_type=item_model.item_type,
                current_value=item_update.current_value,
                data_type=item_model.data_type
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

    # Build update payload
    update_payload = item_update.dict(exclude_unset=True)
    update_payload["last_confirmed_at"] = datetime.utcnow()
    update_payload["updated_at"] = datetime.utcnow()
    
    item = business_state_repo.update(db, current_user.tenant_id, item_id, update_payload)
    if not item:
        raise HTTPException(status_code=404, detail="Business state item not found")
    return item


@app.delete("/api/business-state/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business_state_item(
    item_id: uuid.UUID,
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a specific business-state item for the authenticated tenant."""
    item = business_state_repo.get(db, current_user.tenant_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Business state item not found")
    
    success = business_state_repo.delete(db, current_user.tenant_id, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Business state item not found")
    return None


@app.post("/api/business-state/bulk-import", status_code=status.HTTP_201_CREATED)
def bulk_import_business_state(
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db),
    file_content: str = "" # Send CSV content as a raw string body or in payload (we can support simple JSON list or CSV file string)
):
    """Bulk import business state items using a CSV content string."""
    import csv
    import io
    
    if not file_content.strip():
        raise HTTPException(status_code=400, detail="CSV file content cannot be empty.")
    
    # Let's parse CSV safely
    f = io.StringIO(file_content.strip())
    reader = csv.DictReader(f)
    
    # Standardize columns (ignore case)
    # Expected: name, item_type, current_value, data_type (optional), confirmed_by (optional)
    fieldnames = reader.fieldnames
    if not fieldnames or "name" not in [x.lower() for x in fieldnames] or "item_type" not in [x.lower() for x in fieldnames] or "current_value" not in [x.lower() for x in fieldnames]:
        raise HTTPException(
            status_code=400,
            detail="CSV header must contain 'name', 'item_type', and 'current_value' fields."
        )
    
    # Map headers to canonical lowercase names
    headers_map = {x.lower(): x for x in fieldnames}
    
    parsed_rows = []
    errors = []
    
    # First Pass: Parse and validate all rows
    for row_idx, row in enumerate(reader, start=2):
        name = row.get(headers_map.get("name", ""))
        item_type = row.get(headers_map.get("item_type", ""))
        current_value = row.get(headers_map.get("current_value", ""))
        
        if not name or not item_type or current_value is None:
            errors.append(f"Row {row_idx}: Missing required fields ('name', 'item_type', or 'current_value').")
            continue
            
        data_type = row.get(headers_map.get("data_type", "string"), "string") or "string"
        confirmed_by = row.get(headers_map.get("confirmed_by", "csv_import"), "csv_import") or "csv_import"
        
        # Validate values
        try:
            schemas.BusinessStateItemBase.validate_value_type(
                item_type=item_type.strip(),
                current_value=current_value.strip(),
                data_type=data_type.strip()
            )
        except ValueError as e:
            errors.append(f"Row {row_idx} ({name}): {str(e)}")
            continue
            
        parsed_rows.append({
            "name": name.strip(),
            "item_type": item_type.strip(),
            "current_value": current_value.strip(),
            "data_type": data_type.strip(),
            "confirmed_by": confirmed_by.strip()
        })
            
    if errors:
        # If there are any validation errors, we do NOT perform any DB operations
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Bulk import failed validation checks.", "errors": errors}
        )
        
    # Second Pass: Perform DB operations since all validation succeeded
    created_items = []
    for r in parsed_rows:
        # Check if item with this name already exists for tenant
        existing_item = db.query(models.BusinessStateItem).filter(
            models.BusinessStateItem.tenant_id == current_user.tenant_id,
            models.BusinessStateItem.name == r["name"]
        ).first()
        
        if existing_item:
            existing_item.current_value = r["current_value"]
            existing_item.item_type = r["item_type"]
            existing_item.data_type = r["data_type"]
            existing_item.confirmed_by = r["confirmed_by"]
            existing_item.last_confirmed_at = datetime.utcnow()
            existing_item.updated_at = datetime.utcnow()
            created_items.append(existing_item)
        else:
            # Create a brand new item
            new_item_in = schemas.BusinessStateItemCreate(
                name=r["name"],
                item_type=r["item_type"],
                current_value=r["current_value"],
                data_type=r["data_type"],
                confirmed_by=r["confirmed_by"]
            )
            item_obj = business_state_repo.create(db, current_user.tenant_id, new_item_in)
            created_items.append(item_obj)
            
    db.commit()
    return {"message": f"Successfully imported {len(created_items)} items.", "count": len(created_items)}


# Tenant Settings Endpoint

@app.get("/api/tenant/profile", response_model=schemas.TenantResponse)
def get_tenant_profile(
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get the profile configuration of the authenticated tenant."""
    tenant = tenant_repo.get(db, current_user.tenant_id, current_user.tenant_id) # Tenant ID acts as PK
    if not tenant:
        # Fallback query if UUIDs aren't identical
        tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@app.patch("/api/tenant/profile", response_model=schemas.TenantResponse)
def update_tenant_profile(
    tenant_update: schemas.TenantUpdate,
    current_user: schemas.TokenData = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update the business profile, policies, or preferences of the authenticated tenant."""
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = tenant_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)
    
    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)
    return tenant
