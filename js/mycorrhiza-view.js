// Mycorrhizal fungi popup for a single plant (opened from its details).
// Partners come from GloBI host records; origin from iNaturalist / the ALA
// non-native list; edibility from the Wikipedia mycology infobox; uses from
// the Wikipedia article. Missing data is shown as missing.
import {
  inatFungiWithOrigin, alaFungiAll, globiPartnersOfPlants,
  stateCode, loadIntroducedList, isIntroducedIn,
} from './sources.js';
import { fungalEdibility, getUsage } from './usage.js';
import { normaliseName } from './groups.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE = { EcM: ['Ectomycorrhizal', 'myco-ecm'], AM: ['Arbuscular', 'myco-am'] };
const MAX_OTHERS = 40;

// Fungi recorded in the current search area – fetched once per search.
let areaFungi = null, areaFor = null;
async function getAreaFungi(state) {
  if (areaFor === state.species && areaFungi) return areaFungi;
  areaFor = state.species;
  areaFungi = (async () => {
    const opts = state.opts || {};
    const [inat, ala] = await Promise.all([
      opts.useInat !== false ? inatFungiWithOrigin(state.area, opts).catch(() => []) : [],
      opts.useAla !== false ? alaFungiAll(state.area, opts).catch(() => []) : [],
    ]);
    const m = new Map();
    for (const f of inat) m.set(f.key, { ...f });
    for (const a of ala) {
      const cur = m.get(a.key);
      if (cur) { cur.alaCount = a.alaCount; cur.alaLsid = a.alaLsid; if (!cur.common) cur.common = a.common; }
      else m.set(a.key, { ...a, origin: null });
    }
    return m;
  })();
  return areaFungi;
}

const partnerCache = new Map();

// FUNGuild mycorrhizal taxa (bundled) to separate true mycorrhizal partners
// from decomposers that simply turned up in root samples.
let guilds = null;
function loadGuilds() {
  if (!guilds) guilds = fetch('data/mycorrhizal-guilds.json').then(r => r.json()).then(d => d.taxa).catch(() => ({}));
  return guilds;
}
function isMycorrhizalTaxon(g, name) {
  const k = name.toLowerCase();
  return !!(g[k] || g[k.split(' ')[0]]);
}

function nameHtml(f) {
  return f.common && f.common.toLowerCase() !== f.name.toLowerCase()
    ? `<span class="sp-common">${esc(f.common)}</span><span class="sp-sci">${esc(f.name)}</span>`
    : `<span class="sp-common"><em>${esc(f.name)}</em></span>`;
}
function originBadge(f) {
  if (f.origin === 'native') return `<span class="tag good" title="${esc(f.originSource)}">Native</span>`;
  if (f.origin === 'introduced') return `<span class="tag en" title="${esc(f.originSource)}">Introduced</span>`;
  return '<span class="tag lc">Origin not assessed</span>';
}
function edibilityBadges(e) {
  if (!e) return '<span class="muted small">Edibility: no data</span>';
  return e.values.map((v, i) => {
    const cls = ['deadly', 'poisonous'].includes(v) ? 'cr' : ['psychoactive', 'allergenic', 'caution'].includes(v) ? 'vu' : ['edible', 'choice'].includes(v) ? 'good' : 'lc';
    return `<span class="tag ${cls}">${v === 'deadly' ? '☠ ' : ''}${esc(e.labels[i])}</span>`;
  }).join(' ');
}

function fungusRow(f) {
  return `<li class="sp">
    <div class="sp-main static">
      ${f.photo ? `<img src="${esc(f.photo)}" alt="" loading="lazy">` : '<span class="noimg">🍄</span>'}
      <span class="sp-names">
        ${nameHtml(f)}
        <span class="sp-tags">
          ${originBadge(f)}
          ${f.types.map(t => `<span class="tag ${TYPE[t][1]}">${TYPE[t][0]}</span>`).join(' ')}
          ${f.onSpecies ? '<span class="tag local uncommon">recorded on this species</span>' : ''}
          ${f.records ? `<span class="muted small">${f.records.toLocaleString()} record${f.records === 1 ? '' : 's'} nearby</span>` : ''}
        </span>
        <span class="sp-tags">${edibilityBadges(f.edibility)}</span>
        <span class="small links">
          ${f.inatId ? `<a href="https://www.inaturalist.org/taxa/${f.inatId}" target="_blank" rel="noopener">iNaturalist</a>` : `<a href="https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(f.name)}" target="_blank" rel="noopener">iNaturalist</a>`}
          ${f.edibility ? `<a href="${esc(f.edibility.url)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
          <button class="linklike" data-uses="${esc(f.name)}">Show uses</button>
        </span>
        <div class="usage myco-uses" data-uses-box="${esc(f.name)}" hidden></div>
      </span>
    </div>
  </li>`;
}

export async function showFungiForPlant(plant, state) {
  const dlg = document.getElementById('fungiDialog');
  const body = document.getElementById('fungiBody');
  const genus = plant.name.split(' ')[0];
  body.innerHTML = `<h2>🍄 Mycorrhizal fungi</h2>
    <p class="sp-sci">${esc(plant.common || plant.name)} · <em>${esc(plant.name)}</em></p>
    <p class="status" id="fungiStatus">Looking up recorded fungal partners…</p>`;
  if (!dlg.open) dlg.showModal();
  const status = () => document.getElementById('fungiStatus');

  try {
    if (!partnerCache.has(genus)) partnerCache.set(genus, globiPartnersOfPlants([genus]).then(m => m.get(genus) || []));
    const [recs, nearby, nonNative, g] = await Promise.all([
      partnerCache.get(genus),
      state.area ? getAreaFungi(state) : new Map(),
      loadIntroducedList(),
      loadGuilds(),
    ]);
    if (!dlg.open) return;
    const st = state.point ? stateCode(state.point.lat, state.point.lng, !!(state.evc || state.evc1750)) : 'VIC';

    // Group partner records by fungus species (genus-only records are counted separately).
    const fungi = new Map();
    let genusOnly = 0;
    for (const r of recs) {
      const parts = r.fungus.split(/\s+/);
      if (parts.length < 2 || /^(sp|spp|cf)\.?$/i.test(parts[1])) { genusOnly++; continue; }
      const key = normaliseName(r.fungus);
      const cur = fungi.get(key) || { key, name: key.replace(/^./, c => c.toUpperCase()), types: new Set(), onSpecies: false };
      cur.types.add(r.type);
      if (normaliseName(r.host) === plant.key) cur.onSpecies = true;
      fungi.set(key, cur);
    }
    const list = [...fungi.values()].map(f => {
      const n = nearby.get(f.key);
      const out = { ...f, types: [...f.types], ...(n ? { common: n.common, photo: n.photo, inatId: n.inatId, records: Math.max(n.inatCount || 0, n.alaCount || 0), origin: n.origin, originSource: n.originSource } : {}) };
      if (!out.origin && isIntroducedIn(nonNative, f.key, st)) { out.origin = 'introduced'; out.originSource = 'ALA non-native list'; }
      out.nearby = !!n;
      return out;
    });
    const confirmed = list.filter(f => isMycorrhizalTaxon(g, f.name));
    const incidental = list.filter(f => !isMycorrhizalTaxon(g, f.name)).sort((a, b) => (b.nearby - a.nearby) || a.name.localeCompare(b.name));
    const near = confirmed.filter(f => f.nearby).sort((a, b) => b.records - a.records);
    const others = confirmed.filter(f => !f.nearby);

    if (!list.length) {
      body.innerHTML = `<h2>🍄 Mycorrhizal fungi</h2><p class="sp-sci">${esc(plant.common || plant.name)} · <em>${esc(plant.name)}</em></p>
        <p class="hint">No mycorrhizal partner records for <em>${esc(genus)}</em> in GloBI${genusOnly ? ` (only ${genusOnly} records identified to genus level)` : ''}.</p>`;
      return;
    }

    status().textContent = 'Checking edibility on Wikipedia…';
    let edib = new Map();
    try { edib = await fungalEdibility([...near, ...others.slice(0, MAX_OTHERS), ...incidental.filter(f => f.nearby)].map(f => f.name)); } catch { /* shown as no data */ }
    if (!dlg.open) return;
    for (const f of list) f.edibility = edib.get(f.name) || null;
    // Most useful first: recorded on this exact species, documented on
    // Wikipedia, mushroom-forming (ectomycorrhizal), then alphabetical.
    others.sort((a, b) => (b.onSpecies - a.onSpecies) || (!!b.edibility - !!a.edibility)
      || (b.types.includes('EcM') - a.types.includes('EcM')) || a.name.localeCompare(b.name));

    body.innerHTML = `<h2>🍄 Mycorrhizal fungi</h2>
      <p class="sp-sci">${esc(plant.common || plant.name)} · <em>${esc(plant.name)}</em> · partners recorded for <em>${esc(genus)}</em></p>
      <p class="small warning-inline">⚠️ Never eat a wild mushroom based on this app.</p>
      <h3>Recorded near you (${near.length})</h3>
      ${near.length ? `<ul class="species-list">${near.map(fungusRow).join('')}</ul>` : '<p class="hint">None of the recorded partners have been recorded in your search area.</p>'}
      <h3>Other recorded partners (${others.length})</h3>
      ${others.length ? `<ul class="species-list">${others.slice(0, MAX_OTHERS).map(fungusRow).join('')}</ul>
        ${others.length > MAX_OTHERS ? `<details><summary>${others.length - MAX_OTHERS} more</summary><ul class="species-list">${others.slice(MAX_OTHERS).map(fungusRow).join('')}</ul></details>` : ''}` : '<p class="hint">None.</p>'}
      ${incidental.length ? `<details class="myco-incidental"><summary>Other fungi found on roots, not known to be mycorrhizal (${incidental.length})</summary>
        <p class="hint small">GloBI lists these as partners, but FUNGuild doesn't class their genus as mycorrhizal. They are often decomposers detected in root samples.</p>
        <ul class="species-list">${incidental.slice(0, 80).map(fungusRow).join('')}</ul></details>` : ''}
      <p class="muted small">Sources: partner records from <a href="https://www.globalbioticinteractions.org/" target="_blank" rel="noopener">GloBI</a>, checked against <a href="https://github.com/UMNFuN/FUNGuild" target="_blank" rel="noopener">FUNGuild</a>${genusOnly ? ` (plus ${genusOnly} records identified to genus only)` : ''}. Origin from iNaturalist and the ALA Non-Native Species List. Edibility and uses from Wikipedia.</p>`;
  } catch (e) {
    if (dlg.open) body.insertAdjacentHTML('beforeend', `<p class="hint error">Couldn't load fungal partners (${esc(e.message)}).</p>`);
    partnerCache.delete(genus);
  }
}

// "Show uses" inside the popup.
document.addEventListener('click', async e => {
  const b = e.target.closest('#fungiBody [data-uses]');
  if (!b) return;
  const box = document.querySelector(`#fungiBody [data-uses-box="${CSS.escape(b.dataset.uses)}"]`);
  box.hidden = !box.hidden;
  if (box.hidden || box.dataset.loaded) return;
  box.innerHTML = '<p class="hint">Looking up documented uses on Wikipedia…</p>';
  try {
    const u = await getUsage(b.dataset.uses);
    box.dataset.loaded = '1';
    if (u.missing) { box.innerHTML = '<p class="hint">No Wikipedia article, so no documented uses.</p>'; return; }
    const list = items => `<ul class="usage-list">${items.slice(0, 4).map(i => `<li><blockquote>${esc(i.text)}</blockquote><a class="small" href="${esc(u.url)}#${encodeURIComponent(i.anchor.replace(/ /g, '_'))}" target="_blank" rel="noopener">Wikipedia – ${esc(u.title)} › ${esc(i.section)}</a></li>`).join('')}</ul>`;
    box.innerHTML = `<h4>Traditional (Indigenous) usage</h4>${u.traditional.length ? list(u.traditional) : '<p class="hint">None documented in the Wikipedia article.</p>'}
      <h4>Other documented usage</h4>${u.western.length ? list(u.western) : '<p class="hint">None documented in the Wikipedia article.</p>'}`;
  } catch (err) {
    box.innerHTML = `<p class="hint error">Couldn't load uses (${esc(err.message)}).</p>`;
  }
});
