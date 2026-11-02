// Data source clients: Victorian EVC mapping (DataVic / DEECA), iNaturalist and
// the Atlas of Living Australia (ALA). All of these APIs allow cross-origin
// requests, so the app runs entirely in the browser with no server.

import { GROUPS, groupForInatTaxon, normaliseName } from './groups.js';

const EVC_WFS = 'https://opendata.maps.vic.gov.au/geoserver/wfs';
export const EVC_WMS = 'https://opendata.maps.vic.gov.au/geoserver/wms';
export const EVC_LAYER_2005 = 'open-data-platform:nv2005_evcbcs';
export const EVC_LAYER_1750 = 'open-data-platform:nv1750_evcbcs';
const INAT = 'https://api.inaturalist.org/v1';
const ALA = 'https://biocache-ws.ala.org.au/ws';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, { retries = 2, signal } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (res.status === 429 && attempt < retries) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError' || attempt >= retries) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Square bounding box (lon/lat) of a circle of radiusKm around a point. */
export function radiusBBox(lat, lng, radiusKm) {
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  return { minX: lng - dLng, minY: lat - dLat, maxX: lng + dLng, maxY: lat + dLat };
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sutherland–Hodgman clip of a ring to an axis-aligned box. */
function clipRing(ring, b) {
  const edges = [
    [p => p[0] >= b.minX, (p, q) => interp(p, q, 0, b.minX)],
    [p => p[0] <= b.maxX, (p, q) => interp(p, q, 0, b.maxX)],
    [p => p[1] >= b.minY, (p, q) => interp(p, q, 1, b.minY)],
    [p => p[1] <= b.maxY, (p, q) => interp(p, q, 1, b.maxY)],
  ];
  function interp(p, q, axis, v) {
    const t = (v - p[axis]) / (q[axis] - p[axis]);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  }
  let out = ring;
  for (const [inside, cross] of edges) {
    const input = out; out = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  return out;
}

/** Douglas–Peucker simplification, increasing tolerance until under maxPts. */
function simplifyRing(ring, maxPts = 150) {
  if (ring.length <= maxPts) return ring;
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let maxD = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = segDist(pts[i], a, b);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= tol) return [a, b];
    const left = dp(pts.slice(0, idx + 1), tol), right = dp(pts.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  };
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  let tol = 0.00005, out = ring;
  while (out.length > maxPts && tol < 1) { out = dp(ring, tol); tol *= 2; }
  return out;
}

/**
 * Turn an EVC (Multi)Polygon into a simplified single ring around the user's
 * point, clipped to the search radius. Returns { ring, bbox } or null.
 */
export function evcSearchArea(geometry, lat, lng, radiusKm) {
  if (!geometry) return null;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const pt = [lng, lat];
  let outer = polys.find(p => pointInRing(pt, p[0]))?.[0];
  if (!outer) outer = polys.slice().sort((a, b) => b[0].length - a[0].length)[0][0];
  const box = radiusBBox(lat, lng, radiusKm);
  let ring = clipRing(outer.slice(0, -1), box);
  if (ring.length < 3) return null;
  ring = simplifyRing(ring);
  ring.push(ring[0]);
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  return {
    ring,
    bbox: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
  };
}

// ---------------------------------------------------------------------------
// EVC (Ecological Vegetation Class) – Victoria, DataVic open data
// ---------------------------------------------------------------------------

function evcWfsUrl(layer, extra) {
  const p = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature',
    outputFormat: 'application/json', srsName: 'EPSG:4326', typeNames: layer, ...extra,
  });
  return `${EVC_WFS}?${p}`;
}

/** EVC polygon (2005 extant or 1750 pre-European) at a point, or null. */
export async function evcAtPoint(lat, lng, layer = EVC_LAYER_2005) {
  const url = evcWfsUrl(layer, {
    count: '1',
    CQL_FILTER: `INTERSECTS(geom,POINT(${lat} ${lng}))`,
  });
  const data = await getJSON(url);
  const f = data.features?.[0];
  return f ? { ...f.properties, geometry: f.geometry } : null;
}

/** Distinct EVCs mapped within the search box, with area totals. */
export async function evcsNearby(lat, lng, radiusKm) {
  const b = radiusBBox(lat, lng, radiusKm);
  const url = evcWfsUrl(EVC_LAYER_2005, {
    count: '2000',
    propertyName: 'x_evcname,evc,evc_bcs_desc,hectares,bioregion,x_groupname',
    CQL_FILTER: `BBOX(geom,${b.minY},${b.minX},${b.maxY},${b.maxX})`,
  });
  const data = await getJSON(url);
  const byEvc = new Map();
  for (const f of data.features || []) {
    const p = f.properties;
    if (!p.x_evcname) continue;
    const key = `${p.evc}|${p.bioregion}`;
    const cur = byEvc.get(key) || { ...p, patches: 0, hectares: 0 };
    cur.patches += 1;
    cur.hectares += p.hectares || 0;
    byEvc.set(key, cur);
  }
  return {
    evcs: [...byEvc.values()].sort((a, b) => b.hectares - a.hectares),
    truncated: (data.features || []).length >= 2000,
  };
}

// ---------------------------------------------------------------------------
// iNaturalist
// ---------------------------------------------------------------------------

function inatAreaParams(area) {
  if (area.bbox) {
    return { swlat: area.bbox.minY, swlng: area.bbox.minX, nelat: area.bbox.maxY, nelng: area.bbox.maxX };
  }
  return { lat: area.lat, lng: area.lng, radius: area.radiusKm };
}

async function inatSpeciesCounts(params, { maxPages = 6, onPage, signal } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const p = new URLSearchParams({ ...params, per_page: '500', page: String(page), locale: 'en' });
    const data = await getJSON(`${INAT}/observations/species_counts?${p}`, { signal });
    all.push(...data.results);
    onPage?.(all.length, data.total_results);
    if (all.length >= data.total_results || !data.results.length) break;
    await sleep(1000); // be polite: iNat asks for ~1 request/second
  }
  return all;
}

/**
 * Native species observed in the area according to iNaturalist.
 * opts.nativeMode: 'strict' (native=true) or 'notIntroduced' (introduced=false)
 */
export async function inatNativeSpecies(area, opts = {}, onProgress, signal) {
  const params = {
    ...inatAreaParams(area),
    rank: 'species',
    captive: 'false', // exclude garden plants, street trees and captive animals
    quality_grade: opts.researchOnly ? 'research' : 'research,needs_id',
    ...(opts.nativeMode === 'notIntroduced' ? { introduced: 'false' } : { native: 'true' }),
    ...(opts.sinceYear ? { d1: `${opts.sinceYear}-01-01` } : {}),
  };
  const results = await inatSpeciesCounts(params, {
    signal,
    onPage: (n, total) => onProgress?.(`iNaturalist: ${n} of ${total} species`),
  });
  return results.map(r => {
    const t = r.taxon;
    return {
      key: normaliseName(t.name),
      name: t.name,
      common: t.preferred_common_name || '',
      group: groupForInatTaxon(t),
      inatId: t.id,
      inatCount: r.count,
      inatGlobalCount: t.observations_count,
      photo: t.default_photo?.square_url || '',
      photoMedium: t.default_photo?.medium_url || '',
      photoAttribution: t.default_photo?.attribution || '',
      wikipedia: t.wikipedia_url || '',
      iucn: t.conservation_status ? {
        status: t.conservation_status.status_name || t.conservation_status.status,
        authority: t.conservation_status.authority || 'IUCN',
      } : null,
      threatened: !!t.threatened,
    };
  });
}

/** Names of introduced species in the area (used to clean ALA results). */
export async function inatIntroducedNames(area, signal) {
  const results = await inatSpeciesCounts(
    { ...inatAreaParams(area), rank: 'species', introduced: 'true' },
    { maxPages: 3, signal },
  );
  return new Set(results.map(r => normaliseName(r.taxon.name)));
}

/** Look up iNat photos/common names for species only found in ALA. */
export async function inatTaxaByName(names, signal) {
  const out = new Map();
  // /taxa?q= takes one name at a time, so keep this to a modest number.
  for (const name of names.slice(0, 40)) {
    try {
      const p = new URLSearchParams({ q: name, rank: 'species', per_page: '1', locale: 'en' });
      const data = await getJSON(`${INAT}/taxa?${p}`, { signal, retries: 0 });
      const t = data.results?.[0];
      if (t && normaliseName(t.name) === normaliseName(name)) out.set(normaliseName(name), t);
    } catch (e) { if (e.name === 'AbortError') throw e; }
    await sleep(1000);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Atlas of Living Australia (aggregates VBA, museums, eBird, iNat etc.)
// ---------------------------------------------------------------------------

function alaAreaParams(area) {
  if (area.ring) {
    const wkt = 'POLYGON((' + area.ring.map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join(',') + '))';
    return [['wkt', wkt]];
  }
  return [['lat', area.lat], ['lon', area.lng], ['radius', area.radiusKm]];
}

function alaUrl(area, fqs, facet, opts) {
  const p = new URLSearchParams([
    ['q', '*:*'], ['pageSize', '0'], ['facets', facet], ['flimit', '3000'], ['fsort', 'count'],
    ...alaAreaParams(area),
    ['fq', '-establishment_means:introduced'],
    ['fq', '-degreeOfEstablishment:cultivated'],
    ['fq', 'taxonRank:(species OR subspecies OR variety OR form)'],
    ...(opts.sinceYear ? [['fq', `year:[${opts.sinceYear} TO *]`]] : []),
    ...fqs.map(f => ['fq', f]),
  ]);
  return `${ALA}/occurrences/search?${p}`;
}

function parseFacet(data) {
  return data.facetResults?.[0]?.fieldResult?.filter(r => r.label && r.label !== 'Not supplied') || [];
}

/** Species recorded in ALA, one request per life group. */
export async function alaSpecies(area, opts = {}, onProgress, signal) {
  const groups = GROUPS.filter(g => g.alaFq);
  let done = 0;
  const lists = await Promise.all(groups.map(async g => {
    const data = await getJSON(alaUrl(area, g.alaFq, 'names_and_lsid', opts), { signal });
    onProgress?.(`Atlas of Living Australia: ${++done} of ${groups.length} groups`);
    return parseFacet(data).filter(r => r.label.split('|')[0].includes(' ')).map(r => {
      const [name, lsid, common, kingdom, family] = r.label.split('|');
      return {
        key: normaliseName(name), name: name.replace(/\s*\([^)]*\)/, ''),
        common: common || '', group: g.id, alaLsid: lsid, alaCount: r.count, family, kingdom,
      };
    });
  }));
  // Merge subspecies rows into their species.
  const merged = new Map();
  for (const row of lists.flat()) {
    const cur = merged.get(row.key);
    if (cur) cur.alaCount += row.alaCount;
    else merged.set(row.key, { ...row, name: row.key.replace(/^./, c => c.toUpperCase()) });
  }
  return [...merged.values()];
}

/**
 * Victorian (FFG Act, via ALA "state_conservation") and national (EPBC Act,
 * "country_conservation") listings for species recorded in the area.
 */
export async function alaConservation(area, opts = {}, signal) {
  // key -> { state, national, stateInfra, nationalInfra }. A listing of only a
  // subspecies/variety is kept separately (e.g. "subsp. megalocarpa") so it
  // isn't applied to the whole species.
  const status = new Map();
  for (const [field, slot] of [['state_conservation', 'state'], ['country_conservation', 'national']]) {
    const summary = await getJSON(alaUrl(area, [], field, opts), { signal });
    const values = parseFacet(summary).map(r => r.label);
    await Promise.all(values.map(async v => {
      const data = await getJSON(alaUrl(area, [`${field}:"${v}"`], 'taxon_name', opts), { signal });
      for (const r of parseFacet(data)) {
        const words = r.label.replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/);
        if (words.length < 2) continue; // genus-level record
        const key = normaliseName(r.label);
        const cur = status.get(key) || {};
        if (words.length === 2) cur[slot] = v;
        else cur[slot + 'Infra'] = { status: v, taxon: words.slice(2).join(' ') };
        status.set(key, cur);
      }
    }));
  }
  return status;
}
