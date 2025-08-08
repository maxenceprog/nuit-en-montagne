import json
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from time import sleep

# Load local JSON
with open('merged_refuges.json', 'r', encoding='utf-8') as f:
    refuges = json.load(f)

# Rough bounding boxes for Isère, Savoie, Haute-Savoie (France)
def is_in_target_departments(lat, lng):
    return (
        (45.0 <= lat <= 46.5 and 5.0 <= lng <= 7.5)  # Covers Savoie, Haute-Savoie, and Isère
    )

# Only keep relevant refuges
filtered_refuges = [r for r in refuges if is_in_target_departments(r['lat'], r['lng'])]

session = requests.Session()
headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://centrale.ffcam.fr',
    'Referer': 'https://centrale.ffcam.fr/index.php?',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
}

# Data template
def build_payload(structure_oid, start_date):
    return {
        'action': 'availability',
        'parent_url': '',
        'widgetHostCss': '',
        'apporigin': 'FFCAM',
        'structures': '',
        'faqurl': '',
        'faqtitle': '',
        'mode': 'FORM',
        'structure': structure_oid,
        'productCategory': 'nomatter',
        'pax': '1',
        'date': start_date,
    }

results = {}

for refuge in filtered_refuges:
    name = refuge["name"]
    structure_oid = refuge["backend"]["structure"]
    date_str = datetime.today().strftime('%Y-%m-%d')  # or '2025-08-01'

    payload = build_payload(structure_oid, date_str)

    try:
        response = session.post(
            'https://centrale.ffcam.fr/index.php?',
            headers=headers,
            data=payload,
            timeout=10
        )

        soup = BeautifulSoup(response.text, 'html.parser')
        script_text = soup.find('script', text=re.compile("BK\.globalAvailability"))
        availability = {}

        if script_text:
            match = re.search(r'BK\.globalAvailability\s*=\s*({.*?});', script_text.string)
            if match:
                availability = json.loads(match.group(1))
        
        results[name] = {
            "structure": structure_oid,
            "availability": availability
        }

        print(f"✅ {name}: {len(availability)} dates retrieved")

    except Exception as e:
        print(f"❌ {name}: Error - {e}")
        results[name] = {
            "structure": structure_oid,
            "error": str(e)
        }

    sleep(1)  # Be polite

# Save output
with open('refuge_availabilities.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\nDone.")
