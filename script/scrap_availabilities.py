import json
import requests
import re
from bs4 import BeautifulSoup
from time import sleep

# ----------- Load Refuges Data -----------
with open("merged_refuges.json", "r", encoding="utf-8") as f:
    refuges = json.load(f)

# ----------- Exclude Pyrénées -----------
def select_area(refuge):
    try:
        lat = refuge["lat"]
        lng = refuge["lng"]
        return  (45.0 <= lat <= 46.5 and 5.0 <= lng <= 7.5)  # Covers Savoie, Haute-Savoie, and Isère
    except KeyError:
        # If lat/lng are missing, include the refuge
        return True

filtered_refuges = [r for r in refuges if select_area(r)]

# ----------- FFCAM Endpoint & Headers -----------
url = "https://centrale.ffcam.fr/index.php?"
headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://centrale.ffcam.fr",
    "Referer": "https://centrale.ffcam.fr/index.php?",
    "Accept-Encoding": "gzip, deflate, br, zstd",
}

# ----------- Request Template -----------
def build_payload(structure_oid, date="2025-08-01"):
    return {
        "action": "availability",
        "parent_url": "",
        "widgetHostCss": "",
        "apporigin": "FFCAM",
        "structures": "",
        "faqurl": "",
        "faqtitle": "",
        "mode": "FORM",
        "structure": structure_oid,
        "productCategory": "nomatter",
        "pax": "1",
        "date": date,
    }

# ----------- Start Scraping -----------
session = requests.Session()
results = {}
target_date = "2025-08-13"

print("🔍 Checking availability for 2025-08-13...\n")

for refuge in filtered_refuges:
    name = refuge["name"]
    structure_oid = refuge["backend"]["structure"]
    payload = build_payload(structure_oid)

    try:
        response = session.post(url, headers=headers, data=payload, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        script_tag = soup.find("script", text=re.compile("BK\.globalAvailability"))

        availability = {}
        if script_tag:
            match = re.search(r"BK\.globalAvailability\s*=\s*({.*?});", script_tag.string)
            if match:
                availability = json.loads(match.group(1))

        available_places = availability.get(target_date, 0)
        is_available = available_places > 0

        results[name] = {
            "structure": structure_oid,
            "availability": availability,
        }
        print(f"Get {name} availability")

    except Exception as e:
        print(f"⚠️ Error fetching {name}: {e}")
        results[name] = {
            "structure": structure_oid,
            "error": str(e)
        }

    sleep(1)  # Be polite

# ----------- Save Results -----------
with open("refuge_availabilities.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\n✅ Done.")
