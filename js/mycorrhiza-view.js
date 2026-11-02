// "Mycorrhizal fungi" tab.
//  • Local plants (mainly trees & shrubs) and the mycorrhizal fungi recorded
//    as their partners in GloBI, highlighting partners recorded nearby.
//  • Mycorrhizal fungi recorded nearby (native AND introduced): guild from
//    FUNGuild, origin from iNaturalist / ALA non-native list, hosts from
//    GloBI, edibility from Wikipedia's mycological infobox, uses from the
//    Wikipedia article. Missing data is shown as missing, never filled in.
import {
  inatFungiWithOrigin, alaFungiAll, globiPartnersOfPlants, globiHostsOfFungi,
  stateCode, loadIntroducedList, isIntroducedIn,
} from './sources.js';
import { fungalEdibility, getUsage } from './usage.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLANT_GROUPS = ['flowering', 'ferns', 'conifers', 'otherplants'];
const TYPE_INFO = {
  EcM: { label: 'Ectomycorrhizal', short: 'EcM', cls: 'myco-ecm', desc: 'forms a sheath around root tips. Typical of eucalypts, wattles, sheoaks, tea-trees, pines and oaks. Many produce mushrooms or truffles.' },
  AM: { label: 'Arbuscular mycorrhizal', short: 'AM', cls: 'myco-am', desc: 'grows inside root cells. Found in most grasses, herbs and many shrubs. Usually microscopic, with no mushroom.' },
  ErM: { label: 'Ericoid mycorrhizal', short: 'ErM', cls: 'myco-erm', desc: 'partners heaths (Epacris, Styphelia and relatives) on poor soils.' },
  OrM: { label: 'Orchid mycorrhizal', short: 'OrM', cls: 'myco-orm', desc: 'needed by orchids to germinate and grow.' },
  Endo: { label: 'Endomycorrhizal', short: 'Endo', cls: 'myco-am', desc: 'grows inside root cells.' },
};

let guilds = null;
async function loadGuilds() {
  if (!guilds) guilds = fetch('data/mycorrhizal-guilds.json').then(r => r.json()).then(d => d.taxa).catch(() => ({}));
  return guilds;
}
function guildFor(g, name) {
  const key = name.toLowerCase();
  if (g[key]) return { types: g[key][0].split('+'), conf: g[key][1], level: 'species' };
  const genus = key.split(' ')[0];
  if (g[genus]) return { types: g[genus][0].split('+'), conf: g[genus][1], level: 'genus' };
  return null;
}

let lastRunFor = null, data = null, running = null;
export function resetMycorrhiza() { lastRunFor = null; data = null; running?.abort(); running = null; }

export async function renderMycorrhiza(state, opts) {
  const status = document.getElementById('mycoStatus');
  if (!state.species.length || !state.area) return;
  if (lastRunFor !== state.species) {
    running?.abort();
    const ctrl = new AbortController();
    running = ctrl;
    lastRunFor = state.species;
    data = null;
    document.getElementById('mycoBody').innerHTML = '';
    status.classList.remove('error');
    try {
      data = await gather(state, opts, m => { status.textContent = m; }, ctrl.signal);
    } catch (e) {
      if (e.name === 'AbortError') return;
      status.textContent = `Couldn't load mycorrhizal data: ${e.message}`;
      status.classList.add('error');
      lastRunFor = null;
      return;
    }
    status.textContent = '';
  }
  if (data) draw(state);
}

async function gather(state, opts, progress, signal) {
  const [g, nonNative] = await Promise.all([loadGuilds(), loadIntroducedList()]);
  const st = stateCode(state.point.lat, state.point.lng, !!(state.evc || state.evc1750));

  progress('Finding fungi recorded nearby (native and introduced)…');
  const [inat, ala] = await Promise.all([
    opts.useInat ? inatFungiWithOrigin(state.area, opts, signal) : [],
    opts.useAla ? alaFungiAll(state.area, opts, signal).catch(() => []) : [],
  ]);
  const fungi = new Map();
  for (const f of inat) fungi.set(f.key, { ...f });
  for (const a of ala) {
    const cur = fungi.get(a.key);
    if (cur) { cur.alaCount = a.alaCount; cur.alaLsid = a.alaLsid; if (!cur.common) cur.common = a.common; }
    else fungi.set(a.key, { ...a, origin: null, originSource: null });
  }
  const myco = [];
  for (const f of fungi.values()) {
    const guild = guildFor(g, f.name);
    if (!guild) continue;
    if (!f.origin && isIntroducedIn(nonNative, f.key, st)) { f.origin = 'introduced'; f.originSource = 'ALA non-native list'; }
    f.guild = guild;
    f.records = Math.max(f.inatCount || 0, f.alaCount || 0);
    myco.push(f);
  }
  myco.sort((a, b) => b.records - a.records);

  // Local plants grouped by genus.
  const plantGenera = new Map();
  for (const s of state.species) {
    if (!PLANT_GROUPS.includes(s.group)) continue;
    const genus = s.name.split(' ')[0];
    if (!plantGenera.has(genus)) plantGenera.set(genus, []);
    plantGenera.get(genus).push(s);
  }

  const partners = await globiPartnersOfPlants([...plantGenera.keys()], progress, signal);
  const hosts = await globiHostsOfFungi(myco.slice(0, 200).map(f => f.name), progress, signal);
  let edibility = new Map();
  try { edibility = await fungalEdibility(myco.slice(0, 200).map(f => f.name), progress, signal); }
  catch (e) { if (e.name === 'AbortError') throw e; }

  const localFungiByGenus = new Map();
  for (const f of myco) {
    const gn = f.name.split(' ')[0].toLowerCase();
    if (!localFungiByGenus.has(gn)) localFungiByGenus.set(gn, []);
    localFungiByGenus.get(gn).push(f);
  }

  const plants = [];
  for (const [genus, recs] of partners) {
    const localSpecies = plantGenera.get(genus);
    if (!localSpecies) continue;
    const types = {};
    const fungusNames = new Set();
    for (const r of recs) { types[r.type] = (types[r.type] || 0) + 1; fungusNames.add(r.fungus); }
    // Partner fungi that are also recorded nearby (species match, else same genus).
    const nearby = new Map();
    for (const name of fungusNames) {
      const k = name.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
      const exact = myco.find(f => f.key === k);
      if (exact) nearby.set(exact.key, { f: exact, exact: true });
    }
    const partnerGenera = [...new Set([...fungusNames].map(n => n.split(/\s+/)[0]))].sort();
    for (const pg of partnerGenera) {
      for (const f of localFungiByGenus.get(pg.toLowerCase()) || []) if (!nearby.has(f.key)) nearby.set(f.key, { f, exact: false });
    }
    plants.push({ genus, localSpecies, types, partnerCount: fungusNames.size, partnerGenera, nearby: [...nearby.values()] });
  }
  plants.sort((a, b) => b.nearby.filter(n => n.exact).length - a.nearby.filter(n => n.exact).length || b.partnerCount - a.partnerCount);

  for (const f of myco) {
    const recs = hosts.get(f.key) || [];
    const byGenus = new Map();
    for (const r of recs) {
      const gn = r.host.split(/[\s_]/)[0];
      if (!byGenus.has(gn)) byGenus.set(gn, new Set());
      byGenus.get(gn).add(r.type);
    }
    f.hosts = [...byGenus.entries()].map(([genus, types]) => ({ genus, types: [...types], local: plantGenera.has(genus) }))
      .sort((a, b) => (b.local - a.local) || a.genus.localeCompare(b.genus));
    f.edibility = edibility.get(f.name) || null;
  }
  return { myco, plants, st };
}

function typeBadges(types, conf) {
  return types.map(t => `<span class="tag ${TYPE_INFO[t]?.cls || 'lc'}" title="${esc(TYPE_INFO[t]?.label || t)}${conf ? ` – FUNGuild confidence: ${esc(conf)}` : ''}">${esc(TYPE_INFO[t]?.label || t)}</span>`).join(' ');
}
function originBadge(f) {
  if (f.origin === 'native') return `<span class="tag good" title="Source: ${esc(f.originSource)}">Native</span>`;
  if (f.origin === 'introduced') return `<span class="tag en" title="Source: ${esc(f.originSource)}">Introduced</span>`;
  return '<span class="tag lc" title="Neither iNaturalist nor the ALA non-native list assesses this species">Origin not assessed</span>';
}
function edibilityBadges(e) {
  if (!e) return '<span class="muted small">Edibility: no data</span>';
  return e.values.map((v, i) => {
    const cls = ['deadly', 'poisonous'].includes(v) ? 'cr' : ['psychoactive', 'allergenic', 'caution'].includes(v) ? 'vu' : ['edible', 'choice'].includes(v) ? 'good' : 'lc';
    return `<span class="tag ${cls}">${v === 'deadly' ? '☠ ' : ''}${esc(e.labels[i])}</span>`;
  }).join(' ');
}

function draw(state) {
  const { myco, plants } = data;
  const body = document.getElementById('mycoBody');
  const originF = document.getElementById('mycoOrigin').value;
  const typeF = document.getElementById('mycoType').value;
  const counts = { native: 0, introduced: 0, unknown: 0 };
  for (const f of myco) counts[f.origin || 'unknown']++;

  const shownFungi = myco.filter(f => (originF === 'all' || (f.origin || 'unknown') === originF) && (typeF === 'all' || f.guild.types.includes(typeF)));

  body.innerHTML = `
    <div class="mgmt-site">
      <div><span class="muted small">Mycorrhizal fungi recorded nearby</span><br><strong>${myco.length}</strong></div>
      <div><span class="muted small">Native · Introduced · Not assessed</span><br><strong>${counts.native}</strong> · <strong>${counts.introduced}</strong> · <strong>${counts.unknown}</strong></div>
      <div><span class="muted small">Local plant genera with recorded partners</span><br><strong>${plants.length}</strong></div>
    </div>

    <details class="myco-types"><summary>What do the mycorrhizal types mean?</summary>
      <ul>${Object.entries(TYPE_INFO).filter(([k]) => k !== 'Endo').map(([, t]) => `<li><span class="tag ${t.cls}">${t.label}</span>: ${esc(t.desc)}</li>`).join('')}</ul>
    </details>

    <h3>🌳 Trees, shrubs & other plants and their fungal partners</h3>
    <p class="hint">Plant genera recorded here that have published mycorrhizal partner records in GloBI. These are mostly trees and shrubs, because host studies concentrate on them. "Recorded nearby" means that partner fungus (or another species in its genus) has also been recorded in your search area.</p>
    ${plants.length ? `<div class="myco-plants">${plants.map(p => {
      const exact = p.nearby.filter(n => n.exact), genusOnly = p.nearby.filter(n => !n.exact);
      return `<details class="mgmt-act myco-plant" ${exact.length ? 'open' : ''}>
        <summary><span class="act-name"><em>${esc(p.genus)}</em> <span class="muted small">${esc(p.localSpecies.slice(0, 3).map(s => s.common || s.name).join(', '))}${p.localSpecies.length > 3 ? ` +${p.localSpecies.length - 3}` : ''}</span></span>
          ${Object.entries(p.types).map(([t, n]) => `<span class="tag ${TYPE_INFO[t].cls}">${TYPE_INFO[t].short} · ${n} record${n === 1 ? '' : 's'}</span>`).join(' ')}</summary>
        ${exact.length ? `<p><strong>Partner species recorded nearby:</strong> ${exact.map(n => `${esc(n.f.common || n.f.name)} <em class="muted">(${esc(n.f.name)})</em> ${originBadge(n.f)}`).join(' · ')}</p>` : ''}
        ${genusOnly.length ? `<p class="small"><strong>Nearby fungi in partner genera:</strong> ${genusOnly.slice(0, 12).map(n => `${esc(n.f.common || n.f.name)} <em class="muted">(${esc(n.f.name)})</em>`).join(' · ')}${genusOnly.length > 12 ? ` +${genusOnly.length - 12} more` : ''}</p>` : ''}
        <p class="small muted">${p.partnerCount} partner taxa recorded worldwide, in genera: ${esc(p.partnerGenera.slice(0, 30).join(', '))}${p.partnerGenera.length > 30 ? '…' : ''}</p>
      </details>`;
    }).join('')}</div>` : '<p class="hint">No GloBI mycorrhizal records for plant genera found here.</p>'}

    <h3>🍄 Mycorrhizal fungi recorded nearby (${shownFungi.length})</h3>
    <ul class="species-list myco-fungi">${shownFungi.slice(0, 250).map(f => `
      <li class="sp">
        <div class="sp-main static">
          ${f.photo ? `<img src="${esc(f.photo)}" alt="" loading="lazy">` : '<span class="noimg">🍄</span>'}
          <span class="sp-names">
            <span class="sp-common">${esc(f.common || f.name)}</span>
            <span class="sp-sci">${esc(f.name)}</span>
            <span class="sp-tags">${originBadge(f)} ${typeBadges(f.guild.types, f.guild.conf)}
              ${f.guild.level === 'genus' ? '<span class="muted small">(type from genus)</span>' : ''}
              <span class="muted small">${f.records.toLocaleString()} record${f.records === 1 ? '' : 's'}</span></span>
            <span class="sp-tags">${edibilityBadges(f.edibility)}</span>
            <span class="small">${f.hosts.length
              ? `Recorded hosts: ${f.hosts.slice(0, 14).map(h => h.local ? `<strong title="Recorded in your search area">✓ <em>${esc(h.genus)}</em></strong>` : `<em>${esc(h.genus)}</em>`).join(', ')}${f.hosts.length > 14 ? ` +${f.hosts.length - 14}` : ''}`
              : '<span class="muted">No host records in GloBI</span>'}</span>
            <span class="small links">
              ${f.inatId ? `<a href="https://www.inaturalist.org/taxa/${f.inatId}" target="_blank" rel="noopener">iNaturalist</a>` : ''}
              ${f.alaLsid ? `<a href="https://bie.ala.org.au/species/${encodeURIComponent(f.alaLsid)}" target="_blank" rel="noopener">ALA</a>` : ''}
              ${f.edibility ? `<a href="${esc(f.edibility.url)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
              <button class="linklike" data-uses="${esc(f.name)}">Show uses</button>
            </span>
            <div class="usage myco-uses" data-uses-box="${esc(f.name)}" hidden></div>
          </span>
        </div>
      </li>`).join('')}
    </ul>
    ${shownFungi.length > 250 ? '<p class="hint">Showing the 250 most-recorded. Use the filters to narrow down.</p>' : ''}
    <p class="muted small">Sources: fungi from iNaturalist and ALA. Mycorrhizal type from <a href="https://github.com/UMNFuN/FUNGuild" target="_blank" rel="noopener">FUNGuild</a>. Origin from iNaturalist establishment data and the ALA Non-Native Species List. Host records from <a href="https://www.globalbioticinteractions.org/" target="_blank" rel="noopener">GloBI</a>. Edibility from each species' Wikipedia infobox.</p>`;

  body.onclick = async e => {
    const b = e.target.closest('[data-uses]');
    if (!b) return;
    const box = body.querySelector(`[data-uses-box="${CSS.escape(b.dataset.uses)}"]`);
    box.hidden = !box.hidden;
    if (box.hidden || box.dataset.loaded) return;
    box.innerHTML = '<p class="hint">Looking up documented uses on Wikipedia…</p>';
    try {
      const u = await getUsage(b.dataset.uses);
      box.dataset.loaded = '1';
      if (u.missing) { box.innerHTML = '<p class="hint">No Wikipedia article, so no documented uses.</p>'; return; }
      const list = items => `<ul class="usage-list">${items.slice(0, 4).map(i => `<li><blockquote>${esc(i.text)}</blockquote><a class="small" href="${esc(u.url)}#${encodeURIComponent(i.anchor.replace(/ /g, '_'))}" target="_blank" rel="noopener">Wikipedia – ${esc(u.title)} › ${esc(i.section)}</a></li>`).join('')}</ul>`;
      box.innerHTML = `<h4>Traditional (First Nations) usage</h4>${u.traditional.length ? list(u.traditional) : '<p class="hint">None documented in the Wikipedia article.</p>'}
        <h4>Other documented usage</h4>${u.western.length ? list(u.western) : '<p class="hint">None documented in the Wikipedia article.</p>'}`;
    } catch (err) {
      box.innerHTML = `<p class="hint error">Couldn't load uses (${esc(err.message)}).</p>`;
    }
  };
}

export function bindMycoFilters(state) {
  for (const id of ['mycoOrigin', 'mycoType']) {
    document.getElementById(id).addEventListener('change', () => data && draw(state));
  }
}
