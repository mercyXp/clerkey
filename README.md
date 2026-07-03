# Clerkey

Clerkey is a multi-tenant AI agent platform designed for small businesses to automate accurate customer responses across messaging channels (WhatsApp, Email) in real-time. By checking live, isolated tenant-specific business state facts (such as product stock, pricing, and service availability) before replying, Clerkey prevents hallucinations and incorrect information. If an inquiry is ambiguous or high-risk, Clerkey escalates the conversation to the business owner via WhatsApp, subsequently capturing any human corrections to continuously align its future tone, facts, and policy adherence.

---

## Tech Stack Summary

- **Backend (/apps/backend):** FastAPI (Python), SQLAlchemy (ORM), Alembic (Migrations), Pydantic (Validation & Serialization), PyJWT (Authentication), `pgvector` (Semantic memory & feedback retrieval).
- **Dashboard (/apps/dashboard):** Next.js 14 (TypeScript), Tailwind CSS (Styles), Lucide Icons (Visual elements).
- **Database / Infrastructure:** ApsaraDB for PostgreSQL (Postgres with `pgvector` support, containerized locally), Qwen Cloud AI (Reasoning and generation), Alibaba Cloud Compute.
- **Local Dev Stack:** Docker Compose (PostgreSQL with pre-installed pgvector).

---

## Repository Structure

```
/apps
  /backend           -> FastAPI Python API, reasoning agent loops, and channel adapters
  /dashboard         -> Next.js Web Dashboard for business owners
/docs
  PRD.md             -> Project Requirements Document & functional requirements
  ARCHITECTURE.md    -> System architecture, component relationships, and multi-tenancy isolation
  data-model.md      -> Detailed relational database schema including vector indices
/infra
  /init-db           -> Local Postgres container initialization scripts (enabling pgvector)
README.md            -> Local setup instructions and project overview
LICENSE              -> MIT License file
```

---

## Local Setup & Development Guide

Follow these steps to set up and run the Clerkey workspace locally from scratch.

### Prerequisites

Make sure you have the following installed on your machine:
- **Docker & Docker Compose** (for running Postgres & pgvector)
- **Python 3.10 or higher**
- **Node.js 18 or higher** and npm

---

### Step 1: Database Environment Setup

1. Copy the root environment template to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start the local database (Postgres + pgvector) container in the background:
   ```bash
   docker compose up -d
   ```
   *This automatically creates the `clerkey` database and runs `CREATE EXTENSION IF NOT EXISTS vector;` to enable pgvector support.*

---

### Step 2: Backend API Setup

1. Navigate to the backend directory:
   ```bash
   cd apps/backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the backend-specific env file (if customizing further):
   ```bash
   cp .env.example .env
   ```
5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API is now running at `http://localhost:8000`. You can inspect the interactive OpenAPI documentation at `http://localhost:8000/docs`.

---

### Step 3: Run Backend Tests

While still in the `apps/backend` directory with your virtual environment active, execute the test suite using `pytest`:
```bash
pytest
```
*This runs the health check and authentication flow tests on an isolated SQLite database.*

---

### Step 4: Dashboard Setup

1. Navigate to the dashboard directory:
   ```bash
   cd ../dashboard
   ```
2. Install the Node modules:
   ```bash
   npm install
   ```
3. Copy the dashboard-specific env file:
   ```bash
   cp .env.example .env.local
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The dashboard is now running locally at `http://localhost:3000`. Open this address in your browser to view the isolated owner workspaces and mock states for both retail and service-based tenants.
