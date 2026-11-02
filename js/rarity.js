// Rarity scoring. Two independent signals are combined:
//  1. Conservation listing – Victorian FFG Act (state), EPBC Act (national),
//     or IUCN Red List (via iNaturalist). This is "officially rare".
//  2. Local rarity – how few records a species has in the search area compared
//     with other species in the same life group. This is "rarely seen here".

const THREAT_RANK = {
  'extinct in the wild': 6, 'critically endangered': 5, 'endangered': 4,
  'vulnerable': 3, 'near threatened': 2, 'conservation dependent': 2,
  'data deficient': 1, 'rare': 2, 'threatened': 3,
};

export function threatRank(label) {
  if (!label) return 0;
  return THREAT_RANK[String(label).toLowerCase()] ?? 0;
}

export const LOCAL_TIERS = [
  { id: 'veryrare', label: 'Very rare here', score: 4 },
  { id: 'rare',     label: 'Rare here',      score: 3 },
  { id: 'uncommon', label: 'Uncommon here',  score: 2 },
  { id: 'common',   label: 'Common here',    score: 1 },
  { id: 'abundant', label: 'Abundant here',  score: 0 },
];

/** Assign `records`, `threat`, `local` and `rarityScore` to each species. */
export function scoreRarity(species) {
  for (const s of species) {
    s.records = Math.max(s.inatCount || 0, s.alaCount || 0);
    const listings = [
      s.vic && { label: s.vic, src: 'Vic FFG' },
      s.epbc && { label: s.epbc, src: 'EPBC' },
      s.iucn && s.iucn.status && { label: s.iucn.status, src: 'IUCN' },
    ].filter(Boolean);
    s.listings = listings;
    s.threat = Math.max(0, ...listings.filter(l => l.src !== 'IUCN' || threatRank(l.label) >= 3).map(l => threatRank(l.label)));
  }

  // Local rarity: percentile of record counts within each group.
  const byGroup = new Map();
  for (const s of species) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group).push(s.records);
  }
  for (const counts of byGroup.values()) counts.sort((a, b) => a - b);

  for (const s of species) {
    const counts = byGroup.get(s.group);
    const below = lowerBound(counts, s.records);           // species with fewer records
    const pct = counts.length > 1 ? below / (counts.length - 1) : 0.5;
    let tier;
    if (s.records <= 1) tier = 'veryrare';
    else if (s.records <= 3 || pct < 0.15) tier = 'rare';
    else if (pct < 0.45) tier = 'uncommon';
    else if (pct < 0.85) tier = 'common';
    else tier = 'abundant';
    s.local = tier;
    const localScore = LOCAL_TIERS.find(t => t.id === tier).score;
    s.rarityScore = s.threat * 10 + localScore; // listings outrank local scarcity
  }
  return species;
}

function lowerBound(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

export function threatClass(label) {
  const r = threatRank(label);
  if (r >= 5) return 'cr';
  if (r === 4) return 'en';
  if (r === 3) return 'vu';
  if (r >= 1) return 'nt';
  return 'lc';
}
