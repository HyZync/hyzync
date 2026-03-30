import requests

# 1. Login to get a real JWT
print("Attempting login...")
res = requests.post("http://127.0.0.1:8000/login", data={"username":"demo@horizon.ai", "password":"password123"})
if res.status_code != 200:
    print("Login failed!", res.text)
    # let's try reading the user table to see what emails exist
    import sqlite3
    conn = sqlite3.connect('d:/Rev_New/backend/data/app.db')
    print("Users:", conn.cursor().execute("SELECT email, tenant_id FROM users").fetchall())
    conn.close()
    exit(1)

data = res.json()
token = data["access_token"]
print("Got token:", token)

# 2. Fetch workspaces
print("\nx Fetching workspaces...")
headers = {"Authorization": f"Bearer {token}"}
res2 = requests.get("http://127.0.0.1:8000/api/workspaces?user_id=1", headers=headers)
print("Status Code:", res2.status_code)
print("Response:", res2.text)
