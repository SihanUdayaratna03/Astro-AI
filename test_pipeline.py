import requests
import time
import os

upload_dir = "uploads"
pdfs = [f for f in os.listdir(upload_dir) if f.lower().endswith(".pdf")]

if not pdfs:
    print("No PDFs found in uploads/")
else:
    pdf = pdfs[0]
    print(f"Testing with: {pdf}")

    with open(f"{upload_dir}/{pdf}", "rb") as f:
        r = requests.post(
            "http://127.0.0.1:8000/api/upload",
            files={"file": (pdf, f, "application/pdf")},
        )
    print("Upload status:", r.status_code)
    data = r.json()
    print("Upload response:", data)
    job_id = data["event_id"]

    for i in range(60):
        time.sleep(3)
        s = requests.get(f"http://127.0.0.1:8000/api/status/{job_id}").json()
        print(f"  [{i*3}s] Status:", s["status"])
        if s["status"] == "completed":
            print("SUCCESS:", s)
            break
        elif s["status"] == "failed":
            print("FAILED:", s)
            break
    else:
        print("TIMEOUT - job still running after 3 minutes")
