import { GROUPS, GROUP_BY_ID, normaliseName } from './groups.js';
import {
  EVC_WMS, EVC_LAYER_2005, EVC_LAYER_1750, evcAtPoint, evcsNearby, evcSearchArea,
  inatNativeSpecies, inatIntroducedNames, inatTaxaByName, alaSpecies, alaConservation,
  stateCode, loadIntroducedList, isIntroducedIn,
} from './sources.js';
import { scoreRarity, LOCAL_TIERS, threatClass } from './rarity.js';
import * as checklist from './checklist.js';
import { renderManagement } from './management-view.js';
import { getUsage } from './usage.js';
import { renderEdibles, resetEdibles, bindEdibleFilters } from './edible-view.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  point: null,          // { lat, lng }
  placeLabel: '',
  evc: null,            // 2005 EVC at point
  evc1750: null,        // pre-European EVC at point
  species: [],
  activeGroup: null,    // chip filter
  collapsed: new Set(),
  abort: null,
};

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
const map = L.map('map', { zoomControl: true }).setView([-37.0, 144.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);
const evcLayer = L.tileLayer.wms(EVC_WMS, {
  layers: EVC_LAYER_2005, format: 'image/png', transparent: true, opacity: 0.45,
  attribution: 'EVC mapping &copy; State of Victoria (DEECA)',
}).addTo(map);
let marker = null, circle = null, patchLayer = null;

$('#evcOverlay').addEventListener('change', e => {
  e.target.checked ? evcLayer.addTo(map) : map.removeLayer(evcLayer);
});

map.on('click', e => setPoint(e.latlng.lat, e.latlng.lng, 'Chosen on map'));

function drawSearchArea() {
  if (!state.point) return;
  const r = Number($('#radius').value) * 1000;
  if (circle) circle.setRadius(r).setLatLng(state.point);
  else circle = L.circle(state.point, { radius: r, color: '#2f5d3a', weight: 2, fillOpacity: 0.05 }).addTo(map);
}

function setPoint(lat, lng, label) {
  state.point = { lat, lng };
  state.placeLabel = label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  if (marker) marker.setLatLng(state.point); else marker = L.marker(state.point).addTo(map);
  drawSearchArea();
  map.fitBounds(circle.getBounds(), { padding: [10, 10] });
  $('#searchBtn').disabled = false;
  setStatus(`Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  loadEvc();
  saveSettings();
}

$('#radius').addEventListener('change', () => {
  drawSearchArea();
  if (circle) map.fitBounds(circle.getBounds(), { padding: [10, 10] });
  saveSettings();
});

$('#locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return setStatus('Geolocation is not available in this browser.', true);
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    pos => setPoint(pos.coords.latitude, pos.coords.longitude, 'My location'),
    err => setStatus(`Couldn't get your location (${err.message}). Tap the map instead.`, true),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
});

function setStatus(msg, isError = false) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

// ---------------------------------------------------------------------------
// EVC panel
// ---------------------------------------------------------------------------
const BCS_CLASS = { 'Presumed Extinct': 'cr', 'Endangered': 'en', 'Vulnerable': 'vu', 'Depleted': 'nt', 'Rare': 'nt', 'Least Concern': 'lc' };

async function loadEvc() {
  const { lat, lng } = state.point;
  const card = $('#evcCard');
  card.hidden = false;
  card.innerHTML = '<h2>Vegetation (EVC)</h2><p class="hint">Looking up Ecological Vegetation Class…</p>';
  try {
    const [evc, evc1750] = await Promise.all([
      evcAtPoint(lat, lng, EVC_LAYER_2005),
      evcAtPoint(lat, lng, EVC_LAYER_1750),
    ]);
    if (state.point.lat !== lat || state.point.lng !== lng) return; // moved since
    state.evc = evc; state.evc1750 = evc1750;
    renderEvc();
    loadNearbyEvcs();
  } catch (e) {
    card.innerHTML = `<h2>Vegetation (EVC)</h2><p class="error">Couldn't reach the Victorian EVC service (${esc(e.message)}).</p>`;
  }
}

function evcBlock(e, heading) {
  if (!e) return '';
  const bcs = e.evc_bcs_desc || '';
  return `
    <div class="evc-block">
      <div class="evc-heading">${esc(heading)}</div>
      <div class="evc-name">${esc(e.x_evcname)} <span class="muted">EVC ${esc(e.evc)}</span></div>
      <div class="evc-meta">
        ${bcs ? `<span class="tag ${BCS_CLASS[bcs] || 'lc'}" title="Bioregional Conservation Status">${esc(bcs)}</span>` : ''}
        <span>${esc(e.bioregion)} bioregion</span>
        ${e.x_groupname ? `<span>${esc(e.x_groupname)}</span>` : ''}
        ${e.hectares ? `<span>Patch: ${Number(e.hectares).toLocaleString()} ha</span>` : ''}
      </div>
    </div>`;
}

function renderEvc() {
  const { evc, evc1750 } = state;
  const card = $('#evcCard');
  let body;
  if (!evc && !evc1750) {
    body = '<p class="hint">No EVC is mapped here. EVC mapping only covers Victoria – species results still work Australia-wide.</p>';
  } else {
    body = '';
    if (evc) body += evcBlock(evc, 'You are standing in');
    else body += '<p class="hint">No remnant native vegetation is mapped at this spot (cleared or urban land).</p>';
    if (evc1750 && (!evc || evc1750.evc !== evc.evc)) body += evcBlock(evc1750, 'Before 1750 this was');
    else if (evc1750) body += '<p class="hint">This matches the pre-1750 vegetation type.</p>';
  }
  const scopeEvc = document.querySelector('input[name=scope][value=evc]');
  scopeEvc.disabled = !evc;
  if (!evc && scopeEvc.checked) document.querySelector('input[name=scope][value=radius]').checked = true;
  card.innerHTML = `
    <h2>Vegetation (EVC)</h2>
    ${body}
    <details id="nearbyEvcs"><summary>EVCs within your radius</summary><p class="hint">Loading…</p></details>
    <p class="hint small">EVC benchmarks (characteristic species lists) are published by DEECA:
      <a href="https://www.environment.vic.gov.au/biodiversity/bioregions-and-evc-benchmarks" target="_blank" rel="noopener">Bioregions &amp; EVC benchmarks</a>.</p>`;
}

async function loadNearbyEvcs() {
  const { lat, lng } = state.point;
  try {
    const { evcs, truncated } = await evcsNearby(lat, lng, Number($('#radius').value));
    const el = $('#nearbyEvcs');
    if (!el) return;
    if (!evcs.length) { el.innerHTML = '<summary>EVCs within your radius</summary><p class="hint">None mapped.</p>'; return; }
    el.innerHTML = `<summary>EVCs within your radius (${evcs.length}${truncated ? '+' : ''})</summary>
      <table class="evc-table"><thead><tr><th>EVC</th><th>Status</th><th>Area</th></tr></thead><tbody>
      ${evcs.map(e => `<tr><td>${esc(e.x_evcname)} <span class="muted">${esc(e.evc)}</span></td>
        <td><span class="tag ${BCS_CLASS[e.evc_bcs_desc] || 'lc'}">${esc(e.evc_bcs_desc || '–')}</span></td>
        <td>${e.hectares.toLocaleString(undefined, { maximumFractionDigits: 1 })} ha</td></tr>`).join('')}
      </tbody></table>
      ${truncated ? '<p class="hint small">Large area – list may be incomplete.</p>' : ''}`;
  } catch { /* optional extra */ }
}

// ---------------------------------------------------------------------------
// Species search
// ---------------------------------------------------------------------------
function currentOptions() {
  return {
    radiusKm: Number($('#radius').value),
    scope: document.querySelector('input[name=scope]:checked').value,
    useInat: $('#srcInat').checked,
    useAla: $('#srcAla').checked,
    nativeMode: $('#nativeMode').value,
    sinceYear: $('#since').value ? Number($('#since').value) : null,
    researchOnly: $('#researchOnly').checked,
  };
}

$('#searchBtn').addEventListener('click', runSearch);

async function runSearch() {
  if (!state.point) return;
  const opts = currentOptions();
  if (!opts.useInat && !opts.useAla) return setStatus('Pick at least one data source.', true);

  state.abort?.abort();
  const ctrl = new AbortController();
  state.abort = ctrl;
  const { lat, lng } = state.point;

  let area = { lat, lng, radiusKm: opts.radiusKm };
  if (patchLayer) { map.removeLayer(patchLayer); patchLayer = null; }
  if (opts.scope === 'evc' && state.evc) {
    const patch = evcSearchArea(state.evc.geometry, lat, lng, opts.radiusKm);
    if (patch) {
      area = { ...area, ring: patch.ring, bbox: patch.bbox };
      patchLayer = L.polygon(patch.ring.map(([x, y]) => [y, x]), { color: '#c0392b', weight: 2, fillOpacity: 0.1 }).addTo(map);
    }
  }

  $('#searchBtn').disabled = true;
  $('#welcome').hidden = true;
  setStatus('Searching…');
  const progress = { inat: '', ala: '' };
  const showProgress = () => setStatus([progress.inat, progress.ala].filter(Boolean).join(' · ') || 'Searching…');

  try {
    const tasks = [];
    tasks.push(opts.useInat
      ? inatNativeSpecies(area, opts, m => { progress.inat = m; showProgress(); }, ctrl.signal)
      : Promise.resolve([]));
    tasks.push(opts.useAla
      ? alaSpecies(area, opts, m => { progress.ala = m; showProgress(); }, ctrl.signal)
      : Promise.resolve([]));
    tasks.push(opts.useAla ? alaConservation(area, opts, ctrl.signal).catch(() => new Map()) : Promise.resolve(new Map()));
    tasks.push(opts.useAla ? inatIntroducedNames(area, ctrl.signal).catch(() => new Set()) : Promise.resolve(new Set()));

    tasks.push(loadIntroducedList());
    const [inat, ala, cons, introduced, nonNative] = await Promise.all(tasks);
    const st = stateCode(lat, lng, !!(state.evc || state.evc1750));
    let merged = mergeSpecies(inat, ala, cons, introduced);
    const before = merged.length;
    merged = merged.filter(s => !isIntroducedIn(nonNative, s.key, st));
    state.removedIntroduced = before - merged.length;
    scoreRarity(merged);
    state.species = merged;
    state.activeGroup = null;
    renderResults();
    renderManagement(state);
    resetEdibles();
    if (document.querySelector('.tab.active')?.dataset.view === 'edible') renderEdibles(state, showDetail);
    setStatus(`Found ${merged.length.toLocaleString()} native species${state.removedIntroduced ? ` (${state.removedIntroduced} introduced species removed using the ALA non-native list for ${st})` : ''}. See the Management tab for site advice.`);

    // Fill in photos for ALA-only species of interest (rarest first), in background.
    const needPhotos = merged.filter(s => !s.photo).sort((a, b) => b.rarityScore - a.rarityScore).map(s => s.name);
    if (needPhotos.length) fillPhotos(needPhotos, ctrl.signal);
  } catch (e) {
    if (e.name !== 'AbortError') setStatus(`Search failed: ${e.message}`, true);
  } finally {
    $('#searchBtn').disabled = false;
  }
}

function mergeSpecies(inat, ala, cons, introduced) {
  const map = new Map();
  for (const s of inat) map.set(s.key, { ...s, sources: ['iNat'] });
  for (const a of ala) {
    const cur = map.get(a.key);
    if (cur) {
      cur.alaCount = a.alaCount; cur.alaLsid = a.alaLsid; cur.sources.push('ALA');
      if (!cur.common && a.common) cur.common = a.common;
    } else {
      // ALA-only species: skip ones iNaturalist lists as introduced here.
      if (introduced.has(a.key)) continue;
      map.set(a.key, { ...a, sources: ['ALA'] });
    }
  }
  for (const [key, s] of map) {
    const c = cons.get(key);
    if (!c) continue;
    s.vic = c.state; s.epbc = c.national;
    // Subspecies-only listings: animals recorded here are usually the listed
    // local form, so count them; for plants they are often a different
    // (frequently planted) form, so show them as a note only.
    const isPlant = ['flowering', 'ferns', 'conifers', 'bryophytes', 'otherplants', 'algae'].includes(s.group);
    for (const [slot, infraKey] of [['vic', 'stateInfra'], ['epbc', 'nationalInfra']]) {
      const inf = c[infraKey];
      if (s[slot] || !inf) continue;
      if (isPlant) s[slot + 'Infra'] = `${inf.status} (${inf.taxon} only)`;
      else s[slot] = inf.status;
    }
  }
  return [...map.values()];
}

async function fillPhotos(names, signal) {
  try {
    const found = await inatTaxaByName(names, signal);
    let changed = false;
    for (const s of state.species) {
      const t = found.get(normaliseName(s.name));
      if (t && !s.photo) {
        s.photo = t.default_photo?.square_url || '';
        s.photoMedium = t.default_photo?.medium_url || '';
        s.photoAttribution = t.default_photo?.attribution || '';
        s.inatId = s.inatId || t.id;
        if (!s.common) s.common = t.preferred_common_name || '';
        changed = true;
      }
    }
    if (changed) renderResults();
  } catch { /* photos are a nice-to-have */ }
}

// ---------------------------------------------------------------------------
// Results rendering
// ---------------------------------------------------------------------------
['#filterText', '#filterRarity', '#filterSeen', '#sortBy'].forEach(sel =>
  $(sel).addEventListener(sel === '#filterText' ? 'input' : 'change', renderResults));

function filtered() {
  const text = $('#filterText').value.trim().toLowerCase();
  const rarity = $('#filterRarity').value;
  const seen = $('#filterSeen').value;
  return state.species.filter(s => {
    if (text && !(`${s.common} ${s.name}`.toLowerCase().includes(text))) return false;
    if (rarity === 'listed' && !s.threat) return false;
    if (rarity === 'rare' && !s.threat && !['veryrare', 'rare'].includes(s.local)) return false;
    if (seen === 'seen' && !checklist.isSeen(s.key)) return false;
    if (seen === 'unseen' && checklist.isSeen(s.key)) return false;
    if (seen === 'wanted' && !checklist.isWanted(s.key)) return false;
    return true;
  });
}

function sorter() {
  const by = $('#sortBy').value;
  const name = s => (s.common || s.name).toLowerCase();
  return {
    rarity: (a, b) => b.rarityScore - a.rarityScore || a.records - b.records || name(a).localeCompare(name(b)),
    records: (a, b) => b.records - a.records,
    name: (a, b) => name(a).localeCompare(name(b)),
    sci: (a, b) => a.name.localeCompare(b.name),
  }[by];
}

function renderResults() {
  if (!state.species.length && !state.point) return;
  $('#resultsPanel').hidden = false;
  const list = filtered().sort(sorter());
  const byGroup = new Map(GROUPS.map(g => [g.id, []]));
  for (const s of list) byGroup.get(s.group)?.push(s);

  // Chips (counts are of the full result set so they stay stable while filtering)
  const totals = new Map();
  for (const s of state.species) totals.set(s.group, (totals.get(s.group) || 0) + 1);
  $('#resultsTitle').textContent = `${state.species.length.toLocaleString()} native species`;
  $('#groupChips').innerHTML = `<button class="chip ${state.activeGroup ? '' : 'on'}" data-group="">All</button>` +
    GROUPS.filter(g => totals.get(g.id)).map(g =>
      `<button class="chip ${state.activeGroup === g.id ? 'on' : ''}" data-group="${g.id}">${g.icon} ${esc(g.name)} <b>${totals.get(g.id)}</b></button>`).join('');

  const html = [];
  for (const g of GROUPS) {
    if (state.activeGroup && state.activeGroup !== g.id) continue;
    const items = byGroup.get(g.id);
    if (!items.length) continue;
    const all = state.species.filter(s => s.group === g.id);
    const seenCount = all.filter(s => checklist.isSeen(s.key)).length;
    const listed = all.filter(s => s.threat).length;
    const collapsed = state.collapsed.has(g.id);
    html.push(`
      <section class="group ${collapsed ? 'collapsed' : ''}" data-group="${g.id}">
        <button class="group-head" data-toggle="${g.id}" aria-expanded="${!collapsed}">
          <span class="group-icon">${g.icon}</span>
          <span class="group-name">${esc(g.name)}</span>
          <span class="group-stats">${items.length}${items.length !== all.length ? ` of ${all.length}` : ''} species
            ${listed ? ` · <span class="tag en">${listed} threatened</span>` : ''}
            · ✔ ${seenCount}/${all.length}</span>
          <span class="meter"><span style="width:${all.length ? (100 * seenCount / all.length) : 0}%"></span></span>
        </button>
        <ul class="species-list">${collapsed ? '' : items.slice(0, 400).map(speciesRow).join('')}</ul>
        ${!collapsed && items.length > 400 ? `<p class="hint">Showing first 400 – use search or filters to narrow down.</p>` : ''}
      </section>`);
  }
  $('#groups').innerHTML = html.join('') || '<p class="hint">No species match these filters.</p>';
}

function speciesRow(s) {
  const seen = checklist.isSeen(s.key), wanted = checklist.isWanted(s.key);
  const tier = LOCAL_TIERS.find(t => t.id === s.local);
  return `
    <li class="sp ${seen ? 'seen' : ''}" data-key="${esc(s.key)}">
      <button class="sp-main" data-detail="${esc(s.key)}">
        ${s.photo ? `<img src="${esc(s.photo)}" alt="" loading="lazy">` : `<span class="noimg">${GROUP_BY_ID[s.group].icon}</span>`}
        <span class="sp-names">
          <span class="sp-common">${esc(s.common || s.name)}</span>
          <span class="sp-sci">${esc(s.name)}</span>
          <span class="sp-tags">
            ${s.listings.filter(l => l.src !== 'IUCN' || threatClass(l.label) !== 'lc').map(l => `<span class="tag ${threatClass(l.label)}" title="${esc(l.src)}">${esc(l.src)}: ${esc(l.label)}</span>`).join('')}
            <span class="tag local ${s.local}">${tier.label}</span>
            <span class="muted small">${s.records.toLocaleString()} record${s.records === 1 ? '' : 's'}</span>
          </span>
        </span>
      </button>
      <span class="sp-actions">
        <button class="icon-btn want ${wanted ? 'on' : ''}" data-want="${esc(s.key)}" title="Add to wish list" aria-pressed="${wanted}">${wanted ? '★' : '☆'}</button>
        <button class="icon-btn seen-btn ${seen ? 'on' : ''}" data-seen="${esc(s.key)}" title="Mark as seen" aria-pressed="${seen}">✔</button>
      </span>
    </li>`;
}

$('#groupChips').addEventListener('click', e => {
  const b = e.target.closest('[data-group]');
  if (!b) return;
  state.activeGroup = b.dataset.group || null;
  renderResults();
});

$('#groups').addEventListener('click', e => {
  const t = e.target.closest('[data-toggle],[data-seen],[data-want],[data-detail]');
  if (!t) return;
  const find = k => state.species.find(s => s.key === k);
  if (t.dataset.toggle) {
    const id = t.dataset.toggle;
    state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id);
    renderResults();
  } else if (t.dataset.seen) {
    checklist.toggleSeen(find(t.dataset.seen), state.placeLabel);
  } else if (t.dataset.want) {
    checklist.toggleWanted(find(t.dataset.want));
  } else if (t.dataset.detail) {
    showDetail(find(t.dataset.detail));
  }
});

function showDetail(s) {
  if (!s) return;
  const g = GROUP_BY_ID[s.group];
  const tier = LOCAL_TIERS.find(t => t.id === s.local);
  const entry = checklist.get(s.key);
  $('#speciesDetail').innerHTML = `
    ${s.photoMedium || s.photo ? `<img class="detail-img" src="${esc(s.photoMedium || s.photo)}" alt="${esc(s.common || s.name)}">
      <p class="muted small">${esc(s.photoAttribution)}</p>` : ''}
    <h2>${esc(s.common || s.name)}</h2>
    <p class="sp-sci">${esc(s.name)}</p>
    <p>${g.icon} ${esc(g.name)}${s.family ? ` · ${esc(s.family)}` : ''}</p>
    <h3>Rarity</h3>
    <ul>
      ${s.vic ? `<li>Victoria (FFG Act): <span class="tag ${threatClass(s.vic)}">${esc(s.vic)}</span></li>` : ''}
      ${s.epbc ? `<li>National (EPBC Act): <span class="tag ${threatClass(s.epbc)}">${esc(s.epbc)}</span></li>` : ''}
      ${s.iucn ? `<li>IUCN Red List: <span class="tag ${threatClass(s.iucn.status)}">${esc(s.iucn.status)}</span></li>` : ''}
      ${s.vicInfra ? `<li class="small">Victoria (FFG Act): ${esc(s.vicInfra)}</li>` : ''}
      ${s.epbcInfra ? `<li class="small">National (EPBC Act): ${esc(s.epbcInfra)}</li>` : ''}
      ${!s.vic && !s.epbc && !s.iucn ? '<li>Not on a threatened species list</li>' : ''}
      <li>Locally: <span class="tag local ${s.local}">${tier.label}</span></li>
    </ul>
    <h3>Records in search area</h3>
    <ul>
      ${s.inatCount ? `<li>iNaturalist: ${s.inatCount.toLocaleString()} observations</li>` : ''}
      ${s.alaCount ? `<li>Atlas of Living Australia: ${s.alaCount.toLocaleString()} records</li>` : ''}
      ${s.inatGlobalCount ? `<li class="muted">iNaturalist worldwide: ${s.inatGlobalCount.toLocaleString()}</li>` : ''}
    </ul>
    <div id="usageBox" class="usage"><h3>Uses</h3><p class="hint">Looking up documented uses on Wikipedia…</p></div>
    <div class="row wrap">
      <button class="btn ${checklist.isSeen(s.key) ? 'primary' : ''}" data-dseen>✔ ${checklist.isSeen(s.key) ? 'Seen' : 'Mark seen'}</button>
      <button class="btn" data-dwant>${checklist.isWanted(s.key) ? '★ On wish list' : '☆ Wish list'}</button>
    </div>
    ${entry?.seen ? `<p class="small muted">Seen ${esc(entry.seenDate)}${entry.seenPlace ? ` at ${esc(entry.seenPlace)}` : ''}</p>` : ''}
    ${entry ? `<label class="field">Notes<textarea data-note rows="2">${esc(entry.note || '')}</textarea></label>` : ''}
    <p class="links">
      ${s.inatId ? `<a href="https://www.inaturalist.org/taxa/${s.inatId}" target="_blank" rel="noopener">iNaturalist</a>` : ''}
      ${s.alaLsid ? `<a href="https://bie.ala.org.au/species/${encodeURIComponent(s.alaLsid)}" target="_blank" rel="noopener">Atlas of Living Australia</a>` : `<a href="https://bie.ala.org.au/search?q=${encodeURIComponent(s.name)}" target="_blank" rel="noopener">Atlas of Living Australia</a>`}
      <a href="https://vicflora.rbg.vic.gov.au/flora/search?q=${encodeURIComponent(s.name)}" target="_blank" rel="noopener" ${['flowering', 'ferns', 'conifers', 'bryophytes', 'otherplants'].includes(s.group) ? '' : 'hidden'}>VicFlora</a>
      ${s.wikipedia ? `<a href="${esc(s.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
      ${state.point ? `<a href="https://www.inaturalist.org/observations?taxon_id=${s.inatId || ''}&lat=${state.point.lat}&lng=${state.point.lng}&radius=${$('#radius').value}" target="_blank" rel="noopener" ${s.inatId ? '' : 'hidden'}>Nearby observations</a>` : ''}
    </p>`;
  const dlg = $('#speciesDialog');
  dlg.querySelector('[data-dseen]').onclick = () => { checklist.toggleSeen(s, state.placeLabel); showDetail(s); };
  dlg.querySelector('[data-dwant]').onclick = () => { checklist.toggleWanted(s); showDetail(s); };
  const note = dlg.querySelector('[data-note]');
  if (note) note.onchange = () => checklist.setNote(s.key, note.value);
  if (!dlg.open) dlg.showModal();
  loadUsage(s);
}

function usageList(items, title, url) {
  return `<ul class="usage-list">${items.slice(0, 5).map(i => `
    <li><blockquote>${esc(i.text)}</blockquote>
      <a class="small" href="${esc(url)}#${encodeURIComponent(i.anchor.replace(/ /g, '_'))}" target="_blank" rel="noopener">Wikipedia – ${esc(title)} › ${esc(i.section)}</a></li>`).join('')}
  </ul>${items.length > 5 ? `<p class="hint small">+${items.length - 5} more passages in the <a href="${esc(url)}" target="_blank" rel="noopener">full article</a>.</p>` : ''}`;
}

async function loadUsage(s) {
  const box = document.getElementById('usageBox');
  try {
    const u = await getUsage(s.name);
    if (document.getElementById('usageBox') !== box || !box.isConnected) return; // dialog changed
    if (u.missing) {
      box.innerHTML = `<h3>Uses</h3><p class="hint">There's no Wikipedia article for <em>${esc(s.name)}</em>, so no documented uses can be shown.</p>`;
      return;
    }
    box.innerHTML = `
      <h3>Traditional (First Nations) usage</h3>
      ${u.traditional.length ? usageList(u.traditional, u.title, u.url)
        : '<p class="hint">No traditional usage is documented in this species\' Wikipedia article. Knowledge may still exist and be held by Traditional Owners.</p>'}
      <h3>Other documented usage (Western &amp; international)</h3>
      ${u.western.length ? usageList(u.western, u.title, u.url)
        : '<p class="hint">No other usage is documented in this species\' Wikipedia article.</p>'}
      <p class="muted small">Quoted from <a href="${esc(u.url)}" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA). Passages are picked automatically. Check the source before relying on them, and never eat or use a plant medicinally without expert identification.</p>`;
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<h3>Uses</h3><p class="hint error">Couldn't load usage information (${esc(e.message)}).</p>`;
  }
}

$('#speciesDialog').addEventListener('click', e => { if (e.target.id === 'speciesDialog') e.target.close(); });

// ---------------------------------------------------------------------------
// Checklist view
// ---------------------------------------------------------------------------
checklist.onChange(() => { renderResults(); renderChecklist(); updateBadge(); });

function updateBadge() {
  const n = checklist.all().filter(e => e.seen).length;
  const b = $('#checklistBadge');
  b.hidden = !n; b.textContent = n;
}

$('#checklistFilter').addEventListener('change', renderChecklist);

function renderChecklist() {
  const entries = checklist.all();
  const mode = $('#checklistFilter').value;
  const shown = entries.filter(e => mode === 'all' || (mode === 'seen' ? e.seen : e.wanted));

  // Progress for the current search area, per group.
  if (state.species.length) {
    const rows = GROUPS.map(g => {
      const here = state.species.filter(s => s.group === g.id);
      if (!here.length) return '';
      const seen = here.filter(s => checklist.isSeen(s.key)).length;
      return `<div class="prog-row"><span>${g.icon} ${esc(g.name)}</span>
        <span class="meter"><span style="width:${100 * seen / here.length}%"></span></span>
        <span class="muted small">${seen}/${here.length}</span></div>`;
    }).join('');
    const seenAll = state.species.filter(s => checklist.isSeen(s.key)).length;
    $('#progress').innerHTML = `<h3>Progress in current area: ${seenAll}/${state.species.length}</h3>${rows}`;
  } else {
    $('#progress').innerHTML = '<p class="hint">Run a search to see your progress for that area.</p>';
  }

  if (!shown.length) {
    $('#checklistList').innerHTML = '<p class="hint">Nothing here yet. Tick ✔ or ☆ on species in Explore.</p>';
    return;
  }
  const html = [];
  for (const g of GROUPS) {
    const items = shown.filter(e => e.group === g.id).sort((a, b) => (a.common || a.name).localeCompare(b.common || b.name));
    if (!items.length) continue;
    html.push(`<h3>${g.icon} ${esc(g.name)} <span class="muted">(${items.length})</span></h3><ul class="species-list">` +
      items.map(e => `<li class="sp ${e.seen ? 'seen' : ''}">
        <span class="sp-main static">
          ${e.photo ? `<img src="${esc(e.photo)}" alt="" loading="lazy">` : `<span class="noimg">${g.icon}</span>`}
          <span class="sp-names"><span class="sp-common">${esc(e.common || e.name)}</span><span class="sp-sci">${esc(e.name)}</span>
          <span class="muted small">${e.seen ? `Seen ${esc(e.seenDate)}${e.seenPlace ? ` · ${esc(e.seenPlace)}` : ''}` : '★ Wish list'}${e.note ? ` · ${esc(e.note)}` : ''}</span></span>
        </span>
        <span class="sp-actions"><button class="icon-btn" data-remove="${esc(e.key)}" title="Remove">✕</button></span>
      </li>`).join('') + '</ul>');
  }
  $('#checklistList').innerHTML = html.join('');
}

$('#checklistList').addEventListener('click', e => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  const entry = { key: b.dataset.remove, ...checklist.get(b.dataset.remove) };
  if (entry.seen) checklist.toggleSeen(entry);
  if (checklist.get(entry.key)?.wanted) checklist.toggleWanted(entry);
});

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);
$('#exportCsv').onclick = () => download(`cooter-checklist-${today()}.csv`, checklist.toCSV(id => GROUP_BY_ID[id]?.name || id), 'text/csv');
$('#exportJson').onclick = () => download(`cooter-backup-${today()}.json`, checklist.toJSON(), 'application/json');
$('#importJson').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try { checklist.importJSON(await f.text()); alert('Checklist restored.'); }
  catch (err) { alert(`Couldn't restore: ${err.message}`); }
  e.target.value = '';
};
$('#clearChecklist').onclick = () => {
  if (confirm('Clear your whole checklist? Consider backing it up first.')) checklist.clear();
};

// ---------------------------------------------------------------------------
// Tabs, settings, startup
// ---------------------------------------------------------------------------
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); });
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${tab.dataset.view}`));
  if (tab.dataset.view === 'checklist') renderChecklist();
  if (tab.dataset.view === 'management') renderManagement(state);
  if (tab.dataset.view === 'edible') renderEdibles(state, showDetail);
  if (tab.dataset.view === 'explore') setTimeout(() => map.invalidateSize(), 50);
}));

const SETTINGS_KEY = 'cooter.settings.v1';
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      radius: $('#radius').value, nativeMode: $('#nativeMode').value, since: $('#since').value,
      researchOnly: $('#researchOnly').checked, srcInat: $('#srcInat').checked, srcAla: $('#srcAla').checked,
      point: state.point,
    }));
  } catch { /* ignore */ }
}
['#nativeMode', '#since', '#researchOnly', '#srcInat', '#srcAla'].forEach(s => $(s).addEventListener('change', saveSettings));

(function restore() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { /* ignore */ }
  if (!s) return;
  if (s.radius) $('#radius').value = s.radius;
  if (s.nativeMode) $('#nativeMode').value = s.nativeMode;
  if (s.since != null) $('#since').value = s.since;
  $('#researchOnly').checked = !!s.researchOnly;
  if (s.srcInat != null) $('#srcInat').checked = s.srcInat;
  if (s.srcAla != null) $('#srcAla').checked = s.srcAla;
  if (s.point) setPoint(s.point.lat, s.point.lng, 'Last location');
})();

updateBadge();
bindEdibleFilters(state, showDetail);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
