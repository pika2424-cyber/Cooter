// "Edible plants" tab: plants found in the current search that Wikipedia
// documents as food (by category or an explicit food sentence).
import { findEdibles, stateCategory } from './usage.js';
import { stateCode } from './sources.js';
import { GROUP_BY_ID } from './groups.js';
import { threatClass } from './rarity.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLANT_GROUPS = ['flowering', 'ferns', 'conifers', 'bryophytes', 'otherplants', 'algae'];
const PART_ORDER = ['Fruit', 'Seeds & nuts', 'Leaves & greens', 'Roots & tubers', 'Herbs & spices', 'Bush food', 'Other edible parts', 'Food use mentioned'];

let lastRunFor = null, results = null, running = null;

export function resetEdibles() { lastRunFor = null; results = null; running?.abort(); running = null; }

export async function renderEdibles(state, showDetail) {
  const list = document.getElementById('edibleList');
  const status = document.getElementById('edibleStatus');
  if (!state.species.length) return;

  if (lastRunFor !== state.species) {
    running?.abort();
    const ctrl = new AbortController();
    running = ctrl;
    lastRunFor = state.species;
    results = null;
    list.innerHTML = '';
    const plants = state.species.filter(s => PLANT_GROUPS.includes(s.group));
    const stateCat = stateCategory(stateCode(state.point.lat, state.point.lng, !!(state.evc || state.evc1750)));
    try {
      results = await findEdibles(plants, stateCat, m => { status.textContent = m; }, ctrl.signal);
    } catch (e) {
      if (e.name === 'AbortError') return;
      status.textContent = `Couldn't check Wikipedia: ${e.message}`;
      status.classList.add('error');
      lastRunFor = null;
      return;
    }
    status.classList.remove('error');
    status.textContent = `${results.length} of ${plants.length} native plants recorded here have documented food use on Wikipedia.`;
  }
  if (!results) return;
  draw(state, showDetail);
}

function draw(state, showDetail) {
  const list = document.getElementById('edibleList');
  const strongOnly = document.getElementById('edibleFilter').value === 'strong';
  const hideThreat = document.getElementById('edibleHideThreatened').checked;
  const shown = results.filter(r => (!strongOnly || r.strong) && (!hideThreat || !r.species.threat));
  document.getElementById('edibleTitle').textContent = `Edible plants in this area (${shown.length})`;
  if (!shown.length) { list.innerHTML = '<p class="hint">No plants match. Try showing all evidence or including threatened species.</p>'; return; }

  const byPart = new Map();
  for (const r of shown) {
    const part = PART_ORDER.find(p => r.parts.includes(p)) || 'Other edible parts';
    if (!byPart.has(part)) byPart.set(part, []);
    byPart.get(part).push(r);
  }
  const html = [];
  for (const part of PART_ORDER) {
    const items = byPart.get(part);
    if (!items) continue;
    items.sort((a, b) => b.species.records - a.species.records);
    html.push(`<h3>${esc(part)} <span class="muted">(${items.length})</span></h3><ul class="species-list edible-list">` + items.map(r => {
      const s = r.species;
      const listed = s.listings.filter(l => l.src !== 'IUCN' || threatClass(l.label) !== 'lc');
      return `<li class="sp edible">
        <button class="sp-main" data-edible-detail="${esc(s.key)}">
          ${s.photo ? `<img src="${esc(s.photo)}" alt="" loading="lazy">` : `<span class="noimg">${GROUP_BY_ID[s.group].icon}</span>`}
          <span class="sp-names">
            <span class="sp-common">${esc(s.common || s.name)}</span>
            <span class="sp-sci">${esc(s.name)}</span>
            <span class="sp-tags">
              ${r.parts.filter(p => p !== part).map(p => `<span class="tag local uncommon">${esc(p)}</span>`).join('')}
              ${r.strong ? '<span class="tag good">Wikipedia food category</span>' : '<span class="tag nt">Food use mentioned</span>'}
              ${r.caution ? '<span class="tag en">⚠ toxic parts / caution</span>' : ''}
              ${listed.map(l => `<span class="tag ${threatClass(l.label)}">${esc(l.src)}: ${esc(l.label)} – don't harvest</span>`).join('')}
              <span class="muted small">${s.records.toLocaleString()} record${s.records === 1 ? '' : 's'} nearby</span>
            </span>
            ${r.evidence.filter(e => e.type === 'text').map(e => `<span class="evidence">“…${esc(e.text)}…”</span>`).join('')}
            <span class="muted small">Source: <a href="${esc(r.url)}" target="_blank" rel="noopener">Wikipedia – ${esc(r.title)}</a>${r.evidence.filter(e => e.type === 'category').length ? ` · ${esc(r.evidence.filter(e => e.type === 'category').map(e => e.text.replace('Wikipedia category: ', '')).join(', '))}` : ''}</span>
          </span>
        </button>
      </li>`;
    }).join('') + '</ul>');
  }
  list.innerHTML = html.join('');
  list.onclick = e => {
    if (e.target.closest('a')) return;
    const b = e.target.closest('[data-edible-detail]');
    if (b) showDetail(state.species.find(s => s.key === b.dataset.edibleDetail));
  };
}

export function bindEdibleFilters(state, showDetail) {
  for (const id of ['edibleFilter', 'edibleHideThreatened']) {
    document.getElementById(id).addEventListener('change', () => results && draw(state, showDetail));
  }
}
