// Management practice advice.
//
// There is no API for land-management advice, so this is a curated, rule-based
// knowledge base aimed at south-eastern Australian (especially Victorian) bush.
// It links:
//   • GUILDS    – groups of species that share habitat needs (hollow users,
//                 ground mammals, frogs, orchids…), matched by genus / group
//   • KEYSTONES – species with an outsized effect on the ecosystem
//   • HABITATS  – EVC groups, which set fire, grazing and revegetation needs
// to a set of common bush management ACTIVITIES, producing a rating for each
// (avoid / moderate / encourage) plus "boost" actions that help populations.
//
// Advice is general and indicative. It is not a substitute for a site
// assessment, and permits may be required (see LINKS).

const genus = s => (s.name || '').split(' ')[0];
const inGenera = list => { const set = new Set(list); return s => set.has(genus(s)); };
const inGroups = list => s => list.includes(s.group);
const isSpecies = names => { const set = new Set(names.map(n => n.toLowerCase())); return s => set.has((s.name || '').toLowerCase()); };
const any = (...fns) => s => fns.some(f => f(s));

const VERTEBRATES = ['mammals', 'birds', 'reptiles', 'amphibians', 'fish'];

/** A species "drives" management if it is listed, or locally rare and easy to act on. */
export function isPriority(s) {
  if (s.threat >= 2) return true;
  if (['veryrare', 'rare'].includes(s.local) && (VERTEBRATES.includes(s.group) || ORCHID_GENERA.has(genus(s)))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export const ACTIVITIES = [
  { id: 'burn',      name: 'Planned / ecological burning',          icon: '🔥' },
  { id: 'slash',     name: 'Slashing, mowing & brush-cutting',       icon: '🚜' },
  { id: 'timber',    name: 'Fallen timber & firewood collection',    icon: '🪵' },
  { id: 'deadtrees', name: 'Removing dead, hollow or old trees',     icon: '🌳' },
  { id: 'clearing',  name: 'Clearing or thinning understorey shrubs', icon: '✂️' },
  { id: 'herbicide', name: 'Herbicide weed spraying',                icon: '🧪' },
  { id: 'woodyweed', name: 'Woody weed removal (blackberry, gorse…)', icon: '🌵' },
  { id: 'grazing',   name: 'Livestock grazing',                      icon: '🐄' },
  { id: 'pests',     name: 'Fox, cat & rabbit control',              icon: '🦊' },
  { id: 'rocks',     name: 'Moving or removing bush rock',           icon: '🪨' },
  { id: 'tidy',      name: 'Raking leaf litter & "tidying up"',      icon: '🍂' },
  { id: 'tracks',    name: 'Track, fence & firebreak works',         icon: '🛤️' },
  { id: 'water',     name: 'Dams, drains & wetland water levels',    icon: '💧' },
  { id: 'stream',    name: 'Stream bank & in-stream works',          icon: '🏞️' },
  { id: 'insecticide', name: 'Insecticide & mosquito spraying',      icon: '🦟' },
  { id: 'lighting',  name: 'Outdoor lighting',                       icon: '💡' },
  { id: 'pets',      name: 'Dogs & cats',                            icon: '🐕' },
  { id: 'planting',  name: 'Revegetation & planting',                icon: '🌱' },
  { id: 'nestbox',   name: 'Nest boxes & artificial habitat',        icon: '🏠' },
];

export const RATINGS = {
  avoid:     { label: 'Avoid / stop',       rank: 3, cls: 'en' },
  moderate:  { label: 'Moderate',           rank: 2, cls: 'vu' },
  care:      { label: 'Proceed with care',  rank: 1, cls: 'nt' },
  encourage: { label: 'Encourage',          rank: 0, cls: 'good' },
};

// ---------------------------------------------------------------------------
// Boost actions – things that actively increase populations / biodiversity
// ---------------------------------------------------------------------------
export const BOOSTS = {
  hollows:     { name: 'Keep every large old and hollow-bearing tree', detail: 'Hollows big enough for gliders, owls and cockatoos take 100–200+ years to form. Protect old trees and dead stags, and plan for replacements by letting young eucalypts grow on.' },
  nestboxes:   { name: 'Install nest boxes or chainsaw-carved hollows', detail: 'A stop-gap where hollows are scarce. Match box designs to target species (glider, microbat, parrot, owl) and check them yearly for bees and Common Mynas.' },
  logs:        { name: 'Leave fallen logs and add coarse woody debris', detail: 'Logs are shelter, foraging sites and fungal habitat. Leave them where they fall, or place salvaged logs in clusters on the ground.' },
  litter:      { name: 'Leave leaf litter and the ground layer alone', detail: 'Litter holds invertebrates, fungi, frogs and skinks, and is where ground-foraging birds and bandicoots feed.' },
  understorey: { name: 'Build a dense, layered understorey', detail: 'Plant clumps of local prickly and dense shrubs (e.g. Bursaria, Hedge Wattle, hakeas, tea-trees) for small birds to shelter and nest in. This also deters Noisy Miners.' },
  connectivity:{ name: 'Link habitat patches with corridors', detail: 'Plant strips of local species at least 30–50 m wide between remnants, along roads, creeks and fence lines, so animals can move and populations can mix.' },
  predators:   { name: 'Coordinated fox, cat and rabbit control', detail: 'Work with neighbours and Landcare, because one property alone rarely makes a difference. Time fox control for the breeding season, and follow up rabbit control by ripping warrens after baiting.' },
  pets:        { name: 'Keep cats contained and dogs on lead', detail: 'Pet cats kill large numbers of small reptiles, birds and mammals. Keep cats inside or in a cat run, especially at night.' },
  riparian:    { name: 'Fence stock out of waterways and replant the banks', detail: 'A 20–30 m buffer of native riparian vegetation shades the water, filters runoff and stops bank collapse. Provide off-stream watering points.' },
  snags:       { name: 'Leave snags and woody debris in waterways', detail: 'In-stream timber gives fish, platypus and crayfish places to shelter and breed, and creates pools.' },
  frogponds:   { name: 'Create frog-friendly wetlands', detail: 'Use shallow, gently sloping edges with plenty of reeds and sedges and no fish (Gambusia eats tadpoles). Some ponds should dry out seasonally.' },
  mosaic:      { name: 'Keep a mosaic of fire ages', detail: 'Burn in small, patchy blocks so that recently burnt, mid-aged and long-unburnt habitat always exist side by side. Keep unburnt refuges in gullies and around logs.' },
  biomass:     { name: 'Keep grassy inter-tussock gaps open', detail: 'Grassland wildflowers, orchids and small reptiles need open ground between tussocks. Remove grass biomass every few years with cool burns, or with carefully timed grazing or slashing where burning isn\'t possible.' },
  rocks:       { name: 'Return surface rock and add rock piles', detail: 'Leave embedded rocks in place. Placed rock piles and flat rocks on bare ground give skinks, legless lizards and invertebrates shelter.' },
  pollinators: { name: 'Plant for year-round flowers', detail: 'Choose a mix of local flowering shrubs, groundcovers and daisies that flower in different seasons. Avoid insecticides.' },
  mistletoe:   { name: 'Keep native mistletoe', detail: 'Mistletoe is a keystone food (nectar, fruit and foliage) for many birds and butterflies. It rarely kills healthy trees.' },
  hygiene:     { name: 'Practise Phytophthora (dieback) hygiene', detail: 'Clean soil off boots, tools and vehicles before entering heathy bush. Grass-trees, banksias, heaths and many orchids are very susceptible.' },
  feedtrees:   { name: 'Plant food trees for threatened birds', detail: 'Examples include sheoaks (Allocasuarina) for Glossy and Red-tailed Black-Cockatoos, winter-flowering eucalypts for Swift Parrots and Regent Honeyeaters, and acacias and eucalypts for Gang-gangs.' },
  lighting:    { name: 'Reduce night lighting', detail: 'Use warm-coloured, shielded, motion-sensor lights pointed downwards. Artificial light disrupts insects, bats, frogs and nocturnal mammals.' },
  seed:        { name: 'Revegetate with local-provenance species from your EVC', detail: 'Use the DEECA EVC benchmark species list for your EVC and bioregion, and source seed from nearby (indigenous nurseries can help). Include the grasses, herbs and groundcovers, not just trees.' },
  noisyminer:  { name: 'Tip the balance against Noisy Miners', detail: 'Noisy Miners (a native honeyeater) aggressively exclude small woodland birds from open, edgy habitat. Infilling with dense shrubs and widening narrow strips is the most effective long-term fix.' },
  wetlandflow: { name: 'Restore natural wetting and drying', detail: 'Many wetland plants and animals need seasonal drying. Avoid permanently flooding or draining wetlands, and seek advice from your CMA before altering drains or levees.' },
  slowgrow:    { name: 'Protect slow-recovering plants', detail: 'Mark and protect populations of threatened plants and orchids before any works. Many need years without disturbance to recover.' },
};

// ---------------------------------------------------------------------------
// Guilds
// ---------------------------------------------------------------------------
const ORCHID_GENERA = new Set(['Caladenia', 'Arachnorchis', 'Pterostylis', 'Diplodium', 'Linguella', 'Speculantha', 'Diuris', 'Prasophyllum', 'Thelymitra', 'Corybas', 'Acianthus', 'Cyrtostylis', 'Glossodia', 'Microtis', 'Calochilus', 'Dipodium', 'Gastrodia', 'Chiloglottis', 'Cryptostylis', 'Eriochilus', 'Lyperanthus', 'Corunastylis', 'Genoplesium', 'Spiranthes', 'Sarcochilus', 'Caleana', 'Paracaleana', 'Leporella', 'Burnettia', 'Simpliglottis', 'Petalochilus', 'Plumatichilos', 'Urochilus', 'Hymenochilus', 'Oligochaetochilus', 'Bunochilus', 'Pheladenia', 'Cyanicula', 'Leptoceras', 'Orthoceras', 'Praecoxanthus']);

export const GUILDS = [
  {
    id: 'hollow', name: 'Hollow-dependent animals', icon: '🦉', trigger: 'present',
    why: 'These species need tree hollows to breed or roost. Hollows only form in old trees and are the main limiting resource for many of them.',
    match: inGenera(['Petaurus', 'Petauroides', 'Acrobates', 'Trichosurus', 'Cercartetus', 'Phascogale', 'Callocephalon', 'Calyptorhynchus', 'Zanda', 'Cacatua', 'Eolophus', 'Platycercus', 'Lathamus', 'Glossopsitta', 'Parvipsitta', 'Psephotus', 'Psephotellus', 'Polytelis', 'Northiella', 'Neophema', 'Ninox', 'Tyto', 'Aegotheles', 'Climacteris', 'Cormobates', 'Pardalotus', 'Todiramphus', 'Dacelo', 'Eurystomus', 'Chenonetta', 'Nyctophilus', 'Chalinolobus', 'Vespadelus', 'Myotis', 'Austronomus', 'Ozimops', 'Mormopterus', 'Saccolaimus', 'Scotorepens', 'Falsistrellus', 'Scoteanax', 'Varanus']),
    notes: {
      deadtrees: ['avoid', 'Don\'t remove dead or hollow-bearing trees, including dead stags. If a tree is a genuine safety risk, prune or reduce it to a habitat stump rather than felling it, and check for occupants first.'],
      timber:    ['moderate', 'Large fallen limbs often contain hollows used by phascogales, bats and lizards. Leave them on the ground.'],
      burn:      ['care', 'Rake fuel away from the bases of old hollow trees before burning, and avoid high-intensity fire that can bring them down.'],
      nestbox:   ['encourage', 'Nest boxes help where natural hollows are scarce. Use designs suited to the species recorded here.'],
      planting:  ['encourage', 'Plant and protect eucalypts that will become the hollow trees of the next century.'],
      lighting:  ['care', 'Microbats and gliders forage at night. Keep lighting low and shielded near old trees.'],
    },
    boosts: ['hollows', 'nestboxes', 'connectivity'],
  },
  {
    id: 'groundmammals', name: 'Ground-dwelling mammals', icon: '🐾', trigger: 'priority',
    why: 'Bandicoots, potoroos, antechinuses, dunnarts and native rodents depend on dense ground cover, logs and litter, and are heavily preyed on by foxes and cats.',
    match: inGenera(['Isoodon', 'Perameles', 'Potorous', 'Bettongia', 'Aepyprymnus', 'Antechinus', 'Sminthopsis', 'Pseudomys', 'Mastacomys', 'Rattus', 'Hydromys', 'Dasyurus', 'Tachyglossus', 'Vombatus', 'Wallabia', 'Notamacropus', 'Macropus', 'Planigale', 'Ningaui', 'Cercartetus']),
    notes: {
      pests:     ['encourage', 'Fox and cat control has the biggest single benefit for these species. Take care with 1080 baiting where Spot-tailed Quolls or domestic dogs may take baits, and follow label and permit conditions.'],
      clearing:  ['avoid', 'Dense shrubs, sedges and grass tussocks are their shelter from predators. Don\'t clear or thin the understorey.'],
      slash:     ['moderate', 'Slash in strips or patches, keep unslashed refuges, and avoid slashing dense cover.'],
      tidy:      ['avoid', 'Leaf litter and ground debris are where they forage for insects and fungi.'],
      timber:    ['moderate', 'Logs provide nest sites and cover. Leave most fallen timber where it lies.'],
      burn:      ['care', 'Burn in small patches and leave unburnt refuges. Large, uniform burns expose survivors to predators.'],
      pets:      ['avoid', 'Roaming cats and dogs are a major threat. Keep cats contained and dogs on lead.'],
      woodyweed: ['care', 'Bandicoots often shelter in blackberry and other weed thickets. Remove weeds in stages and replace them with dense native shrubs.'],
    },
    boosts: ['predators', 'understorey', 'logs', 'litter', 'pets'],
  },
  {
    id: 'woodlandbirds', name: 'Woodland & understorey birds', icon: '🐦', trigger: 'priority',
    why: 'Small insect-eating and ground-foraging birds have declined sharply. They need a shrub layer, fallen timber and litter, and protection from Noisy Miners.',
    match: inGenera(['Climacteris', 'Pomatostomus', 'Melanodryas', 'Petroica', 'Microeca', 'Eopsaltria', 'Grantiella', 'Anthochaera', 'Stagonopleura', 'Neochmia', 'Acanthiza', 'Aphelocephala', 'Pyrrholaemus', 'Chthonicola', 'Malurus', 'Stipiturus', 'Amytornis', 'Cinclosoma', 'Turnix', 'Pedionomus', 'Burhinus', 'Menura', 'Pycnoptilus', 'Origma', 'Sericornis', 'Dasyornis', 'Calamanthus', 'Hylacola', 'Psophodes', 'Falcunculus', 'Oreoica', 'Pachycephala', 'Colluricincla', 'Melithreptus', 'Lichenostomus', 'Ptilotula', 'Plectorhyncha', 'Epthianura', 'Leipoa', 'Artamus', 'Daphoenositta', 'Smicrornis']),
    notes: {
      clearing:  ['avoid', 'Keep the shrub layer, because these birds nest and shelter in it. Open, shrubless woodland favours Noisy Miners.'],
      timber:    ['avoid', 'Fallen timber is critical foraging habitat for robins, treecreepers and babblers. Don\'t collect firewood from bushland.'],
      tidy:      ['moderate', 'Leave litter in place, because it is where most of their insect food lives.'],
      woodyweed: ['care', 'Some threatened birds (e.g. Southern Emu-wren, Eastern Bristlebird) use weed thickets. Remove weeds gradually and replant natives first.'],
      insecticide: ['moderate', 'These birds eat insects. Avoid broad-scale insecticide use.'],
      planting:  ['encourage', 'Plant clumps of dense and prickly shrubs and widen narrow strips. This is the best way to bring small birds back.'],
      grazing:   ['moderate', 'Heavy grazing removes the shrub and ground layers. Exclude stock from remnants, or graze lightly and only occasionally.'],
      burn:      ['care', 'Burn small patches so unburnt shrub cover always remains nearby.'],
    },
    boosts: ['understorey', 'logs', 'noisyminer', 'connectivity', 'pollinators'],
  },
  {
    id: 'raptors', name: 'Owls & birds of prey', icon: '🦅', trigger: 'priority',
    why: 'Top predators need large territories, big old nest and roost trees, and plenty of prey. Their presence indicates a healthy food web.',
    match: inGenera(['Ninox', 'Tyto', 'Aquila', 'Haliaeetus', 'Hieraaetus', 'Lophoictinia', 'Accipiter', 'Circus', 'Falco', 'Elanus', 'Haliastur', 'Milvus', 'Pandion']),
    notes: {
      deadtrees: ['avoid', 'Retain large old trees used for nests and roosts. Powerful Owls need big hollows, and eagles use tall emergent trees.'],
      pests:     ['care', 'Don\'t use rodenticides (rat poison), because owls and raptors die from eating poisoned rodents. Use traps instead.'],
      clearing:  ['moderate', 'Keep dense roost vegetation in gullies (e.g. for Powerful Owls).'],
    },
    boosts: ['hollows', 'connectivity'],
  },
  {
    id: 'frogs', name: 'Frogs', icon: '🐸', trigger: 'present',
    why: 'Frogs breathe partly through their skin, so they are very sensitive to chemicals, sediment and changes to water regimes. They are excellent indicators of wetland health.',
    match: inGroups(['amphibians']),
    notes: {
      herbicide: ['moderate', 'Near water, use only herbicides registered for aquatic areas (some surfactants in standard formulations are toxic to frogs), spot-spray only, and avoid spraying in the breeding season.'],
      insecticide: ['avoid', 'Insecticides are highly toxic to tadpoles and remove frogs\' food.'],
      water:     ['care', 'Keep a mix of permanent and seasonal water. Don\'t drain wetlands or stock dams with fish. Many frogs need ponds that dry in late summer.'],
      grazing:   ['moderate', 'Fence stock out of wetlands and dam edges so fringing reeds and sedges can recover.'],
      rocks:     ['moderate', 'Rocks and logs near water are frog shelter. Leave them in place.'],
      lighting:  ['care', 'Lights near ponds disrupt calling and breeding.'],
      slash:     ['care', 'Leave unmown vegetation around wetlands. Frogs migrate through long grass.'],
    },
    boosts: ['frogponds', 'wetlandflow', 'riparian', 'lighting'],
  },
  {
    id: 'aquatic', name: 'Fish, platypus & freshwater crayfish', icon: '🐟', trigger: 'present',
    why: 'Native fish, platypus, water-rats and crayfish need clean, shaded water, snags and stable undercut banks.',
    match: any(inGroups(['fish']), inGenera(['Ornithorhynchus', 'Hydromys', 'Euastacus', 'Engaeus', 'Cherax', 'Geocharax', 'Galaxias', 'Nannoperca', 'Maccullochella', 'Macquaria', 'Gadopsis', 'Prototroctes', 'Mogurnda', 'Craterocephalus', 'Paratya'])),
    notes: {
      stream:    ['avoid', 'Don\'t remove snags or reshape banks. Bank and bed works on waterways usually need a permit from your Catchment Management Authority (CMA).'],
      grazing:   ['moderate', 'Fence stock out of waterways. Trampling causes erosion and sediment that smothers fish eggs and crayfish burrows.'],
      herbicide: ['moderate', 'Use only aquatic-registered herbicides near waterways and never spray directly into water.'],
      water:     ['care', 'Keep environmental flows, and avoid barriers (weirs, culverts) that block fish passage.'],
      planting:  ['encourage', 'Replant riparian buffers to shade the water and stabilise banks.'],
    },
    boosts: ['riparian', 'snags', 'wetlandflow'],
  },
  {
    id: 'waterbirds', name: 'Wetland & waterbirds', icon: '🦆', trigger: 'priority',
    why: 'Cryptic wetland birds such as bitterns, crakes and snipe need dense reed beds, shallow margins and natural wet–dry cycles.',
    match: inGenera(['Botaurus', 'Ixobrychus', 'Rostratula', 'Gallinago', 'Porzana', 'Zapornia', 'Lewinia', 'Oxyura', 'Biziura', 'Stictonetta', 'Aythya', 'Ardea', 'Egretta', 'Nycticorax', 'Platalea', 'Threskiornis', 'Plegadis', 'Calidris', 'Charadrius', 'Thinornis', 'Numenius', 'Limosa', 'Tringa', 'Sternula', 'Hydroprogne', 'Gelochelidon', 'Grus', 'Cygnus', 'Poliocephalus', 'Tachybaptus']),
    notes: {
      water:     ['avoid', 'Don\'t drain, deepen or permanently flood wetlands. Shallow, fluctuating margins are where these birds feed.'],
      grazing:   ['moderate', 'Fence stock out of reed beds and wetland margins, especially in the breeding season (spring–summer).'],
      pets:      ['moderate', 'Keep dogs away from wetland edges and beaches, where shorebirds and waterbirds nest on the ground.'],
      slash:     ['care', 'Don\'t slash or burn reed beds during spring–summer nesting.'],
    },
    boosts: ['wetlandflow', 'riparian', 'pets'],
  },
  {
    id: 'reptiles', name: 'Lizards, snakes & turtles', icon: '🦎', trigger: 'priority',
    why: 'Reptiles need structure (rocks, logs, litter and tussocks) to shelter in and to regulate their body temperature.',
    match: inGroups(['reptiles']),
    notes: {
      rocks:     ['avoid', 'Don\'t remove or turn over bush rock, because it is irreplaceable reptile habitat. Collecting bush rock is listed as a threatening process.'],
      timber:    ['moderate', 'Leave logs and fallen timber where they lie.'],
      slash:     ['moderate', 'Raise slasher height (≥10–15 cm) and avoid warm days when lizards are active above ground. Grassland legless lizards and earless dragons live in tussocks.'],
      tidy:      ['moderate', 'Leave leaf litter and debris piles.'],
      pets:      ['moderate', 'Cats are major predators of lizards. Keep them contained.'],
      burn:      ['care', 'Burn in cooler months when reptiles are sheltering, and leave unburnt patches.'],
    },
    boosts: ['rocks', 'logs', 'litter', 'pets'],
  },
  {
    id: 'orchids', name: 'Native orchids', icon: '🌸', trigger: 'present',
    why: 'Terrestrial orchids depend on specific soil fungi and pollinators, are easily damaged by soil disturbance, herbicide and grazing, and many are threatened.',
    match: s => ORCHID_GENERA.has(genus(s)),
    notes: {
      herbicide: ['moderate', 'Map orchid patches and avoid spraying from autumn to early summer, when leaves and flowers are above ground. Hand-weed near orchids instead.'],
      slash:     ['moderate', 'Avoid slashing from winter to early summer, when most orchids are flowering and setting seed.'],
      grazing:   ['moderate', 'Rabbits, kangaroos and stock eat orchid leaves and flowers. Use exclusion cages for threatened orchids.'],
      burn:      ['care', 'Many orchids flower prolifically after summer–autumn fire, but spring burns can kill emerging plants.'],
      tracks:    ['care', 'Keep vehicles and new tracks away from orchid sites.'],
      pests:     ['encourage', 'Rabbit control directly protects orchids.'],
    },
    boosts: ['slowgrow', 'hygiene', 'predators'],
  },
  {
    id: 'grassyflora', name: 'Grassland & grassy woodland wildflowers', icon: '🌼', trigger: 'priority',
    why: 'Lilies, daisies, peas and other forbs grow in the gaps between grass tussocks. They are lost when grass gets too thick or when soils are fertilised or disturbed.',
    match: inGenera(['Themeda', 'Rytidosperma', 'Austrostipa', 'Microseris', 'Leucochrysum', 'Rutidosis', 'Craspedia', 'Wurmbea', 'Bulbine', 'Arthropodium', 'Dichopogon', 'Burchardia', 'Thysanotus', 'Xerochrysum', 'Chrysocephalum', 'Swainsona', 'Pimelea', 'Lepidium', 'Ptilotus', 'Calocephalus', 'Brachyscome', 'Eryngium', 'Senecio', 'Stackhousia', 'Velleia', 'Goodenia', 'Leptorhynchos', 'Podolepis', 'Triptilodiscus', 'Hypoxis', 'Tricoryne', 'Caesia', 'Stylidium', 'Lomandra', 'Convolvulus', 'Linum', 'Plantago', 'Geranium', 'Ranunculus', 'Kennedia', 'Glycine', 'Hovea', 'Desmodium', 'Cullen', 'Rutidosis']),
    notes: {
      burn:      ['encourage', 'Cool burns every few years open up inter-tussock gaps that wildflowers need. This is the best tool for most grassy ecosystems.'],
      slash:     ['care', 'Slashing can substitute for fire if cuttings are removed, because leaving thatch smothers forbs. Time it after seed set (late summer).'],
      grazing:   ['moderate', 'Rotational or crash grazing in summer–autumn can reduce biomass. Avoid continuous grazing and grazing during flowering (spring).'],
      herbicide: ['moderate', 'Spot-spray only. Never boom-spray native grassland, because forbs are killed by broadleaf herbicides.'],
      planting:  ['care', 'Don\'t plant trees or shrubs into native grassland. Shade and leaf fall destroy it. Add forbs and grasses instead.'],
    },
    boosts: ['biomass', 'slowgrow', 'seed'],
  },
  {
    id: 'invertebrates', name: 'Threatened insects & invertebrates', icon: '🦋', trigger: 'priority',
    why: 'Threatened butterflies, moths and other invertebrates often rely on a single host plant or ant partner, and are very sensitive to pesticides and habitat change.',
    match: inGroups(['insects', 'arachnids', 'crustaceans', 'molluscs', 'otherinv']),
    notes: {
      insecticide: ['avoid', 'Avoid insecticides, including drift from nearby spraying.'],
      herbicide: ['moderate', 'Identify and protect host plants (e.g. Sweet Bursaria for the Eltham Copper Butterfly, wallaby-grasses for the Golden Sun Moth) before any weed control.'],
      slash:     ['moderate', 'Leave patches of unmown grass and flowering plants through spring and summer.'],
      lighting:  ['care', 'Night lighting attracts and kills moths and other insects.'],
    },
    boosts: ['pollinators', 'lighting', 'slowgrow'],
  },
  {
    id: 'fungi', name: 'Fungi & lichens', icon: '🍄', trigger: 'priority',
    why: 'Fungi recycle nutrients and partner with plant roots (including all orchids). They depend on undisturbed soil, litter and dead wood.',
    match: inGroups(['fungi']),
    notes: {
      timber:    ['moderate', 'Dead wood at every stage of decay supports different fungi. Leave it on the ground.'],
      tidy:      ['moderate', 'Leave litter and dead wood. Don\'t rake or remove it.'],
    },
    boosts: ['logs', 'litter'],
  },
  {
    id: 'threatflora', name: 'Threatened plants', icon: '🌿', trigger: 'priority',
    why: 'Listed or locally rare plants are often reduced to a few individuals. Accidental damage from works, herbicide or grazing can wipe out a population.',
    match: s => ['flowering', 'ferns', 'conifers', 'bryophytes', 'otherplants'].includes(s.group) && s.threat >= 2,
    notes: {
      herbicide: ['moderate', 'Survey and flag threatened plants before any spraying, and keep a no-spray buffer around them.'],
      tracks:    ['moderate', 'Keep track, fence and firebreak works away from known populations.'],
      grazing:   ['moderate', 'Protect plants from grazing with fencing or cages where browsing is evident.'],
    },
    boosts: ['slowgrow', 'seed', 'hygiene'],
  },
];

// ---------------------------------------------------------------------------
// Keystone species – present at any rarity
// ---------------------------------------------------------------------------
export const KEYSTONES = [
  { match: inGenera(['Eucalyptus', 'Corymbia', 'Angophora']), role: 'Foundation trees', detail: 'Eucalypts form the canopy, and as they age they provide hollows, nectar, insects and fallen timber for hundreds of species.', notes: { deadtrees: ['avoid', 'Old eucalypts are irreplaceable on human timescales.'] }, boosts: ['hollows'] },
  { match: inGenera(['Acacia']), role: 'Nitrogen fixers & food plants', detail: 'Wattles enrich the soil, and their gum, seed and insects feed gliders, birds and butterflies (Jalmenus, Ogyris and others).', boosts: ['understorey'] },
  { match: isSpecies(['Bursaria spinosa']), role: 'Nectar for beneficial insects', detail: 'Sweet Bursaria flowers in summer when little else does. It feeds parasitoid wasps that control pasture pests and is the host plant of the threatened Eltham Copper Butterfly.', boosts: ['understorey', 'pollinators'] },
  { match: inGenera(['Banksia']), role: 'Winter nectar source', detail: 'Banksias feed honeyeaters, pygmy-possums and insects through the cooler months.', boosts: ['hygiene'] },
  { match: inGenera(['Xanthorrhoea']), role: 'Grass-trees', detail: 'Grass-trees are long-lived, provide nectar and shelter, and are highly susceptible to Phytophthora dieback.', boosts: ['hygiene'] },
  { match: inGenera(['Allocasuarina', 'Casuarina']), role: 'Black-cockatoo food trees', detail: 'Sheoak cones are the main food of Glossy Black-Cockatoos, and sheoaks are important for Red-tailed Black-Cockatoos and other seed-eaters.', boosts: ['feedtrees'] },
  { match: isSpecies(['Themeda triandra']), role: 'Dominant grassland tussock', detail: 'Kangaroo Grass tussocks structure native grasslands. They shelter reptiles and insects and create gaps for wildflowers.', boosts: ['biomass'] },
  { match: inGenera(['Amyema', 'Muellerina', 'Dendrophthoe', 'Lysiana']), role: 'Mistletoe', detail: 'Mistletoe is a keystone resource whose nectar, fruit and leaves support Mistletoebirds, honeyeaters and many butterflies.', notes: { deadtrees: ['care', 'Don\'t remove mistletoe from healthy trees.'] }, boosts: ['mistletoe'] },
  { match: isSpecies(['Pteropus poliocephalus']), role: 'Long-distance pollinator', detail: 'Grey-headed Flying-foxes pollinate eucalypts and disperse seed over tens of kilometres.', notes: { planting: ['care', 'If netting fruit trees, note that netting with mesh over 5 mm entangles flying-foxes. Use wildlife-safe netting (holes under 5 mm).'] }, boosts: ['feedtrees'] },
  { match: inGenera(['Isoodon', 'Perameles', 'Potorous', 'Bettongia']), role: 'Soil engineers', detail: 'Digging marsupials turn over tonnes of soil a year, burying seed and litter, improving water infiltration and spreading fungal spores.', boosts: ['predators'] },
  { match: isSpecies(['Tachyglossus aculeatus']), role: 'Soil engineer', detail: 'Echidnas dig for ants and termites, aerating the soil and burying litter.', boosts: ['logs'] },
  { match: isSpecies(['Vombatus ursinus']), role: 'Burrow builder', detail: 'Wombat burrows are used as refuges by many other animals, especially during fire.', notes: { pests: ['care', 'Don\'t fumigate or rip burrows during rabbit control unless you have confirmed they are not wombat burrows.'] } },
  { match: isSpecies(['Menura novaehollandiae']), role: 'Forest-floor engineer', detail: 'Superb Lyrebirds turn over huge amounts of litter, which reduces fuel loads and mixes nutrients into the soil.', boosts: ['litter'] },
  { match: isSpecies(['Ornithorhynchus anatinus']), role: 'Stream health indicator', detail: 'Platypus need intact banks, clean water and abundant invertebrates. Their presence shows a healthy waterway.', notes: { stream: ['avoid', 'Never use enclosed yabby traps ("opera house" nets), which drown platypus and are banned in Victoria.'] }, boosts: ['riparian', 'snags'] },
  { match: inGenera(['Engaeus']), role: 'Burrowing crayfish', detail: 'Burrowing crayfish aerate wet soils, and their burrows shelter frogs and invertebrates.', boosts: ['riparian'] },
  { match: isSpecies(['Ninox strenua']), role: 'Apex nocturnal predator', detail: 'Powerful Owls regulate possum populations and need large old hollow trees and dense gully roosts.', boosts: ['hollows'] },
  { match: isSpecies(['Dasyurus maculatus']), role: 'Apex marsupial predator', detail: 'Spot-tailed Quolls need large connected forests with logs and rocky dens.', notes: { pests: ['moderate', 'Use quoll-safe baiting (buried or bait stations) under permit conditions.'] }, boosts: ['logs', 'connectivity'] },
  { match: isSpecies(['Manorina melanocephala']), negative: true, role: 'Hyper-aggressive native', detail: 'Noisy Miners are native but drive small birds out of open woodland and edges. Where they dominate, adding shrub cover matters more than anything else for small birds.', notes: { clearing: ['avoid', 'Thinning the understorey favours Noisy Miners.'] }, boosts: ['noisyminer', 'understorey'] },
];

// ---------------------------------------------------------------------------
// Habitat (EVC group) guidance
// ---------------------------------------------------------------------------
export const HABITATS = [
  { test: /grassland|chenopod/i, name: 'Grasslands', fire: 'Frequent, cool burns. Indicatively every 3–5 years to keep inter-tussock gaps open. Grasslands degrade quickly without biomass removal.', grazing: 'Can be a substitute for fire if light, rotational and avoiding spring. Never fertilise native grassland.', planting: 'Don\'t plant trees or shrubs. Restore with local grasses and forbs (direct seeding or tubestock).', notes: { burn: ['encourage', 'Native grasslands depend on regular biomass removal.'], planting: ['care', 'Keep grasslands treeless.'] }, boosts: ['biomass'] },
  { test: /plains woodland|riverine grassy|herb-rich|grassy woodland|lower slopes/i, name: 'Grassy woodlands', fire: 'Low-intensity, patchy burns. Indicatively every 5–15 years for the grassy ground layer, while protecting old trees.', grazing: 'Exclude stock or graze only lightly and occasionally (outside spring). Continuous grazing removes the shrub layer and forbs.', planting: 'Restore the missing shrub layer in clumps, and add forbs. Leave canopy gaps open.', notes: { timber: ['avoid', 'Grassy woodlands naturally carry lots of fallen timber, which ground-foraging birds and mammals need.'] }, boosts: ['logs', 'understorey', 'hollows'] },
  { test: /box ironbark|lower fertility/i, name: 'Box–ironbark forests', fire: 'Infrequent, low-intensity fire. Indicatively at least 10–15 years between fires.', grazing: 'Exclude stock.', planting: 'Plant winter-flowering eucalypts (e.g. Mugga Ironbark, Yellow Gum) for Swift Parrots and Regent Honeyeaters.', notes: { timber: ['avoid', 'Box–ironbark forests were heavily cut for firewood, and fallen timber is now critically scarce.'] }, boosts: ['logs', 'feedtrees', 'hollows'] },
  { test: /heathy woodland|heathland/i, name: 'Heathlands & heathy woodlands', fire: 'Fire-dependent, but needs time to set seed. Indicatively 10–15 years minimum and roughly 30–45 years maximum between fires. Too frequent fire removes obligate seeders, and too little leads to senescence.', grazing: 'Exclude stock.', planting: 'Usually regenerates best from soil seed. Control weeds and keep a suitable fire regime.', notes: { tracks: ['care', 'Heaths are very prone to Phytophthora. Clean vehicles and boots.'] }, boosts: ['hygiene', 'mosaic'] },
  { test: /dry forest/i, name: 'Dry forests', fire: 'Mosaic burning. Indicatively at least 10–12 years between fires, with unburnt refuges kept.', grazing: 'Exclude stock.', planting: 'Encourage natural regeneration, and replant understorey where it is missing.', notes: {}, boosts: ['mosaic', 'logs'] },
  { test: /lowland forest/i, name: 'Lowland forests', fire: 'Indicatively at least 15 years between fires, in patchy burns.', grazing: 'Exclude stock.', planting: 'Encourage natural regeneration.', notes: {}, boosts: ['mosaic', 'understorey'] },
  { test: /wet or damp|damp forest|wet forest/i, name: 'Wet & damp forests', fire: 'Fire-sensitive. Damp forest needs at least about 25 years between fires, and wet forest (e.g. Mountain Ash) about 80+ years. Planned burning is generally not appropriate.', grazing: 'Exclude stock.', planting: 'Protect tree ferns, logs and moist gullies, and control woody weeds.', notes: { burn: ['avoid', 'Wet forests are killed or converted by frequent fire.'] }, boosts: ['logs', 'hollows'] },
  { test: /rainforest/i, name: 'Rainforests', fire: 'Exclude fire.', grazing: 'Exclude stock.', planting: 'Protect from edge effects with buffer plantings.', notes: { burn: ['avoid', 'Rainforest is destroyed by fire.'] }, boosts: ['connectivity'] },
  { test: /riparian|swampy/i, name: 'Riparian & swampy vegetation', fire: 'Generally fire-sensitive. Avoid burning, and keep as a refuge when surrounding areas are burnt.', grazing: 'Fence out stock and provide off-stream water.', planting: 'Replant a 20–30 m buffer with local riparian species.', notes: { burn: ['moderate', 'Riparian zones act as fire refuges and recover slowly.'], grazing: ['avoid', 'Stock destroy stream banks and riparian vegetation.'] }, boosts: ['riparian', 'snags'] },
  { test: /wetland|aquatic|swamp/i, name: 'Wetlands', fire: 'Fire is rarely used. Hydrology (wetting and drying) is the key driver.', grazing: 'Exclude or tightly control stock.', planting: 'Restore fringing sedges and reeds, and restore natural water regimes.', notes: { water: ['avoid', 'Altering wetland hydrology is the biggest threat here.'] }, boosts: ['wetlandflow', 'frogponds'] },
  { test: /mallee/i, name: 'Mallee', fire: 'Long fire intervals. Many mallee animals (e.g. Malleefowl, Mallee Emu-wren) need long-unburnt (30+ year) habitat. Avoid large fires.', grazing: 'Control total grazing pressure (stock, goats, rabbits and over-abundant kangaroos).', planting: 'Direct-seed local species and control rabbits first.', notes: { burn: ['moderate', 'Long-unburnt mallee is critically scarce.'] }, boosts: ['mosaic', 'predators'] },
  { test: /salt|succulent/i, name: 'Saltmarsh & salt-tolerant shrublands', fire: 'Fire-sensitive. Exclude fire.', grazing: 'Exclude stock and vehicles, because saltmarsh recovers extremely slowly.', planting: 'Natural regeneration after removing disturbance.', notes: { burn: ['avoid', 'Chenopod and saltmarsh shrubs are killed by fire.'], tracks: ['moderate', 'Vehicle tracks scar saltmarsh for decades.'] }, boosts: ['slowgrow'] },
  { test: /coastal/i, name: 'Coastal scrubs & woodlands', fire: 'Indicatively at least 10–25 years between fires, depending on type.', grazing: 'Exclude stock.', planting: 'Use local coastal species, and control woody weeds (e.g. Coast Tea-tree spread, Boneseed).', notes: { pets: ['moderate', 'Keep dogs on lead, because beach-nesting birds are vulnerable.'] }, boosts: ['pets'] },
  { test: /rocky|escarpment/i, name: 'Rocky outcrops', fire: 'Infrequent fire, because outcrops act as natural refuges.', grazing: 'Exclude stock and goats.', planting: 'Leave rocks in place, and control weeds.', notes: { rocks: ['avoid', 'Outcrop rock is critical habitat. Never remove it.'] }, boosts: ['rocks'] },
  { test: /montane|sub-alpine|alpine/i, name: 'Montane & alpine vegetation', fire: 'Fire-sensitive. Snow Gum woodland needs about 30+ years between fires, and alpine bogs should never be burnt.', grazing: 'Exclude stock, deer and horses, which trample bogs.', planting: 'Natural regeneration is preferred.', notes: { burn: ['moderate', 'Alpine vegetation recovers very slowly.'] }, boosts: ['slowgrow'] },
];

export const LINKS = [
  { href: 'https://discover.data.vic.gov.au/dataset/aspatial-table-tolerable-fire-interval-for-ecological-fire-groups-and-ecological-vegetation-div', label: 'DEECA – Tolerable fire interval table' },
  { href: 'https://www.environment.vic.gov.au/biodiversity/bioregions-and-evc-benchmarks', label: 'DEECA – EVC benchmarks (species lists for revegetation)' },
  { href: 'https://www.environment.vic.gov.au/native-vegetation/native-vegetation', label: 'Native vegetation removal rules (Clause 52.17)' },
  { href: 'https://www.cfa.vic.gov.au/burnoff', label: 'CFA – burning off & permits' },
  { href: 'https://trustfornature.org.au/what-we-do/land-for-wildlife/', label: 'Land for Wildlife – Trust for Nature (free property advice)' },
  { href: 'https://www.landcarevic.org.au/', label: 'Landcare Victoria – find your local group' },
];

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------
const byRarity = (a, b) => (b.rarityScore || 0) - (a.rarityScore || 0);

export function buildPlan(species, evc, evc1750) {
  const activity = new Map(ACTIVITIES.map(a => [a.id, { ...a, notes: [] }]));
  const boosts = new Map();
  const addBoost = (id, source, names) => {
    if (!BOOSTS[id]) return;
    const b = boosts.get(id) || { id, ...BOOSTS[id], sources: new Set(), species: new Set() };
    b.sources.add(source);
    names.forEach(n => b.species.add(n));
    boosts.set(id, b);
  };
  const label = s => s.common || s.name;

  // Guilds
  const guilds = [];
  for (const g of GUILDS) {
    const members = species.filter(g.match);
    if (!members.length) continue;
    const priority = members.filter(isPriority).sort(byRarity);
    if (g.trigger === 'priority' && !priority.length) continue;
    const drivers = (priority.length ? priority : members.slice().sort(byRarity)).slice(0, 6);
    const driverNames = drivers.map(label);
    guilds.push({ ...g, members, priority, drivers });
    for (const [act, [rating, text]] of Object.entries(g.notes)) {
      activity.get(act)?.notes.push({ rating, text, source: g.name, icon: g.icon, species: driverNames });
    }
    g.boosts.forEach(b => addBoost(b, g.name, driverNames));
  }

  // Keystones
  const keystones = [];
  for (const k of KEYSTONES) {
    const members = species.filter(k.match);
    if (!members.length) continue;
    keystones.push({ ...k, members });
    const names = members.slice(0, 4).map(label);
    for (const [act, [rating, text]] of Object.entries(k.notes || {})) {
      activity.get(act)?.notes.push({ rating, text, source: `Keystone: ${k.role}`, icon: '🔑', species: names });
    }
    (k.boosts || []).forEach(b => addBoost(b, `Keystone: ${k.role}`, names));
  }

  // Habitat from EVC (current, else pre-1750)
  const habEvc = evc || evc1750;
  let habitat = null;
  if (habEvc) {
    const text = `${habEvc.x_groupname || ''} ${habEvc.x_evcname || ''}`;
    habitat = HABITATS.find(h => h.test.test(text)) || null;
    if (habitat) {
      habitat = { ...habitat, evc: habEvc, isHistoric: !evc };
      for (const [act, [rating, text]] of Object.entries(habitat.notes)) {
        activity.get(act)?.notes.push({ rating, text, source: `Habitat: ${habitat.name}`, icon: '🗺️', species: [] });
      }
      habitat.boosts.forEach(b => addBoost(b, `Habitat: ${habitat.name}`, []));
    }
    if (evc && ['Endangered', 'Vulnerable'].includes(evc.evc_bcs_desc)) {
      for (const act of ['clearing', 'deadtrees', 'tracks']) {
        activity.get(act)?.notes.push({
          rating: 'moderate', source: 'EVC conservation status', icon: '⚖️', species: [],
          text: `${evc.x_evcname} is ${evc.evc_bcs_desc.toLowerCase()} in the ${evc.bioregion} bioregion. Removing, destroying or lopping native vegetation (including dead trees and understorey) generally needs a planning permit under Clause 52.17.`,
        });
      }
    }
  }
  addBoost('seed', 'Always recommended', []);

  // Resolve ratings
  const activities = [...activity.values()].map(a => {
    a.notes.sort((x, y) => RATINGS[y.rating].rank - RATINGS[x.rating].rank);
    const top = a.notes[0];
    a.rating = top ? top.rating : null;
    return a;
  });
  // Order: avoid, moderate, care, encourage, then no specific advice.
  activities.sort((x, y) => order(x) - order(y));

  const boostList = [...boosts.values()]
    .map(b => ({ ...b, sources: [...b.sources], species: [...b.species] }))
    .sort((a, b) => (b.sources.length + b.species.length / 10) - (a.sources.length + a.species.length / 10));

  const prioritySpecies = species.filter(isPriority).sort(byRarity);
  return { guilds, keystones, habitat, activities, boosts: boostList, prioritySpecies };
}

function order(a) {
  return { avoid: 0, moderate: 1, care: 2, encourage: 3 }[a.rating] ?? 4;
}
