import json

# Load data
with open("merged_refuges.json", "r", encoding="utf-8") as f:
    refuges = json.load(f)

with open("my_refuge_availabilities.json", "r", encoding="utf-8") as f:
    availabilities = json.load(f)

# Build lookup by structure ID (e.g., BK_STRUCTURE:85)
refuge_by_structure = {
    refuge["backend"]["structure"]: refuge
    for refuge in refuges
}

# Merge
merged = []

for refuge_name, data in availabilities.items():
    structure_id = data.get("structure")
    refuge_info = refuge_by_structure.get(structure_id)

    if refuge_info:
        merged.append({
            "name": refuge_info["name"],
            "structure": structure_id,
            "lat": refuge_info.get("lat"),
            "lng": refuge_info.get("lng"),
            "places": refuge_info.get("places"),
            "availability": data.get("availability", {}),
            "available_on_aug_13": data.get("available_on_aug_13", False),
            "places_on_aug_13": data.get("places_on_aug_13", 0),
        })
    else:
        print(f"⚠️ No refuge found for structure ID: {structure_id} (from {refuge_name})")

# Save merged output
with open("merged_availability_refuges.json", "w", encoding="utf-8") as f:
    json.dump(merged, f, indent=2, ensure_ascii=False)

print("✅ Merged data written to merged_availability_refuges.json")
