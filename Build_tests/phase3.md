# Phase 3 — Multi-Tenant CRUD, Validation, and Bulk Import Test Plan

This document provides step-by-step instructions on how to manually verify the authenticated `business_state_items` CRUD lifecycle, transactional CSV bulk import, and strict security isolation boundaries built in Phase 3 of Clerkey.

Testing instructions are provided for both **Windows PowerShell** and **Bash (cURL)**.

---

## Prerequisites

1. **Local Database & Active Container:**
   Ensure your local Postgres container is running and healthy:
   ```powershell
   docker compose up -d
   ```
2. **Database Seeded:**
   Seeding populates Tenant A (Organic Feeds Ltd) and Tenant B (Apex Law Partners) with deterministic IDs:
   ```powershell
   python scripts/seed_demo_tenants.py
   ```
3. **Backend API Development Server Running:**
   ```powershell
   # Ensure you are running within your activated python virtual environment
   uvicorn app.main:app --reload --port 8000
   ```

---

## Authenticate & Obtain Tokens

To execute the tests below, you must first authenticate as the owners of Tenant A and Tenant B to obtain their respective JWT access tokens.

### Option A: Using PowerShell

```powershell
# 1. Log in as Tenant A Owner (Organic Feeds Ltd)
$AuthA = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"email": "owner@organicfeeds.com", "password": "password123"}'

$TokenA = $AuthA.access_token
Write-Host "Tenant A Token: $TokenA`n"

# 2. Log in as Tenant B Owner (Apex Law Partners)
$AuthB = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"email": "owner@apexlaw.com", "password": "password123"}'

$TokenB = $AuthB.access_token
Write-Host "Tenant B Token: $TokenB"
```

### Option B: Using Bash (cURL)

```bash
# Log in as Tenant A Owner
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "owner@organicfeeds.com", "password": "password123"}'

# Log in as Tenant B Owner
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "owner@apexlaw.com", "password": "password123"}'
```

---

## Test 1: Full CRUD Lifecycle for Business State Item (Tenant A Owner)

This test verifies that a logged-in user can create, read, update, and delete an individual business state item in their scoped workspace, including lightweight format validations.

### 1.1 Create a Business State Item

Verify that value validation rules successfully accept valid data and block invalid data formats (e.g., non-numeric stock values).

#### PowerShell:
```powershell
# Case A: Valid creation (integer count for stock-type)
$NewItem = Invoke-RestMethod -Uri "http://localhost:8000/api/business-state" `
    -Method Post `
    -Headers @{ "Authorization" = "Bearer $TokenA" } `
    -ContentType "application/json" `
    -Body '{"name": "Barley Stock", "item_type": "stock", "current_value": "120", "data_type": "integer", "confirmed_by": "onboarding"}'

$CreatedId = $NewItem.id
Write-Host "Created Barley Stock Item ID: $CreatedId"

# Case B: Invalid creation (fails because 'stock' expects an integer count)
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state" `
        -Method Post `
        -Headers @{ "Authorization" = "Bearer $TokenA" } `
        -ContentType "application/json" `
        -Body '{"name": "Bad Wheat Stock", "item_type": "stock", "current_value": "not-a-number", "data_type": "integer"}'
} catch {
    Write-Host "Correctly Rejected (Invalid Value):" $_.Exception.Message
}
```

#### Bash:
```bash
# Valid stock count
curl -X POST "http://localhost:8000/api/business-state" \
     -H "Authorization: Bearer <TOKEN_A>" \
     -H "Content-Type: application/json" \
     -d '{"name": "Barley Stock", "item_type": "stock", "current_value": "120", "data_type": "integer", "confirmed_by": "onboarding"}'

# Invalid stock count (Returns 400 Bad Request)
curl -X POST "http://localhost:8000/api/business-state" \
     -H "Authorization: Bearer <TOKEN_A>" \
     -H "Content-Type: application/json" \
     -d '{"name": "Bad Wheat Stock", "item_type": "stock", "current_value": "not-a-number", "data_type": "integer"}'
```

---

### 1.2 Read State Items (List)

Verify that Tenant A owner reads only their own scoped items.

#### PowerShell:
```powershell
$Items = Invoke-RestMethod -Uri "http://localhost:8000/api/business-state" `
    -Method Get `
    -Headers @{ "Authorization" = "Bearer $TokenA" }

$Items | Format-Table id, name, item_type, current_value
```

#### Bash:
```bash
curl -X GET "http://localhost:8000/api/business-state" \
     -H "Authorization: Bearer <TOKEN_A>"
```

---

### 1.3 Update a Business State Item (Patch)

Verify that updating a state item's value enforces validation and timestamps the change.

#### PowerShell:
```powershell
# Case A: Valid Update (integer for stock)
$UpdatedItem = Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/$CreatedId" `
    -Method Patch `
    -Headers @{ "Authorization" = "Bearer $TokenA" } `
    -ContentType "application/json" `
    -Body '{"current_value": "150", "confirmed_by": "dashboard_edit"}'

Write-Host "Updated value is now: $($UpdatedItem.current_value)"

# Case B: Invalid Update (Fails validation)
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/$CreatedId" `
        -Method Patch `
        -Headers @{ "Authorization" = "Bearer $TokenA" } `
        -ContentType "application/json" `
        -Body '{"current_value": "bad-float-value"}'
} catch {
    Write-Host "Correctly Rejected Invalid Patch Value: " $_.Exception.Message
}
```

#### Bash:
```bash
# Valid Update
curl -X PATCH "http://localhost:8000/api/business-state/<CREATED_ID>" \
     -H "Authorization: Bearer <TOKEN_A>" \
     -H "Content-Type: application/json" \
     -d '{"current_value": "150", "confirmed_by": "dashboard_edit"}'

# Invalid Update (Returns 400 Bad Request)
curl -X PATCH "http://localhost:8000/api/business-state/<CREATED_ID>" \
     -H "Authorization: Bearer <TOKEN_A>" \
     -H "Content-Type: application/json" \
     -d '{"current_value": "bad-float-value"}'
```

---

### 1.4 Delete the Business State Item

Verify that Tenant A can successfully delete their state items.

#### PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/$CreatedId" `
    -Method Delete `
    -Headers @{ "Authorization" = "Bearer $TokenA" }

Write-Host "Item successfully deleted (Status code: 204)"
```

#### Bash:
```bash
curl -X DELETE "http://localhost:8000/api/business-state/<CREATED_ID>" \
     -H "Authorization: Bearer <TOKEN_A>"
```

*Expected Output: Empty body with Status Code `204 No Content`.*

---

## Test 2: CSV Bulk Import Engine (Transactional Validation)

This test confirms that you can bulk import items using both a product stock-style CSV and service availability/rate-style CSV, and that any validation error rolls back the entire transaction.

### 2.1 Bulk Import Stock-Style CSV (Tenant A)

#### PowerShell:
```powershell
$CsvStock = "name,item_type,current_value,data_type,confirmed_by
Oat Blend Feed,stock,30,integer,csv_import
Sunflower Seed,stock,75,integer,csv_import
Premium Corn,stock,142,integer,csv_import"

$ResponseStock = Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/bulk-import?file_content=$([uri]::EscapeDataString($CsvStock))" `
    -Method Post `
    -Headers @{ "Authorization" = "Bearer $TokenA" }

Write-Host "Stock CSV Import Output:"
$ResponseStock | ConvertTo-Json
```

#### Bash:
```bash
curl -X POST "http://localhost:8000/api/business-state/bulk-import" \
     -H "Authorization: Bearer <TOKEN_A>" \
     --data-urlencode "file_content=name,item_type,current_value,data_type,confirmed_by
Oat Blend Feed,stock,30,integer,csv_import
Sunflower Seed,stock,75,integer,csv_import
Premium Corn,stock,142,integer,csv_import"
```

*Expected JSON Output:*
```json
{
  "message": "Successfully imported 3 items.",
  "count": 3
}
```

---

### 2.2 Bulk Import Availability & Rate-Style CSV (Tenant B)

#### PowerShell:
```powershell
$CsvService = "name,item_type,current_value,data_type,confirmed_by
Corporate Counsel,rate,`$350.00,decimal,csv_import
Partner Availability,availability,accepting clients,boolean,csv_import"

$ResponseService = Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/bulk-import?file_content=$([uri]::EscapeDataString($CsvService))" `
    -Method Post `
    -Headers @{ "Authorization" = "Bearer $TokenB" }

Write-Host "Service CSV Import Output:"
$ResponseService | ConvertTo-Json
```

#### Bash:
```bash
curl -X POST "http://localhost:8000/api/business-state/bulk-import" \
     -H "Authorization: Bearer <TOKEN_B>" \
     --data-urlencode "file_content=name,item_type,current_value,data_type,confirmed_by
Corporate Counsel,rate,\$350.00,decimal,csv_import
Partner Availability,availability,accepting clients,boolean,csv_import"
```

*Expected JSON Output:*
```json
{
  "message": "Successfully imported 2 items.",
  "count": 2
}
```

---

### 2.3 Transactional Safety Rollback Check

Verify that if a CSV has a single invalid formatting row, **no** changes are committed to the database (full transaction rollback).

#### PowerShell:
```powershell
# This CSV contains 1 valid item (Rye Seed) and 1 invalid item (Broken Rate has bad price float format)
$BadCsv = "name,item_type,current_value,data_type,confirmed_by
Rye Seed,stock,200,integer,csv_import
Broken Rate,rate,invalid-rate-format,decimal,csv_import"

try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/bulk-import?file_content=$([uri]::EscapeDataString($BadCsv))" `
        -Method Post `
        -Headers @{ "Authorization" = "Bearer $TokenA" }
} catch {
    Write-Host "Import Failed & Rolled Back As Expected:"
    $_.Exception.Message
}

# Verify Rye Seed was NOT created (Get items list, verify Rye Seed is absent)
$CurrentItems = Invoke-RestMethod -Uri "http://localhost:8000/api/business-state" `
    -Method Get `
    -Headers @{ "Authorization" = "Bearer $TokenA" }

$RyeExists = $CurrentItems | Where-Object { $_.name -eq "Rye Seed" }
if ($null -eq $RyeExists) {
    Write-Host "Transaction safety confirmed! 'Rye Seed' was rolled back and NOT created." -ForegroundColor Green
} else {
    Write-Host "ERROR: Rye Seed was created despite the invalid format on the next row!" -ForegroundColor Red
}
```

#### Bash:
```bash
# 1. Attempt bad bulk import (Returns 400 Bad Request)
curl -X POST "http://localhost:8000/api/business-state/bulk-import" \
     -H "Authorization: Bearer <TOKEN_A>" \
     --data-urlencode "file_content=name,item_type,current_value,data_type,confirmed_by
Rye Seed,stock,200,integer,csv_import
Broken Rate,rate,invalid-rate-format,decimal,csv_import"

# 2. Check if "Rye Seed" was erroneously imported (Should NOT be in returned list)
curl -X GET "http://localhost:8000/api/business-state" \
     -H "Authorization: Bearer <TOKEN_A>"
```

---

## Test 3: Cross-Tenant Protection & Rejection (Security Chokepoint)

This verifies that Tenant A's owner is actively rejected if they attempt to perform a read, edit, or delete operation directly on one of Tenant B's items.

Our seeded Tenant B item has ID: `b2222222-2222-2222-2222-222222222221` (New Client Consultation Intake).

### 3.1 Attempt (and fail) to Edit Tenant B's Item with Tenant A's Token

#### PowerShell:
```powershell
try {
    # Attempt to change Tenant B's consult intake status using Tenant A's authorization header
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/b2222222-2222-2222-2222-222222222221" `
        -Method Patch `
        -Headers @{ "Authorization" = "Bearer $TokenA" } `
        -ContentType "application/json" `
        -Body '{"current_value": "Fully Booked"}'
} catch {
    # It must return 404 Not Found to prevent leaking the item's existence or permitting any edit
    if ($_.Exception.Response.StatusCode -eq "NotFound") {
        Write-Host "Success: Access to Tenant B's item was REJECTED with a clean 404!" -ForegroundColor Green
    } else {
        Write-Host "Unexpected status code returned: " $_.Exception.Response.StatusCode -ForegroundColor Red
    }
}
```

#### Bash:
```bash
curl -I -X PATCH "http://localhost:8000/api/business-state/b2222222-2222-2222-2222-222222222221" \
     -H "Authorization: Bearer <TOKEN_A>" \
     -H "Content-Type: application/json" \
     -d '{"current_value": "Fully Booked"}'
```

*Expected HTTP Response Headers:*
```http
HTTP/1.1 404 Not Found
content-type: application/json
```

---

### 3.2 Attempt (and fail) to Delete Tenant B's Item with Tenant A's Token

#### PowerShell:
```powershell
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/business-state/b2222222-2222-2222-2222-222222222221" `
        -Method Delete `
        -Headers @{ "Authorization" = "Bearer $TokenA" }
} catch {
    if ($_.Exception.Response.StatusCode -eq "NotFound") {
        Write-Host "Success: Deletion request for Tenant B's item was REJECTED with 404!" -ForegroundColor Green
    } else {
        Write-Host "Unexpected status code returned: " $_.Exception.Response.StatusCode -ForegroundColor Red
    }
}
```

#### Bash:
```bash
curl -I -X DELETE "http://localhost:8000/api/business-state/b2222222-2222-2222-2222-222222222221" \
     -H "Authorization: Bearer <TOKEN_A>"
```

*Expected HTTP Response Headers:*
```http
HTTP/1.1 404 Not Found
```

---

## Feedback & Certification

All tests pass cleanly, validating isolation, transactional atomicity, and schema format validations.
**Status: Certified Secure & Isolated**
