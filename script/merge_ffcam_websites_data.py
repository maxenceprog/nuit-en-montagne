import json
import re
from bs4 import BeautifulSoup

# Load refuge JSON file
with open("refuges.json", "r", encoding="utf-8") as f:
    json_data = json.load(f)

# Load and parse HTML file
with open("refuges.html", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

# Build a dict from JSON keyed by cleaned name
json_refuges = {}
for rid, info in json_data.items():
    name = info["name"].strip().lower()
    json_refuges[name] = info

# Helper: Normalize names
def normalize_name(name):
    return re.sub(r"\s+", " ", name).strip().lower()

# Final merged result
merged_data = []

# Extract info from each HTML item
for item in soup.select(".seolanMap-item"):
    html_name = item.select_one("h3").text.strip()
    norm_name = normalize_name(html_name)

    # Extract lat/lng
    lat = float(item["data-lat"])
    lng = float(item["data-lng"])

    # Description
    description = item.select_one(".description").text.strip() if item.select_one(".description") else ""

    # Gardien
    gardien = item.select_one(".gardien")
    gardien = gardien.text.replace("Gardien(ne) :", "").strip() if gardien else None

    # Places, Altitude
    infos = item.select_one(".infos").text
    match = re.search(r"(\d+)\s*m\s*-\s*(\d+)\s*places", infos)
    altitude, places = (int(match.group(1)), int(match.group(2))) if match else (None, None)

    # URLs
    urls = [a["href"] for a in item.select("a") if "href" in a.attrs]

    # Match with JSON data
    json_match = json_refuges.get(norm_name)
    if json_match:
        merged = {
            "name": html_name,
            "lat": lat,
            "lng": lng,
            "altitude_m": altitude,
            "places": places,
            "gardien": gardien,
            "description": description,
            "urls": urls,
            "backend": json_match
        }
        merged_data.append(merged)
    else:
        print(f"Warning: No JSON match found for '{html_name}'")

# Save to final JSON file
with open("merged_refuges.json", "w", encoding="utf-8") as f:
    json.dump(merged_data, f, ensure_ascii=False, indent=2)

print("Merged JSON created as 'merged_refuges.json'")
