// Small math, noise and colour helpers shared by every other script.
(function () {
  "use strict";

  // Integer hash to [0, 1). Deterministic, so the same stretch of track always looks the same.
  function hash(n, seed) {
    let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));

  // 1D value noise in [0, 1).
  function noise(x, seed) {
    const i = Math.floor(x);
    return lerp(hash(i, seed), hash(i + 1, seed), smooth(x - i));
  }

  // Fractal noise in [0, 1).
  function fbm(x, seed, oct) {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      sum += noise(x * f, seed + o * 101) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }

  // Ridged noise gives sharp mountain peaks.
  function ridged(x, seed, oct) {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      const n = 1 - Math.abs(noise(x * f, seed + o * 57) * 2 - 1);
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return sum / norm;
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Colours are [r, g, b] arrays of 0–255 while being mixed, strings only when drawn.
  function hex(h) {
    if (Array.isArray(h)) return h;
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mul = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  function rgb(c, alpha) {
    const r = clamp(c[0] | 0, 0, 255), g = clamp(c[1] | 0, 0, 255), b = clamp(c[2] | 0, 0, 255);
    return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
  }

  // Interpolate a table of {h: hour, ...colours} keyframes, wrapping around midnight.
  function keyframe(table, hour, key) {
    for (let i = 0; i < table.length; i++) {
      const a = table[i], b = table[(i + 1) % table.length];
      const hb = b.h <= a.h ? b.h + 24 : b.h;
      let h = hour;
      if (h < a.h) h += 24;
      if (h >= a.h && h < hb) {
        const t = smooth((h - a.h) / (hb - a.h));
        const va = a[key], vb = b[key];
        return typeof va === "number" ? lerp(va, vb, t) : mix(hex(va), hex(vb), t);
      }
    }
    const v = table[0][key];
    return typeof v === "number" ? v : hex(v);
  }

  window.U = { hash, noise, fbm, ridged, rng, lerp, clamp, smooth, smoothstep, hex, mix, mul, scale, rgb, keyframe };
})();
