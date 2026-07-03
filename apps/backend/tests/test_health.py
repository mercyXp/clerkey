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
    assert login_data["tenant_id"] == signup_data["tenant_id"]
