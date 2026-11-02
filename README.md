# Cooter – Native Species Near You

A mobile-friendly web app that shows the **native species recorded around your location**, organised by type of life, with **rarity** ratings, your **Ecological Vegetation Class (EVC)**, and a personal **checklist**.

## Features

- **Location** – use your phone/computer GPS or tap anywhere on the map. Radius 1–25 km.
- **EVC lookup (Victoria)** – shows the EVC you're standing in (e.g. *Swampy Riparian Woodland, EVC 83*), its Bioregional Conservation Status, bioregion and patch size; the **pre-1750 EVC** where vegetation has been cleared; and all EVCs mapped within your radius. EVC map overlay on the map.
- **EVC patch search** – optionally restrict results to species recorded inside the vegetation patch you're standing in.
- **Grouped by type of life** – mammals, birds, reptiles, frogs, fish, insects, spiders, crustaceans, molluscs, other invertebrates, flowering plants, conifers, ferns, mosses, algae, fungi & lichens, protists.
- **Multiple sources merged** – iNaturalist + Atlas of Living Australia (which includes the Victorian Biodiversity Atlas, museums, eBird, BirdLife…).
- **Rarity**
  - Threatened listings: Victorian **FFG Act**, national **EPBC Act**, **IUCN** Red List.
  - Local rarity (Very rare / Rare / Uncommon / Common / Abundant here) based on how few records a species has compared to others in its group.
  - Sort "Rarest first" or filter to threatened / rare only.
- **Checklist** – tick ✔ species you've seen (date + place recorded), ☆ species you want to find, add notes, see your progress per group for the current area, export to CSV, back up / restore to move between devices.
- Works offline for your checklist (installable as a PWA – "Add to Home Screen").

## Running it

It's a static site – no build step, no server, no API keys.

**GitHub Pages:** in the repo go to *Settings → Pages*, choose *Deploy from a branch*, pick the branch and `/ (root)`. The app will be at `https://<user>.github.io/<repo>/`. (Geolocation needs HTTPS, which Pages provides.)

**Locally:**

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Data sources

| Source | Used for |
| --- | --- |
| [iNaturalist API](https://api.inaturalist.org/v1/docs/) | Native species observation counts, photos, common names, IUCN status, introduced-species list |
| [ALA biocache](https://biocache-ws.ala.org.au/ws/) | Species records from VBA/museums/eBird etc., Vic FFG and EPBC conservation status |
| [DataVic NV2005_EVCBCS / NV1750_EVCBCS](https://discover.data.vic.gov.au/) (DEECA) | EVC at your location, pre-European EVC, EVCs nearby, map overlay |

## Code layout

```
index.html          UI
css/styles.css      styles (light/dark)
js/app.js           map, search flow, rendering
js/sources.js       iNaturalist / ALA / EVC API clients + geometry helpers
js/groups.js        life-group definitions & name matching
js/rarity.js        rarity scoring
js/checklist.js     checklist storage (localStorage), CSV/JSON export
sw.js               offline cache
```

## Notes & limitations

- EVC mapping covers Victoria only; species search works anywhere in Australia.
- iNaturalist can't search by polygon, so in "EVC patch" mode iNat uses the patch's bounding box (ALA uses the exact shape).
- Local rarity reflects how often a species is *recorded*, which also depends on how conspicuous it is.
- Sensitive species locations are generalised by data providers.
