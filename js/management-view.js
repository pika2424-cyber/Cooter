// Renders the "Management practice" tab from the current search results.
import { buildPlan, RATINGS, LINKS } from './management.js';
import { threatClass } from './rarity.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const listNames = (names, max = 5) => {
  if (!names.length) return '';
  const shown = names.slice(0, max).map(esc).join(', ');
  return names.length > max ? `${shown} +${names.length - max} more` : shown;
};
const badge = r => r ? `<span class="tag ${RATINGS[r].cls}">${RATINGS[r].label}</span>` : '<span class="tag lc">No specific concerns</span>';

export function renderManagement(state) {
  const body = document.getElementById('managementBody');
  const printBtn = document.getElementById('printPlan');
  if (!state.species.length) { printBtn.hidden = true; return; }
  printBtn.hidden = false;
  printBtn.onclick = () => window.print();

  const plan = buildPlan(state.species, state.evc, state.evc1750);
  const { habitat, guilds, keystones, activities, boosts, prioritySpecies } = plan;
  const evc = state.evc || state.evc1750;

  const site = `
    <div class="mgmt-site">
      <div><span class="muted small">Site</span><br><strong>${esc(state.placeLabel)}</strong> · ${document.getElementById('radius').value} km radius</div>
      ${evc ? `<div><span class="muted small">${state.evc ? 'EVC' : 'Pre-1750 EVC (site cleared)'}</span><br><strong>${esc(evc.x_evcname)}</strong>
        ${evc.evc_bcs_desc ? `<span class="tag ${threatClass(evc.evc_bcs_desc === 'Depleted' ? 'near threatened' : evc.evc_bcs_desc)}">${esc(evc.evc_bcs_desc)}</span>` : ''}</div>` : ''}
      ${habitat ? `<div><span class="muted small">Habitat type</span><br><strong>${esc(habitat.name)}</strong></div>` : ''}
      <div><span class="muted small">Driving species</span><br><strong>${prioritySpecies.length}</strong> threatened/rare · <strong>${keystones.reduce((n, k) => n + k.members.length, 0)}</strong> keystone</div>
    </div>`;

  const avoidCount = activities.filter(a => a.rating === 'avoid').length;
  const modCount = activities.filter(a => a.rating === 'moderate').length;
  const summary = `
    <p class="mgmt-summary">At this site, <strong>${avoidCount}</strong> common activit${avoidCount === 1 ? 'y' : 'ies'} should be avoided and
    <strong>${modCount}</strong> should be moderated, based on ${guilds.length} species group${guilds.length === 1 ? '' : 's'} with specific habitat needs${habitat ? ` and the site's ${esc(habitat.name.toLowerCase())} habitat` : ''}.
    The <a href="#mgmt-boost">top actions to increase biodiversity</a> are listed below.</p>`;

  // Key species
  const keyHtml = `
    <div class="mgmt-cols">
      <div>
        <h3>🔑 Keystone species here</h3>
        ${keystones.length ? `<ul class="mgmt-list">${keystones.map(k => `
          <li><strong>${esc(k.role)}</strong>${k.negative ? ' <span class="tag vu">problem native</span>' : ''}<br>
            <span class="small">${listNames(k.members.map(m => m.common || m.name), 4)}</span><br>
            <span class="muted small">${esc(k.detail)}</span></li>`).join('')}</ul>` : '<p class="hint">No keystone species from Cooter\'s list were recorded.</p>'}
      </div>
      <div>
        <h3>⚠️ Threatened & rare species driving advice</h3>
        ${prioritySpecies.length ? `<ul class="mgmt-chips">${prioritySpecies.slice(0, 30).map(s => {
          const top = s.listings.filter(l => l.src !== 'IUCN' || threatClass(l.label) !== 'lc')[0];
          return `<li>${esc(s.common || s.name)} ${top ? `<span class="tag ${threatClass(top.label)}">${esc(top.label)}</span>` : `<span class="tag local ${s.local}">rare here</span>`}</li>`;
        }).join('')}</ul>${prioritySpecies.length > 30 ? `<p class="hint small">+${prioritySpecies.length - 30} more (see Explore → Rare here or listed)</p>` : ''}`
          : '<p class="hint">No threatened or locally rare species were recorded in this area.</p>'}
      </div>
    </div>`;

  // Activities
  const withAdvice = activities.filter(a => a.notes.length);
  const without = activities.filter(a => !a.notes.length);
  const actHtml = `
    <h3>🧭 Common bush management activities</h3>
    <div class="mgmt-legend">${Object.keys(RATINGS).map(badge).join(' ')}</div>
    <div class="mgmt-acts">
      ${withAdvice.map(a => `
        <details class="mgmt-act rating-${a.rating}" ${a.rating === 'avoid' || a.rating === 'moderate' ? 'open' : ''}>
          <summary><span class="act-icon">${a.icon}</span><span class="act-name">${esc(a.name)}</span>${badge(a.rating)}</summary>
          <ul>${a.notes.map(n => `
            <li>${badge(n.rating)} ${esc(n.text)}
              <div class="muted small">${n.icon} ${esc(n.source)}${n.species.length ? ` – ${listNames(n.species, 4)}` : ''}</div></li>`).join('')}
          </ul>
        </details>`).join('')}
    </div>
    ${without.length ? `<p class="hint small">No site-specific concerns for: ${without.map(a => `${a.icon} ${esc(a.name)}`).join(', ')}. Follow standard good practice.</p>` : ''}`;

  // Boosts
  const boostHtml = `
    <h3 id="mgmt-boost">🌱 Ways to increase populations & biodiversity</h3>
    <ol class="mgmt-boosts">
      ${boosts.map(b => `
        <li><strong>${esc(b.name)}</strong>
          <div>${esc(b.detail)}</div>
          ${b.species.length ? `<div class="muted small">Benefits: ${listNames(b.species, 6)}</div>` : ''}
          <div class="muted small">Why: ${b.sources.map(esc).join(' · ')}</div></li>`).join('')}
    </ol>`;

  // Habitat
  const habHtml = habitat ? `
    <h3>🗺️ Habitat guidance: ${esc(habitat.name)}</h3>
    ${habitat.isHistoric ? `<p class="hint">No remnant vegetation is mapped at this point. This guidance is for the original (pre-1750) vegetation, ${esc(habitat.evc.x_evcname)}, and is useful as a target for restoration.</p>` : ''}
    <table class="evc-table mgmt-hab">
      <tr><th>🔥 Fire</th><td>${esc(habitat.fire)}</td></tr>
      <tr><th>🐄 Grazing</th><td>${esc(habitat.grazing)}</td></tr>
      <tr><th>🌱 Revegetation</th><td>${esc(habitat.planting)}</td></tr>
    </table>
    <p class="hint small">Fire intervals are indicative. Check DEECA's tolerable fire interval for your exact EVC, and get permits before burning.</p>`
    : (evc ? '' : '<p class="hint">No EVC is mapped here (outside Victoria?), so habitat-specific fire and grazing guidance isn\'t available. Species-based advice still applies.</p>');

  // Guild detail
  const guildHtml = guilds.length ? `
    <details class="mgmt-guilds"><summary>Species groups considered (${guilds.length})</summary>
      <ul class="mgmt-list">${guilds.map(g => `
        <li><strong>${g.icon} ${esc(g.name)}</strong> – ${g.members.length} species${g.priority.length ? `, ${g.priority.length} threatened/rare` : ''}<br>
          <span class="muted small">${esc(g.why)}</span><br>
          <span class="small">${listNames(g.drivers.map(s => s.common || s.name), 6)}</span></li>`).join('')}
      </ul></details>` : '';

  body.innerHTML = `
    ${site}
    ${summary}
    ${keyHtml}
    ${actHtml}
    ${boostHtml}
    ${habHtml}
    ${guildHtml}
    <div class="mgmt-disclaimer">
      <p><strong>Please note:</strong> this is general guidance generated from species records and vegetation mapping. It isn't a substitute for an on-ground assessment by an ecologist, your council, CMA or DEECA. Records can include planted trees or vagrant animals, so check that a species really occurs on your site before acting on it. Removing native vegetation, burning, works on waterways, and handling threatened species can all need permits.</p>
      <p class="links">${LINKS.map(l => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>
    </div>`;
}
