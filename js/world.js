// The made-up world: routes, the scenery layers each one is built from, trains, stations, tunnels and climate.
// Distances are metres along the track. Layers are drawn far to near; `p` is parallax (how close the layer is).
(function () {
  "use strict";
  const { hash, fbm } = U;

  const pole = { k: "poles", p: 1.7, y: 0.97, cell: 55, size: 17 };

  const BIOMES = {
    countryside: {
      name: "Countryside",
      blurb: "Patchwork fields, windmills, sheep and sleepy villages.",
      sky: "earth",
      temp: [16, 5],
      weather: { clear: 4, cloudy: 3, rain: 2, fog: 1, storm: 0.4 },
      names: [
        ["Ash", "Bram", "Wil", "Hollow", "Kings", "Elder", "Marl", "Thorn", "Oak", "Hazel", "Brook", "Little ", "Upper ", "Long "],
        ["combe", "ford", "ley", "bury", "field", "wick", "mere", "by", "ton", "stead", "well", "Barrow", "Meadow", "Cross"],
      ],
      layers: [
        { k: "ridge", p: 0.018, y: 0.47, amp: 0.05, freq: 1 / 1100, oct: 3, col: "#6f87a6", haze: 0.72 },
        { k: "ridge", p: 0.045, y: 0.51, amp: 0.05, freq: 1 / 600, oct: 3, col: "#5f8457", haze: 0.5,
          objs: [{ kind: "tree", cell: 30, prob: 0.55, size: [10, 16] }, { kind: "church", cell: 2500, prob: 0.35, size: [26, 30] }] },
        { k: "field", p: 0.12, y: 0.57, amp: 0.025, freq: 1 / 400, col: "#7c9d4d", haze: 0.3, fieldCell: 90,
          fields: ["#86a553", "#a9b25a", "#c8b66b", "#6f9a4a", "#9aa14e", "#b9a15a"],
          objs: [
            { kind: "tree", cell: 45, prob: 0.4, size: [9, 15] },
            { kind: "house", cell: 160, prob: 0.3, size: [7, 9] },
            { kind: "barn", cell: 420, prob: 0.3, size: [8, 10] },
            { kind: "windmill", cell: 1400, prob: 0.45, size: [22, 26] },
            { kind: "sheep", cell: 12, prob: 0.12, size: [1, 1.2] },
          ] },
        { k: "field", p: 0.32, y: 0.64, amp: 0.02, freq: 1 / 250, col: "#739843", haze: 0.12, fieldCell: 70,
          fields: ["#7ea64d", "#98ad52", "#bfae62", "#6a9443"],
          objs: [
            { kind: "tree", cell: 40, prob: 0.3, size: [9, 14] },
            { kind: "poplar", cell: 90, prob: 0.25, size: [14, 18] },
            { kind: "house", cell: 300, prob: 0.2, size: [7, 9] },
            { kind: "cow", cell: 16, prob: 0.1, size: [1.4, 1.6] },
          ] },
        { k: "ground", p: 0.95, y: 0.73, amp: 0.012, freq: 1 / 60, col: "#5c8a3c", haze: 0,
          objs: [{ kind: "bush", cell: 7, prob: 0.5, size: [1.2, 2.4] }, { kind: "tree", cell: 34, prob: 0.22, size: [9, 13] }, { kind: "fence", cell: 3, prob: 1, size: [1.1, 1.1] }] },
        pole,
      ],
    },

    mountains: {
      name: "Mountains",
      blurb: "Snow peaks, alpine lakes, pine valleys and long tunnels.",
      sky: "earth",
      temp: [5, 5],
      tunnels: { cell: 3800, prob: 0.55, len: [350, 1300] },
      weather: { clear: 3, cloudy: 3, rain: 1, snow: 1.5, fog: 1.5, storm: 0.3 },
      names: [
        ["Alp", "Ber", "Grau", "Lauter", "Sil", "Eis", "Ober", "Hoch", "Sankt ", "Wald", "Rosen", "Kalt"],
        ["bach", "horn", "tal", "berg", "joch", "matt", "see", "egg", "alp", "brunnen", "fluh", "au"],
      ],
      layers: [
        { k: "ridge", p: 0.012, y: 0.5, amp: 0.32, freq: 1 / 1400, oct: 5, sharp: true, snow: 0.45, col: "#8497b5", haze: 0.62 },
        { k: "ridge", p: 0.03, y: 0.55, amp: 0.24, freq: 1 / 900, oct: 5, sharp: true, snow: 0.72, col: "#5e7288", haze: 0.42 },
        { k: "water", p: 0.06, y: 0.585, col: "#3e6d86", haze: 0.3, band: 0.04, cell: 3000, prob: 0.5 },
        { k: "ridge", p: 0.075, y: 0.62, amp: 0.1, freq: 1 / 500, oct: 4, col: "#35583f", haze: 0.3,
          objs: [{ kind: "pine", cell: 11, prob: 0.85, size: [12, 20] }] },
        { k: "ground", p: 0.22, y: 0.67, amp: 0.04, freq: 1 / 300, col: "#4c6d3c", haze: 0.12,
          objs: [{ kind: "pine", cell: 9, prob: 0.6, size: [12, 22] }, { kind: "chalet", cell: 260, prob: 0.3, size: [8, 10] }, { kind: "cow", cell: 18, prob: 0.06, size: [1.4, 1.6] }] },
        { k: "ground", p: 0.95, y: 0.74, amp: 0.02, freq: 1 / 70, col: "#566f3a", haze: 0,
          objs: [{ kind: "pine", cell: 11, prob: 0.5, size: [10, 16] }, { kind: "rock", cell: 13, prob: 0.3, size: [1, 2.5] }] },
        pole,
      ],
    },

    city: {
      name: "City",
      blurb: "Skylines, bridges and a thousand lit windows at night.",
      sky: "earth",
      temp: [18, 4],
      tunnels: { cell: 9000, prob: 0.35, len: [300, 700] },
      stationSpacing: 3500,
      cruise: 60,
      weather: { clear: 3, cloudy: 3, rain: 2.5, fog: 1, storm: 0.4 },
      names: [
        ["Central", "Market", "Harbour", "Old Town", "Museum", "Riverside", "Queens", "Lantern", "Clockwork", "Union", "Parkside", "Mill"],
        [" Street", " Square", " Gate", " Junction", " Park", " Quay", " Row", " Terminal", " Hill", " Bridge"],
      ],
      layers: [
        { k: "bldg", p: 0.035, y: 0.49, col: "#8d99ad", haze: 0.6, cell: 34, prob: 0.95, size: [50, 190] },
        { k: "bldg", p: 0.08, y: 0.54, col: "#6c7688", haze: 0.4, cell: 32, prob: 0.9, size: [35, 130] },
        { k: "water", p: 0.13, y: 0.57, col: "#39566e", haze: 0.25, band: 0.045, cell: 2500, prob: 0.4 },
        { k: "bldg", p: 0.2, y: 0.625, col: "#5a5f6e", haze: 0.18, cell: 26, prob: 0.85, size: [16, 60], warm: true },
        { k: "ground", p: 0.9, y: 0.74, amp: 0.004, freq: 1 / 80, col: "#5b5e66", haze: 0,
          objs: [{ kind: "lamp", cell: 32, prob: 1, size: [7, 7] }, { kind: "tree", cell: 22, prob: 0.35, size: [7, 10] }, { kind: "wall", cell: 4, prob: 1, size: [1.4, 1.4] }] },
        pole,
      ],
    },

    coast: {
      name: "Seaside",
      blurb: "A line along the shore: sailboats, lighthouses, dunes and the tide.",
      sky: "earth",
      temp: [17, 3],
      weather: { clear: 4, cloudy: 3, rain: 1.5, fog: 1.5, storm: 0.5 },
      names: [
        ["Gull", "Salt", "Shell", "Tide", "Pebble", "Mar", "Port ", "Kelp", "Coral", "Sand", "Driftwood ", "West"],
        ["haven", "mouth", "cove", "sands", "point", "bay", "strand", "Harbour", "Head", "wick", "quay"],
      ],
      layers: [
        { k: "ridge", p: 0.02, y: 0.475, amp: 0.035, freq: 1 / 1500, oct: 3, col: "#7a8fa8", haze: 0.72, cut: 0.5,
          objs: [{ kind: "lighthouse", cell: 2600, prob: 0.6, size: [30, 34], onRidge: true }] },
        { k: "water", p: 0.03, y: 0.49, col: "#2f6c8f", haze: 0.35, band: 1,
          objs: [{ kind: "boat", cell: 160, prob: 0.35, size: [9, 14] }] },
        { k: "ground", p: 0.28, y: 0.655, amp: 0.012, freq: 1 / 180, col: "#dcc795", haze: 0.1,
          objs: [{ kind: "hut", cell: 70, prob: 0.25, size: [3.2, 3.8] }, { kind: "grass", cell: 6, prob: 0.4, size: [1, 1.6] }] },
        { k: "ground", p: 0.95, y: 0.745, amp: 0.012, freq: 1 / 60, col: "#8f9b5b", haze: 0,
          objs: [{ kind: "grass", cell: 3, prob: 0.6, size: [1, 1.8] }, { kind: "bush", cell: 9, prob: 0.3, size: [1, 2] }, { kind: "fence", cell: 3, prob: 1, size: [1.1, 1.1] }] },
        pole,
      ],
    },

    forest: {
      name: "Deep Forest",
      blurb: "Endless pines, misty valleys and fireflies after dark.",
      sky: "earth",
      temp: [12, 5],
      tunnels: { cell: 9000, prob: 0.3, len: [300, 800] },
      weather: { clear: 2.5, cloudy: 3, rain: 2.5, fog: 2.5, storm: 0.4 },
      names: [
        ["Fern", "Moss", "Pine", "Cedar", "Owl", "Hart", "Bracken", "Wolf", "Rowan", "Alder", "Birch", "Lynx"],
        ["glen", "wood", "dale", "hurst", "brook", "hollow", "shaw", "ridge", "falls", "clearing"],
      ],
      layers: [
        { k: "ridge", p: 0.018, y: 0.49, amp: 0.1, freq: 1 / 1300, oct: 4, col: "#5d7890", haze: 0.7 },
        { k: "ridge", p: 0.04, y: 0.54, amp: 0.1, freq: 1 / 700, oct: 4, col: "#2f5a45", haze: 0.48,
          objs: [{ kind: "pine", cell: 8, prob: 1, size: [16, 24] }] },
        { k: "ridge", p: 0.1, y: 0.6, amp: 0.06, freq: 1 / 400, oct: 3, col: "#27493a", haze: 0.28,
          objs: [{ kind: "pine", cell: 7, prob: 0.95, size: [16, 26] }, { kind: "tree", cell: 20, prob: 0.3, size: [12, 16] }] },
        { k: "ground", p: 0.3, y: 0.67, amp: 0.02, freq: 1 / 200, col: "#2a4a2b", haze: 0.12,
          objs: [{ kind: "pine", cell: 6, prob: 0.85, size: [14, 24] }, { kind: "cabin", cell: 900, prob: 0.3, size: [5, 6] }] },
        { k: "ground", p: 0.95, y: 0.745, amp: 0.02, freq: 1 / 60, col: "#2d4a25", haze: 0,
          objs: [{ kind: "pine", cell: 9, prob: 0.55, size: [12, 18] }, { kind: "bush", cell: 4, prob: 0.6, size: [0.8, 1.6] }, { kind: "tree", cell: 26, prob: 0.25, size: [10, 14] }] },
        pole,
      ],
    },

    desert: {
      name: "Desert",
      blurb: "Red mesas, saguaros, dunes and the clearest night skies.",
      sky: "earth",
      temp: [28, 9],
      cruise: 130,
      weather: { clear: 7, cloudy: 1.5, fog: 0.4, storm: 0.3 },
      names: [
        ["Mesa", "Sol", "Dune", "Oasis", "Ember", "Copper", "Red", "Coyote", "Saguaro", "Dust", "Sage", "Juniper"],
        [" Wells", " Junction", " Springs", " Flats", "ridge", " Butte", " Canyon", " Crossing", "ville", " Rock"],
      ],
      layers: [
        { k: "ridge", p: 0.014, y: 0.5, amp: 0.1, freq: 1 / 1300, oct: 4, terrace: true, col: "#c48d6a", haze: 0.58 },
        { k: "ridge", p: 0.035, y: 0.55, amp: 0.14, freq: 1 / 800, oct: 4, terrace: true, col: "#b56a45", haze: 0.34 },
        { k: "ridge", p: 0.1, y: 0.61, amp: 0.035, freq: 1 / 500, oct: 2, col: "#dcb27a", haze: 0.18 },
        { k: "ground", p: 0.3, y: 0.665, amp: 0.012, freq: 1 / 200, col: "#cf9f66", haze: 0.08,
          objs: [{ kind: "cactus", cell: 35, prob: 0.35, size: [6, 11] }, { kind: "rock", cell: 30, prob: 0.25, size: [2, 5] }, { kind: "scrub", cell: 9, prob: 0.4, size: [0.8, 1.4] }] },
        { k: "ground", p: 0.95, y: 0.75, amp: 0.012, freq: 1 / 60, col: "#c7955d", haze: 0,
          objs: [{ kind: "cactus", cell: 30, prob: 0.25, size: [5, 9] }, { kind: "scrub", cell: 5, prob: 0.5, size: [0.8, 1.6] }, { kind: "rock", cell: 12, prob: 0.25, size: [0.6, 1.8] }] },
        { ...pole, cell: 65, telegraph: true },
      ],
    },

    tundra: {
      name: "Snowy North",
      blurb: "Frozen fjells, red cabins and the northern lights.",
      sky: "earth",
      temp: [-12, 4],
      aurora: 1,
      weather: { clear: 4, cloudy: 3, snow: 3.5, fog: 1 },
      names: [
        ["Frost", "Aur", "Nord", "Kvit", "Isk", "Polar", "Snø", "Ren", "Ulv", "Björk", "Stjerne", "Lys"],
        ["vik", "fjell", "heim", "stad", "dal", "vann", "berg", "mo", "by", "nes"],
      ],
      layers: [
        { k: "ridge", p: 0.015, y: 0.5, amp: 0.2, freq: 1 / 1300, oct: 5, sharp: true, snow: 0.1, col: "#8b9fbd", haze: 0.6 },
        { k: "ridge", p: 0.04, y: 0.56, amp: 0.08, freq: 1 / 700, oct: 3, col: "#dfe7f0", haze: 0.35,
          objs: [{ kind: "snowpine", cell: 22, prob: 0.4, size: [10, 16] }] },
        { k: "ground", p: 0.15, y: 0.63, amp: 0.03, freq: 1 / 350, col: "#e8eef5", haze: 0.15,
          objs: [{ kind: "snowpine", cell: 18, prob: 0.5, size: [10, 18] }, { kind: "cabin", cell: 450, prob: 0.35, size: [5, 6], red: true }] },
        { k: "ground", p: 0.95, y: 0.745, amp: 0.02, freq: 1 / 70, col: "#eef3f9", haze: 0,
          objs: [{ kind: "snowpine", cell: 14, prob: 0.4, size: [9, 15] }, { kind: "rock", cell: 25, prob: 0.12, size: [0.8, 1.5], snowy: true }] },
        pole,
      ],
    },

    neon: {
      name: "Neon Metropolis",
      blurb: "Year 2300. Kilometre-high arcologies, sky traffic and holograms.",
      future: true,
      sky: "neon",
      temp: [23, 2],
      cruise: 110,
      speedShown: 3.2,
      maglev: true,
      planet: true,
      weather: { clear: 3, cloudy: 2, rain: 3, fog: 1.5 },
      names: [
        ["Nova", "Helix", "Aurora", "Quanta", "Zenith", "Lumen", "Cygnus", "Vector", "Prism", "Halcyon", "Axiom", "Kairo"],
        [" Spire", " Plaza", " Nexus", " Arcology", " Terminal", " Hub", " Heights", " Stack", " Loop", " Core"],
      ],
      layers: [
        { k: "tower", p: 0.02, y: 0.5, col: "#343a5c", haze: 0.55, cell: 60, prob: 0.8, size: [260, 900] },
        { k: "traffic", p: 0.03, y: 0.25, count: 26 },
        { k: "tower", p: 0.06, y: 0.56, col: "#262a44", haze: 0.35, cell: 45, prob: 0.85, size: [120, 450], holo: 0.3 },
        { k: "traffic", p: 0.1, y: 0.35, count: 14 },
        { k: "tower", p: 0.16, y: 0.63, col: "#1c1f33", haze: 0.18, cell: 30, prob: 0.8, size: [50, 200], holo: 0.5 },
        { k: "streets", p: 0.4, y: 0.63, y2: 0.75 },
        { k: "guide", p: 0.95, y: 0.75, col: "#151827", glow: "#35e0ff" },
      ],
    },

    celestial: {
      name: "Celestial Line",
      blurb: "Another world: a ringed giant, floating islands, crystal spires and sky whales.",
      future: true,
      sky: "alien",
      temp: [19, 3],
      cruise: 90,
      speedShown: 2.4,
      maglev: true,
      planet: true,
      whales: true,
      aurora: 0.7,
      weather: { clear: 5, cloudy: 2, rain: 1, fog: 1.5 },
      names: [
        ["Vael", "Ithra", "Seraph", "Oriel", "Lyr", "Cael", "Nyx", "Solen", "Emyr", "Thal", "Quor", "Ysil"],
        ["ion", "ara", "essa", "oris", "yth", "une", "ael", " Reach", " Veil", " Choir"],
      ],
      layers: [
        { k: "isles", p: 0.02, y: 0.27, cell: 900, prob: 0.55, size: [90, 170] },
        { k: "ridge", p: 0.018, y: 0.52, amp: 0.3, freq: 1 / 1200, oct: 5, sharp: true, snow: 0.6, snowCol: "#c9f3ff", col: "#6b4fa0", haze: 0.5 },
        { k: "isles", p: 0.045, y: 0.36, cell: 500, prob: 0.4, size: [40, 80] },
        { k: "ridge", p: 0.06, y: 0.59, amp: 0.08, freq: 1 / 600, oct: 3, col: "#35286a", haze: 0.3,
          objs: [{ kind: "crystal", cell: 45, prob: 0.5, size: [25, 70] }, { kind: "arch", cell: 1400, prob: 0.4, size: [60, 90] }] },
        { k: "ground", p: 0.2, y: 0.665, amp: 0.03, freq: 1 / 260, col: "#244a63", haze: 0.12,
          objs: [{ kind: "shroom", cell: 14, prob: 0.55, size: [5, 14] }, { kind: "crystal", cell: 40, prob: 0.3, size: [8, 22] }] },
        { k: "guide", p: 0.95, y: 0.75, col: "#1a2c3f", glow: "#b18bff",
          objs: [{ kind: "glowplant", cell: 4, prob: 0.55, size: [0.8, 2.2] }] },
      ],
    },

    orbital: {
      name: "Orbital Ring",
      blurb: "A railway around the planet, 400 km up. The Earth turns below you.",
      future: true,
      sky: "space",
      temp: null,
      cruise: 55,
      speedShown: 450,
      maglev: true,
      space: true,
      weather: { clear: 1 },
      names: [
        ["Halo", "Meridian", "Lagrange", "Apogee", "Zenith", "Kepler", "Tsiolkovsky", "Gagarin", "Lovelace", "Hypatia"],
        [" Ring Station", " Dock", " Spoke", " Node", " Gate", " Terminal"],
      ],
      layers: [
        { k: "planet", p: 0.004 },
        { k: "sats", p: 0.04, y: 0.3, cell: 1200, prob: 0.35 },
        { k: "truss", p: 0.95, y: 0.76 },
      ],
    },
  };

  const TOUR = ["countryside", "forest", "mountains", "tundra", "coast", "desert", "city"];
  const TOUR_LEG = 16000;

  const ROUTES = {
    countryside: { biome: "countryside", train: ["The Meadowlark", "Vale & Downs Railway", "VD Class 40 diesel-electric", "8 carriages, 1950s-style Mk1 stock"] },
    mountains: { biome: "mountains", train: ["The Glacier Star", "Alpine Rhaetic Bahn", "Ge 4/4 electric, 1,700 kW", "Panorama coaches with roof glass"] },
    city: { biome: "city", train: ["Metro Circle Line", "Metropolitan Transit", "M-9 electric multiple unit", "6 cars, open gangways"] },
    coast: { biome: "coast", train: ["The Tidewater", "Coastal & Western", "CW Class 57 diesel", "7 carriages with a buffet car"] },
    forest: { biome: "forest", train: ["The Northwoods Sleeper", "Pinelands Railroad", "PR SD-70 diesel-electric", "11 cars with sleeping berths"] },
    desert: { biome: "desert", train: ["The Sunset Limited Star", "Southwest Rail", "SW Genesis P-42 diesel", "Superliner double-deckers"] },
    tundra: { biome: "tundra", train: ["The Aurora Night", "Nordlys Jernbane", "El-18 electric, 5,400 kW", "Sleeper and observation cars"] },
    tour: { biome: "tour", name: "Grand Tour", blurb: "All seven landscapes in turn, a tunnel between each.", train: ["The Long Dream Express", "Transcontinental Rail", "TC Class 92 dual-mode", "14 cars: sleepers, diner, observation"] },
    neon: { biome: "neon", train: ["Helix Hyperline", "Zenith Transit Authority", "HX-9 superconducting maglev", "Pressurised capsule, 4 pods"] },
    celestial: { biome: "celestial", train: ["The Seraph", "Ithran Starways", "Resonance-drive glider", "Crystal-glass observation car"] },
    orbital: { biome: "orbital", train: ["Ring Express 1", "Orbital Ring Consortium", "Linear induction, 12 MW", "Shielded carriage, cupola windows"] },
  };

  function routeInfo(id) {
    const r = ROUTES[id];
    if (r.biome === "tour") return { ...r, id };
    const b = BIOMES[r.biome];
    return { ...r, id, name: b.name, blurb: b.blurb, future: !!b.future };
  }

  function biomeIdAt(routeId, d) {
    const r = ROUTES[routeId];
    if (r.biome !== "tour") return r.biome;
    const i = Math.floor(d / TOUR_LEG);
    return TOUR[((i % TOUR.length) + TOUR.length) % TOUR.length];
  }

  // Tunnels: [start, end] ranges of track. In the Grand Tour the landscape changes inside one.
  function tunnelsNear(routeId, d, range) {
    const out = [];
    const r = ROUTES[routeId];
    if (r.biome === "tour") {
      for (let i = Math.floor((d - range) / TOUR_LEG); i <= Math.floor((d + range) / TOUR_LEG) + 1; i++) {
        if (i <= 0) continue;
        const half = 350 + 250 * hash(i, 77);
        out.push({ a: i * TOUR_LEG - half, b: i * TOUR_LEG + half, style: "stone" });
      }
      return out;
    }
    const b = BIOMES[r.biome];
    const t = b.tunnels;
    if (!t) return out;
    for (let i = Math.floor((d - range) / t.cell) - 1; i <= Math.floor((d + range) / t.cell) + 1; i++) {
      if (i <= 0 || hash(i, 31) > t.prob) continue;
      const len = t.len[0] + (t.len[1] - t.len[0]) * hash(i, 32);
      const a = i * t.cell + (t.cell - len - 1200) * hash(i, 33) + 600;
      out.push({ a, b: a + len, style: "stone" });
    }
    return out;
  }

  function inTunnel(routeId, d) {
    for (const t of tunnelsNear(routeId, d, 10)) if (d > t.a && d < t.b) return t;
    return null;
  }

  function spacingFor(routeId) {
    const r = ROUTES[routeId];
    if (r.biome === "tour") return 8000;
    return BIOMES[r.biome].stationSpacing || 9000;
  }

  // Station i sits somewhere in cell i; station 0 is where the journey starts.
  function stationPos(routeId, i) {
    if (i <= 0) return 0;
    const sp = spacingFor(routeId);
    let pos = i * sp + (hash(i, 51) - 0.5) * sp * 0.5;
    for (const t of tunnelsNear(routeId, pos, 800)) {
      if (pos > t.a - 400 && pos < t.b + 400) pos = t.b + 500;
    }
    return pos;
  }

  function stationName(routeId, i) {
    const biome = BIOMES[biomeIdAt(routeId, stationPos(routeId, i))];
    const [a, b] = biome.names;
    const seed = routeId.length * 97 + i;
    let first = a[Math.floor(hash(seed, 1) * a.length)];
    let second = b[Math.floor(hash(seed, 2) * b.length)];
    if (first.endsWith(" ") && second.startsWith(" ")) second = second.trim();
    let name = first + second;
    if (!first.endsWith(" ") && !second.startsWith(" ") && /^[A-Z]/.test(second)) name = first + " " + second;
    if (first.endsWith(" ") && /^[a-z]/.test(second)) name = first + second[0].toUpperCase() + second.slice(1);
    return name.replace(/(.)\1\1/g, "$1$1").replace(/\s+/g, " ").trim();
  }

  function station(routeId, i) {
    return { i, pos: stationPos(routeId, i), name: stationName(routeId, i) };
  }

  function nextStation(routeId, d) {
    const sp = spacingFor(routeId);
    let i = Math.max(1, Math.floor(d / sp) - 1);
    while (stationPos(routeId, i) <= d + 0.01) i++;
    return station(routeId, i);
  }

  function prevStation(routeId, d) {
    const n = nextStation(routeId, d);
    return station(routeId, n.i - 1);
  }

  // Climate. Temperatures in °C.
  function climate(routeId, d, hour, w, t) {
    const b = BIOMES[biomeIdAt(routeId, d)];
    if (!b.temp) return { space: true };
    const [mean, amp] = b.temp;
    let temp = mean + amp * Math.sin(((hour - 9) / 24) * Math.PI * 2) + (fbm(t / 900, 5, 2) - 0.5) * 3;
    temp -= w.cloud * 2 + w.rain * 3 + w.storm * 2 + w.fog * 1;
    if (w.snow > 0.3) temp = Math.min(temp, -1 - w.snow * 3);
    const wind = 6 + w.cloud * 8 + w.rain * 8 + w.storm * 35 + w.snow * 10 + fbm(t / 300, 8, 2) * 8;
    const humidity = Math.min(99, 40 + w.cloud * 20 + w.rain * 35 + w.fog * 40 + w.snow * 20 - (mean > 25 ? 25 : 0));
    return { temp, wind, humidity };
  }

  window.WORLD = { BIOMES, ROUTES, TOUR, routeInfo, biomeIdAt, tunnelsNear, inTunnel, nextStation, prevStation, station, stationPos, climate };
})();
