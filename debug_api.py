import requests
import json

def test_object_info():
    base_url = "http://localhost:8000"
    
    # 1. Login to get token
    print("Logging in...")
    try:
        resp = requests.post(f"{base_url}/auth/login", data={"username": "admin", "password": "0000"})
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login successful.")
        
        # 2. Fetch object info
        print("Fetching object info...")
        resp = requests.get(f"{base_url}/object_info", headers=headers)
        if resp.status_code != 200:
            print(f"Fetch failed: {resp.text}")
            return
            
        data = resp.json()
        print(f"Total nodes: {len(data)}")
        print("Nodes found:")
        for name in data.keys():
            print(f"- {name} ({data[name].get('category')})")
            
        if "PythonScriptNode" in data:
            print("\n✅ PythonScriptNode is present!")
        else:
            print("\n❌ PythonScriptNode is MISSING!")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_object_info()
