import uuid
from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.orm import Session
from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    """
    Base repository class that structurally enforces tenant_id scoping on all read/write database queries.
    It is structurally difficult to write a query without providing tenant_id as the first parameter.
    """
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, tenant_id: uuid.UUID, id: uuid.UUID) -> Optional[ModelType]:
        """Retrieve a single record by ID, scoped strictly to the tenant."""
        if hasattr(self.model, "tenant_id"):
            return db.query(self.model).filter(
                self.model.tenant_id == tenant_id,
                self.model.id == id
            ).first()
        else:
            return db.query(self.model).filter(
                self.model.id == id
            ).first()

    def list(self, db: Session, tenant_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """List records scoped strictly to the tenant."""
        if hasattr(self.model, "tenant_id"):
            return db.query(self.model).filter(
                self.model.tenant_id == tenant_id
            ).offset(skip).limit(limit).all()
        else:
            return db.query(self.model).filter(
                self.model.id == tenant_id
            ).offset(skip).limit(limit).all()

    def create(self, db: Session, tenant_id: uuid.UUID, obj_in: Any) -> ModelType:
        """Create a new record, automatically injecting and enforcing the tenant_id."""
        obj_data = obj_in if isinstance(obj_in, dict) else obj_in.dict()
        # Enforce tenant_id injection if model has it
        if hasattr(self.model, "tenant_id"):
            obj_data["tenant_id"] = tenant_id
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, tenant_id: uuid.UUID, id: uuid.UUID, obj_in: Any) -> Optional[ModelType]:
        """Update an existing record, scoped strictly to the tenant."""
        db_obj = self.get(db, tenant_id, id)
        if not db_obj:
            return None
        
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.dict(exclude_unset=True)
        # Ensure tenant_id cannot be overwritten or changed
        update_data.pop("tenant_id", None)
        
        for field in update_data:
            if hasattr(db_obj, field):
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, tenant_id: uuid.UUID, id: uuid.UUID) -> bool:
        """Delete a record, scoped strictly to the tenant."""
        db_obj = self.get(db, tenant_id, id)
        if not db_obj:
            return False
        db.delete(db_obj)
        db.commit()
        return True
