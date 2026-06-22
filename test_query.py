import requests
import time

print("Testing query pipeline...")
r = requests.post(
    "http://127.0.0.1:8000/api/query",
    json={"question": "What is the main topic of this document?"},
)
print("Query status:", r.status_code)
data = r.json()
print("Query response:", data)
job_id = data["event_id"]

for i in range(60):
    time.sleep(3)
    s = requests.get(f"http://127.0.0.1:8000/api/status/{job_id}").json()
    print(f"  [{i*3}s] Status:", s["status"])
    if s["status"] == "completed":
        print("\n=== ANSWER ===")
        print(s["output"]["answer"])
        print("\n=== SOURCES ===")
        print(s["output"]["sources"])
        break
    elif s["status"] == "failed":
        print("FAILED:", s)
        break
else:
    print("TIMEOUT")
