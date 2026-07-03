import os
import sys

# Add apps/backend to sys.path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), "../apps/backend"))

from app.database import engine, Base
import app.models # Import models to ensure they are registered on Base

def reset_db():
    print("Connecting to database...")
    try:
        # We can drop everything using SQLAlchemy's Metadata
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        print("All tables dropped successfully!")
    except Exception as e:
        print(f"Error resetting database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    reset_db()
