// Draws the view outside: sky, layered landscape, stations, tunnels and weather.
// Everything is generated from the track position, so nothing needs to be downloaded.
(function () {
  "use strict";
  const { hash, fbm, ridged, noise, clamp, smoothstep, hex, mix, mul, rgb } = U;
  const { KINDS, rvar } = OBJECTS;

  class Scenery {
    constructor() {
      this.lit = new Map(); // lit-window canvases for buildings
      this.patterns = new Map();
      this.planet = null;
    }

    // Colour helpers bound to the current lighting and a layer's haze.
    palette(env, haze, p) {
      const fogK = env.fog * (1 - clamp(p, 0, 1) * 0.85);
      const h = 1 - (1 - haze) * (1 - fogK);
      const cache = new Map();
      const tunnelDim = 1 - env.tunnel * 0.9;
      const P = (col) => {
        let v = cache.get(col);
        if (!v) {
          v = rgb(mix(mul(hex(col), env.light), env.haze, h).map((x) => x * tunnelDim));
          cache.set(col, v);
        }
        return v;
      };
      const E = (col, a) => rgb(mix(hex(col), env.haze, h * 0.55), a);
      return { P, E, h };
    }

    render(ctx, S) {
      const { W, H, d, t } = S;
      this.W = W;
      this.H = H;
      const routeId = S.routeId;
      const biomeId = WORLD.biomeIdAt(routeId, d);
      const biome = WORLD.BIOMES[biomeId];
      const tunnels = WORLD.tunnelsNear(routeId, d, 3000);
      const K = H * 0.02;
      const cover = this.tunnelCover(tunnels, d, K, W);
      const env = SKY.environment(S.hour, biome, S.weather, cover);
      this.env = env;
      const horizon = H * 0.5;

      ctx.save();
      // The carriage rocks gently.
      const rock = S.v > 0.5 ? Math.sin(t * 1.7) * 1.2 * Math.min(1, S.v / 25) + (S.bump || 0) : 0;
      ctx.translate(0, rock);
      SKY.drawSky(ctx, W, H + 4, env, t, d, biome, S.weather, horizon);

      const layers = biome.layers;
      const stationLayerP = 1.25;
      let stationDrawn = false;
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        if (!stationDrawn && L.p > stationLayerP) {
          this.drawStations(ctx, S, env, K, biome);
          stationDrawn = true;
        }
        this.drawLayer(ctx, S, env, L, li, biomeId, K, horizon);
      }
      if (!stationDrawn) this.drawStations(ctx, S, env, K, biome);

      if (!biome.space) this.drawWeather(ctx, S, env, biome);
      this.drawTunnels(ctx, S, env, tunnels, K, routeId);
      ctx.restore();
      return env;
    }

    // How much of the screen is inside a tunnel (0–1), used for lighting the carriage.
    tunnelCover(tunnels, d, K, W) {
      let cover = 0;
      for (const tn of tunnels) {
        const xa = W / 2 + (tn.a - d) * K, xb = W / 2 + (tn.b - d) * K;
        const c = (Math.min(W, xb) - Math.max(0, xa)) / W;
        if (c > cover) cover = c;
      }
      return clamp(cover, 0, 1);
    }

    ground(L, m, H) {
      const seed = L.seed;
      if (L.k === "ridge") {
        let v = L.sharp ? smoothstep(0.22, 0.95, ridged(m * L.freq, seed, L.oct)) : smoothstep(0.22, 0.78, fbm(m * L.freq, seed, L.oct));
        if (L.terrace) {
          const q = v * 4, f = Math.floor(q);
          v = (f + smoothstep(0.78, 1, q - f)) / 4;
        }
        if (L.cut) v = Math.max(0, v - L.cut) / (1 - L.cut);
        return H * (L.y - L.amp * v);
      }
      return H * (L.y - L.amp * (fbm(m * (L.freq || 0.01), seed, 2) - 0.35));
    }

    drawLayer(ctx, S, env, L, li, biomeId, K, horizon) {
      const { W, H, d } = S;
      if (L.seed === undefined) L.seed = li * 131 + biomeId.length * 17 + biomeId.charCodeAt(0);
      const s = K * L.p;
      const pal = this.palette(env, L.haze || 0, L.p);
      switch (L.k) {
        case "ridge":
        case "ground":
        case "field":
          this.drawGround(ctx, S, env, L, s, pal);
          break;
        case "water":
          this.drawWater(ctx, S, env, L, s, pal);
          return;
        case "bldg":
          this.drawBuildings(ctx, S, env, L, li, biomeId, s, pal);
          break;
        case "tower":
          this.drawTowers(ctx, S, env, L, li, s, pal);
          break;
        case "streets":
          this.drawStreets(ctx, S, env, L);
          return;
        case "traffic":
          this.drawTraffic(ctx, S, env, L, s);
          return;
        case "isles":
          this.drawIsles(ctx, S, env, L, s, pal);
          return;
        case "guide":
          this.drawGuideway(ctx, S, env, L, s, pal);
          break;
        case "poles":
          this.drawPoles(ctx, S, env, L, s, pal);
          return;
        case "planet":
          this.drawPlanet(ctx, S, env, s, horizon);
          return;
        case "sats":
          this.drawSatellites(ctx, S, env, L, s, pal);
          return;
        case "truss":
          this.drawTruss(ctx, S, env, L, s, pal);
          return;
      }
      if (L.objs) this.drawObjects(ctx, S, env, L, li, s, pal);
    }

    drawGround(ctx, S, env, L, s, pal) {
      const { W, H, d } = S;
      const step = L.p < 0.1 ? 6 : 4;
      const pts = [];
      for (let x = -step; x <= W + step; x += step) pts.push([x, this.ground(L, d + (x - W / 2) / s, H)]);
      const top = H * (L.y - (L.amp || 0));
      const g = ctx.createLinearGradient(0, top, 0, H * L.y + H * 0.08);
      g.addColorStop(0, pal.P(rgbHex(mix(hex(L.col), [255, 255, 255], 0.12))));
      g.addColorStop(1, pal.P(L.col));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-step, H + 10);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(W + step, H + 10);
      ctx.fill();

      if (L.snow !== undefined) {
        ctx.fillStyle = pal.P(L.snowCol || "#f3f6fb");
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        for (let i = pts.length - 1; i >= 0; i--) {
          const [x, y] = pts[i];
          const m = d + (x - W / 2) / s;
          const line = H * (L.y - L.amp * (L.snow + (noise(m * L.freq * 6, L.seed + 3) - 0.5) * 0.12));
          ctx.lineTo(x, Math.max(y, line));
        }
        ctx.fill();
      }

      if (L.p > 0.9 && L.k === "ground") this.drawGroundDetail(ctx, S, L, s, pal);

      if (L.fields) {
        const cell = L.fieldCell;
        const m0 = d - W / 2 / s, m1 = d + W / 2 / s;
        for (let i = Math.floor(m0 / cell); i <= Math.floor(m1 / cell); i++) {
          const col = L.fields[Math.floor(hash(i, L.seed + 5) * L.fields.length)];
          const xa = W / 2 + (i * cell - d) * s, xb = W / 2 + ((i + 1) * cell - d) * s;
          ctx.fillStyle = pal.P(col);
          ctx.beginPath();
          ctx.moveTo(xa, H + 10);
          for (let x = xa; x <= xb + 0.1; x += Math.max(4, (xb - xa) / 8)) ctx.lineTo(x, this.ground(L, d + (x - W / 2) / s, H) + 1.5);
          ctx.lineTo(xb, this.ground(L, d + (xb - W / 2) / s, H) + 1.5);
          ctx.lineTo(xb, H + 10);
          ctx.fill();
          // furrows
          ctx.strokeStyle = pal.P(rgbHex(mix(hex(col), [60, 50, 30], 0.2)));
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let k = 1; k < 4; k++) {
            const y = this.ground(L, d + ((xa + xb) / 2 - W / 2) / s, H) + k * s * 1.8;
            ctx.moveTo(xa + 2, y);
            ctx.lineTo(xb - 2, y);
          }
          ctx.stroke();
          // hedgerow between fields
          ctx.fillStyle = pal.P("#3f6030");
          const hy = this.ground(L, i * cell, H);
          ctx.beginPath();
          ctx.ellipse(xa, hy, s * 2.5, s * 1.2, 0, Math.PI, 0);
          ctx.fill();
        }
      }
    }

    // Streaks of grass, stones and snow below the near ground line; the lower, the closer and faster.
    drawGroundDetail(ctx, S, L, s, pal) {
      const { W, H, d } = S;
      const top = H * L.y;
      const base = hex(L.col);
      const dark = pal.P(rgbHex(mix(base, [20, 20, 10], 0.25)));
      const light = pal.P(rgbHex(mix(base, [255, 255, 240], 0.18)));
      const span = W + 200;
      for (let k = 0; k < 90; k++) {
        const u = Math.pow(hash(k, 61), 1.4);
        const y = top + H * 0.02 + u * (H - top);
        const scale = s * (1 + u * 2.5);
        const x = (((hash(k, 62) * span - d * scale) % span) + span) % span - 100;
        const len = Math.max(2, 1.5 * scale * 0.2 + S.v * scale * 0.012);
        ctx.fillStyle = hash(k, 63) < 0.5 ? dark : light;
        ctx.fillRect(x, y, len, Math.max(1, scale * 0.06));
      }
    }

    drawObjects(ctx, S, env, L, li, s, pal) {
      const { W, H, d, t } = S;
      const o = { c: ctx, P: pal.P, E: pal.E, night: env.night, t, s };
      L.objs.forEach((spec, oi) => {
        const draw = KINDS[spec.kind];
        const cell = spec.cell;
        const maxS = spec.size[1] * 1.5;
        const m0 = d - W / 2 / s - maxS, m1 = d + W / 2 / s + maxS;
        const seed = L.seed * 7 + oi * 53;
        const cellPx = cell * s;
        for (let i = Math.floor(m0 / cell); i <= Math.floor(m1 / cell); i++) {
          if (hash(i, seed) > spec.prob) continue;
          const jitter = spec.kind === "fence" || spec.kind === "wall" ? 0 : 0.15 + 0.7 * hash(i, seed + 1);
          const m = (i + jitter) * cell;
          const size = (spec.size[0] + (spec.size[1] - spec.size[0]) * hash(i, seed + 2)) * s;
          if (size < 0.8) continue;
          const x = W / 2 + (m - d) * s;
          let y;
          if (L.k === "water") y = H * L.y + H * 0.012 + hash(i, seed + 3) * H * 0.05 * (L.band || 0.05) * 20 * 0.2;
          else if (L.k === "guide") y = H * L.y;
          else y = this.ground(L, m, H) + (spec.onRidge ? 1 : Math.min(3, size * 0.04));
          if (L.k === "water" && !this.waterAt(L, m)) continue;
          draw(o, x, y, size, rvar(i, seed), spec, cellPx);
        }
      });
    }

    waterAt(L, m) {
      if (!L.cell) return true;
      const i = Math.floor(m / L.cell);
      if (hash(i, L.seed + 9) > L.prob) return false;
      const f = m / L.cell - i;
      return f > 0.2 && f < 0.8;
    }

    drawWater(ctx, S, env, L, s, pal) {
      const { W, H, d, t } = S;
      const top = H * L.y, bottom = L.band >= 1 ? H : top + H * L.band;
      // Visible stretches of water (lakes come and go; the sea is always there).
      const spans = [];
      if (!L.cell) spans.push([0, W]);
      else {
        const m0 = d - W / 2 / s, m1 = d + W / 2 / s;
        for (let i = Math.floor(m0 / L.cell); i <= Math.floor(m1 / L.cell); i++) {
          if (hash(i, L.seed + 9) > L.prob) continue;
          spans.push([W / 2 + ((i + 0.2) * L.cell - d) * s, W / 2 + ((i + 0.8) * L.cell - d) * s]);
        }
      }
      if (!spans.length) return;
      const sky = mix(env.hor, env.top, 0.25);
      const water = mix(mul(hex(L.col), env.light), sky, 0.35);
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, rgb(mix(sky, env.haze, pal.h)));
      g.addColorStop(0.25, rgb(mix(water, env.haze, pal.h * 0.6)));
      g.addColorStop(1, rgb(mix(water, [0, 0, 0], 0.25)));
      const sun = SKY.sunPos(W, H, env.hour, H * 0.5);
      const moon = SKY.moonPos(W, H, env.hour, H * 0.5);
      for (const [xa, xb] of spans) {
        ctx.fillStyle = g;
        ctx.beginPath();
        if (L.cell) {
          ctx.ellipse((xa + xb) / 2, top, (xb - xa) / 2, bottom - top, 0, 0, Math.PI);
        } else ctx.rect(xa, top, xb - xa, bottom - top);
        ctx.fill();
        ctx.save();
        ctx.clip();
        // Glitter path under the sun or moon, and ripples everywhere else.
        const glitterX = env.elev > 0 ? sun.x : moon.up ? moon.x : -9999;
        const glitterA = env.elev > 0 ? 0.8 * (1 - env.overcast) : 0.5 * env.night * (1 - env.overcast);
        const n = L.cell ? 30 : 90;
        for (let k = 0; k < n; k++) {
          const yy = top + Math.pow(hash(k, 3), 1.6) * (bottom - top);
          const depth = (yy - top) / (bottom - top + 1);
          const len = 4 + depth * 30;
          const span = W + 200;
          const xx = ((hash(k, 4) * span - d * s * (1 + depth * 3) - t * 6) % span + span) % span - 100;
          const near = Math.exp(-Math.pow((xx - glitterX) / (W * 0.06 + depth * W * 0.05), 2));
          const tw = 0.5 + 0.5 * Math.sin(t * 2 + k);
          ctx.fillStyle = near > 0.05 ? `rgba(255,245,220,${glitterA * near * tw})` : rgb(mix(sky, [255, 255, 255], 0.3), 0.12 + depth * 0.1);
          ctx.fillRect(xx, yy, len, 1 + depth);
        }
        ctx.restore();
      }
      if (L.objs) {
        const o = { c: ctx, P: pal.P, E: pal.E, night: env.night, t, s };
        L.objs.forEach((spec, oi) => {
          const seed = L.seed * 7 + oi * 53;
          const m0 = d - W / 2 / s - 20, m1 = d + W / 2 / s + 20;
          for (let i = Math.floor(m0 / spec.cell); i <= Math.floor(m1 / spec.cell); i++) {
            if (hash(i, seed) > spec.prob) continue;
            const m = (i + 0.15 + 0.7 * hash(i, seed + 1)) * spec.cell;
            if (!this.waterAt(L, m)) continue;
            const depth = hash(i, seed + 3);
            const size = (spec.size[0] + (spec.size[1] - spec.size[0]) * hash(i, seed + 2)) * s * (1 + depth * 2.5);
            const x = W / 2 + (m - d) * s * (1 + depth * 2);
            const y = top + (bottom - top) * depth * 0.18 + 2;
            KINDS[spec.kind](o, x, y, size, rvar(i, seed), spec);
          }
        });
      }
    }

    // City blocks. Lit windows are drawn once per building into a small canvas and reused.
    drawBuildings(ctx, S, env, L, li, biomeId, s, pal) {
      const { W, H, d } = S;
      const cell = L.cell;
      const m0 = d - W / 2 / s - cell, m1 = d + W / 2 / s + cell;
      const base = H * L.y;
      ctx.fillStyle = pal.P(rgbHex(mix(hex(L.col), [0, 0, 0], 0.25)));
      ctx.fillRect(0, base - 1, W, H - base + 1);
      const floorPx = 3.4 * s, colPx = 2.6 * s;
      for (let i = Math.floor(m0 / cell); i <= Math.floor(m1 / cell); i++) {
        if (hash(i, L.seed) > L.prob) continue;
        const downtown = 0.45 + fbm(i * cell / 2500, L.seed + 4, 2) * 1.1;
        const hM = (L.size[0] + (L.size[1] - L.size[0]) * Math.pow(hash(i, L.seed + 1), 1.6)) * downtown;
        const wM = cell * (0.6 + 0.4 * hash(i, L.seed + 2));
        const x = W / 2 + (i * cell + (cell - wM) * hash(i, L.seed + 3) - d) * s;
        const w = wM * s, h = hM * s;
        const tint = ["#8d99ad", "#a39a8c", "#7d8796", "#b5aa98", "#6f7a8c", "#9aa3b3"][Math.floor(hash(i, L.seed + 5) * 6)];
        const col = rgbHex(mix(hex(L.col), hex(tint), 0.45));
        ctx.fillStyle = pal.P(col);
        ctx.fillRect(x, base - h, w, h + 1);
        // sunlit edge
        ctx.fillStyle = pal.P(rgbHex(mix(hex(col), [255, 255, 255], 0.15)));
        ctx.fillRect(x, base - h, Math.max(1, w * 0.12), h);
        // roof details
        ctx.fillStyle = pal.P(rgbHex(mix(hex(col), [0, 0, 0], 0.3)));
        if (hM > 90 && hash(i, L.seed + 6) < 0.6) {
          ctx.fillRect(x + w * 0.45, base - h - 12 * s, Math.max(1, s * 0.4), 12 * s);
          if (env.night > 0.2 && Math.sin(S.t * 3 + i) > 0) {
            ctx.fillStyle = "rgba(255,60,60,0.9)";
            ctx.fillRect(x + w * 0.45 - 1, base - h - 12 * s - 2, 3, 3);
          }
        } else if (hash(i, L.seed + 7) < 0.3) ctx.fillRect(x + w * 0.2, base - h - 3 * s, w * 0.2, 3 * s);
        if (floorPx >= 2) {
          // Daytime glass: a pattern of window panes.
          if (env.day > 0.05) {
            const pat = this.windowPattern(ctx, floorPx, colPx);
            pat.setTransform(new DOMMatrix([1, 0, 0, 1, x, base - h]));
            ctx.globalAlpha = 0.25 + env.day * 0.35;
            ctx.fillStyle = pat;
            ctx.fillRect(x + w * 0.06, base - h + floorPx * 0.5, w * 0.88, h - floorPx);
            ctx.globalAlpha = 1;
          }
        }
        if (env.night > 0.05 || env.tunnel > 0) {
          const key = `${biomeId}:${li}:${i}:${Math.round(s * 20)}`;
          const img = this.litWindows(key, w, h, Math.max(1.6, floorPx), Math.max(1.6, colPx), hash(i, L.seed + 8), L.warm);
          ctx.globalAlpha = clamp(env.night * 1.2, 0, 1) * (1 - pal.h * 0.5);
          ctx.drawImage(img, x, base - h);
          ctx.globalAlpha = 1;
        }
      }
    }

    windowPattern(ctx, fp, cp) {
      const key = `${fp.toFixed(1)}:${cp.toFixed(1)}`;
      let p = this.patterns.get(key);
      if (!p) {
        const cv = document.createElement("canvas");
        cv.width = Math.max(2, Math.round(cp));
        cv.height = Math.max(2, Math.round(fp));
        const c = cv.getContext("2d");
        c.fillStyle = "rgba(20,35,60,0.9)";
        c.fillRect(cv.width * 0.18, cv.height * 0.25, cv.width * 0.64, cv.height * 0.5);
        c.fillStyle = "rgba(210,230,255,0.5)";
        c.fillRect(cv.width * 0.18, cv.height * 0.25, cv.width * 0.2, cv.height * 0.18);
        p = ctx.createPattern(cv, "repeat");
        this.patterns.set(key, p);
      }
      return p;
    }

    litWindows(key, w, h, fp, cp, density, warm) {
      let cv = this.lit.get(key);
      if (cv) return cv;
      cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.ceil(w));
      cv.height = Math.max(1, Math.ceil(h));
      const c = cv.getContext("2d");
      const rows = Math.floor(h / fp), cols = Math.floor((w * 0.88) / cp);
      const frac = 0.12 + density * 0.4;
      const seed = Math.floor(density * 1e6);
      const warmCols = ["#ffd58a", "#ffe6b3", "#ffcc70", "#fff0d0"];
      const coolCols = ["#cfe6ff", "#e8f3ff", "#ffd58a", "#b8d8ff"];
      const pal = warm ? warmCols : density > 0.5 ? coolCols : warmCols;
      for (let r = 1; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          const hsh = hash(r * 131 + k, seed);
          if (hsh > frac) continue;
          c.fillStyle = pal[Math.floor(hash(r * 7 + k, seed + 1) * pal.length)];
          c.globalAlpha = 0.6 + 0.4 * (hsh / frac);
          c.fillRect(w * 0.06 + k * cp + cp * 0.18, r * fp + fp * 0.25, Math.max(1, cp * 0.64), Math.max(1, fp * 0.5));
        }
      }
      this.lit.set(key, cv);
      if (this.lit.size > 400) this.lit.delete(this.lit.keys().next().value);
      return cv;
    }

    // Megatowers of the Neon Metropolis.
    drawTowers(ctx, S, env, L, li, s, pal) {
      const { W, H, d, t } = S;
      const cell = L.cell;
      const base = H * L.y;
      ctx.fillStyle = pal.P(L.col);
      ctx.fillRect(0, base - 1, W, H - base + 1);
      const glows = ["#35e0ff", "#ff4fd8", "#9d7bff", "#5dffb0", "#ffb347"];
      const m0 = d - W / 2 / s - cell * 2, m1 = d + W / 2 / s + cell;
      const glowA = 0.45 + env.night * 0.55;
      for (let i = Math.floor(m0 / cell); i <= Math.floor(m1 / cell); i++) {
        if (hash(i, L.seed) > L.prob) continue;
        const hM = L.size[0] + (L.size[1] - L.size[0]) * Math.pow(hash(i, L.seed + 1), 1.4);
        const wM = cell * (0.45 + 0.6 * hash(i, L.seed + 2));
        const x = W / 2 + (i * cell - d) * s, w = wM * s, h = hM * s;
        const gcol = glows[Math.floor(hash(i, L.seed + 3) * glows.length)];
        const tiers = 1 + Math.floor(hash(i, L.seed + 4) * 3);
        ctx.fillStyle = pal.P(L.col);
        for (let k = 0; k < tiers; k++) {
          const tw = w * (1 - k * 0.22), th = h * (1 - k * 0.3);
          ctx.fillRect(x + (w - tw) / 2, base - th, tw, th);
        }
        const tw = w * (1 - (tiers - 1) * 0.22), topY = base - h * (1 - (tiers - 1) * 0.3);
        // spire
        ctx.fillRect(x + w / 2 - 0.5, topY - h * 0.12, Math.max(1, s * 1.2), h * 0.12);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = pal.E(gcol, glowA * 0.9);
        ctx.fillRect(x + (w - tw) / 2, topY, Math.max(1, s * 0.8), base - topY);
        ctx.fillRect(x + (w + tw) / 2 - Math.max(1, s * 0.8), topY, Math.max(1, s * 0.8), base - topY);
        const bands = 3 + Math.floor(hash(i, L.seed + 5) * 6);
        for (let k = 0; k < bands; k++) {
          const by = base - (h * (k + 1)) / (bands + 1);
          const bw = by < topY ? 0 : w * (1 - Math.min(tiers - 1, Math.floor(((base - by) / h) / 0.34)) * 0.22);
          ctx.fillRect(x + (w - bw) / 2, by, bw, Math.max(1, s * 0.6));
        }
        if (s * 3 > 1.4) {
          const key = `neon:${li}:${i}:${Math.round(s * 20)}`;
          const img = this.litWindows(key, w, h, Math.max(1.6, s * 4), Math.max(1.6, s * 3), 0.55 + hash(i, 9) * 0.45, false);
          ctx.globalAlpha = 0.25 + env.night * 0.5;
          ctx.drawImage(img, x, base - h);
          ctx.globalAlpha = 1;
        }
        // beacon
        if (Math.sin(t * 2 + i) > 0.3) {
          ctx.fillStyle = "rgba(255,70,90,0.95)";
          ctx.fillRect(x + w / 2 - 1.5, topY - h * 0.12 - 2, 3, 3);
        }
        ctx.restore();
        // Holographic billboards
        if (L.holo && hash(i, L.seed + 6) < L.holo && w > 12) {
          const hy = base - h * (0.3 + 0.4 * hash(i, L.seed + 7)), hh = Math.min(h * 0.18, w * 0.9), hw = w * 0.9;
          const hc = glows[Math.floor(hash(i, L.seed + 8) * glows.length)];
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = pal.E(hc, 0.18 + env.night * 0.2);
          ctx.fillRect(x + w * 0.05, hy, hw, hh);
          ctx.fillStyle = pal.E(hc, 0.55 + env.night * 0.3);
          const ph = (t * 0.6 + i) % 1;
          for (let k = 0; k < 5; k++) {
            const gy = hy + hh * (0.15 + k * 0.16);
            const gw = hw * (0.3 + 0.6 * noise(k * 3 + Math.floor(t * 0.5 + i), 70 + i));
            ctx.fillRect(x + w * 0.1, gy, gw, Math.max(1, hh * 0.07));
          }
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(x + w * 0.05, hy + ph * hh, hw, 1);
          ctx.restore();
        }
      }
    }

    drawStreets(ctx, S, env, L) {
      const { W, H, d, t } = S;
      const y0 = H * L.y, y1 = H * L.y2;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgb(mix([40, 20, 70], env.haze, 0.4)));
      g.addColorStop(1, rgb([12, 10, 24]));
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, W, y1 - y0 + 1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const lanes = 9;
      for (let k = 0; k < lanes; k++) {
        const u = k / (lanes - 1);
        const y = y0 + (y1 - y0) * (0.1 + 0.85 * u);
        const p = 0.2 + u * 0.6;
        const dir = k % 2 ? 1 : -1;
        const col = dir > 0 ? [255, 240, 220] : [255, 60, 90];
        const span = 90 + u * 140;
        const shift = ((d * p * 18 + dir * t * (60 + u * 120)) % span + span) % span;
        ctx.fillStyle = rgb(col, 0.35 + env.night * 0.45);
        for (let x = -span + shift; x < W + span; x += span) {
          const len = 10 + u * 40;
          for (let c = 0; c < 3; c++) ctx.fillRect(x + c * len * 1.6 + hash(k * 7 + c, 3) * 20, y, len, 1 + u * 1.5);
        }
      }
      // shop signs along the street edge
      for (let k = 0; k < 24; k++) {
        const x = (((hash(k, 81) * (W + 300) - d * 0.3 * 18) % (W + 300)) + W + 300) % (W + 300) - 150;
        const y = y0 + (y1 - y0) * (0.05 + hash(k, 82) * 0.3);
        const cols = ["#35e0ff", "#ff4fd8", "#9d7bff", "#5dffb0", "#ffb347"];
        ctx.fillStyle = rgb(hex(cols[k % 5]), 0.35 + env.night * 0.4);
        ctx.fillRect(x, y, 6 + hash(k, 83) * 18, 3 + hash(k, 84) * 5);
      }
      ctx.restore();
    }

    // Flying vehicles, each a pair of lights on its own lane.
    drawTraffic(ctx, S, env, L, s) {
      const { W, H, d, t } = S;
      const span = W + 300;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let j = 0; j < L.count; j++) {
        const dir = hash(j, 2) < 0.5 ? -1 : 1;
        const v = dir * (30 + hash(j, 3) * 90);
        const y = H * (L.y + hash(j, 4) * 0.22) + Math.sin(t * 0.5 + j) * 3;
        const x = (((hash(j, 1) * span + (v * t - d) * s) % span) + span) % span - 150;
        const len = Math.max(2, Math.abs(v - S.v) * s * 0.15);
        const sz = Math.max(1.2, s * 3);
        const g = ctx.createLinearGradient(x, 0, x - dir * len, 0);
        g.addColorStop(0, `rgba(255,255,255,${0.5 + env.night * 0.5})`);
        g.addColorStop(1, "rgba(80,200,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(x, x - dir * len), y - sz * 0.3, len, sz * 0.6);
        ctx.fillStyle = `rgba(255,60,90,${0.7 + env.night * 0.3})`;
        ctx.fillRect(x - dir * sz * 2, y - sz * 0.25, sz * 0.7, sz * 0.5);
      }
      ctx.restore();
    }

    // Floating islands with waterfalls pouring into the sky.
    drawIsles(ctx, S, env, L, s, pal) {
      const { W, H, d, t } = S;
      if (L.seed === undefined) L.seed = 999;
      const m0 = d - W / 2 / s - L.size[1] * 2, m1 = d + W / 2 / s + L.size[1] * 2;
      for (let i = Math.floor(m0 / L.cell); i <= Math.floor(m1 / L.cell); i++) {
        if (hash(i, L.seed) > L.prob) continue;
        const m = (i + 0.2 + 0.6 * hash(i, L.seed + 1)) * L.cell;
        const S0 = (L.size[0] + (L.size[1] - L.size[0]) * hash(i, L.seed + 2)) * s;
        const x = W / 2 + (m - d) * s;
        const y = H * L.y + (hash(i, L.seed + 3) - 0.5) * H * 0.14 + Math.sin(t * 0.25 + i) * S0 * 0.04;
        // waterfall
        const fx = x + S0 * 0.3;
        const fg = ctx.createLinearGradient(0, y, 0, y + S0 * 2.2);
        fg.addColorStop(0, "rgba(220,245,255,0.7)");
        fg.addColorStop(1, "rgba(220,245,255,0)");
        ctx.fillStyle = fg;
        ctx.fillRect(fx, y, S0 * 0.06, S0 * 2.2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        for (let k = 0; k < 6; k++) {
          const yy = y + ((t * S0 * 0.3 + k * S0 * 0.4) % (S0 * 2));
          ctx.fillRect(fx + S0 * 0.01, yy, S0 * 0.04, S0 * 0.08);
        }
        // underside
        const g = ctx.createLinearGradient(0, y, 0, y + S0 * 0.9);
        g.addColorStop(0, pal.P("#6a4f7a"));
        g.addColorStop(1, pal.P("#2a1f45"));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - S0 * 0.5, y);
        const n = 7;
        for (let k = 0; k <= n; k++) {
          const u = k / n;
          const depth = Math.sin(u * Math.PI) * S0 * (0.5 + 0.5 * hash(i * 9 + k, 5));
          ctx.lineTo(x - S0 * 0.5 + u * S0, y + depth);
        }
        ctx.lineTo(x + S0 * 0.5, y);
        ctx.fill();
        // top
        ctx.fillStyle = pal.P("#3fa08a");
        ctx.beginPath();
        ctx.ellipse(x, y, S0 * 0.52, S0 * 0.08, 0, 0, 7);
        ctx.fill();
        // trees and a tower on top
        const o = { c: ctx, P: pal.P, E: pal.E, night: env.night, t, s };
        for (let k = 0; k < 4; k++) KINDS.shroom(o, x - S0 * 0.35 + k * S0 * 0.2, y, S0 * (0.12 + hash(i * 5 + k, 6) * 0.1), rvar(i * 5 + k, 3));
        if (hash(i, L.seed + 4) < 0.4) {
          ctx.fillStyle = pal.P("#e8e0ff");
          ctx.fillRect(x + S0 * 0.1, y - S0 * 0.35, S0 * 0.06, S0 * 0.35);
          ctx.fillStyle = pal.E("#ffe9a8", 0.5 + env.night * 0.5);
          ctx.fillRect(x + S0 * 0.11, y - S0 * 0.3, S0 * 0.04, S0 * 0.05);
        }
        // hanging crystals glow at night
        if (env.night > 0.2) SKY.glow(ctx, x, y + S0 * 0.5, S0 * 0.4, [150, 220, 255], env.night * 0.3);
      }
    }

    // A maglev guideway: smooth deck with a light strip.
    drawGuideway(ctx, S, env, L, s, pal) {
      const { W, H, d, t } = S;
      const y = H * L.y;
      const deck = ctx.createLinearGradient(0, y, 0, H);
      deck.addColorStop(0, pal.P(rgbHex(mix(hex(L.col), hex(L.glow), 0.12))));
      deck.addColorStop(1, pal.P(L.col));
      ctx.fillStyle = deck;
      ctx.fillRect(0, y, W, H - y);
      ctx.fillStyle = rgb(hex(L.glow), 0.08 + env.night * 0.08);
      for (let k = 0; k < 5; k++) {
        const yy = y + (H - y) * (0.15 + k * 0.18);
        const sp = 140 + k * 60;
        const off = ((d * K_DECK * (1 + k * 0.6)) % sp + sp) % sp;
        for (let x = -sp + off; x < W; x += sp) ctx.fillRect(x, yy, sp * 0.5, 1 + k);
      }
      const g = ctx.createLinearGradient(0, y - H * 0.02, 0, y + H * 0.02);
      const gc = hex(L.glow);
      g.addColorStop(0, rgb(gc, 0));
      g.addColorStop(0.5, rgb(gc, 0.35 + env.night * 0.4));
      g.addColorStop(1, rgb(gc, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - H * 0.02, W, H * 0.04);
      ctx.fillStyle = rgb(mix(gc, [255, 255, 255], 0.5), 0.9);
      ctx.fillRect(0, y - 1, W, 2);
      // light posts
      const cell = 18;
      for (let i = Math.floor((d - W / 2 / s) / cell) - 1; i <= Math.floor((d + W / 2 / s) / cell) + 1; i++) {
        const x = W / 2 + (i * cell - d) * s;
        ctx.fillStyle = pal.P("#2a3144");
        ctx.fillRect(x - s * 0.08, y - s * 1.1, s * 0.16, s * 1.1);
        ctx.fillStyle = rgb(gc, 0.6 + 0.4 * env.night);
        ctx.fillRect(x - s * 0.12, y - s * 1.15, s * 0.24, s * 0.12);
        // glass railing
        ctx.fillStyle = rgb(mix(gc, [255, 255, 255], 0.6), 0.06);
        ctx.fillRect(x, y - s * 1.0, cell * s, s * 1.0);
      }
    }

    drawPoles(ctx, S, env, L, s, pal) {
      const { W, H, d } = S;
      const cell = L.cell;
      const base = H * L.y;
      const i0 = Math.floor((d - W / 2 / s) / cell) - 1, i1 = Math.floor((d + W / 2 / s) / cell) + 1;
      const xs = [];
      for (let i = i0; i <= i1; i++) xs.push(W / 2 + (i * cell - d) * s);
      const topY = base - L.size * s;
      ctx.strokeStyle = pal.P("#26282c");
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      const wires = L.telegraph ? [0.05, 0.1, 0.16] : [0.02, 0.1];
      for (let k = 0; k < xs.length - 1; k++) {
        for (const wy of wires) {
          const y = topY + L.size * s * wy;
          ctx.moveTo(xs[k], y);
          ctx.quadraticCurveTo((xs[k] + xs[k + 1]) / 2, y + s * 0.9, xs[k + 1], y);
        }
      }
      ctx.stroke();
      for (const x of xs) {
        ctx.fillStyle = pal.P(L.telegraph ? "#5b4632" : "#44484f");
        ctx.fillRect(x - s * 0.18, topY, s * 0.36, base - topY);
        ctx.fillRect(x - s * 1.2, topY + s * 0.2, s * 2.4, s * 0.22);
        ctx.fillStyle = pal.P("#8b9098");
        for (let k = -1; k <= 1; k += 2) ctx.fillRect(x + k * s * 0.9 - s * 0.08, topY, s * 0.16, s * 0.35);
      }
    }

    // The Orbital Ring: a planet below with oceans, clouds and city lights on its night side.
    planetTextures() {
      if (this.planet) return this.planet;
      const w = 1024, h = 256;
      const mk = () => {
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        return cv;
      };
      const surf = mk(), clouds = mk(), lights = mk();
      const sc = surf.getContext("2d"), cc = clouds.getContext("2d"), lc = lights.getContext("2d");
      const si = sc.createImageData(w, h), ci = cc.createImageData(w, h), li = lc.createImageData(w, h);
      const n2 = (x, y, seed) => {
        // 2D value noise from the 1D hash
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const hh = (a, b) => hash(a * 7919 + b * 104729, seed);
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const top = hh(xi, yi) + (hh(xi + 1, yi) - hh(xi, yi)) * u;
        const bot = hh(xi, yi + 1) + (hh(xi + 1, yi + 1) - hh(xi, yi + 1)) * u;
        return top + (bot - top) * v;
      };
      const f2 = (x, y, seed, oct) => {
        let s = 0, a = 0.5, n = 0, f = 1;
        for (let o = 0; o < oct; o++) {
          // wrap horizontally so the texture tiles around the planet
          s += n2(((x * f) % (8 * f)), y * f, seed + o) * a;
          n += a;
          a *= 0.5;
          f *= 2;
        }
        return s / n;
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const u = (x / w) * 8, v = (y / h) * 2;
          const land = f2(u, v, 3, 5);
          const lat = Math.abs(y / h - 0.5) * 2;
          const i = (y * w + x) * 4;
          let c;
          if (lat > 0.88) c = [235, 240, 248];
          else if (land > 0.53) {
            const dry = f2(u * 2, v * 2, 9, 3);
            c = dry > 0.55 ? [196, 170, 120] : land > 0.62 ? [96, 110, 70] : [70, 118, 64];
          } else c = land > 0.5 ? [52, 120, 170] : [18, 58, 118];
          si.data[i] = c[0];
          si.data[i + 1] = c[1];
          si.data[i + 2] = c[2];
          si.data[i + 3] = 255;
          const cl = f2(u * 1.5 + 3, v * 1.5, 21, 5);
          ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = 255;
          ci.data[i + 3] = Math.max(0, (cl - 0.5) * 2.4) * 255;
          const city = land > 0.54 && lat < 0.8 && hash(x * 3 + y * 9173, 5) < 0.035 * (f2(u * 4, v * 4, 31, 2) > 0.55 ? 2.5 : 0.3);
          li.data[i] = 255;
          li.data[i + 1] = 200;
          li.data[i + 2] = 120;
          li.data[i + 3] = city ? 255 : 0;
        }
      }
      sc.putImageData(si, 0, 0);
      cc.putImageData(ci, 0, 0);
      lc.putImageData(li, 0, 0);
      // Soften the city lights so they glow instead of showing as square pixels.
      const soft = mk();
      const sc2 = soft.getContext("2d");
      sc2.filter = "blur(1.2px)";
      sc2.drawImage(lights, 0, 0);
      sc2.drawImage(lights, 0, 0);
      sc2.filter = "none";
      sc2.globalAlpha = 0.6;
      sc2.drawImage(lights, 0, 0);
      this.planet = { surf, clouds, lights: soft, w, h };
      return this.planet;
    }

    drawPlanet(ctx, S, env, s, horizon) {
      const { W, H, d, t } = S;
      const P = this.planetTextures();
      const R = Math.max(W, H) * 2.2;
      const limb = H * 0.47;
      const cx = W / 2, cy = limb + R;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 7);
      ctx.clip();
      ctx.imageSmoothingQuality = "high";
      const bands = 14;
      const off = (d * 0.035 + t * 0.4) % P.w;
      const coff = (d * 0.045 + t * 0.9) % P.w;
      const rows = P.h * 0.75;
      for (let b = 0; b < bands; b++) {
        // foreshortening: rows near the limb are squeezed
        const y0 = limb + (H - limb) * Math.pow(b / bands, 1.8);
        const y1 = limb + (H - limb) * Math.pow((b + 1) / bands, 1.8) + 1;
        const sy = 12 + (rows * b) / bands, sh = rows / bands;
        const sw = P.w * 0.32;
        this.blitWrapped(ctx, P.surf, off, sy, sw, sh, 0, y0, W, y1 - y0, P.w);
        ctx.globalAlpha = 0.85;
        this.blitWrapped(ctx, P.clouds, coff, sy, sw, sh, 0, y0, W, y1 - y0, P.w);
        ctx.globalAlpha = 1;
      }
      // Day and night on the planet follow the chosen time of day.
      const f = clamp((Math.sin(((env.hour - 6) / 24) * Math.PI * 2) + 0.2) / 1.2, 0, 1);
      const tx = W * (-0.4 + f * 1.8);
      const g = ctx.createLinearGradient(tx - W * 0.25, 0, tx + W * 0.25, 0);
      g.addColorStop(0, "rgba(2,4,12,0)");
      g.addColorStop(1, "rgba(2,4,12,0.93)");
      ctx.fillStyle = g;
      ctx.fillRect(0, limb, W, H - limb);
      if (tx < W * 1.25) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(tx - W * 0.05, limb, W * 2, H);
        ctx.clip();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.9;
        for (let b = 0; b < bands; b++) {
          const y0 = limb + (H - limb) * Math.pow(b / bands, 1.8);
          const y1 = limb + (H - limb) * Math.pow((b + 1) / bands, 1.8) + 1;
          const sy = 12 + (rows * b) / bands, sh = rows / bands;
          const sw = P.w * 0.32;
          this.blitWrapped(ctx, P.lights, off, sy, sw, sh, 0, y0, W, y1 - y0, P.w);
        }
        ctx.restore();
      }
      ctx.restore();
      // Atmosphere glow along the curve
      const ag = ctx.createRadialGradient(cx, cy, R - H * 0.02, cx, cy, R + H * 0.05);
      ag.addColorStop(0, "rgba(90,160,255,0)");
      ag.addColorStop(0.3, `rgba(110,180,255,${0.35 + 0.4 * f})`);
      ag.addColorStop(0.55, `rgba(80,140,255,${0.15 + 0.2 * f})`);
      ag.addColorStop(1, "rgba(40,80,200,0)");
      ctx.fillStyle = ag;
      ctx.fillRect(0, limb - H * 0.06, W, H * 0.2);
    }

    blitWrapped(ctx, img, off, sy, sw, sh, dx, dy, dw, dh, tw) {
      const sx = ((off % tw) + tw) % tw;
      const first = Math.min(sw, tw - sx);
      const k = dw / sw;
      ctx.drawImage(img, sx, sy, first, sh, dx, dy, first * k + 0.5, dh);
      if (first < sw) ctx.drawImage(img, 0, sy, sw - first, sh, dx + first * k, dy, (sw - first) * k, dh);
    }

    drawSatellites(ctx, S, env, L, s, pal) {
      const { W, H, d, t } = S;
      if (L.seed === undefined) L.seed = 555;
      for (let i = Math.floor((d - W / s) / L.cell); i <= Math.floor((d + W / s) / L.cell); i++) {
        if (hash(i, L.seed) > L.prob) continue;
        const x = W / 2 + ((i + hash(i, L.seed + 1)) * L.cell - d) * s;
        const y = H * (L.y - 0.15 + hash(i, L.seed + 2) * 0.25);
        const kind = hash(i, L.seed + 3);
        const sz = Math.min(W, H) * (0.03 + hash(i, L.seed + 4) * 0.06);
        ctx.save();
        ctx.translate(x, y);
        if (kind < 0.35) {
          // spinning wheel station
          ctx.rotate(t * 0.1 + i);
          ctx.strokeStyle = pal.P("#d9dde6");
          ctx.lineWidth = sz * 0.12;
          ctx.beginPath();
          ctx.arc(0, 0, sz, 0, 7);
          ctx.moveTo(-sz, 0);
          ctx.lineTo(sz, 0);
          ctx.moveTo(0, -sz);
          ctx.lineTo(0, sz);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,220,150,0.9)";
          for (let k = 0; k < 12; k++) ctx.fillRect(Math.cos(k / 1.91) * sz - 1, Math.sin(k / 1.91) * sz - 1, 2, 2);
        } else {
          // satellite with solar wings
          ctx.rotate(Math.sin(t * 0.05 + i) * 0.3);
          ctx.fillStyle = pal.P("#c9b27a");
          ctx.fillRect(-sz * 0.15, -sz * 0.2, sz * 0.3, sz * 0.4);
          ctx.fillStyle = pal.P("#2a3f7a");
          ctx.fillRect(-sz * 1.1, -sz * 0.12, sz * 0.85, sz * 0.24);
          ctx.fillRect(sz * 0.25, -sz * 0.12, sz * 0.85, sz * 0.24);
          ctx.strokeStyle = "rgba(160,190,255,0.5)";
          ctx.lineWidth = 1;
          ctx.strokeRect(-sz * 1.1, -sz * 0.12, sz * 0.85, sz * 0.24);
          ctx.strokeRect(sz * 0.25, -sz * 0.12, sz * 0.85, sz * 0.24);
        }
        if (Math.sin(t * 2 + i) > 0.6) {
          ctx.fillStyle = "rgba(120,255,160,1)";
          ctx.fillRect(-1, -sz * 0.3, 2, 2);
        }
        ctx.restore();
      }
    }

    drawTruss(ctx, S, env, L, s, pal) {
      const { W, H, d, t } = S;
      const y = H * L.y;
      ctx.fillStyle = pal.P("#2a2e36");
      ctx.fillRect(0, y, W, H - y);
      ctx.fillStyle = pal.P("#5a616e");
      ctx.fillRect(0, y, W, s * 0.25);
      const cell = 8;
      ctx.strokeStyle = pal.P("#6b7280");
      ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.beginPath();
      for (let i = Math.floor((d - W / 2 / s) / cell) - 1; i <= Math.floor((d + W / 2 / s) / cell) + 1; i++) {
        const x = W / 2 + (i * cell - d) * s;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - s * 1.6);
        ctx.moveTo(x, y);
        ctx.lineTo(x + cell * s, y - s * 1.6);
        ctx.moveTo(x, y - s * 1.6);
        ctx.lineTo(x + cell * s, y);
      }
      ctx.moveTo(0, y - s * 1.6);
      ctx.lineTo(W, y - s * 1.6);
      ctx.stroke();
      for (let i = Math.floor((d - W / 2 / s) / cell) - 1; i <= Math.floor((d + W / 2 / s) / cell) + 1; i++) {
        const x = W / 2 + (i * cell - d) * s;
        const on = (Math.floor(t * 4) + i) % 6 === 0;
        ctx.fillStyle = on ? "rgba(120,220,255,1)" : "rgba(80,140,200,0.5)";
        ctx.fillRect(x - 1.5, y - s * 1.6 - 1.5, 3, 3);
      }
    }

    // Station platforms: canopy, signs with the station name, lamps, benches and waiting passengers.
    drawStations(ctx, S, env, K, biome) {
      const { W, H, d, t, routeId } = S;
      const p = 1.25, s = K * p;
      const next = WORLD.nextStation(routeId, d - 150);
      const pal = this.palette(env, 0, p);
      const future = biome.future;
      for (const st of [next, WORLD.station(routeId, next.i + 1), WORLD.station(routeId, Math.max(0, next.i - 1))]) {
        const half = 110;
        const xa = W / 2 + (st.pos - half - d) * s, xb = W / 2 + (st.pos + half - d) * s;
        if (xb < -50 || xa > W + 50) continue;
        const top = H * 0.715;
        // back wall and building
        ctx.fillStyle = pal.P(future ? "#dfe6ee" : "#b9a78c");
        ctx.fillRect(xa, top - s * 2.2, xb - xa, s * 2.2);
        const bx = W / 2 + (st.pos - 30 - d) * s;
        ctx.fillStyle = pal.P(future ? "#eef2f7" : "#c9a37a");
        ctx.fillRect(bx, top - s * 5.5, s * 60, s * 5.5);
        ctx.fillStyle = pal.P(future ? "#9aa6b8" : "#6b3f2e");
        ctx.fillRect(bx - s, top - s * 6, s * 62, s * 0.6);
        for (let k = 0; k < 10; k++) {
          ctx.fillStyle = env.night > 0.2 || env.tunnel > 0.5 ? pal.E("#ffd89a", 0.85) : pal.P("#4b5b70");
          ctx.fillRect(bx + s * (3 + k * 5.6), top - s * 4.6, s * 2.4, s * 2.2);
        }
        // clock
        const ckx = bx + s * 30, cky = top - s * 6.9;
        ctx.fillStyle = pal.P("#f6f2e8");
        ctx.beginPath();
        ctx.arc(ckx, cky, s * 0.6, 0, 7);
        ctx.fill();
        ctx.strokeStyle = pal.P("#222");
        ctx.lineWidth = Math.max(1, s * 0.1);
        const hr = (env.hour / 12) * Math.PI * 2, mn = ((env.hour % 1) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(ckx, cky);
        ctx.lineTo(ckx + Math.sin(hr) * s * 0.32, cky - Math.cos(hr) * s * 0.32);
        ctx.moveTo(ckx, cky);
        ctx.lineTo(ckx + Math.sin(mn) * s * 0.5, cky - Math.cos(mn) * s * 0.5);
        ctx.stroke();

        // platform
        ctx.fillStyle = pal.P(future ? "#c9d1dc" : "#9a958c");
        ctx.fillRect(xa, top, xb - xa, H - top);
        ctx.fillStyle = pal.P(future ? "#35e0ff" : "#e8c547");
        ctx.fillRect(xa, top + s * 0.1, xb - xa, s * 0.18);
        ctx.fillStyle = pal.P("#6d685f");
        ctx.fillRect(xa, top + s * 0.8, xb - xa, H);

        // people
        for (let k = 0; k < 14; k++) {
          if (hash(k + st.i * 50, 7) < 0.4) continue;
          const px = W / 2 + (st.pos - half + 10 + hash(k + st.i * 50, 8) * (half * 2 - 20) - d) * s;
          if (px < -40 || px > W + 40) continue;
          const coat = ["#3b4a6b", "#7a3b3b", "#2f4f3f", "#5a4a3a", "#8a7a5a", "#444"][Math.floor(hash(k, st.i + 9) * 6)];
          const ph = 1.6 + hash(k, st.i + 10) * 0.25;
          ctx.fillStyle = pal.P(coat);
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(px - s * 0.25, top - ph * s * 0.85, s * 0.5, ph * s * 0.55, s * 0.15) : ctx.rect(px - s * 0.25, top - ph * s * 0.85, s * 0.5, ph * s * 0.55);
          ctx.fill();
          ctx.fillStyle = pal.P("#2a2a30");
          ctx.fillRect(px - s * 0.18, top - ph * s * 0.32, s * 0.14, ph * s * 0.32);
          ctx.fillRect(px + s * 0.04, top - ph * s * 0.32, s * 0.14, ph * s * 0.32);
          ctx.fillStyle = pal.P("#d9b99a");
          ctx.beginPath();
          ctx.arc(px, top - ph * s * 0.93, s * 0.13, 0, 7);
          ctx.fill();
          if (hash(k, st.i + 11) < 0.3) {
            ctx.fillStyle = pal.P("#6b4a2a");
            ctx.fillRect(px + s * 0.3, top - s * 0.6, s * 0.4, s * 0.6);
          }
        }

        // canopy with pillars
        const ca = W / 2 + (st.pos - 60 - d) * s, cb = W / 2 + (st.pos + 60 - d) * s;
        const roof = top - s * 4.3;
        ctx.fillStyle = pal.P(future ? "#f4f7fa" : "#4e5a4e");
        for (let px = ca; px <= cb; px += s * 12) ctx.fillRect(px - s * 0.15, roof, s * 0.3, top - roof);
        ctx.fillRect(ca - s * 2, roof - s * 0.5, cb - ca + s * 4, s * 0.6);
        ctx.fillStyle = pal.P(future ? "#bfeaff" : "#7e6a52");
        ctx.fillRect(ca - s * 2, roof - s * 0.7, cb - ca + s * 4, s * 0.25);

        // lamps, signs and benches along the platform
        for (let m = -100; m <= 100; m += 20) {
          const x = W / 2 + (st.pos + m - d) * s;
          if (x < -100 || x > W + 100) continue;
          if (Math.abs(m) > 60) {
            ctx.fillStyle = pal.P("#33363c");
            ctx.fillRect(x - s * 0.06, top - s * 3.8, s * 0.12, s * 3.8);
            if (env.night > 0.15 || env.tunnel > 0.3) {
              SKY.glow(ctx, x, top - s * 3.8, s * 2.5, [255, 214, 150], 0.35 * Math.max(env.night, env.tunnel));
              ctx.fillStyle = pal.E("#fff1d0", 1);
            } else ctx.fillStyle = pal.P("#e6e3da");
            ctx.fillRect(x - s * 0.3, top - s * 3.9, s * 0.6, s * 0.2);
          } else if (env.night > 0.15) {
            SKY.glow(ctx, x, roof + s * 0.2, s * 3, [255, 220, 160], 0.3 * env.night);
          }
          if ((m / 20) % 2 === 0) {
            // name board
            const bw = s * 4.2, bh = s * 0.9, by = top - s * 3.1;
            ctx.fillStyle = pal.P(future ? "#12304a" : "#1f3b6b");
            ctx.fillRect(x - bw / 2, by, bw, bh);
            ctx.fillStyle = pal.P("#33363c");
            ctx.fillRect(x - bw * 0.4, by + bh, s * 0.1, top - by - bh);
            ctx.fillRect(x + bw * 0.4, by + bh, s * 0.1, top - by - bh);
            ctx.fillStyle = future ? pal.E("#9ff3ff", 1) : pal.P("#ffffff");
            ctx.font = `600 ${Math.max(6, bh * 0.52)}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(st.name, x, by + bh * 0.54, bw * 0.92);
          } else {
            ctx.fillStyle = pal.P("#5a3a28");
            ctx.fillRect(x - s * 0.9, top - s * 0.5, s * 1.8, s * 0.12);
            ctx.fillRect(x - s * 0.9, top - s * 0.9, s * 1.8, s * 0.1);
            ctx.fillRect(x - s * 0.8, top - s * 0.5, s * 0.08, s * 0.5);
            ctx.fillRect(x + s * 0.72, top - s * 0.5, s * 0.08, s * 0.5);
          }
        }
      }
    }

    drawTunnels(ctx, S, env, tunnels, K, routeId) {
      const { W, H, d, t } = S;
      const s = K;
      for (const tn of tunnels) {
        const xa = W / 2 + (tn.a - d) * s, xb = W / 2 + (tn.b - d) * s;
        if (xb < -W || xa > W * 2) continue;
        // The hillside rises before the portal and falls after it.
        const bank = 70 * s;
        for (const [edge, dir, at] of [[xa, -1, tn.a - 1], [xb, 1, tn.b + 1]]) {
          if (edge + bank < 0 || edge - bank > W) continue;
          const b = WORLD.BIOMES[WORLD.biomeIdAt(routeId, at)];
          const gl = b.layers.find((l) => l.k === "ground" || l.k === "guide") || b.layers[b.layers.length - 1];
          const pal = this.palette(env, 0, 1);
          ctx.fillStyle = pal.P(gl.col || "#555");
          ctx.beginPath();
          ctx.moveTo(edge + dir * bank, H + 10);
          ctx.quadraticCurveTo(edge + dir * bank * 0.2, H * 0.4, edge, -10);
          ctx.lineTo(edge - dir * 4, -10);
          ctx.lineTo(edge - dir * 4, H + 10);
          ctx.fill();
          ctx.fillStyle = pal.P("#6d6a64");
          ctx.fillRect(Math.min(edge, edge - dir * s * 2.5), -10, s * 2.5, H + 20);
        }
        const a = Math.max(xa, -10), b = Math.min(xb, W + 10);
        if (b <= a) continue;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0b0b0d");
        g.addColorStop(0.5, "#16161a");
        g.addColorStop(1, "#08080a");
        ctx.fillStyle = g;
        ctx.fillRect(a, -10, b - a, H + 20);
        // wall ribs and passing lamps
        ctx.save();
        ctx.beginPath();
        ctx.rect(a, -10, b - a, H + 20);
        ctx.clip();
        ctx.strokeStyle = "rgba(60,60,66,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let m = Math.floor((d - W / s) / 6) * 6; m < d + W / s; m += 6) {
          const x = W / 2 + (m - d) * s;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
        }
        ctx.stroke();
        const future = WORLD.BIOMES[WORLD.biomeIdAt(routeId, d)].future;
        for (let m = Math.floor((d - W / s) / 30) * 30; m < d + W / s; m += 30) {
          const x = W / 2 + (m - d) * s;
          const col = future ? [80, 220, 255] : [255, 170, 80];
          SKY.glow(ctx, x, H * 0.33, H * 0.12, col, 0.5);
          ctx.fillStyle = rgb(col, 1);
          const len = Math.max(8, Math.min(120, S.v * 1.2));
          ctx.fillRect(x - len / 2, H * 0.33 - 2, len, 4);
        }
        ctx.restore();
      }
    }

    // Rain, snow and fog outside the glass.
    drawWeather(ctx, S, env, biome) {
      const { W, H, t, weather: w } = S;
      const speed = S.v;
      if (w.rain > 0.02 || w.storm > 0.02) {
        const n = Math.floor((w.rain + w.storm) * 260);
        const slant = 0.25 + speed * 0.03;
        ctx.strokeStyle = rgb(mix([200, 210, 225], env.light.map((x) => x * 255), 0.5), 0.28);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const fall = 900 + hash(k, 2) * 400;
          const y = ((hash(k, 3) * (H + 100) + t * fall) % (H + 100)) - 50;
          const x = (((hash(k, 1) * (W + 400) - t * fall * slant) % (W + 400)) + (W + 400)) % (W + 400) - 200;
          const len = 14 + hash(k, 4) * 14;
          ctx.moveTo(x, y);
          ctx.lineTo(x - len * slant, y + len);
        }
        ctx.stroke();
      }
      if (w.snow > 0.02) {
        const n = Math.floor(w.snow * 320);
        ctx.fillStyle = rgb(mix([255, 255, 255], env.light.map((x) => x * 255), 0.3), 0.85);
        for (let k = 0; k < n; k++) {
          const depth = 0.4 + hash(k, 5) * 0.6;
          const fall = 50 + depth * 90;
          const drift = 60 + speed * 14 * depth;
          const y = ((hash(k, 6) * (H + 40) + t * fall) % (H + 40)) - 20;
          const x = (((hash(k, 7) * (W + 200) - t * drift + Math.sin(t + k) * 10) % (W + 200)) + (W + 200)) % (W + 200) - 100;
          const r = depth * 2.2;
          if (speed > 15) {
            ctx.globalAlpha = 0.6;
            ctx.fillRect(x, y, r * (1 + speed * 0.08), r * 0.8);
            ctx.globalAlpha = 1;
          } else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 7);
            ctx.fill();
          }
        }
      }
      if (w.fog > 0.02) {
        const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
        g.addColorStop(0, rgb(env.haze, 0));
        g.addColorStop(0.35, rgb(env.haze, w.fog * 0.55));
        g.addColorStop(1, rgb(env.haze, w.fog * 0.25));
        ctx.fillStyle = g;
        ctx.fillRect(0, H * 0.3, W, H * 0.7);
      }
      if (w.flash > 0.5 && w.boltX !== undefined) {
        ctx.strokeStyle = `rgba(235,240,255,${w.flash})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let x = W * w.boltX, y = 0;
        ctx.moveTo(x, y);
        const r = U.rng(Math.floor(w.boltX * 1e6));
        while (y < H * 0.5) {
          x += (r() - 0.5) * 40;
          y += 10 + r() * 25;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  const K_DECK = 14;

  function rgbHex(c) {
    return "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  }

  window.Scenery = Scenery;
})();
