// Lighting and the sky: time-of-day colour tables, sun, moon, stars, clouds, aurora, planets and sky creatures.
(function () {
  "use strict";
  const { hash, fbm, noise, lerp, clamp, smoothstep, hex, mix, scale, rgb, keyframe } = U;

  // Keyframes by hour: sky top, horizon, light (multiplies every colour) and haze (distance colour).
  const SKIES = {
    earth: [
      { h: 0, top: "#03060f", hor: "#0c1628", light: "#2a3150", haze: "#0e1830" },
      { h: 4.6, top: "#050915", hor: "#141d36", light: "#2c3353", haze: "#141d36" },
      { h: 5.6, top: "#141c3c", hor: "#51405e", light: "#5a5570", haze: "#4a4262" },
      { h: 6.5, top: "#2d4f82", hor: "#f2a46c", light: "#d09a86", haze: "#d9a084" },
      { h: 8, top: "#3f78c0", hor: "#bcd6ea", light: "#f2ede2", haze: "#b8cfe2" },
      { h: 12.5, top: "#2c6cd0", hor: "#cde3f6", light: "#ffffff", haze: "#c3d8ec" },
      { h: 16.5, top: "#386db6", hor: "#e6d7b8", light: "#fff2df", haze: "#d8d0bb" },
      { h: 18.3, top: "#32416f", hor: "#f48a52", light: "#e0a07e", haze: "#da8a68" },
      { h: 19.3, top: "#181f42", hor: "#6a3f5e", light: "#6a5a78", haze: "#453457" },
      { h: 20.5, top: "#060a18", hor: "#121c34", light: "#2e3555", haze: "#121c34" },
    ],
    neon: [
      { h: 0, top: "#07031a", hor: "#3a1250", light: "#3a3160", haze: "#2a1245" },
      { h: 5.5, top: "#140a35", hor: "#6b2a6b", light: "#55467a", haze: "#4a2560" },
      { h: 6.8, top: "#3a3f8f", hor: "#ff9a6b", light: "#d8a098", haze: "#d98c8a" },
      { h: 9, top: "#3f8fb8", hor: "#f2d3b0", light: "#f0e8e8", haze: "#c9b8c0" },
      { h: 13, top: "#2f86c8", hor: "#e6e0d0", light: "#ffffff", haze: "#c7c9d0" },
      { h: 17.5, top: "#5a5aa8", hor: "#ffb07a", light: "#f0c8b0", haze: "#d9a89a" },
      { h: 19, top: "#2a1a5a", hor: "#ff5a8a", light: "#9a6a9a", haze: "#8a3a7a" },
      { h: 20.5, top: "#0a0522", hor: "#4a1760", light: "#3e3468", haze: "#34154f" },
    ],
    alien: [
      { h: 0, top: "#04021a", hor: "#2a0f4a", light: "#3a3470", haze: "#231048" },
      { h: 5.4, top: "#1a0b45", hor: "#7a2f7a", light: "#6a4f8a", haze: "#5a2f78" },
      { h: 6.6, top: "#3b2e8a", hor: "#ff9ec8", light: "#e0b0d0", haze: "#e59ac4" },
      { h: 9, top: "#1a7f9a", hor: "#f7c6e6", light: "#f4f0ff", haze: "#c9b6e6" },
      { h: 13, top: "#128aa8", hor: "#d9f4f0", light: "#ffffff", haze: "#b9dfe6" },
      { h: 17.4, top: "#2a5aa8", hor: "#ffc27a", light: "#ffe0c8", haze: "#e6b8b0" },
      { h: 18.9, top: "#3a1a78", hor: "#ff6f9e", light: "#b07ab0", haze: "#a0508a" },
      { h: 20.4, top: "#0a0428", hor: "#3a1466", light: "#40387a", haze: "#2a1456" },
    ],
    space: [
      { h: 0, top: "#000000", hor: "#02030a", light: "#5a5f78", haze: "#02030a" },
      { h: 6, top: "#000000", hor: "#03050f", light: "#dcd6d0", haze: "#03050f" },
      { h: 12, top: "#000000", hor: "#040814", light: "#ffffff", haze: "#040814" },
      { h: 18, top: "#000000", hor: "#03050f", light: "#dcc8c0", haze: "#03050f" },
    ],
  };

  const SUNRISE = 6.2, SUNSET = 18.8;

  function sunElevation(hour) {
    const day = (hour - SUNRISE) / (SUNSET - SUNRISE);
    return Math.sin(day * Math.PI); // positive while up
  }

  function environment(hour, biome, w, tunnel) {
    const table = SKIES[biome.sky];
    let top = keyframe(table, hour, "top");
    let hor = keyframe(table, hour, "hor");
    let light = scale(keyframe(table, hour, "light"), 1 / 255);
    let haze = keyframe(table, hour, "haze");
    const elev = sunElevation(hour);
    const day = biome.space ? 1 : smoothstep(-0.18, 0.22, elev);

    const overcast = clamp(w.cloud * 0.7 + w.rain * 0.25 + w.storm * 0.35 + w.snow * 0.3, 0, 0.9);
    if (!biome.space && overcast > 0) {
      const grey = (c, k) => {
        const l = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) * k;
        return [l, l, l * 1.04];
      };
      top = mix(top, grey(top, 0.95), overcast);
      hor = mix(hor, grey(hor, 0.92), overcast);
      haze = mix(haze, grey(haze, 0.95), overcast * 0.8);
      light = scale(light, 1 - overcast * 0.35);
    }
    if (w.fog > 0 && !biome.space) {
      const fogCol = mix(haze, [200, 205, 210], day * 0.5);
      haze = mix(haze, fogCol, w.fog * 0.6);
      hor = mix(hor, haze, w.fog * 0.8);
      top = mix(top, haze, w.fog * 0.5);
    }
    if (w.flash > 0) {
      light = mix(light, [1.3, 1.3, 1.45], w.flash);
      top = mix(top, [210, 215, 255], w.flash * 0.8);
      hor = mix(hor, [230, 230, 255], w.flash * 0.8);
    }
    return {
      hour, top, hor, light, haze, day, night: 1 - day, elev,
      stars: biome.space ? 1 : clamp((1 - day) * (1 - overcast * 1.2) * (1 - w.fog), 0, 1),
      fog: w.fog, overcast,
      tunnel: tunnel || 0,
    };
  }

  // Stars are fixed per sky; generated once per size.
  let starCache = null;
  function stars(W, H) {
    if (starCache && starCache.W === W && starCache.H === H) return starCache.list;
    const r = U.rng(7);
    const list = [];
    const n = Math.floor((W * H) / 2600);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = Math.pow(r(), 1.3) * H * 0.62;
      // A band of extra stars forms the Milky Way.
      list.push({ x, y, s: r() < 0.06 ? 1.6 : r() < 0.3 ? 1.1 : 0.7, tw: r() * 6.28, c: r() });
    }
    for (let i = 0; i < n * 0.8; i++) {
      const u = r();
      const x = u * W, y = H * (0.05 + 0.5 * u) + (r() - 0.5) * H * 0.12;
      list.push({ x, y, s: 0.55, tw: r() * 6.28, c: r() });
    }
    starCache = { W, H, list };
    return list;
  }

  function drawStars(ctx, W, H, env, t, horizon) {
    const a = env.stars;
    if (a < 0.02) return;
    // Milky Way glow
    ctx.save();
    ctx.globalAlpha = a * 0.22;
    ctx.translate(W * 0.5, H * 0.28);
    ctx.rotate(0.46);
    const g = ctx.createLinearGradient(0, -H * 0.1, 0, H * 0.1);
    g.addColorStop(0, "rgba(160,170,220,0)");
    g.addColorStop(0.5, "rgba(190,190,235,0.9)");
    g.addColorStop(1, "rgba(160,170,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H * 0.1, W * 2, H * 0.2);
    ctx.restore();

    for (const s of stars(W, H)) {
      if (s.y > horizon) continue;
      const tw = 0.65 + 0.35 * Math.sin(t * (0.6 + s.c) + s.tw);
      ctx.globalAlpha = a * tw * (s.y > horizon * 0.8 ? 0.5 : 1);
      ctx.fillStyle = s.c < 0.15 ? "#ffd9b0" : s.c > 0.85 ? "#b9ccff" : "#f4f6ff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function glow(ctx, x, y, r, col, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgb(col, alpha));
    g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function sunPos(W, H, hour, horizon) {
    const f = (hour - SUNRISE) / (SUNSET - SUNRISE);
    return { x: W * (0.1 + 0.8 * f), y: horizon - Math.sin(f * Math.PI) * H * 0.42 };
  }

  function moonPos(W, H, hour, horizon) {
    const f = (((hour - 18.3 + 24) % 24)) / 12.4;
    return { x: W * (0.12 + 0.76 * f), y: horizon - Math.sin(f * Math.PI) * H * 0.38, up: f > 0 && f < 1 };
  }

  function drawSunMoon(ctx, W, H, env, horizon, biome) {
    const hour = env.hour;
    const R = Math.min(W, H);
    const clear = 1 - env.overcast * 0.9;
    // Sun
    if (env.elev > -0.1) {
      const s = sunPos(W, H, hour, horizon);
      const low = 1 - clamp(env.elev * 2.5, 0, 1);
      const col = mix([255, 250, 235], [255, 150, 80], low);
      glow(ctx, s.x, s.y, R * 0.35, col, 0.35 * clear);
      glow(ctx, s.x, s.y, R * 0.08, col, 0.8 * clear);
      ctx.fillStyle = rgb(mix(col, [255, 255, 255], 0.5), clear);
      ctx.beginPath();
      ctx.arc(s.x, s.y, R * 0.022, 0, 7);
      ctx.fill();
    }
    // Moon
    const m = moonPos(W, H, hour, horizon);
    if (m.up && env.day < 0.9) {
      const a = (1 - env.day) * clear;
      glow(ctx, m.x, m.y, R * 0.16, [200, 215, 255], 0.22 * a);
      ctx.fillStyle = rgb([236, 238, 245], a);
      ctx.beginPath();
      ctx.arc(m.x, m.y, R * 0.028, 0, 7);
      ctx.fill();
      ctx.fillStyle = rgb([190, 196, 210], a * 0.5);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(m.x + (hash(i, 3) - 0.5) * R * 0.03, m.y + (hash(i, 4) - 0.5) * R * 0.03, R * 0.003 * (1 + hash(i, 5) * 2), 0, 7);
        ctx.fill();
      }
      if (biome.sky === "alien") {
        // Two small moons as well.
        ctx.fillStyle = rgb([255, 200, 230], a * 0.9);
        ctx.beginPath();
        ctx.arc(m.x - R * 0.12, m.y - R * 0.06, R * 0.01, 0, 7);
        ctx.fill();
        ctx.fillStyle = rgb([180, 255, 235], a * 0.9);
        ctx.beginPath();
        ctx.arc(m.x + R * 0.09, m.y + R * 0.04, R * 0.006, 0, 7);
        ctx.fill();
      }
    }
  }

  // A huge ringed planet hangs in the sky of the future routes.
  function drawRingedPlanet(ctx, W, H, env, biome) {
    const R = Math.min(W, H);
    const x = W * 0.72, y = H * 0.2, r = R * (biome.sky === "alien" ? 0.2 : 0.11);
    const a = biome.sky === "alien" ? 0.95 - env.day * 0.35 : 0.3 + env.night * 0.55;
    const tilt = -0.32;
    const ring = (from, to) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = rgb(i % 2 ? [230, 200, 170] : [200, 180, 220], a * (0.35 - i * 0.04));
        ctx.lineWidth = r * 0.07;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (1.5 + i * 0.12), r * (0.34 + i * 0.03), 0, from, to);
        ctx.stroke();
      }
      ctx.restore();
    };
    ring(Math.PI, Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    if (biome.sky === "alien") {
      g.addColorStop(0, "#ffd3a8");
      g.addColorStop(0.45, "#e38fb0");
      g.addColorStop(1, "#3a2466");
    } else {
      g.addColorStop(0, "#b9c7ff");
      g.addColorStop(0.5, "#8a7fc8");
      g.addColorStop(1, "#231a4a");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = a * 0.25;
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#5a3a7a";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillRect(-r, -r + (i / 9) * 2 * r + hash(i, 9) * r * 0.1, r * 2, r * (0.04 + hash(i, 8) * 0.08));
      ctx.restore();
    }
    ctx.restore();
    ring(0, Math.PI);
  }

  let auroraCanvas = null;
  function drawAurora(ctx, W, H, env, t, strength) {
    const a = env.night * (1 - env.overcast) * strength;
    if (a < 0.03) return;
    // Drawn at quarter resolution, one pixel per column, then scaled up so it stays soft and cheap.
    const q = 4, w = Math.ceil(W / q), h = Math.ceil((H * 0.6) / q);
    if (!auroraCanvas) auroraCanvas = document.createElement("canvas");
    const cv = auroraCanvas;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const c = cv.getContext("2d");
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = "lighter";
    for (let band = 0; band < 3; band++) {
      const g = c.createLinearGradient(0, 0, 0, 1);
      g.addColorStop(0, band === 1 ? "rgba(180,90,255,0)" : "rgba(120,90,255,0)");
      g.addColorStop(0.6, "rgba(90,255,170,0.6)");
      g.addColorStop(1, "rgba(60,255,150,1)");
      c.fillStyle = g;
      const base = h * (0.2 + band * 0.12);
      for (let x = 0; x < w; x++) {
        const X = x * q;
        const n = fbm(X / 420 + t * 0.02 + band * 3, 40 + band, 3);
        const y = base + Math.sin(X / 260 + t * 0.15 + band) * h * 0.07 + n * h * 0.1;
        const hgt = h * (0.13 + 0.3 * fbm(X / 180 - t * 0.05, 50 + band, 2));
        c.globalAlpha = a * (0.35 + 0.65 * noise(X / 90 + t * 0.3, 60 + band)) * 0.3;
        c.setTransform(1, 0, 0, hgt + 1, x, y - hgt);
        c.fillRect(0, 0, 1, 1);
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(cv, 0, 0, w, h, 0, 0, W, H * 0.6);
    ctx.restore();
  }

  function drawNebula(ctx, W, H, env) {
    const a = env.night * 0.5 * (1 - env.overcast);
    if (a < 0.03) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const blobs = [[0.25, 0.18, 0.35, [150, 60, 200]], [0.4, 0.1, 0.25, [60, 120, 220]], [0.15, 0.3, 0.2, [220, 70, 140]]];
    for (const [bx, by, br, c] of blobs) glow(ctx, W * bx, H * by, Math.min(W, H) * br, c, a * 0.35);
    ctx.restore();
  }

  function drawClouds(ctx, W, H, env, t, d, amount, horizon, biome) {
    const n = Math.round(4 + amount * 14);
    const sky = mix(env.hor, env.top, 0.3);
    const lit = mix(mix(scale([255, 250, 245], env.light[0] * 0.9 + 0.1), [120, 130, 160], env.night * 0.35), sky, 0.25);
    const visible = U.lerp(0.25, 1, Math.max(env.day, amount));
    const shade = mix(lit, env.haze, 0.5);
    const alien = biome.sky === "alien" ? [255, 190, 230] : null;
    for (let i = 0; i < n; i++) {
      const depth = 0.3 + hash(i, 11) * 0.7;
      const speed = 3 + depth * 6;
      const span = W * 1.6;
      const x = ((hash(i, 12) * span - (t * speed + d * 0.02 * depth)) % span + span) % span - W * 0.3;
      const y = horizon * (0.12 + hash(i, 13) * 0.62);
      const w = W * (0.08 + depth * 0.14) * (0.7 + amount * 0.6);
      const h = w * 0.28;
      ctx.globalAlpha = (0.35 + 0.55 * amount) * (0.5 + depth * 0.5) * visible;
      for (let k = 0; k < 7; k++) {
        const px = x + (hash(i * 7 + k, 14) - 0.5) * w;
        const py = y + (hash(i * 7 + k, 15) - 0.6) * h * 0.8;
        const pr = h * (0.45 + hash(i * 7 + k, 16) * 0.55);
        const g = ctx.createRadialGradient(px, py - pr * 0.3, pr * 0.1, px, py, pr);
        const c = alien ? mix(lit, alien, 0.35) : lit;
        g.addColorStop(0, rgb(c, 1));
        g.addColorStop(0.7, rgb(shade, 0.8));
        g.addColorStop(1, rgb(shade, 0));
        ctx.fillStyle = g;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Shooting stars on clear nights, a flock of birds by day.
  function drawSkyLife(ctx, W, H, env, t, horizon, biome) {
    if (env.stars > 0.3) {
      const slot = Math.floor(t / 23);
      const ph = (t % 23) / 23;
      if (hash(slot, 90) < 0.45 && ph < 0.06) {
        const k = ph / 0.06;
        const x0 = W * (0.15 + 0.7 * hash(slot, 91)), y0 = horizon * (0.1 + 0.4 * hash(slot, 92));
        const x = x0 + k * W * 0.2, y = y0 + k * H * 0.08;
        const g = ctx.createLinearGradient(x - W * 0.08, y - H * 0.03, x, y);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(1, `rgba(255,255,255,${env.stars * (1 - k)})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - W * 0.08, y - H * 0.03);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    if (env.day > 0.6 && !biome.future && env.overcast < 0.7) {
      const slot = Math.floor(t / 40);
      const ph = (t % 40) / 40;
      if (hash(slot, 93) < 0.6) {
        const cx = W * (1.1 - ph * 1.3), cy = horizon * (0.35 + 0.35 * hash(slot, 94));
        ctx.strokeStyle = rgb(scale([40, 40, 50], 1), 0.7);
        ctx.lineWidth = 1.3;
        const count = 5 + Math.floor(hash(slot, 95) * 8);
        for (let b = 0; b < count; b++) {
          const bx = cx + b * 11 + (b % 2) * 4, by = cy + Math.abs(b - count / 2) * 6 + Math.sin(t + b) * 2;
          const f = Math.sin(t * 7 + b) * 3;
          ctx.beginPath();
          ctx.moveTo(bx - 5, by - f);
          ctx.quadraticCurveTo(bx - 2, by - 1, bx, by);
          ctx.quadraticCurveTo(bx + 2, by - 1, bx + 5, by - f);
          ctx.stroke();
        }
      }
    }
    if (biome.whales) {
      for (let i = 0; i < 2; i++) {
        const period = 140 + i * 60;
        const ph = ((t + i * 70) % period) / period;
        const x = W * (1.25 - ph * 1.5), y = horizon * (0.3 + i * 0.25) + Math.sin(t * 0.2 + i) * H * 0.02;
        drawWhale(ctx, x, y, Math.min(W, H) * (0.22 - i * 0.08), t + i * 3, env, i);
      }
    }
  }

  function drawWhale(ctx, x, y, L, t, env, i) {
    ctx.save();
    ctx.globalAlpha = 0.45 + env.night * 0.35;
    ctx.globalCompositeOperation = env.night > 0.5 ? "lighter" : "source-over";
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const u = k / 20;
      const wave = Math.sin(t * 1.3 - u * 4) * L * 0.03 * u;
      const thick = Math.sin(Math.min(1, u * 1.15) * Math.PI) * L * 0.13 * (1 - u * 0.5);
      pts.push([x + u * L, y + wave, thick]);
    }
    const g = ctx.createLinearGradient(x, y - L * 0.1, x, y + L * 0.12);
    const body = env.night > 0.5 ? ["rgba(120,220,255,0.55)", "rgba(80,90,220,0.25)"] : ["rgba(90,110,170,0.75)", "rgba(200,220,245,0.6)"];
    g.addColorStop(0, body[0]);
    g.addColorStop(1, body[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    pts.forEach(([px, py, th], k) => (k ? ctx.lineTo(px, py - th) : ctx.moveTo(px, py - th)));
    for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0], pts[k][1] + pts[k][2] * 0.8);
    ctx.fill();
    // Tail flukes and fin
    const [tx, ty] = pts[20];
    const f = Math.sin(t * 1.3 - 4) * L * 0.05;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + L * 0.08, ty - L * 0.1 + f, tx + L * 0.14, ty - L * 0.08 + f);
    ctx.quadraticCurveTo(tx + L * 0.07, ty + f * 0.5, tx + L * 0.14, ty + L * 0.07 + f);
    ctx.quadraticCurveTo(tx + L * 0.08, ty + L * 0.08 + f, tx, ty);
    ctx.fill();
    const [fx, fy, fth] = pts[7];
    ctx.beginPath();
    ctx.moveTo(fx, fy + fth * 0.5);
    ctx.quadraticCurveTo(fx + L * 0.05, fy + fth * 2.4 + Math.sin(t * 1.3) * L * 0.02, fx + L * 0.12, fy + fth * 0.6);
    ctx.fill();
    // Bioluminescent spots
    ctx.fillStyle = env.night > 0.5 ? "rgba(200,255,255,0.9)" : "rgba(255,255,255,0.6)";
    for (let k = 2; k < 16; k += 2) {
      const [px, py, th] = pts[k];
      ctx.beginPath();
      ctx.arc(px, py - th * 0.3, L * 0.006, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSky(ctx, W, H, env, t, d, biome, w, horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, rgb(env.top));
    g.addColorStop(0.65, rgb(mix(env.top, env.hor, 0.55)));
    g.addColorStop(1, rgb(env.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + 1);
    ctx.fillStyle = rgb(env.hor);
    ctx.fillRect(0, horizon, W, H - horizon);

    drawStars(ctx, W, H, env, t, horizon);
    if (biome.sky === "alien") drawNebula(ctx, W, H, env);
    if (biome.aurora) drawAurora(ctx, W, H, env, t, biome.aurora);
    if (biome.planet) drawRingedPlanet(ctx, W, H, env, biome);
    drawSunMoon(ctx, W, H, env, horizon, biome);
    if (!biome.space) drawClouds(ctx, W, H, env, t, d, clamp(w.cloud + w.rain * 0.6 + w.storm + w.snow * 0.6, 0, 1), horizon, biome);
    drawSkyLife(ctx, W, H, env, t, horizon, biome);
  }

  window.SKY = { environment, drawSky, sunPos, moonPos, glow, SUNRISE, SUNSET };
})();
