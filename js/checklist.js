// Personal checklist stored in the browser (localStorage). Each species can be
// marked "seen" (with date + place) and/or "wanted" (a target to look for).

const KEY = 'cooter.checklist.v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

let store = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full / blocked */ }
  listeners.forEach(fn => fn());
}

export function onChange(fn) { listeners.add(fn); }

export function get(key) { return store[key]; }
export function isSeen(key) { return !!store[key]?.seen; }
export function isWanted(key) { return !!store[key]?.wanted; }

function snapshot(sp) {
  return { name: sp.name, common: sp.common, group: sp.group, photo: sp.photo, inatId: sp.inatId, alaLsid: sp.alaLsid };
}

export function toggleSeen(sp, place) {
  const cur = store[sp.key] || snapshot(sp);
  if (cur.seen) {
    delete cur.seen; delete cur.seenDate; delete cur.seenPlace;
  } else {
    cur.seen = true;
    cur.seenDate = new Date().toISOString().slice(0, 10);
    cur.seenPlace = place || '';
    delete cur.wanted; // found it!
  }
  Object.assign(cur, snapshot(sp), { seen: cur.seen, wanted: cur.wanted });
  if (!cur.seen && !cur.wanted) delete store[sp.key]; else store[sp.key] = cur;
  save();
}

export function toggleWanted(sp) {
  const cur = store[sp.key] || snapshot(sp);
  cur.wanted = !cur.wanted;
  if (!cur.seen && !cur.wanted) delete store[sp.key]; else store[sp.key] = cur;
  save();
}

export function setNote(key, note) {
  if (!store[key]) return;
  store[key].note = note;
  save();
}

export function all() {
  return Object.entries(store).map(([key, v]) => ({ key, ...v }));
}

export function clear() { store = {}; save(); }

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(groupName) {
  const rows = [['Status', 'Group', 'Common name', 'Scientific name', 'Date seen', 'Place', 'Note']];
  for (const e of all()) {
    rows.push([e.seen ? 'Seen' : 'Wanted', groupName(e.group), e.common, e.name, e.seenDate, e.seenPlace, e.note]);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

export function toJSON() { return JSON.stringify(store, null, 2); }

export function importJSON(text) {
  const data = JSON.parse(text);
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Not a checklist file');
  store = { ...store, ...data };
  save();
}
