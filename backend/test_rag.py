import sys
import os
from dotenv import load_dotenv

# Load env variables so we can hit the LLM
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from copilot import chat_with_copilot
import pandas as pd

# Mock dataset
df = pd.DataFrame([
    {"score": 5, "content": "I love Horizon analytics!", "issue": "none"},
    {"score": 2, "content": "Too expensive for me.", "issue": "Pricing"}
])

print("Test 1: Internal question (Should NOT search web)", file=sys.stderr)
ans1 = chat_with_copilot("What are the main issues users complain about?", df, source="widget")
print(f"Ans 1: {ans1}\n", file=sys.stderr)

print("Test 2: External question (SHOULD search web)", file=sys.stderr)
ans2 = chat_with_copilot("Who are the top competitors for project management software and what are their prices?", df, source="widget")
print(f"Ans 2: {ans2}\n", file=sys.stderr)
