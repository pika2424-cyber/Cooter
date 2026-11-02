// Life groups used to organise results. Order matters: the first group whose
// iNaturalist taxon id appears in a taxon's ancestry wins, so specific groups
// come before their broader parents (e.g. Insects before "Other invertebrates").
//
// `inat`  – iNaturalist taxon ids that belong to this group
// `alaFq` – Atlas of Living Australia filter query(s) selecting this group
export const GROUPS = [
  { id: 'mammals',    name: 'Mammals',              icon: '🦘', inat: [40151],          alaFq: ['class:Mammalia'] },
  { id: 'birds',      name: 'Birds',                icon: '🐦', inat: [3],              alaFq: ['class:Aves'] },
  { id: 'reptiles',   name: 'Reptiles',             icon: '🦎', inat: [26036],          alaFq: ['class:Reptilia'] },
  { id: 'amphibians', name: 'Frogs & amphibians',   icon: '🐸', inat: [20978],          alaFq: ['class:Amphibia'] },
  { id: 'fish',       name: 'Fish',                 icon: '🐟', inat: [47178, 47273, 85497], alaFq: ['species_group:Fishes'] },
  { id: 'insects',    name: 'Insects',              icon: '🦋', inat: [47158],          alaFq: ['class:Insecta'] },
  { id: 'arachnids',  name: 'Spiders & arachnids',  icon: '🕷️', inat: [47119],          alaFq: ['class:Arachnida'] },
  { id: 'crustaceans',name: 'Crustaceans',          icon: '🦀', inat: [85493],          alaFq: ['species_group:Crustaceans'] },
  { id: 'molluscs',   name: 'Molluscs',             icon: '🐌', inat: [47115],          alaFq: ['phylum:Mollusca'] },
  { id: 'otherinv',   name: 'Other invertebrates',  icon: '🪱', inat: [1],              alaFq: ['kingdom:Animalia', '-phylum:Chordata', '-phylum:Arthropoda', '-phylum:Mollusca'] },
  { id: 'flowering',  name: 'Flowering plants',     icon: '🌼', inat: [47125],          alaFq: ['species_group:"Flowering plants"'] },
  { id: 'conifers',   name: 'Conifers & cycads',    icon: '🌲', inat: [136329, 136336], alaFq: ['species_group:"Conifers, Cycads"'] },
  { id: 'ferns',      name: 'Ferns & allies',       icon: '🌿', inat: [121943, 47623], alaFq: ['species_group:"Ferns and allies"'] },
  { id: 'bryophytes', name: 'Mosses & liverworts',  icon: '🌱', inat: [311249, 64615, 56327], alaFq: ['species_group:Bryophytes'] },
  { id: 'algae',      name: 'Algae & seaweeds',     icon: '🪸', inat: [48222, 57774, 50863], alaFq: ['species_group:Algae'] },
  { id: 'otherplants',name: 'Other plants',         icon: '🪴', inat: [47126],          alaFq: null },
  { id: 'fungi',      name: 'Fungi & lichens',      icon: '🍄', inat: [47170],          alaFq: ['kingdom:Fungi'] },
  { id: 'protists',   name: 'Protists & other',     icon: '🦠', inat: [47686],          alaFq: null },
];

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map(g => [g.id, g]));

/** Classify an iNaturalist taxon (needs ancestor_ids) into a group id. */
export function groupForInatTaxon(taxon) {
  const anc = new Set(taxon.ancestor_ids || []);
  anc.add(taxon.id);
  for (const g of GROUPS) {
    if (g.inat.some(id => anc.has(id))) return g.id;
  }
  return 'protists';
}

/** Normalise a scientific name so iNat and ALA names can be matched. */
export function normaliseName(name) {
  if (!name) return '';
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ') // drop subgenus "(Myzantha)"
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)                       // genus + species epithet
    .join(' ')
    .toLowerCase();
}
