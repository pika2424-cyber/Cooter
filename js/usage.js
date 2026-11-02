// Traditional (First Nations) and Western usage, and edibility, sourced ONLY
// from English Wikipedia. Nothing is generated or inferred beyond what the
// article / category actually says: every statement shown is a quoted
// paragraph or category with a link back to its source. If Wikipedia has
// nothing, the app says so rather than filling the gap.
//
// Wikipedia content is CC BY-SA 4.0. Requests are throttled and cached to
// respect Wikimedia's API etiquette.

const API = 'https://en.wikipedia.org/w/api.php';
const HEADERS = { 'Api-User-Agent': 'Cooter/1.0 (https://github.com/pika2424-cyber/Cooter)' };
const CACHE_PREFIX = 'cooter.wiki.';
const TTL = 30 * 24 * 3600 * 1000; // 30 days

const sleep = ms => new Promise(r => setTimeout(r, ms));

function cacheGet(key) {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_PREFIX + key));
    if (v && Date.now() - v.t < TTL) return v.d;
  } catch { /* ignore */ }
  return undefined;
}
function cacheSet(key, d) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d })); }
  catch {
    // Storage full: drop old wiki cache entries and give up quietly.
    try { Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).slice(0, 200).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
  }
}

// One request at a time, with a small gap, backing off on 429.
let queue = Promise.resolve();
function wiki(params, signal) {
  const run = async () => {
    const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: HEADERS, signal });
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get('Retry-After')) || 2 ** attempt * 2;
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(`Wikipedia: ${data.error.info || data.error.code}`);
      await sleep(250);
      return data;
    }
    throw new Error('Wikipedia is busy (rate limited) – try again in a minute');
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

export const wikiUrl = (title, anchor) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}${anchor ? '#' + encodeURIComponent(anchor.replace(/ /g, '_')) : ''}`;

// ---------------------------------------------------------------------------
// Classification patterns
// ---------------------------------------------------------------------------
const INDIGENOUS_CS = /\b(Indigenous|First Australians?|first Australians'?)\b/; // capitalised 'Indigenous' only
const INDIGENOUS_CI = /\b(Aboriginal|Aborigines|First Nations|First Peoples|Koori|Koorie|Kulin|Wurundjeri|Boon ?wurrung|Bunurong|Wadawurrung|Wathaurong|Dja Dja Wurrung|Taungurung|Gunditjmara|Yorta Yorta|Wiradjuri|Gunaikurnai|Noongar|Nyungar|Ngarrindjeri|Kaurna|Palawa|Yolŋu|Yolngu|Arrernte|Pitjantjatjara|Warlpiri|Torres Strait Islanders?|traditional owners?|bush ?tucker|bush ?food|M[āa]ori|Native Americans?|indigenous peoples?)\b/i;
const isIndigenous = t => INDIGENOUS_CS.test(t) || INDIGENOUS_CI.test(t);
// Stricter test for Western/other usage sentences.
const WESTERN_USE = /\b(used (as|for|in|to|by|medicinally)|uses (include|of)|is (grown|planted|cultivated|harvested)|are (grown|planted|cultivated|harvested)|widely (grown|planted|cultivated)|cultivat\w+|grown (as|for|in)|planted (as|for|in)|timber|firewood|furniture|cabinet\w*|veneer|edible|eaten|culinary|flavou?r\w*|food|fodder|forage|honey|nectar source|essential oils?|oil|medicin\w*|remed\w*|treat(s|ed|ment)? (of|for)|tannin|dye|fibre|fiber|weav\w*|crafts?|paper|pulp|ornamental|landscap\w*|hedg\w*|windbreak|shelterbelt|erosion control|revegetation|bush ?tucker|bush ?food|brew\w*|tea|jam|sauce|spice|perfume|commercial\w*|sold|marketed|nursery|nurseries|garden\w*)\b/i;
// Sentences about wildlife using the plant are ecology, not human usage.
const WILDLIFE_USE = /\b(food (source|plant)s? for [^.]{0,40}(birds?|avian|insects?|larvae|caterpillars?|butterfl\w+|moths?|animals?|wildlife|species|mammals?|possums?|gliders?|bees)|host plant|eaten by [^.]{0,30}(birds?|insects?|larvae|caterpillars?|animals?|kangaroos?|wallabies|possums?|stock|cattle|sheep)|(birds?|insects?|larvae|caterpillars?|animals?|wildlife|bees|moths?|butterfl\w+) (feed|eat|use)s?)\b/i;
const CONTINUES = /^(They|These|This|Its|It|Both|Also|In addition|Additionally|The (bark|seeds?|leaves|roots?|tubers?|fruits?|berries|wood|stems?|flowers?|gum|resin|sap|nectar|grains?|pods?|bulbs?|corms?|shoots?|plant))\b|\b(traditional|clap ?sticks|spear-?throwers?|woomeras?|shields?|coolamons?|dilly ?bags?|damper|bush ?tucker|bush ?food|ceremon\w*)\b/;
const NON_TRADITIONAL = /\b(European|settlers?|colonists?|commercial\w*|cultivars?|nurser(y|ies)|horticultur\w*|exported|industry)\b/i;
const SKIP_SUBHEADINGS = /\b(ecology|distribution|habitat|conservation|threats?|population|taxonomy|description|etymology|pests?|diseases?|appearance|properties)\b/i;
const USE_WORDS = /\b(use[ds]?|using|utili[sz]ed|eat|eaten|ate|food|edible|medicin\w*|remed\w*|treat(ed|ment)?|fibre|fiber|string|cord|basket\w*|canoes?|shields?|spears?|tools?|implements?|roast\w*|cook\w*|bak\w*|dyes?|ceremon\w*|smok\w*|weav\w*|nets?|drinks?|beverages?|sweet\w*|nectar|resin|gum|tea|infusion|poultice|ground into|flour|damper|soaked|harvest\w*|gather\w*|collected)\b/i;
const WESTERN_HEADINGS = /\b(uses?|usage|utili[sz]ation|cultivation|horticultur\w*|culinary|food|cuisine|economic|commercial|timber|wood|lumber|medicin\w*|pharmac\w*|garden\w*|landscap\w*|apicultur\w*|honey|essential oil|in culture|ornamental|agricultur\w*|forestry|industr\w*)\b/i;
const SKIP_HEADINGS = /\b(references|notes|external links|further reading|see also|bibliography|gallery|sources)\b/i;

// ---------------------------------------------------------------------------
// Per-species usage
// ---------------------------------------------------------------------------
function cleanText(el) {
  el.querySelectorAll('sup, .reference, .mw-ref, style, .noprint, .mw-editsection, .citation-needed-content').forEach(n => n.remove());
  return el.textContent.replace(/\[\d+\]|\[citation needed\]/g, '').replace(/\s+/g, ' ').trim();
}

function parseArticle(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('.mw-parser-output') || doc.body;
  const blocks = []; // { h2, h3, text }
  let h2 = 'Introduction', h3 = '';
  for (const node of root.children) {
    const heading = node.matches('h2,h3,h4') ? node : node.querySelector(':scope > h2, :scope > h3, :scope > h4');
    if (heading && (node.matches('h2,h3,h4') || node.classList.contains('mw-heading'))) {
      const text = cleanText(heading.cloneNode(true));
      if (heading.tagName === 'H2') { h2 = text; h3 = ''; } else h3 = text;
      continue;
    }
    if (node.matches('p')) {
      const text = cleanText(node.cloneNode(true));
      if (text.length > 30) blocks.push({ h2, h3, text });
    } else if (node.matches('ul, ol')) {
      for (const li of node.querySelectorAll(':scope > li')) {
        const text = cleanText(li.cloneNode(true));
        if (text.length > 30) blocks.push({ h2, h3, text, li: true });
      }
    }
  }
  return blocks;
}

const ABBREV = /^([A-Z]|e\.g|i\.e|etc|sp|spp|subsp|ssp|var|cf|St|Mt|Dr|Mr|Mrs|approx|c|ca|no|vs|al|Jr|Sr|Ltd)$/i;
function splitSentences(text) {
  const out = [];
  const re = /[.!?]+["')\]]*\s+(?=["'(]?[A-Z0-9])/g;
  let start = 0, m;
  while ((m = re.exec(text))) {
    const lastWord = text.slice(start, m.index).split(/\s+/).pop().replace(/\.$/, '');
    if (ABBREV.test(lastWord)) continue; // "A. melanoxylon", "e.g. …"
    out.push(text.slice(start, m.index + m[0].length).trim());
    start = m.index + m[0].length;
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/**
 * Returns { title, url, traditional: [{text, section}], western: [...] } or
 * { missing: true } when there is no article for the species.
 */
export async function getUsage(scientificName, signal) {
  const key = 'usage4.' + scientificName.toLowerCase();
  const cached = cacheGet(key);
  if (cached) return cached;

  let data;
  try {
    data = await wiki({ action: 'parse', page: scientificName, redirects: '1', prop: 'text', disableeditsection: '1', disabletoc: '1' }, signal);
  } catch (e) {
    if (/missingtitle|doesn't exist/i.test(e.message)) {
      const result = { missing: true };
      cacheSet(key, result);
      return result;
    }
    throw e;
  }
  const title = data.parse.title;
  const blocks = parseArticle(data.parse.text);
  const traditional = [], western = [];
  for (const b of blocks) {
    const section = b.h3 ? `${b.h2} › ${b.h3}` : b.h2;
    if (SKIP_HEADINGS.test(b.h2)) continue;
    const anchor = b.h3 || b.h2;
    const sentences = splitSentences(b.text);
    // Traditional: sentences anywhere that mention First Nations people AND a
    // use (so etymology / history mentions alone don't count).
    // A sentence that directly continues a traditional-use sentence ("The bark
    // is harvested to make string…") stays with it.
    const tradSet = new Set();
    sentences.forEach((s, i) => {
      if (WILDLIFE_USE.test(s)) return;
      if (isIndigenous(s) && USE_WORDS.test(s)) tradSet.add(i);
      else if (tradSet.has(i - 1) && CONTINUES.test(s) && USE_WORDS.test(s) && !NON_TRADITIONAL.test(s)) tradSet.add(i);
    });
    const trad = sentences.filter((_, i) => tradSet.has(i));
    if (trad.length) traditional.push({ text: trad.join(' '), section, anchor });
    // Other usage: only inside use-type sections, only sentences that state a
    // use, and never sentences about First Nations people.
    const inUseSection = (WESTERN_HEADINGS.test(b.h2) || WESTERN_HEADINGS.test(b.h3)) && !SKIP_SUBHEADINGS.test(b.h3);
    if (inUseSection) {
      const other = sentences.filter((s, i) => !tradSet.has(i) && !isIndigenous(s) && WESTERN_USE.test(s) && !WILDLIFE_USE.test(s));
      if (other.length) western.push({ text: other.join(' '), section, anchor });
    }
  }
  const result = { title, url: wikiUrl(title), traditional, western };
  cacheSet(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Edible plants
// ---------------------------------------------------------------------------
const EDIBLE_CATS = [
  { re: /^Bushfood$/i, part: 'Bush food', label: 'Bushfood' },
  { re: /^Edible fruits$|^Fruits originating/i, part: 'Fruit', label: 'Edible fruit' },
  { re: /^Edible nuts and seeds$|^Nuts$/i, part: 'Seeds & nuts', label: 'Edible nuts & seeds' },
  { re: /^Leaf vegetables$/i, part: 'Leaves & greens', label: 'Leaf vegetable' },
  { re: /^Root vegetables$/i, part: 'Roots & tubers', label: 'Root vegetable' },
  { re: /^Edible plants$|^Edible (flowers|thistles)$/i, part: 'Other edible parts', label: 'Edible plant' },
  { re: /^Herbs$|^Spices$|^Medicinal herbs$/i, part: 'Herbs & spices', label: 'Herb / spice' },
];
const CAUTION_CATS = /^(Poisonous plants|Toxic plants|Plant toxins)$/i;
const FOOD_SNIPPET = /\b(edible|bush ?food|bush ?tucker|eaten (raw|cooked|fresh|roasted)|used as (a )?food|food (plant|source) (for|by|of) (the )?(Aboriginal|Indigenous)|(Aboriginal|Indigenous)[^.]{0,60}\b(ate|eaten|eat|food|roasted)|(eaten|food)[^.]{0,40}\b(Aboriginal|Indigenous))/i;
const NOT_EDIBLE = /\b(inedible|not edible|unpalatable)\b/i;

export function stateForPoint(lat, lng, inVictoria) {
  if (inVictoria) return 'Victoria (state)';
  if (lat < -39.6) return 'Tasmania';
  if (lng < 129) return 'Western Australia';
  if (lat > -26 && lng < 138) return 'the Northern Territory';
  if (lng < 141) return 'South Australia';
  if (lat > -29) return 'Queensland';
  return 'New South Wales';
}

/** Food-related text snippets for a state's flora (cached), title -> snippet. */
async function stateFoodSnippets(stateCat, signal, onProgress) {
  const key = 'snips.' + stateCat;
  const cached = cacheGet(key);
  if (cached) return new Map(cached);
  const out = new Map();
  const query = `"edible" OR "bushfood" OR "bush food" OR "bush tucker" OR "eaten raw" OR "roasted" OR "used as food" incategory:"Flora_of_${stateCat.replace(/ /g, '_')}"`;
  let offset = 0;
  for (let page = 0; page < 6; page++) {
    onProgress?.(`Searching Wikipedia for food plants of ${stateCat.replace(' (state)', '')}…`);
    const data = await wiki({ action: 'query', list: 'search', srsearch: query, srlimit: '500', srnamespace: '0', srprop: 'snippet', sroffset: String(offset) }, signal);
    for (const r of data.query.search) {
      const snippet = r.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
      out.set(r.title, snippet);
    }
    if (!data.continue) break;
    offset = data.continue.sroffset;
  }
  cacheSet(key, [...out]);
  return out;
}

/**
 * Check which plants have documented food use on Wikipedia.
 * Returns [{ species, title, parts:[...], evidence:[{type,label,text}], caution }]
 */
export async function findEdibles(plants, stateCat, onProgress, signal) {
  const names = plants.map(p => p.name);
  const titleOf = new Map();   // scientific name -> article title
  const catsOf = new Map();    // article title -> [category]
  const pending = [];
  for (const n of names) {
    const c = cacheGet('cats.' + n.toLowerCase());
    if (c) { titleOf.set(n, c.title); if (c.title) catsOf.set(c.title, c.cats); }
    else pending.push(n);
  }

  for (let i = 0; i < pending.length; i += 50) {
    onProgress?.(`Checking Wikipedia categories: ${Math.min(i + 50, pending.length)} of ${pending.length} plants…`);
    const batch = pending.slice(i, i + 50);
    let cont = {};
    const pages = new Map();
    let data;
    do {
      data = await wiki({ action: 'query', prop: 'categories', cllimit: 'max', clshow: '!hidden', redirects: '1', titles: batch.join('|'), ...cont }, signal);
      for (const p of data.query.pages || []) {
        const cur = pages.get(p.title) || { missing: !!p.missing, cats: [] };
        cur.cats.push(...(p.categories || []).map(c => c.title.replace(/^Category:/, '')));
        pages.set(p.title, cur);
      }
      cont = data.continue || null;
    } while (cont);
    const redirect = new Map();
    for (const arr of [data.query.normalized || [], data.query.redirects || []]) for (const r of arr) redirect.set(r.from, r.to);
    for (const n of batch) {
      let t = n;
      for (let k = 0; k < 3 && redirect.has(t); k++) t = redirect.get(t);
      const pg = pages.get(t);
      const title = pg && !pg.missing ? t : null;
      titleOf.set(n, title);
      if (title) catsOf.set(title, pg.cats);
      cacheSet('cats.' + n.toLowerCase(), { title, cats: title ? pg.cats : [] });
    }
  }

  let snippets = new Map();
  try { snippets = await stateFoodSnippets(stateCat, signal, onProgress); } catch (e) { if (e.name === 'AbortError') throw e; }

  const results = [];
  for (const sp of plants) {
    const title = titleOf.get(sp.name);
    if (!title) continue;
    const cats = catsOf.get(title) || [];
    const evidence = [], parts = new Set();
    for (const c of cats) {
      const m = EDIBLE_CATS.find(e => e.re.test(c));
      if (m) { parts.add(m.part); evidence.push({ type: 'category', label: m.label, text: `Wikipedia category: ${c}` }); }
    }
    const snip = snippets.get(title);
    if (snip && FOOD_SNIPPET.test(snip) && !NOT_EDIBLE.test(snip)) {
      evidence.push({ type: 'text', label: 'Food use mentioned', text: snip });
      if (!parts.size) parts.add('Food use mentioned');
    }
    if (!evidence.length) continue;
    results.push({
      species: sp, title, url: wikiUrl(title), parts: [...parts], evidence,
      caution: cats.some(c => CAUTION_CATS.test(c)) || /\b(poison\w*|toxic)\b/i.test(snip || ''),
      strong: evidence.some(e => e.type === 'category'),
    });
  }
  return results;
}
