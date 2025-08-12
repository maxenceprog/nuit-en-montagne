import json
import re
from time import sleep

import requests
from bs4 import BeautifulSoup

# ----------- Load Refuges Data -----------
with open("src/data/refuges.json", "r", encoding="utf-8") as f:
    refuges = json.load(f)



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


for refuge in refuges:
    name = refuge["name"]
    structure_oid = refuge["backend"]["structure"]
    payload = build_payload(structure_oid)

    try:
        response = session.post(url, headers=headers, data=payload, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        script_tag = soup.find("script", text=re.compile("BK\.globalAvailability"))

        availability = {}
        if script_tag:
            match = re.search(
                r"BK\.globalAvailability\s*=\s*({.*?});", script_tag.string
            )
            if match:
                availability = json.loads(match.group(1))

        results[structure_oid] = {
            "name": name,
            "structure": structure_oid,
            "availability": availability,
        }

        print(f"Get {name} availability")

    except Exception as e:
        print(f"⚠️ Error fetching {name}: {e}")
        results[name] = {
            "name": name,
            "structure": structure_oid,
            "error": str(e),
        }

    sleep(0.3)  # Be polite

# ----------- Save Results -----------
with open("src/data/refuge_availabilities.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)


print("\n✅ Done.")
