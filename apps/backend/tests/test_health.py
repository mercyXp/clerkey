def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "platform" in data


def test_signup_and_login_flow(client):
    # 1. Sign up a new user/tenant
    signup_payload = {
        "email": "owner@organicfeeds.com",
        "password": "securepassword123",
        "first_name": "Mercy",
        "last_name": "Munzenzi",
        "tenant_name": "Organic Feeds Ltd",
        "industry": "retail"
    }
    
    response = client.post("/api/auth/signup", json=signup_payload)
    assert response.status_code == 201
    signup_data = response.json()
    assert "access_token" in signup_data
    assert "refresh_token" in signup_data
    assert signup_data["role"] == "owner"
    assert "tenant_id" in signup_data
    
    # 2. Log in with the registered credentials
    login_payload = {
        "email": "owner@organicfeeds.com",
        "password": "securepassword123"
    }
    
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    login_data = response.json()
    assert "access_token" in login_data
    assert "refresh_token" in login_data
    assert login_data["tenant_id"] == signup_data["tenant_id"]

    # 3. Refresh access token using the refresh token
    refresh_payload = {
        "refresh_token": login_data["refresh_token"]
    }
    response = client.post("/api/auth/refresh", json=refresh_payload)
    assert response.status_code == 200
    refresh_data = response.json()
    assert "access_token" in refresh_data
    assert "refresh_token" in refresh_data
    assert refresh_data["refresh_token"] != login_data["refresh_token"]  # Rotated


def test_business_state_multi_tenant_isolation(client):
    # 1. Sign up Tenant A
    signup_a = client.post("/api/auth/signup", json={
        "email": "owner@tenant-a.com",
        "password": "password123",
        "first_name": "Tenant",
        "last_name": "A",
        "tenant_name": "Tenant A Feed Store",
        "industry": "Feed/agricultural suppliers"
    })
    assert signup_a.status_code == 201
    token_a = signup_a.json()["access_token"]

    # 2. Sign up Tenant B
    signup_b = client.post("/api/auth/signup", json={
        "email": "owner@tenant-b.com",
        "password": "password123",
        "first_name": "Tenant",
        "last_name": "B",
        "tenant_name": "Tenant B Law Partners",
        "industry": "Law firms"
    })
    assert signup_b.status_code == 201
    token_b = signup_b.json()["access_token"]

    # 3. Create a business state item under Tenant A
    headers_a = {"Authorization": f"Bearer {token_a}"}
    create_item_payload = {
        "name": "Barley Stock",
        "item_type": "stock",
        "current_value": "120",
        "data_type": "integer",
        "confirmed_by": "manual"
    }
    create_res = client.post("/api/business-state", json=create_item_payload, headers=headers_a)
    assert create_res.status_code == 201
    item_a = create_res.json()
    item_a_id = item_a["id"]

    # 4. Verify Tenant A can fetch their own item
    get_a_res = client.get("/api/business-state", headers=headers_a)
    assert get_a_res.status_code == 200
    get_a_data = get_a_res.json()
    assert len(get_a_data) == 1
    assert get_a_data[0]["name"] == "Barley Stock"

    # 5. Verify Tenant B CANNOT see Tenant A's item
    headers_b = {"Authorization": f"Bearer {token_b}"}
    get_b_res = client.get("/api/business-state", headers=headers_b)
    assert get_b_res.status_code == 200
    assert len(get_b_res.json()) == 0

    # 6. Verify Tenant B CANNOT edit Tenant A's item
    patch_b_res = client.patch(
        f"/api/business-state/{item_a_id}",
        json={"current_value": "200"},
        headers=headers_b
    )
    # The BaseRepository.update will return None or raise error. 
    # Our endpoint returns 404 if the item doesn't exist for that tenant.
    assert patch_b_res.status_code == 404

    # 7. Verify Tenant B CANNOT delete Tenant A's item
    delete_b_res = client.delete(
        f"/api/business-state/{item_a_id}",
        headers=headers_b
    )
    assert delete_b_res.status_code == 404

    # 8. Verify Tenant A CAN update their own item
    patch_a_res = client.patch(
        f"/api/business-state/{item_a_id}",
        json={"current_value": "150"},
        headers=headers_a
    )
    assert patch_a_res.status_code == 200
    assert patch_a_res.json()["current_value"] == "150"

    # 9. Verify Tenant A CAN delete their own item
    delete_a_res = client.delete(
        f"/api/business-state/{item_a_id}",
        headers=headers_a
    )
    assert delete_a_res.status_code == 204


def test_business_state_validation_and_bulk_import(client):
    # Sign up tenant and retrieve token
    signup = client.post("/api/auth/signup", json={
        "email": "importer@company.com",
        "password": "password123",
        "first_name": "Excel",
        "last_name": "Wizard",
        "tenant_name": "Bulk Corp",
        "industry": "Retail shops, grocery/convenience stores"
    })
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Verify light validation rejects incorrect 'stock' count format
    bad_stock_res = client.post("/api/business-state", json={
        "name": "Wheat Stock",
        "item_type": "stock",
        "current_value": "not-a-number",
        "data_type": "integer"
    }, headers=headers)
    assert bad_stock_res.status_code == 400
    assert "must have a valid integer count" in bad_stock_res.json()["detail"]

    # 2. Verify light validation rejects incorrect 'rate' price format
    bad_rate_res = client.post("/api/business-state", json={
        "name": "Hourly Rate",
        "item_type": "rate",
        "current_value": "priceless",
        "data_type": "decimal"
    }, headers=headers)
    assert bad_rate_res.status_code == 400
    assert "must parse as a valid numerical price or rate" in bad_rate_res.json()["detail"]

    # 3. Verify light validation rejects incorrect 'availability' status formats
    bad_avail_res = client.post("/api/business-state", json={
        "name": "Meeting Room",
        "item_type": "availability",
        "current_value": "maybe",
        "data_type": "boolean"
    }, headers=headers)
    assert bad_avail_res.status_code == 400
    assert "must be a clean state flag" in bad_avail_res.json()["detail"]

    # 4. Perform bulk CSV import with correct format
    csv_payload = (
        "name,item_type,current_value,data_type,confirmed_by\n"
        "Corn Seed,stock,500,integer,csv_bulk\n"
        "Consulting Rate,rate,$150.00,decimal,csv_bulk\n"
        "Office Open,availability,true,boolean,csv_bulk"
    )
    bulk_res = client.post(
        "/api/business-state/bulk-import",
        params={"file_content": csv_payload},
        headers=headers
    )
    assert bulk_res.status_code == 201
    assert bulk_res.json()["count"] == 3

    # 5. Fetch items and confirm they imported successfully
    get_res = client.get("/api/business-state", headers=headers)
    assert get_res.status_code == 200
    items = get_res.json()
    assert len(items) == 3
    
    names = [item["name"] for item in items]
    assert "Corn Seed" in names
    assert "Consulting Rate" in names
    assert "Office Open" in names

    # 6. Verify bulk CSV import fails and rolls back whole transaction on single row schema mismatch
    bad_csv_payload = (
        "name,item_type,current_value,data_type,confirmed_by\n"
        "Barley Seed,stock,200,integer,csv_bulk\n"
        "Broken Rate,rate,invalid-rate,decimal,csv_bulk"
    )
    bad_bulk_res = client.post(
        "/api/business-state/bulk-import",
        params={"file_content": bad_csv_payload},
        headers=headers
    )
    assert bad_bulk_res.status_code == 400
    
    # Assert Barley Seed was NOT imported because the transaction was rolled back
    get_post_fail = client.get("/api/business-state", headers=headers)
    assert len(get_post_fail.json()) == 3  # Still just the 3 original items


