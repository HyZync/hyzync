import sys
import os
import uuid

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import (
    create_user, get_db_connection, crm_upsert_profiles, crm_get_profiles,
    create_workspace, create_tenant, get_user_by_id
)

def run_test():
    print("Starting Multi-Tenancy Isolation Test...")
    
    # 1. Create Tenants First (Proper IDs)
    tenant_a_id = create_tenant("Test Tenant A")
    tenant_b_id = create_tenant("Test Tenant B")
    print(f"Tenants Created: A={tenant_a_id}, B={tenant_b_id}")

    # 2. Create Users
    email_a = f"a_{uuid.uuid4().hex[:6]}@test.com"
    email_b = f"b_{uuid.uuid4().hex[:6]}@test.com"
    
    uid_a = create_user(email_a, "pass123", "User A", tenant_a_id)
    uid_b = create_user(email_b, "pass123", "User B", tenant_b_id)
    
    if not uid_a or not uid_b:
        print(f"FAILED: User creation failed. A={uid_a}, B={uid_b}")
        return

    user_a = get_user_by_id(uid_a)
    user_b = get_user_by_id(uid_b)
    print(f"Users Created: A={user_a['id']}, B={user_b['id']}")

    # 3. Create Workspaces
    ws_a = create_workspace(user_a["id"], user_a["tenant_id"], "Workspace A")
    ws_b = create_workspace(user_b["id"], user_b["tenant_id"], "Workspace B")
    print(f"Workspaces Created: A={ws_a}, B={ws_b}")

    # 4. Insert Data for Tenant A
    profiles_a = [
        {"name": "Alice", "email": "alice@a.com", "external_id": "ext_a1"},
        {"name": "Alex", "email": "alex@a.com", "external_id": "ext_a2"}
    ]
    inserted_a = crm_upsert_profiles(user_a["id"], user_a["tenant_id"], profiles_a, ws_a)
    print(f"Tenant A data inserted: {inserted_a}")

    # 5. Insert Data for Tenant B
    profiles_b = [
        {"name": "Bob", "email": "bob@b.com", "external_id": "ext_b1"}
    ]
    inserted_b = crm_upsert_profiles(user_b["id"], user_b["tenant_id"], profiles_b, ws_b)
    print(f"Tenant B data inserted: {inserted_b}")

    # 6. Verify Isolation
    results_a = crm_get_profiles(user_a["id"], user_a["tenant_id"])
    results_b = crm_get_profiles(user_b["id"], user_b["tenant_id"])
    
    print(f"Results A: {len(results_a)}, Results B: {len(results_b)}")
    
    assert len(results_a) == 2, f"Tenant A should have 2 profiles, got {len(results_a)}"
    assert len(results_b) == 1, f"Tenant B should have 1 profile, got {len(results_b)}"
    
    # 7. Verify NO leakage (Cross-check)
    results_a_names = [p['name'] for p in results_a]
    assert "Bob" not in results_a_names, "Tenant A saw Tenant B data!"
    
    print("SUCCESS: Multi-Tenancy Data Isolation Verified!")

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"CRITICAL ERROR in test: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
