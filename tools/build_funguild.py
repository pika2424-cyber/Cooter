#!/usr/bin/env python3
"""Build data/mycorrhizal-guilds.json from the FUNGuild database
(Nguyen et al. 2016, Fungal Ecology 20:241-248; https://github.com/UMNFuN/FUNGuild).

Keeps only taxa whose guild includes a mycorrhizal type, at genus or species
level, as  { "<taxon lowercase>": ["EcM", "Probable"] , ... }.

Usage:  python3 tools/build_funguild.py            (downloads the database)
        python3 tools/build_funguild.py file.json  (uses a saved copy)
"""
import json, sys, urllib.request, datetime, pathlib

URL = "http://www.stbates.org/funguild_db.php"
TYPES = [("Ectomycorrhizal", "EcM"), ("Arbuscular Mycorrhizal", "AM"),
         ("Ericoid Mycorrhizal", "ErM"), ("Orchid Mycorrhizal", "OrM"),
         ("Endomycorrhizal", "Endo")]
LEVELS = {"13": "genus", "20": "species", "21": "species", "22": "species"}

def main():
    if len(sys.argv) > 1:
        text = pathlib.Path(sys.argv[1]).read_text()
    else:
        with urllib.request.urlopen(URL, timeout=180) as r:
            text = r.read().decode("utf-8")
    data = json.loads(text[text.index("["): text.rindex("]") + 1])
    out = {}
    for row in data:
        if row.get("taxonomicLevel") not in LEVELS:
            continue
        guild = row.get("guild", "")
        types = [code for name, code in TYPES if name in guild]
        if not types:
            continue
        conf = row.get("confidenceRanking", "")
        out[row["taxon"].strip().lower()] = ["+".join(types), conf]
    dest = pathlib.Path(__file__).resolve().parent.parent / "data" / "mycorrhizal-guilds.json"
    dest.write_text(json.dumps({
        "source": "FUNGuild (Nguyen et al. 2016, Fungal Ecology 20:241-248)",
        "url": "https://github.com/UMNFuN/FUNGuild",
        "built": datetime.date.today().isoformat(),
        "taxa": dict(sorted(out.items())),
    }, separators=(",", ":")))
    print(f"wrote {len(out)} taxa to {dest} ({dest.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
