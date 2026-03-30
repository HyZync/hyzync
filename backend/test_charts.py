import sys
import os
from dotenv import load_dotenv

# Load env variables so we can hit the LLM
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from copilot import chat_with_copilot
import pandas as pd

# Mock dataset representing sentiments
df = pd.DataFrame([
    {"score": 5, "content": "Great app", "sentiment": "positive"},
    {"score": 5, "content": "Awesome", "sentiment": "positive"},
    {"score": 4, "content": "Good", "sentiment": "positive"},
    {"score": 2, "content": "Bad features", "sentiment": "negative"},
    {"score": 1, "content": "Terrible performance", "sentiment": "negative"},
    {"score": 3, "content": "Okay", "sentiment": "neutral"}
])

print("Testing Chart Generation request...", file=sys.stderr)
ans1 = chat_with_copilot("Generate a pie chart showing the distribution of sentiments in these reviews.", df, source="tab")
print(f"Response:\n{ans1}\n", file=sys.stderr)

print("Testing Bar Chart...", file=sys.stderr)
ans2 = chat_with_copilot("Show me a bar chart of the count of positive, negative, and neutral reviews.", df, source="tab")
print(f"Response:\n{ans2}\n", file=sys.stderr)
