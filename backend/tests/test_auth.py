"""
Authentication API Test Script
Tests JWT authentication endpoints without starting the full server
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token
)
from app.models.user import UserCreate
from datetime import timedelta


def test_password_hashing():
    """Test password hashing and verification"""
    print("\n" + "="*60)
    print("TEST 1: Password Hashing")
    print("="*60)
    
    password = "test_password_123"
    hashed = get_password_hash(password)
    
    print(f"Plain password: {password}")
    print(f"Hashed password: {hashed[:50]}...")
    
    # Verify correct password
    assert verify_password(password, hashed), "Password verification failed"
    print("✅ Correct password verified")
    
    # Verify incorrect password
    assert not verify_password("wrong_password", hashed), "Wrong password should not verify"
    print("✅ Wrong password correctly rejected")


def test_jwt_token_creation():
    """Test JWT token creation and decoding"""
    print("\n" + "="*60)
    print("TEST 2: JWT Token Creation & Decoding")
    print("="*60)
    
    # Create token
    token_data = {"sub": "testuser", "user_id": "123"}
    token = create_access_token(data=token_data, expires_delta=timedelta(minutes=30))
    
    print(f"Created token: {token[:50]}...")
    
    # Decode token
    payload = decode_access_token(token)
    
    assert payload is not None, "Token decoding failed"
    assert payload.get("sub") == "testuser", "Username mismatch"
    assert payload.get("user_id") == "123", "User ID mismatch"
    assert "exp" in payload, "Expiration not set"
    
    print(f"✅ Token decoded successfully")
    print(f"   Username: {payload['sub']}")
    print(f"   User ID: {payload['user_id']}")
    print(f"   Expires: {payload['exp']}")


def test_token_expiration():
    """Test expired token handling"""
    print("\n" + "="*60)
    print("TEST 3: Token Expiration")
    print("="*60)
    
    # Create token that expires immediately
    token = create_access_token(
        data={"sub": "testuser"},
        expires_delta=timedelta(seconds=-1)  # Already expired
    )
    
    payload = decode_access_token(token)
    
    assert payload is None, "Expired token should be rejected"
    print("✅ Expired token correctly rejected")


def test_invalid_token():
    """Test invalid token handling"""
    print("\n" + "="*60)
    print("TEST 4: Invalid Token")
    print("="*60)
    
    invalid_tokens = [
        "not.a.token",
        "invalid_token_string",
        "",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
    ]
    
    for token in invalid_tokens:
        payload = decode_access_token(token)
        assert payload is None, f"Invalid token should be rejected: {token[:20]}..."
    
    print(f"✅ All {len(invalid_tokens)} invalid tokens rejected")


def test_user_model_validation():
    """Test user model validation"""
    print("\n" + "="*60)
    print("TEST 5: User Model Validation")
    print("="*60)
    
    # Valid user
    try:
        user = UserCreate(
            username="validuser",
            email="user@example.com",
            password="secure_password_123"
        )
        print(f"✅ Valid user created: {user.username}")
    except Exception as e:
        print(f"❌ Valid user creation failed: {e}")
        sys.exit(1)
    
    # Invalid username (too short)
    try:
        user = UserCreate(
            username="ab",  # Too short
            email="user@example.com",
            password="password123"
        )
        print("❌ Should have rejected short username")
        sys.exit(1)
    except Exception:
        print("✅ Short username rejected")
    
    # Invalid email
    try:
        user = UserCreate(
            username="validuser",
            email="not-an-email",
            password="password123"
        )
        print("❌ Should have rejected invalid email")
        sys.exit(1)
    except Exception:
        print("✅ Invalid email rejected")
    
    # Invalid password (too short)
    try:
        user = UserCreate(
            username="validuser",
            email="user@example.com",
            password="short"  # Too short
        )
        print("❌ Should have rejected short password")
        sys.exit(1)
    except Exception:
        print("✅ Short password rejected")


def main():
    print("="*60)
    print("JWT AUTHENTICATION TEST SUITE")
    print("="*60)
    
    try:
        test_password_hashing()
        test_jwt_token_creation()
        test_token_expiration()
        test_invalid_token()
        test_user_model_validation()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        
        print("\n📋 Next Steps:")
        print("1. Start backend: uvicorn app.main:app --reload")
        print("2. Test login: POST /auth/login")
        print("3. Default admin credentials:")
        print("   Username: admin")
        print("   Password: admin123")
        print("   ⚠️  Change password immediately!")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
