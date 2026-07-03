import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import jwt
from passlib.context import CryptContext

from app import models, schemas
from app.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db, engine, Base

# Create tables in development if they don't exist yet (Alembic will also be set up)
# In production, Alembic handles migrations.
Base.metadata.create_all(bind=engine)

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

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")


# Helper Functions
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def get_current_user_data(token: str = Depends(oauth2_scheme)) -> schemas.TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        tenant_id_str: str = payload.get("tenant_id")
        role: str = payload.get("role")
        if email is None or tenant_id_str is None:
            raise credentials_exception
        tenant_id = uuid.UUID(tenant_id_str)
        return schemas.TokenData(email=email, tenant_id=tenant_id, role=role)
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
    # Check if user already exists
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
        db.flush()  # Gen ID

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

    # 3. Issue Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "tenant_id": str(user.tenant_id), "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
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
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "tenant_id": str(user.tenant_id), "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
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
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "tenant_id": str(user.tenant_id), "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "tenant_id": user.tenant_id,
        "role": user.role
    }


@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: schemas.TokenData = Depends(get_current_user_data), db: Session = Depends(get_db)):
    """Get profile of the currently logged-in user."""
    user = db.query(models.User).filter(
        models.User.email == current_user.email,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# Business State Items Router (Strictly Scoped by tenant_id)

@app.get("/api/business-state", response_model=List[schemas.BusinessStateItemResponse])
def list_business_state_items(
    current_user: schemas.TokenData = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    """Retrieve all business-state items for the authenticated tenant."""
    items = db.query(models.BusinessStateItem).filter(
        models.BusinessStateItem.tenant_id == current_user.tenant_id
    ).all()
    return items


@app.post("/api/business-state", response_model=schemas.BusinessStateItemResponse, status_code=status.HTTP_201_CREATED)
def create_business_state_item(
    item_in: schemas.BusinessStateItemCreate,
    current_user: schemas.TokenData = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    """Create a new business-state item for the authenticated tenant."""
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

    item = models.BusinessStateItem(
        tenant_id=current_user.tenant_id,
        **item_in.dict()
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.patch("/api/business-state/{item_id}", response_model=schemas.BusinessStateItemResponse)
def update_business_state_item(
    item_id: uuid.UUID,
    item_update: schemas.BusinessStateItemUpdate,
    current_user: schemas.TokenData = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    """Update a specific business-state item's value and re-confirm it."""
    item = db.query(models.BusinessStateItem).filter(
        models.BusinessStateItem.id == item_id,
        models.BusinessStateItem.tenant_id == current_user.tenant_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Business state item not found")
    
    if item_update.current_value is not None:
        item.current_value = item_update.current_value
    
    item.confirmation_source = item_update.confirmation_source
    item.last_confirmed_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(item)
    return item


# Tenant Settings Endpoint

@app.get("/api/tenant/profile", response_model=schemas.TenantResponse)
def get_tenant_profile(
    current_user: schemas.TokenData = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    """Get the profile configuration of the authenticated tenant."""
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@app.patch("/api/tenant/profile", response_model=schemas.TenantResponse)
def update_tenant_profile(
    tenant_update: schemas.TenantUpdate,
    current_user: schemas.TokenData = Depends(get_current_user_data),
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
