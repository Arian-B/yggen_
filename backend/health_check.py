"""
wikiyggen_ system health check.
Run with: .\\venv\\Scripts\\python.exe health_check.py
"""
import sys, os, asyncio
sys.path.insert(0, os.getcwd())

print("=" * 52)
print("  wikiyggen_ SYSTEM HEALTH CHECK")
print("=" * 52)

results = {}

# ── 1. ArangoDB ─────────────────────────────────────
print("\n[1/4] ArangoDB")
try:
    from app.database.connection import db
    db.connect()                       # Must be called explicitly outside FastAPI
    colls = [c["name"] for c in db.db.collections() if not c["name"].startswith("_")]
    prop  = db.db.properties()
    print(f"  [OK] CONNECTED")
    print(f"  DB          : {prop['name']}")
    print(f"  Collections : {colls}")
    results["ArangoDB"] = "OK"
except Exception as e:
    print(f"  [FAIL] -- {e}")
    results["ArangoDB"] = f"FAIL: {e}"

# ── 2. Wikipedia ─────────────────────────────────────
print("\n[2/4] Wikipedia API")
try:
    import wikipedia
    results_list = wikipedia.search("Black hole", results=3)
    snippet = wikipedia.summary("Black hole", sentences=1)
    print(f"  [OK] CONNECTED")
    print(f"  Search      : {results_list}")
    print(f"  Sample      : {snippet[:120]}...")
    results["Wikipedia"] = "OK"
except Exception as e:
    print(f"  [FAIL] -- {e}")
    results["Wikipedia"] = f"FAIL: {e}"

# ── 3. Groq ──────────────────────────────────────────
print("\n[3/4] Groq (llama3-70b-8192) — Fast/Drift/Summary")
try:
    from app.services.providers.groq_provider import GroqProvider
    groq = GroqProvider()
    resp = asyncio.run(groq.generate_text(
        model=None,
        system_prompt="You are a test bot. Reply with exactly: CONNECTED",
        user_prompt="Ping."
    ))
    print(f"  [OK] CONNECTED")
    print(f"  Response    : {str(resp).strip()[:80]}")
    results["Groq"] = "OK"
except Exception as e:
    print(f"  [FAIL] -- {e}")
    results["Groq"] = f"FAIL: {e}"

# ── 4. Gemini ─────────────────────────────────────────
print("\n[4/4] Gemini (gemini-2.0-flash) — Smart/Graph")
try:
    from app.services.providers.gemini_provider import GeminiProvider
    gemini = GeminiProvider()
    resp = asyncio.run(gemini.generate_text(
        model=None,
        system_prompt="You are a test bot. Reply with exactly: CONNECTED",
        user_prompt="Ping."
    ))
    print(f"  [OK] CONNECTED")
    print(f"  Response    : {str(resp).strip()[:80]}")
    results["Gemini"] = "OK"
except Exception as e:
    print(f"  [FAIL] -- {e}")
    results["Gemini"] = f"FAIL: {e}"

# ── Summary ───────────────────────────────────────────
print("\n" + "=" * 52)
print("  RESULTS SUMMARY")
print("=" * 52)
all_ok = True
for svc, status in results.items():
    icon = "[OK]" if status == "OK" else "[FAIL]"
    print(f"  {icon}  {svc:<15} {status}")
    if status != "OK":
        all_ok = False

print()
if all_ok:
    print("  [OK]  All systems operational. Ready to launch!")
else:
    print("  [WARN] Some services need attention before launch.")
print("=" * 52)
