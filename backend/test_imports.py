import sys
import os

print("Testing imports...")

try:
    print("Importing config...")
    import config
    print("Config imported.")
except Exception as e:
    print(f"Config import failed: {e}")

try:
    print("Importing security...")
    import security
    print("Security imported.")
except Exception as e:
    print(f"Security import failed: {e}")

try:
    print("Importing database...")
    import database
    print("Database imported.")
except Exception as e:
    print(f"Database import failed: {e}")

try:
    print("Importing main...")
    import main
    print("Main imported.")
except Exception as e:
    print(f"Main import failed: {e}")

print("Done.")
