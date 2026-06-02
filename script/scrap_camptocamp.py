import json
import re
import time

import requests

# ---------------------------------------------------------------------------
C2C_API = "https://api.camptocamp.org"
HEADERS = {
    "User-Agent": "nuit-en-montagne-bot/1.0 (https://github.com/maxenceprog/nuit-en-montagne)",
    "Accept": "application/json",
}
# ---------------------------------------------------------------------------


def clean_name(raw):
    name = re.sub(r"\s*\(FFCAM\)\s*", " ", raw, flags=re.IGNORECASE)
    name = re.sub(r"\s+", " ", name).strip()
    return name.title()


def slugify(text):
    text = text.lower()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[èéêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^\w]+", "-", text)
    return text.strip("-")


# ---------------------------------------------------------------------------

with open("src/data/refuges.json", encoding="utf-8") as f:
    refuges = json.load(f)

results = {}
ACCEPTED_TYPES = {"hut", "gite", "camp_site", "shelter"}

for structure_id, refuge in refuges.items():
    name = clean_name(refuge["name"])
    lat = refuge.get("lat")
    lng = refuge.get("lng")

    try:
        resp = requests.get(
            f"{C2C_API}/search",
            params={"q": name, "lang": "fr", "limit": 20, "t": "w"},
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"⚠️  {name}: {exc}")
        results[structure_id] = None
        time.sleep(0.5)
        continue

    waypoints = data.get("waypoints", {}).get("documents", [])

    if len(waypoints) == 0:
        print(f"⚠️  {name} not found")
        continue

    best_wp = waypoints[0]

    doc_id = best_wp["document_id"]
    locale = next(
        (local for local in best_wp.get("locales", []) if local.get("lang") == "fr"),
        (best_wp.get("locales") or [{}])[0],
    )
    title = locale.get("title", name)
    url = f"https://www.camptocamp.org/waypoints/{doc_id}/fr/{slugify(title)}"
    results[structure_id] = url
    print(f"✅  {name}  →  {title})")


# ---------------------------------------------------------------------------
with open("src/data/camptocamp_links.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

found = sum(1 for v in results.values() if v)
print(f"\n✅  {found}/{len(results)} refuges matched")
