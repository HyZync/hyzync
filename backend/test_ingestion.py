import requests
import time

BASE_URL = "http://localhost:8000"

def test_ingestion():
    url = f"{BASE_URL}/api/fi/ingest/playstore"
    
    headers = {
        "Authorization": "Bearer dev_token_123"
    }
    
    payload = {
        "review_text": "The app keeps crashing when I try to check out. It's so frustrating and I missed the flash sale because of it! Fix your payment gateway.",
        "star_rating": 1,
        "username": "angry_shopper_99",
        "app_version": "2.4.1",
        "device": "Samsung Galaxy S23"
    }
    
    print(f"Sending Play Store payload to {url}...")
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=60)
        print(f"Status Code: {resp.status_code}")
        print(f"Response: {resp.json()}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_ingestion()
