// Things that stand in the landscape. Each draws with its base at (x, y) and height S in pixels.
// o = { c: context, P: shaded colour, E: emissive colour, night, t, s: pixels per metre }.
(function () {
  "use strict";
  const { hash } = U;

  function pine(o, x, y, S, r, snowy) {
    const c = o.c, w = S * 0.4;
    c.fillStyle = o.P("#3b2e22");
    c.fillRect(x - S * 0.03, y - S * 0.14, S * 0.06, S * 0.16);
    c.fillStyle = o.P(r(1) < 0.5 ? "#2b4d33" : "#2f5838");
    const tiers = S < 12 ? 1 : 4;
    const pts = [];
    for (let i = 1; i <= tiers; i++) pts.push([w * (0.35 + (0.65 * i) / tiers), y - S * 0.1 - S * 0.9 * (1 - i / tiers)]);
    c.beginPath();
    c.moveTo(x, y - S);
    pts.forEach(([ww, yy], i) => {
      c.lineTo(x + ww, yy);
      if (i < tiers - 1) c.lineTo(x + ww * 0.45, yy);
    });
    for (let i = tiers - 1; i >= 0; i--) {
      const [ww, yy] = pts[i];
      if (i < tiers - 1) c.lineTo(x - ww * 0.45, yy);
      c.lineTo(x - ww, yy);
    }
    c.closePath();
    c.fill();
    if (snowy) {
      c.strokeStyle = o.P("#f2f6fb");
      c.lineWidth = Math.max(1, S * 0.035);
      c.beginPath();
      c.moveTo(x - w * 0.12, y - S * 0.88);
      c.lineTo(x, y - S);
      c.lineTo(x + w * 0.12, y - S * 0.88);
      for (const [ww, yy] of pts) {
        c.moveTo(x - ww * 0.95, yy - S * 0.015);
        c.lineTo(x + ww * 0.95, yy - S * 0.015);
      }
      c.stroke();
    }
  }

  function tree(o, x, y, S, r) {
    const c = o.c;
    c.fillStyle = o.P("#4a3a2a");
    c.fillRect(x - S * 0.035, y - S * 0.45, S * 0.07, S * 0.47);
    const blobs = [[0, -0.62, 0.3], [-0.2, -0.5, 0.23], [0.2, -0.52, 0.24], [0.02, -0.82, 0.22]];
    c.fillStyle = o.P(r(3) < 0.5 ? "#3f6b2f" : "#46722f");
    c.beginPath();
    for (const [dx, dy, rr] of blobs) {
      c.moveTo(x + dx * S + rr * S, y + dy * S);
      c.arc(x + dx * S, y + dy * S, rr * S, 0, 7);
    }
    c.fill();
    if (S > 10) {
      c.fillStyle = o.P("#5e8c3e");
      c.beginPath();
      c.arc(x - S * 0.06, y - S * 0.76, S * 0.14, 0, 7);
      c.arc(x - S * 0.2, y - S * 0.56, S * 0.1, 0, 7);
      c.fill();
    }
  }

  function poplar(o, x, y, S) {
    const c = o.c;
    c.fillStyle = o.P("#4a7433");
    c.beginPath();
    c.ellipse(x, y - S * 0.55, S * 0.12, S * 0.5, 0, 0, 7);
    c.fill();
  }

  function bush(o, x, y, S, r) {
    const c = o.c;
    c.fillStyle = o.P(r(3) < 0.5 ? "#46702f" : "#557f33");
    c.beginPath();
    c.arc(x - S * 0.3, y - S * 0.3, S * 0.4, 0, 7);
    c.arc(x + S * 0.25, y - S * 0.35, S * 0.45, 0, 7);
    c.arc(x, y - S * 0.55, S * 0.4, 0, 7);
    c.fill();
  }

  function windowLight(o, lit) {
    return lit && o.night > 0.25 ? o.E("#ffcf7a", 0.4 + o.night * 0.6) : o.P("#44556a");
  }

  function house(o, x, y, S, r) {
    const c = o.c, w = S * 1.3, h = S * 0.6;
    const walls = ["#e8dcc4", "#f1ece0", "#d9c2a0", "#c9b59a", "#efe3cf", "#b8a58c"];
    c.fillStyle = o.P(walls[Math.floor(r(4) * walls.length)]);
    c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = o.P(r(5) < 0.5 ? "#8a4a3a" : "#5b5a60");
    c.beginPath();
    c.moveTo(x - w * 0.58, y - h);
    c.lineTo(x, y - h - S * 0.42);
    c.lineTo(x + w * 0.58, y - h);
    c.fill();
    c.fillRect(x + w * 0.2, y - h - S * 0.35, S * 0.1, S * 0.2);
    if (S > 5) {
      c.fillStyle = windowLight(o, r(6) < 0.7);
      c.fillRect(x - w * 0.34, y - h * 0.7, w * 0.16, h * 0.28);
      c.fillStyle = windowLight(o, r(7) < 0.5);
      c.fillRect(x + w * 0.16, y - h * 0.7, w * 0.16, h * 0.28);
      c.fillStyle = o.P("#5a3b2a");
      c.fillRect(x - w * 0.06, y - h * 0.45, w * 0.13, h * 0.45);
    }
  }

  function barn(o, x, y, S) {
    const c = o.c, w = S * 1.5, h = S * 0.55;
    c.fillStyle = o.P("#9c3b2e");
    c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = o.P("#4d4d52");
    c.beginPath();
    c.moveTo(x - w * 0.55, y - h);
    c.lineTo(x - w * 0.4, y - h - S * 0.25);
    c.lineTo(x, y - h - S * 0.42);
    c.lineTo(x + w * 0.4, y - h - S * 0.25);
    c.lineTo(x + w * 0.55, y - h);
    c.fill();
    if (S > 6) {
      c.strokeStyle = o.P("#efe6d6");
      c.lineWidth = Math.max(1, S * 0.03);
      c.strokeRect(x - w * 0.15, y - h * 0.8, w * 0.3, h * 0.8);
      c.beginPath();
      c.moveTo(x - w * 0.15, y - h * 0.8);
      c.lineTo(x + w * 0.15, y);
      c.moveTo(x + w * 0.15, y - h * 0.8);
      c.lineTo(x - w * 0.15, y);
      c.stroke();
    }
  }

  function church(o, x, y, S) {
    const c = o.c;
    c.fillStyle = o.P("#cfc6b4");
    c.fillRect(x - S * 0.5, y - S * 0.3, S * 0.8, S * 0.3);
    c.fillRect(x + S * 0.3, y - S * 0.62, S * 0.16, S * 0.62);
    c.fillStyle = o.P("#6b6f78");
    c.beginPath();
    c.moveTo(x + S * 0.28, y - S * 0.62);
    c.lineTo(x + S * 0.38, y - S);
    c.lineTo(x + S * 0.48, y - S * 0.62);
    c.moveTo(x - S * 0.54, y - S * 0.3);
    c.lineTo(x - S * 0.1, y - S * 0.45);
    c.lineTo(x + S * 0.32, y - S * 0.3);
    c.fill();
  }

  function windmill(o, x, y, S, r) {
    const c = o.c;
    c.fillStyle = o.P("#e9e2d2");
    c.beginPath();
    c.moveTo(x - S * 0.16, y);
    c.lineTo(x - S * 0.09, y - S * 0.62);
    c.lineTo(x + S * 0.09, y - S * 0.62);
    c.lineTo(x + S * 0.16, y);
    c.fill();
    c.fillStyle = o.P("#6b4a3a");
    c.beginPath();
    c.arc(x, y - S * 0.62, S * 0.1, Math.PI, 0);
    c.fill();
    const a0 = o.t * 0.7 + r(8) * 6;
    c.strokeStyle = o.P("#bdb4a2");
    c.lineWidth = Math.max(1, S * 0.03);
    const hx = x, hy = y - S * 0.64;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2;
      const ex = hx + Math.cos(a) * S * 0.48, ey = hy + Math.sin(a) * S * 0.48;
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(ex, ey);
      c.stroke();
      c.save();
      c.globalAlpha *= 0.8;
      c.fillStyle = o.P("#d8cfbd");
      c.translate(hx, hy);
      c.rotate(a);
      c.fillRect(S * 0.1, 0, S * 0.36, S * 0.08);
      c.restore();
    }
  }

  function chalet(o, x, y, S, r) {
    const c = o.c, w = S * 1.2, h = S * 0.62;
    c.fillStyle = o.P("#f0ebe0");
    c.fillRect(x - w / 2, y - h * 0.4, w, h * 0.4);
    c.fillStyle = o.P("#a9774a");
    c.fillRect(x - w / 2, y - h, w, h * 0.6);
    c.fillStyle = o.P("#4d3528");
    c.beginPath();
    c.moveTo(x - w * 0.7, y - h + S * 0.02);
    c.lineTo(x, y - h - S * 0.32);
    c.lineTo(x + w * 0.7, y - h + S * 0.02);
    c.fill();
    c.fillStyle = windowLight(o, r(6) < 0.7);
    c.fillRect(x - w * 0.3, y - h * 0.85, w * 0.18, h * 0.22);
    c.fillRect(x + w * 0.12, y - h * 0.85, w * 0.18, h * 0.22);
  }

  function cabin(o, x, y, S, r, spec) {
    const c = o.c, w = S * 1.4, h = S * 0.55;
    c.fillStyle = o.P(spec.red ? "#a3342b" : "#7a5236");
    c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = o.P(spec.red ? "#eef3f8" : "#3d3d3d");
    c.beginPath();
    c.moveTo(x - w * 0.6, y - h);
    c.lineTo(x, y - h - S * 0.4);
    c.lineTo(x + w * 0.6, y - h);
    c.fill();
    c.fillStyle = windowLight(o, r(6) < 0.8);
    c.fillRect(x - w * 0.25, y - h * 0.7, w * 0.18, h * 0.32);
    c.fillRect(x + w * 0.1, y - h * 0.7, w * 0.18, h * 0.32);
    if (o.night > 0.3 && S > 8) {
      // chimney smoke
      c.fillStyle = o.P("#c8ccd4");
      for (let k = 0; k < 4; k++) {
        c.globalAlpha = 0.25 * (1 - k / 4);
        c.beginPath();
        c.arc(x + w * 0.25 + k * S * 0.12 + Math.sin(o.t + k) * S * 0.03, y - h - S * 0.45 - k * S * 0.18, S * (0.06 + k * 0.03), 0, 7);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  function sheep(o, x, y, S) {
    const c = o.c;
    c.fillStyle = o.P("#f1ede4");
    c.beginPath();
    c.ellipse(x, y - S * 0.55, S * 0.55, S * 0.35, 0, 0, 7);
    c.fill();
    c.fillStyle = o.P("#2d2a28");
    c.fillRect(x + S * 0.4, y - S * 0.75, S * 0.3, S * 0.25);
    c.fillRect(x - S * 0.3, y - S * 0.3, S * 0.08, S * 0.3);
    c.fillRect(x + S * 0.2, y - S * 0.3, S * 0.08, S * 0.3);
  }

  function cow(o, x, y, S, r) {
    const c = o.c;
    c.fillStyle = o.P(r(9) < 0.5 ? "#f3efe8" : "#6b4a33");
    c.fillRect(x - S * 0.6, y - S * 0.8, S * 1.1, S * 0.45);
    c.fillRect(x + S * 0.45, y - S * 0.95, S * 0.3, S * 0.3);
    c.fillStyle = o.P("#2d2a28");
    c.fillRect(x - S * 0.2, y - S * 0.75, S * 0.25, S * 0.2);
    c.fillRect(x - S * 0.55, y - S * 0.35, S * 0.1, S * 0.35);
    c.fillRect(x + S * 0.35, y - S * 0.35, S * 0.1, S * 0.35);
  }

  function rock(o, x, y, S, r, spec) {
    const c = o.c;
    c.fillStyle = o.P(r(2) < 0.5 ? "#7d7a74" : "#8b857a");
    c.beginPath();
    c.moveTo(x - S * 0.8, y);
    c.lineTo(x - S * 0.6, y - S * 0.6);
    c.lineTo(x - S * 0.1, y - S);
    c.lineTo(x + S * 0.5, y - S * 0.75);
    c.lineTo(x + S * 0.8, y);
    c.fill();
    c.fillStyle = o.P(spec.snowy ? "#f4f7fb" : "#a19a8e");
    c.beginPath();
    c.moveTo(x - S * 0.6, y - S * 0.6);
    c.lineTo(x - S * 0.1, y - S);
    c.lineTo(x + S * 0.5, y - S * 0.75);
    c.lineTo(x + S * 0.1, y - S * 0.6);
    c.fill();
  }

  function fence(o, x, y, S, r, spec, cellPx) {
    const c = o.c;
    c.fillStyle = o.P("#8a7356");
    c.fillRect(x - S * 0.05, y - S, S * 0.1, S);
    c.fillRect(x, y - S * 0.8, cellPx, S * 0.07);
    c.fillRect(x, y - S * 0.45, cellPx, S * 0.07);
  }

  function wall(o, x, y, S, r, spec, cellPx) {
    const c = o.c;
    c.fillStyle = o.P("#77787c");
    c.fillRect(x, y - S, cellPx + 1, S);
    c.fillStyle = o.P("#8e8f93");
    c.fillRect(x, y - S, cellPx + 1, S * 0.08);
    if (r(4) < 0.12) {
      const cols = ["#e5486f", "#3fb6d9", "#f2c14e", "#7ad16e", "#a36be0"];
      c.fillStyle = o.P(cols[Math.floor(r(5) * cols.length)]);
      c.beginPath();
      c.ellipse(x + cellPx * 0.5, y - S * 0.5, cellPx * 0.4, S * 0.3, 0, 0, 7);
      c.fill();
    }
  }

  function lamp(o, x, y, S, r) {
    const c = o.c;
    c.fillStyle = o.P("#3a3d44");
    c.fillRect(x - S * 0.02, y - S, S * 0.04, S);
    c.fillRect(x - S * 0.02, y - S, S * 0.22, S * 0.03);
    const lx = x + S * 0.18, ly = y - S * 0.95;
    if (o.night > 0.2) {
      SKY.glow(c, lx, ly, S * 0.5, [255, 200, 130], 0.35 * o.night);
      c.fillStyle = o.E("#ffe2b0", o.night);
    } else c.fillStyle = o.P("#d9d9d0");
    c.fillRect(lx - S * 0.05, ly - S * 0.02, S * 0.1, S * 0.04);
  }

  function grass(o, x, y, S, r) {
    const c = o.c;
    c.strokeStyle = o.P(r(2) < 0.5 ? "#8d9a55" : "#a0a560");
    c.lineWidth = Math.max(1, S * 0.05);
    c.beginPath();
    for (let k = -2; k <= 2; k++) {
      c.moveTo(x + k * S * 0.08, y);
      c.quadraticCurveTo(x + k * S * 0.1, y - S * 0.5, x + k * S * 0.25 + Math.sin(o.t * 1.5 + x * 0.01) * S * 0.08, y - S * (0.7 + r(k + 5) * 0.3));
    }
    c.stroke();
  }

  function hut(o, x, y, S, r) {
    const c = o.c;
    const cols = ["#e56b5d", "#5aa2d6", "#f2c14e", "#7cc6a4", "#f4f1ea", "#e89ac0"];
    c.fillStyle = o.P(cols[Math.floor(r(3) * cols.length)]);
    c.fillRect(x - S * 0.35, y - S * 0.75, S * 0.7, S * 0.75);
    c.fillStyle = o.P("#f4f1ea");
    c.beginPath();
    c.moveTo(x - S * 0.45, y - S * 0.75);
    c.lineTo(x, y - S);
    c.lineTo(x + S * 0.45, y - S * 0.75);
    c.fill();
  }

  function lighthouse(o, x, y, S) {
    const c = o.c;
    c.fillStyle = o.P("#f2f0ea");
    c.beginPath();
    c.moveTo(x - S * 0.1, y);
    c.lineTo(x - S * 0.06, y - S * 0.8);
    c.lineTo(x + S * 0.06, y - S * 0.8);
    c.lineTo(x + S * 0.1, y);
    c.fill();
    c.fillStyle = o.P("#c23b33");
    for (let k = 0; k < 3; k++) c.fillRect(x - S * 0.1 + k * S * 0.01, y - S * (0.2 + k * 0.24), S * 0.2 - k * S * 0.02, S * 0.1);
    c.fillStyle = o.P("#333");
    c.fillRect(x - S * 0.08, y - S * 0.92, S * 0.16, S * 0.12);
    if (o.night > 0.2) {
      const a = o.t * 0.9;
      const k = Math.abs(Math.cos(a));
      SKY.glow(c, x, y - S * 0.86, S * (0.4 + k * 0.6), [255, 240, 190], 0.6 * o.night);
      c.fillStyle = `rgba(255,240,200,${0.18 * o.night * k})`;
      const dir = Math.sin(a) > 0 ? 1 : -1;
      c.beginPath();
      c.moveTo(x, y - S * 0.86);
      c.lineTo(x + dir * S * 8, y - S * 0.86 - S * 0.5);
      c.lineTo(x + dir * S * 8, y - S * 0.86 + S * 0.5);
      c.fill();
    }
  }

  function boat(o, x, y, S, r) {
    const c = o.c;
    y += Math.sin(o.t * 1.2 + r(1) * 6) * S * 0.03;
    c.fillStyle = o.P(r(2) < 0.5 ? "#f4f1ea" : "#2d3b52");
    c.beginPath();
    c.moveTo(x - S * 0.5, y - S * 0.12);
    c.lineTo(x + S * 0.5, y - S * 0.12);
    c.lineTo(x + S * 0.35, y);
    c.lineTo(x - S * 0.4, y);
    c.fill();
    c.fillStyle = o.P("#fbf8f2");
    c.beginPath();
    c.moveTo(x, y - S * 0.15);
    c.lineTo(x, y - S);
    c.lineTo(x + S * 0.42, y - S * 0.18);
    c.fill();
    c.fillStyle = o.P(r(3) < 0.5 ? "#d6564a" : "#e9dfc8");
    c.beginPath();
    c.moveTo(x - S * 0.03, y - S * 0.18);
    c.lineTo(x - S * 0.03, y - S * 0.85);
    c.lineTo(x - S * 0.36, y - S * 0.18);
    c.fill();
    if (o.night > 0.3) {
      c.fillStyle = o.E("#ffe0a0", o.night);
      c.fillRect(x - 1, y - S - 2, 2, 2);
    }
  }

  function cactus(o, x, y, S, r) {
    const c = o.c;
    const w = S * 0.14;
    c.fillStyle = o.P("#4f7a45");
    const pill = (px, py, pw, ph) => {
      c.beginPath();
      c.roundRect ? c.roundRect(px, py, pw, ph, pw / 2) : c.rect(px, py, pw, ph);
      c.fill();
    };
    pill(x - w / 2, y - S, w, S);
    if (r(2) < 0.8) {
      pill(x - w * 2.2, y - S * 0.72, w * 0.8, S * 0.35);
      c.fillRect(x - w * 1.9, y - S * 0.45, w * 1.5, w * 0.7);
    }
    if (r(3) < 0.7) {
      pill(x + w * 1.4, y - S * 0.8, w * 0.8, S * 0.4);
      c.fillRect(x, y - S * 0.48, w * 1.8, w * 0.7);
    }
  }

  function scrub(o, x, y, S, r) {
    const c = o.c;
    c.fillStyle = o.P(r(1) < 0.5 ? "#8c8a55" : "#9a8c5e");
    c.beginPath();
    c.ellipse(x, y - S * 0.35, S * 0.7, S * 0.4, 0, 0, 7);
    c.fill();
  }

  // Future and alien things

  function crystal(o, x, y, S, r) {
    const c = o.c;
    const cols = ["#6ff7ff", "#ff7de9", "#b18bff", "#7dffb2"];
    const col = cols[Math.floor(r(4) * cols.length)];
    const lean = (r(5) - 0.5) * S * 0.3;
    const g = c.createLinearGradient(x, y - S, x, y);
    g.addColorStop(0, o.E(col, 0.55 + o.night * 0.45));
    g.addColorStop(1, o.P("#2a1f55"));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - S * 0.12, y);
    c.lineTo(x - S * 0.1 + lean * 0.8, y - S * 0.8);
    c.lineTo(x + lean, y - S);
    c.lineTo(x + S * 0.1 + lean * 0.8, y - S * 0.8);
    c.lineTo(x + S * 0.12, y);
    c.fill();
    c.strokeStyle = o.E("#ffffff", 0.35 + o.night * 0.4);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + lean, y - S);
    c.lineTo(x + lean * 0.3, y);
    c.stroke();
    if (o.night > 0.3 && S > 6) SKY.glow(c, x + lean * 0.7, y - S * 0.6, S * 0.6, U.hex(col), 0.25 * o.night);
  }

  function arch(o, x, y, S) {
    const c = o.c;
    c.strokeStyle = o.P("#4b3b7c");
    c.lineWidth = S * 0.12;
    c.beginPath();
    c.moveTo(x - S * 0.5, y);
    c.lineTo(x - S * 0.5, y - S * 0.5);
    c.arc(x, y - S * 0.5, S * 0.5, Math.PI, 0);
    c.lineTo(x + S * 0.5, y);
    c.stroke();
    c.fillStyle = o.E("#9ff8ff", 0.4 + 0.6 * o.night);
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k / 6) * Math.PI;
      c.fillRect(x + Math.cos(a) * S * 0.5 - 1, y - S * 0.5 + Math.sin(a) * S * 0.5 - 1, 2.5, 2.5);
    }
  }

  function shroom(o, x, y, S, r) {
    const c = o.c;
    const cols = ["#58f0ff", "#ff6fd8", "#a58bff", "#7dffb2"];
    const col = cols[Math.floor(r(4) * cols.length)];
    const bend = (r(5) - 0.5) * S * 0.3;
    c.strokeStyle = o.P("#d7e9ff");
    c.lineWidth = Math.max(1, S * 0.07);
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + bend, y - S * 0.5, x + bend * 0.5, y - S * 0.85);
    c.stroke();
    const cx = x + bend * 0.5, cy = y - S * 0.85;
    if (o.night > 0.2) SKY.glow(c, cx, cy, S * 0.7, U.hex(col), 0.3 * o.night);
    c.fillStyle = o.E(col, 0.5 + 0.5 * o.night);
    c.beginPath();
    c.ellipse(cx, cy, S * 0.35, S * 0.16, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = o.E("#ffffff", 0.3 + 0.4 * o.night);
    c.fillRect(cx - S * 0.3, cy - 1, S * 0.6, Math.max(1, S * 0.02));
  }

  function glowplant(o, x, y, S, r) {
    const c = o.c;
    c.strokeStyle = o.P("#2f6a70");
    c.lineWidth = 1;
    c.fillStyle = o.E(r(3) < 0.5 ? "#3cffc8" : "#6fb8ff", 0.4 + 0.6 * o.night);
    for (let k = 0; k < 3; k++) {
      const ex = x + (k - 1) * S * 0.2 + Math.sin(o.t + x * 0.02 + k) * S * 0.05, ey = y - S * (0.6 + r(k + 5) * 0.4);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x, ey + S * 0.2, ex, ey);
      c.stroke();
      c.beginPath();
      c.arc(ex, ey, Math.max(1, S * 0.07), 0, 7);
      c.fill();
    }
  }

  const KINDS = {
    pine: (o, x, y, S, r) => pine(o, x, y, S, r, false),
    snowpine: (o, x, y, S, r) => pine(o, x, y, S, r, true),
    tree, poplar, bush, house, barn, church, windmill, chalet, cabin, sheep, cow, rock, fence, wall, lamp,
    grass, hut, lighthouse, boat, cactus, scrub, crystal, arch, shroom, glowplant,
  };

  window.OBJECTS = { KINDS, rvar: (i, seed) => (k) => hash(i * 31 + k, seed + 999) };
})();
