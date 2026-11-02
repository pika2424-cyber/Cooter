#!/usr/bin/env python3
"""Build data/introduced.json from the ALA "Non Native Species List for
Australia and Territories" (dr32213).

The ALA lists service doesn't allow cross-origin browser requests and the
full list is ~14 MB, so the app ships this compact copy instead:
  { "species": { "<genus species, lowercase>": "*VIC,NSW,..." }, ... }
listing the states/territories where each species is introduced; a leading
"*" marks species that are exotic to Australia altogether.

Re-run occasionally to refresh:  python3 tools/build_introduced.py
"""
import json, re, urllib.request, datetime, pathlib

LIST = "dr32213"
URL = f"https://lists-ws.ala.org.au/ws/speciesListItems/{LIST}?max=20000&includeKVP=true"
STATES = {
    "Victoria_Status": "VIC", "New_South_Wales_Status": "NSW", "Queensland_Status": "QLD",
    "South_Australia_Status": "SA", "Tasmania_Status": "TAS", "Western_Australia_Status": "WA",
    "Northern_Territory_Status": "NT", "Australian_Capital_Territory_Status": "ACT",
}
# Treated as "not native here". 'native and introduced', 'uncertain origin',
# 'doubtfully introduced' and 'formerly introduced' are NOT excluded.
INTRODUCED = {"introduced", "introduced from elsewhere in australia",
              "introduced, uncertain origin", "probably introduced"}

def norm(name):
    name = re.sub(r"\s*\([^)]*\)\s*", " ", name)
    return " ".join(name.split()[:2]).lower()

def main():
    with urllib.request.urlopen(URL, timeout=120) as r:
        items = json.load(r)
    species = {}
    for it in items:
        kv = {k["key"]: k["value"] for k in it.get("kvpValues", [])}
        states = sorted({code for key, code in STATES.items()
                         if kv.get(key, "").strip().lower() in INTRODUCED})
        name = it.get("scientificName") or it.get("name")
        if not states or not name or len(name.split()) < 2:
            continue
        # "Exotic" = never described as native anywhere in Australia: every
        # status given is a plain introduction (not "from elsewhere in
        # Australia" or "native and introduced"). Exotics are excluded
        # nationally, which covers gaps in the per-state columns.
        values = [v.strip().lower() for k, v in kv.items() if k.endswith("_Status") and v.strip()]
        exotic = all(v in INTRODUCED and "elsewhere in australia" not in v for v in values)
        key = norm(name)
        prev = species.get(key, "")
        merged = sorted(set(prev.lstrip("*").split(",") + states) - {""})
        species[key] = ("*" if exotic and (not prev or prev.startswith("*")) else "") + ",".join(merged)
    out = {
        "source": f"Atlas of Living Australia – Non Native Species List for Australia and Territories ({LIST})",
        "url": f"https://lists.ala.org.au/speciesListItem/list/{LIST}",
        "built": datetime.date.today().isoformat(),
        "species": dict(sorted(species.items())),
    }
    path = pathlib.Path(__file__).resolve().parent.parent / "data" / "introduced.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {len(species)} species to {path} ({path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
