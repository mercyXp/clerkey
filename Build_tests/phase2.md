# Phase 2 — Multi-Tenant Isolation & Authentication Test Plan

This document provides step-by-step instructions on how to manually verify the multi-tenant isolation boundaries, JWT authentication flows, and token rotation security mechanisms built in Phase 2 of Clerkey.

Testing is provided for both standard bash (`curl`) and Windows PowerShell (`Invoke-RestMethod`) environments.

---

## Prerequisites

1. **Local Database & Schema Active:**
   Ensure your local Postgres container is running and fully migrated:
   ```powershell
   docker compose up -d
   ```
2. **Database Seeded:**
   Verify your database is seeded with the deterministic demo tenants:
   ```powershell
   python scripts/seed_demo_tenants.py
   ```
3. **Backend API Running:**
   Ensure your FastAPI development server is running locally on port `8000`:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```

---

## Deterministic Seeding Metadata (For Reference)

Our seeding script registers deterministic, fixed UUIDs so you can perform exact direct API queries:
* **Tenant A (Organic Feeds Ltd):** `a0000000-0000-0000-0000-000000000000`
  * Owner Login: `owner@organicfeeds.com` (pwd: `password123`)
  * State Item ID (Chicken Feed): `a2222222-2222-2222-2222-222222222221`
* **Tenant B (Apex Law Partners):** `b0000000-0000-0000-0000-000000000000`
  * Owner Login: `owner@apexlaw.com` (pwd: `password123`)
  * State Item ID (Law Intake): `b2222222-2222-2222-2222-222222222221`

---

## Test 1: Sign up & Login (Tenant A)

This verifies that you can register a new tenant workspace, log in with their credentials, and receive a valid access/refresh token pair.

### Option A: Using PowerShell

```powershell
# 1. Test Login to seeded Tenant A owner
$LoginResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"email": "owner@organicfeeds.com", "password": "password123"}'

# 2. Extract and inspect the tokens
$TokenA = $LoginResponse.access_token
$RefreshA = $LoginResponse.refresh_token
Write-Host "Tenant A JWT Token: $TokenA"
```

### Option B: Using Bash (cURL)

```bash
# 1. Login to seeded Tenant A owner
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "owner@organicfeeds.com", "password": "password123"}'
```

*Expected JSON Output:*
```json
{
  "access_token": "ey...",
  "refresh_token": "secure_random_string...",
  "token_type": "bearer",
  "tenant_id": "a0000000-0000-0000-0000-000000000000",
  "role": "owner"
}
```

---

## Test 2: Sign up & Login (Tenant B)

This verifies that a separate, isolated tenant account can be authenticated, returning a distinct scoped workspace mapping.

### Option A: Using PowerShell

```powershell
# Login to seeded Tenant B owner
$LoginResponseB = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"email": "owner@apexlaw.com", "password": "password123"}'

$TokenB = $LoginResponseB.access_token
Write-Host "Tenant B JWT Token: $TokenB"
```

### Option B: Using Bash (cURL)

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "owner@apexlaw.com", "password": "password123"}'
```

*Expected JSON Output:*
```json
{
  "access_token": "ey...",
  "refresh_token": "secure_random_string...",
  "token_type": "bearer",
  "tenant_id": "b0000000-0000-0000-0000-000000000000",
  "role": "owner"
}
```

---

## Test 3: Multi-Tenant Query Isolation (NFR-1 Violation Protection)

This is the safety-critical test. It confirms that Tenant A's token **cannot** be used to read or modify resources belonging to Tenant B, verified directly at the API level (enforced by our `BaseRepository` architecture).

### Case 3.1: Attempt to list Tenant B's items using Tenant A's Token

When Tenant A queries the business-state endpoint, they must only receive Tenant A's stock. They must *never* receive legal-consult intake values.

#### PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/business-state" `
    -Method Get `
    -Headers @{ "Authorization" = "Bearer $TokenA" }
```

#### Bash:
```bash
curl -X GET "http://localhost:8000/api/business-state" \
     -H "Authorization: Bearer <TOKEN_A>"
```

*Expected Result:*
You will receive a list containing *only* items belonging to `Organic Feeds Ltd` (`50kg Organic Chicken Feed`, `Maize Seeds premium blend`, etc.). No legal consulting entries will be returned.

---

### Case 3.2: Attempt to modify Tenant B's item using Tenant A's Token (Cross-Tenant Write)

We will attempt to perform a PATCH request to edit Tenant B's deterministic consult date item (`b2222222-2222-2222-2222-222222222223`) using Tenant A's authorization header.

#### PowerShell:
```powershell
# Attempt to modify Tenant B's consult item using Tenant A's JWT token
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/b2222222-2222-2222-2222-222222222223" `
        -Method Patch `
        -ContentType "application/json" `
        -Headers @{ "Authorization" = "Bearer $TokenA" } `
        -Body '{"current_value": "MALICIOUS_OVERWRITE"}'
} catch {
    Write-Host "Request Rejected with: " $_.Exception.Message
}
```

#### Bash:
```bash
curl -X PATCH "http://localhost:8000/api/business-state/b2222222-2222-2222-2222-222222222223" \
     -H "Authorization: Bearer <TOKEN_A>" \
     -H "Content-Type: application/json" \
     -d '{"current_value": "MALICIOUS_OVERWRITE"}'
```

*Expected Result:*
**`404 Not Found`**  
The API returns a `404 Not Found` error. Because our `BaseRepository` query layer filters by the token's authenticated `tenant_id` automatically, the backend searches for `b2222222-2222-2222-2222-222222222223` *strictly within Tenant A's rows*. Since it belongs to Tenant B, it does not exist in Tenant A's space, returning a clean, secure 404 rather than leaking data or allowing a cross-tenant exploit.

---

## Test 4: Invalid and Expired Token Rejection

Protected endpoints must structurally reject invalid signatures or tampered authorization headers.

### Case 4.1: Querying with an invalid token

#### PowerShell:
```powershell
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state" `
        -Method Get `
        -Headers @{ "Authorization" = "Bearer invalid-garbage-token-here" }
} catch {
    Write-Host "Rejected as expected: " $_.Exception.Message
}
```

#### Bash:
```bash
curl -X GET "http://localhost:8000/api/business-state" \
     -H "Authorization: Bearer invalid-garbage-token-here"
```

*Expected Result:*
**`401 Unauthorized`** with body:
```json
{
  "detail": "Could not validate credentials"
}
```

---

### Case 4.2: Querying with an expired token / token refresh lifecycle

When an access token expires, the dashboard should hit the refresh endpoint to obtain a rotated token pair.

Let's test refresh token consumption:

#### PowerShell:
```powershell
# Attempt token refresh using the previously saved refresh token
$RefreshResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/refresh" `
    -Method Post `
    -ContentType "application/json" `
    -Body "{ `"refresh_token`": `"$RefreshA`" }"

Write-Host "New Access Token: " $RefreshResponse.access_token
Write-Host "New Rotated Refresh Token: " $RefreshResponse.refresh_token
```

#### Bash:
```bash
curl -X POST "http://localhost:8000/api/auth/refresh" \
     -H "Content-Type: application/json" \
     -d '{"refresh_token": "<REFRESH_TOKEN_A>"}'
```

*Expected Result:*
**`200 OK`** containing a brand new access and rotated refresh token. 

*Re-run Check:* If you run this exact same request a **second time** with the same `<REFRESH_TOKEN_A>`, the API will return a **`401 Unauthorized`** with `"Invalid, expired, or revoked refresh token"`, proving that refresh tokens are single-use rotated chokepoints.



## FEEDBACK 
ALL TESTS PASSED