import sqlite3
import json

conn = sqlite3.connect("data/app.db")
cursor = conn.cursor()
cursor.execute("SELECT results FROM analysis_history LIMIT 1")
row = cursor.fetchone()
if row and row[0]:
    data = json.loads(row[0])
    reviews = data.get("reviews", [])
    if reviews:
        print("Review keys:\n" + "\n".join(reviews[0].keys()))
    else:
        print("No reviews found in the first analysis.")
else:
    print("No analysis found.")
