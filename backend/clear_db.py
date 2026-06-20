"""
clear_db.py — Truncates all collections in the yggen_ database.
Run once from the backend/ directory:
    python clear_db.py
"""
import sys
import os

# Allow imports from the app package
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from arango import ArangoClient

ARANGO_HOST = os.getenv("ARANGO_HOST", "http://localhost:8529")
ARANGO_USER = os.getenv("ARANGO_USERNAME", "root")
ARANGO_PASS = os.getenv("ARANGO_PASSWORD", "")
ARANGO_DB   = os.getenv("ARANGO_DB", "yggen")

COLLECTIONS_TO_CLEAR = ["expeditions", "nodes", "edges", "users"]

client = ArangoClient(hosts=ARANGO_HOST)
db = client.db(ARANGO_DB, username=ARANGO_USER, password=ARANGO_PASS)

print(f"Connected to ArangoDB: {ARANGO_HOST} / {ARANGO_DB}\n")

for col_name in COLLECTIONS_TO_CLEAR:
    if db.has_collection(col_name):
        count_before = db.collection(col_name).count()
        db.collection(col_name).truncate()
        print(f"  [OK]  {col_name:18s} -- cleared {count_before:,} documents")
    else:
        print(f"  [-]   {col_name:18s} -- collection not found, skipping")

print("\nDatabase is now empty. Ready for fresh start.")
