// The carriage around the window: six views, raindrops on the glass and night-time reflections.
(function () {
  "use strict";
  const { hash, clamp, hex, mix, rgb } = U;

  const VIEWS = {
    window: "Window seat",
    compartment: "Compartment",
    dining: "Dining car",
    sleeper: "Sleeper berth",
    dome: "Observation dome",
    open: "Scenery only",
  };

  const CLASSIC = {
    wall: "#d8c9ad", wall2: "#b89f7c", frame: "#6b4228", frameHi: "#9a6a44", curtain: "#7a2f3a",
    seat: "#6d2a33", cloth: "#efe8d8", table: "#7a4a2c", tableTop: "#946038", metal: "#b9a37a",
  };
  const FUTURE = {
    wall: "#e8edf2", wall2: "#c9d3de", frame: "#aeb9c7", frameHi: "#f4f7fa", curtain: "#dbe3ec",
    seat: "#2c3344", cloth: "#dfe6ee", table: "#cfd8e2", tableTop: "#eef2f6", metal: "#9fb0c2", glow: "#35e0ff",
  };

  class Interior {
    constructor() {
      this.drops = [];
      this.beads = null;
    }

    // Interior light: daylight through the windows plus warm lamps after dark or in tunnels.
    lighting(env) {
      const day = ((env.light[0] + env.light[1] + env.light[2]) / 3) * (1 - env.tunnel * 0.95);
      const lamp = clamp(1.15 - day * 1.6, 0, 1);
      return { day, lamp };
    }

    shade(col, L, k = 1) {
      const c = hex(col);
      const amb = 0.18 + 0.72 * L.day;
      const warm = [1, 0.8, 0.58];
      return rgb([0, 1, 2].map((i) => c[i] * (amb + L.lamp * 0.55 * warm[i]) * k));
    }

    render(ctx, S, env, dt) {
      const { W, H } = S;
      const view = S.view;
      const pal = S.future ? FUTURE : CLASSIC;
      const L = this.lighting(env);
      const I = (c, k) => this.shade(c, L, k);
      const R = Math.min(W, H);
      const holes = this.holes(view, W, H, R);

      if (holes.length) {
        ctx.save();
        ctx.beginPath();
        for (const h of holes) this.round(ctx, h);
        ctx.clip();
        this.glass(ctx, S, env, L, dt, holes);
        ctx.restore();
      } else this.glass(ctx, S, env, L, dt, [{ x: 0, y: 0, w: W, h: H, r: 0 }]);

      ctx.save();
      const sway = S.v > 0.5 ? Math.sin(S.t * 1.7 + 0.4) * 0.6 : 0;
      ctx.translate(0, sway);
      switch (view) {
        case "window":
          this.windowSeat(ctx, W, H, R, holes, pal, I, L, S);
          break;
        case "compartment":
          this.compartment(ctx, W, H, R, holes, pal, I, L, S);
          break;
        case "dining":
          this.dining(ctx, W, H, R, holes, pal, I, L, S);
          break;
        case "sleeper":
          this.sleeper(ctx, W, H, R, holes, pal, I, L, S);
          break;
        case "dome":
          this.dome(ctx, W, H, R, pal, I, L, S);
          break;
      }
      ctx.restore();
      this.vignette(ctx, W, H, view);
    }

    holes(view, W, H, R) {
      const r = R * 0.045;
      switch (view) {
        case "window":
          return [{ x: W * 0.08, y: H * 0.07, w: W * 0.84, h: H * 0.7, r }];
        case "compartment":
          return [
            { x: W * 0.05, y: H * 0.15, w: W * 0.4, h: H * 0.45, r },
            { x: W * 0.55, y: H * 0.15, w: W * 0.4, h: H * 0.45, r },
          ];
        case "dining":
          return [
            { x: W * 0.06, y: H * 0.08, w: W * 0.43, h: H * 0.55, r: r * 0.7 },
            { x: W * 0.51, y: H * 0.08, w: W * 0.43, h: H * 0.55, r: r * 0.7 },
          ];
        case "sleeper":
          return [{ x: W * 0.2, y: H * 0.1, w: W * 0.6, h: H * 0.44, r: r * 1.4 }];
        default:
          return [];
      }
    }

    round(ctx, h) {
      if (ctx.roundRect) ctx.roundRect(h.x, h.y, h.w, h.h, h.r);
      else ctx.rect(h.x, h.y, h.w, h.h);
    }

    // Wall with window openings cut out of it.
    wall(ctx, W, H, holes, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.rect(-5, -5, W + 10, H + 10);
      for (const h of holes) this.round(ctx, h);
      ctx.fill("evenodd");
    }

    frames(ctx, holes, R, pal, I, S) {
      for (const h of holes) {
        ctx.lineWidth = R * 0.022;
        ctx.strokeStyle = I(pal.frame);
        ctx.beginPath();
        this.round(ctx, h);
        ctx.stroke();
        ctx.lineWidth = R * 0.004;
        ctx.strokeStyle = I(pal.frameHi);
        ctx.beginPath();
        this.round(ctx, { x: h.x - R * 0.008, y: h.y - R * 0.008, w: h.w + R * 0.016, h: h.h + R * 0.016, r: h.r + R * 0.008 });
        ctx.stroke();
        if (S.future) {
          ctx.strokeStyle = rgb(hex(pal.glow), 0.5);
          ctx.lineWidth = R * 0.003;
          ctx.beginPath();
          this.round(ctx, { x: h.x - R * 0.014, y: h.y - R * 0.014, w: h.w + R * 0.028, h: h.h + R * 0.028, r: h.r + R * 0.014 });
          ctx.stroke();
        }
      }
    }

    windowSeat(ctx, W, H, R, holes, pal, I, L, S) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, I(pal.wall, 0.9));
      g.addColorStop(0.75, I(pal.wall));
      g.addColorStop(1, I(pal.wall2));
      this.wall(ctx, W, H, holes, g);
      const h = holes[0];
      if (!S.future) {
        // top-light bar of an old carriage window
        ctx.fillStyle = I(pal.frame);
        ctx.fillRect(h.x, h.y + h.h * 0.2, h.w, R * 0.012);
      }
      this.frames(ctx, holes, R, pal, I, S);
      if (S.future) {
        ctx.fillStyle = rgb(hex(pal.glow), 0.25 + L.lamp * 0.4);
        ctx.fillRect(0, H * 0.025, W, R * 0.006);
      } else {
        this.curtain(ctx, 0, W * 0.13, H * 0.8, 1, pal, I, S);
        this.curtain(ctx, W, W * 0.13, H * 0.8, -1, pal, I, S);
      }
      // table
      const ty = H * 0.775;
      ctx.fillStyle = I(pal.tableTop);
      ctx.beginPath();
      ctx.moveTo(W * 0.1, ty);
      ctx.lineTo(W * 0.9, ty);
      ctx.lineTo(W, ty + H * 0.05);
      ctx.lineTo(0, ty + H * 0.05);
      ctx.fill();
      ctx.fillStyle = I(pal.table, 0.8);
      ctx.fillRect(0, ty + H * 0.05, W, H * 0.03);
      ctx.fillStyle = I(pal.wall2, 0.7);
      ctx.fillRect(0, ty + H * 0.08, W, H);
      this.cup(ctx, W * 0.72, ty + H * 0.028, R * 0.05, pal, I, L, S);
      this.book(ctx, W * 0.26, ty + H * 0.03, R * 0.1, pal, I, S);
    }

    curtain(ctx, x0, w, h, dir, pal, I, S) {
      ctx.save();
      const g = ctx.createLinearGradient(x0, 0, x0 + dir * w, 0);
      g.addColorStop(0, I(pal.curtain, 0.7));
      g.addColorStop(1, I(pal.curtain, 1.05));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + dir * w, 0);
      ctx.quadraticCurveTo(x0 + dir * w * 0.45, h * 0.42, x0 + dir * w * 0.42, h * 0.5);
      ctx.quadraticCurveTo(x0 + dir * w * 0.5, h * 0.62, x0 + dir * w * 0.75, h);
      ctx.lineTo(x0, h);
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = w * 0.06;
      for (let k = 1; k < 5; k++) {
        const fx = x0 + dir * w * (k / 5) * 0.9;
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.quadraticCurveTo(x0 + dir * w * 0.4 * (k / 5), h * 0.5, fx * 0.6 + (x0 + dir * w * 0.7) * 0.4, h);
        ctx.stroke();
      }
      // tie-back
      ctx.fillStyle = I("#c9a24a");
      ctx.fillRect(Math.min(x0, x0 + dir * w * 0.6), h * 0.48, w * 0.6, h * 0.025);
      ctx.restore();
    }

    cup(ctx, x, y, r, pal, I, L, S) {
      ctx.fillStyle = I("#f4f1ea");
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r * 0.35, 0, 0, 7);
      ctx.fill();
      if (S.future) {
        // a tall glass with something glowing in it
        ctx.fillStyle = "rgba(200,240,255,0.25)";
        ctx.fillRect(x - r * 0.45, y - r * 1.9, r * 0.9, r * 1.9);
        ctx.fillStyle = "rgba(60,220,255,0.75)";
        ctx.fillRect(x - r * 0.42, y - r * 1.2, r * 0.84, r * 1.15);
        SKY.glow(ctx, x, y - r * 0.8, r * 2, [60, 220, 255], 0.25);
        return;
      }
      ctx.fillStyle = I("#ffffff");
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 1.1);
      ctx.lineTo(x + r * 0.8, y - r * 1.1);
      ctx.quadraticCurveTo(x + r * 0.75, y - r * 0.1, x, y - r * 0.05);
      ctx.quadraticCurveTo(x - r * 0.75, y - r * 0.1, x - r * 0.8, y - r * 1.1);
      ctx.fill();
      ctx.strokeStyle = I("#ffffff");
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(x + r * 0.85, y - r * 0.7, r * 0.28, -1.2, 1.4);
      ctx.stroke();
      ctx.fillStyle = I("#8a4a22");
      ctx.beginPath();
      ctx.ellipse(x, y - r * 1.1, r * 0.78, r * 0.16, 0, 0, 7);
      ctx.fill();
      // steam
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + L.lamp * 0.1})`;
      ctx.lineWidth = r * 0.12;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const bx = x + (k - 1) * r * 0.35;
        ctx.moveTo(bx, y - r * 1.2);
        for (let j = 1; j <= 8; j++) {
          ctx.lineTo(bx + Math.sin(S.t * 1.3 + j * 0.8 + k * 2) * r * 0.18 * (j / 4), y - r * 1.2 - j * r * 0.28);
        }
        ctx.stroke();
      }
    }

    book(ctx, x, y, w, pal, I, S) {
      ctx.fillStyle = I(S.future ? "#1a2230" : "#2f4a3a");
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y);
      ctx.lineTo(x + w * 0.45, y);
      ctx.lineTo(x + w * 0.55, y - w * 0.12);
      ctx.lineTo(x - w * 0.4, y - w * 0.12);
      ctx.fill();
      if (S.future) {
        ctx.fillStyle = "rgba(90,220,255,0.55)";
        ctx.beginPath();
        ctx.moveTo(x - w * 0.45, y - w * 0.02);
        ctx.lineTo(x + w * 0.42, y - w * 0.02);
        ctx.lineTo(x + w * 0.5, y - w * 0.1);
        ctx.lineTo(x - w * 0.37, y - w * 0.1);
        ctx.fill();
        return;
      }
      ctx.fillStyle = I("#efe6d0");
      ctx.fillRect(x - w * 0.48, y - w * 0.035, w * 0.9, w * 0.03);
      ctx.fillStyle = I("#a33");
      ctx.fillRect(x + w * 0.1, y, w * 0.03, w * 0.12);
    }

    compartment(ctx, W, H, R, holes, pal, I, L, S) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, I(pal.wall, 0.85));
      g.addColorStop(1, I(pal.wall2));
      this.wall(ctx, W, H, holes, g);
      this.frames(ctx, holes, R, pal, I, S);
      // ceiling light strip
      ctx.fillStyle = L.lamp > 0.1 ? `rgba(255,228,180,${0.4 + L.lamp * 0.5})` : I("#f1ece2");
      ctx.fillRect(W * 0.1, 0, W * 0.8, H * 0.02);
      // luggage rack with a suitcase
      ctx.strokeStyle = I(pal.metal);
      ctx.lineWidth = R * 0.006;
      ctx.beginPath();
      for (const yy of [H * 0.085, H * 0.1]) {
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
      }
      ctx.stroke();
      ctx.fillStyle = I(S.future ? "#8a96a8" : "#6b4a2e");
      ctx.fillRect(W * 0.12, H * 0.035, W * 0.16, H * 0.05);
      ctx.fillStyle = I(S.future ? "#5a6a80" : "#c9a24a");
      ctx.fillRect(W * 0.19, H * 0.03, W * 0.02, H * 0.008);
      // wall sconce between the windows
      const lx = W * 0.5, ly = H * 0.3;
      ctx.fillStyle = I(pal.metal);
      ctx.fillRect(lx - R * 0.008, ly, R * 0.016, R * 0.05);
      if (L.lamp > 0.05) SKY.glow(ctx, lx, ly, R * 0.15, [255, 215, 150], 0.5 * L.lamp);
      ctx.fillStyle = L.lamp > 0.05 ? `rgba(255,236,200,${0.6 + L.lamp * 0.4})` : I("#f4efe6");
      ctx.beginPath();
      ctx.arc(lx, ly, R * 0.018, 0, 7);
      ctx.fill();
      // small tables under each window
      for (const h of holes) {
        ctx.fillStyle = I(pal.tableTop);
        ctx.fillRect(h.x + h.w * 0.2, h.y + h.h + H * 0.03, h.w * 0.6, H * 0.025);
        ctx.fillStyle = I(pal.table, 0.8);
        ctx.fillRect(h.x + h.w * 0.2, h.y + h.h + H * 0.055, h.w * 0.6, H * 0.012);
      }
      // seat backs in the foreground
      for (const [x0, x1] of [[W * -0.02, W * 0.4], [W * 0.6, W * 1.02]]) {
        const top = H * 0.62;
        const sg = ctx.createLinearGradient(0, top, 0, H);
        sg.addColorStop(0, I(pal.seat, 1.1));
        sg.addColorStop(1, I(pal.seat, 0.6));
        ctx.fillStyle = sg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x0, top, x1 - x0, H - top + 20, [R * 0.08, R * 0.08, 0, 0]);
        else ctx.rect(x0, top, x1 - x0, H - top + 20);
        ctx.fill();
        ctx.fillStyle = I(pal.cloth);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x0 + (x1 - x0) * 0.2, top + H * 0.015, (x1 - x0) * 0.6, H * 0.09, R * 0.02);
        else ctx.rect(x0 + (x1 - x0) * 0.2, top + H * 0.015, (x1 - x0) * 0.6, H * 0.09);
        ctx.fill();
        // piping
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 + R * 0.04, top + H * 0.16);
        ctx.lineTo(x1 - R * 0.04, top + H * 0.16);
        ctx.stroke();
      }
      // aisle floor between the seats
      ctx.fillStyle = I(S.future ? "#a8b4c4" : "#5a3a2e", 0.7);
      ctx.fillRect(W * 0.4, H * 0.85, W * 0.2, H * 0.15);
    }

    dining(ctx, W, H, R, holes, pal, I, L, S) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, I(S.future ? pal.wall : "#6b4a33", 0.9));
      g.addColorStop(1, I(S.future ? pal.wall2 : "#4a3021"));
      this.wall(ctx, W, H, holes, g);
      this.frames(ctx, holes, R, pal, I, S);
      if (!S.future) {
        ctx.fillStyle = I("#c9a24a", 0.9);
        ctx.fillRect(0, H * 0.035, W, R * 0.006);
      }
      // tablecloth
      const ty = H * 0.66;
      ctx.fillStyle = I("#f7f4ee");
      ctx.beginPath();
      ctx.moveTo(W * 0.12, ty);
      ctx.lineTo(W * 0.88, ty);
      ctx.lineTo(W * 1.05, H * 0.82);
      ctx.lineTo(W * -0.05, H * 0.82);
      ctx.fill();
      ctx.fillStyle = I("#e4ded2");
      ctx.fillRect(0, H * 0.82, W, H * 0.2);
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = R * 0.01;
      for (let k = 1; k < 8; k++) {
        ctx.beginPath();
        ctx.moveTo((W * k) / 8, H * 0.82);
        ctx.lineTo((W * k) / 8 + R * 0.01, H);
        ctx.stroke();
      }
      // plates, glasses, vase, lamp
      for (const px of [0.28, 0.72]) {
        ctx.fillStyle = I("#ffffff");
        ctx.beginPath();
        ctx.ellipse(W * px, H * 0.745, R * 0.11, R * 0.03, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = I("#c9a24a");
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(W * px, H * 0.745, R * 0.085, R * 0.022, 0, 0, 7);
        ctx.stroke();
        ctx.fillStyle = I("#b9b2a6");
        ctx.fillRect(W * px - R * 0.15, H * 0.735, R * 0.006, R * 0.05);
        ctx.fillRect(W * px + R * 0.145, H * 0.735, R * 0.006, R * 0.05);
      }
      for (const gx of [0.38, 0.62]) {
        const x = W * gx, y = H * 0.72, r = R * 0.02;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - r * 1.8);
        ctx.moveTo(x - r * 0.7, y);
        ctx.lineTo(x + r * 0.7, y);
        ctx.stroke();
        ctx.fillStyle = S.future ? "rgba(60,220,255,0.6)" : "rgba(140,20,40,0.75)";
        ctx.beginPath();
        ctx.moveTo(x - r * 0.9, y - r * 3.4);
        ctx.quadraticCurveTo(x, y - r * 1.2, x + r * 0.9, y - r * 3.4);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.moveTo(x - r * 0.9, y - r * 4.2);
        ctx.quadraticCurveTo(x - r, y - r * 1.6, x, y - r * 1.8);
        ctx.quadraticCurveTo(x + r, y - r * 1.6, x + r * 0.9, y - r * 4.2);
        ctx.stroke();
      }
      // table lamp
      const lx = W * 0.5, base = H * 0.7;
      ctx.fillStyle = I("#c9a24a");
      ctx.fillRect(lx - R * 0.004, base - R * 0.13, R * 0.008, R * 0.13);
      ctx.beginPath();
      ctx.ellipse(lx, base, R * 0.03, R * 0.008, 0, 0, 7);
      ctx.fill();
      const shadeY = base - R * 0.2;
      SKY.glow(ctx, lx, shadeY + R * 0.06, R * 0.35, [255, 200, 130], 0.25 + 0.35 * L.lamp);
      ctx.fillStyle = L.lamp > 0.05 ? `rgba(255,${190 + L.lamp * 40},${130 + L.lamp * 40},1)` : I("#f0d7b0");
      ctx.beginPath();
      ctx.moveTo(lx - R * 0.03, shadeY);
      ctx.lineTo(lx + R * 0.03, shadeY);
      ctx.lineTo(lx + R * 0.055, shadeY + R * 0.075);
      ctx.lineTo(lx - R * 0.055, shadeY + R * 0.075);
      ctx.fill();
      // bud vase
      const vx = W * 0.56;
      ctx.fillStyle = "rgba(220,240,255,0.5)";
      ctx.fillRect(vx - R * 0.006, H * 0.7 - R * 0.06, R * 0.012, R * 0.06);
      ctx.strokeStyle = I("#3f6b2f");
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(vx, H * 0.7 - R * 0.06);
      ctx.lineTo(vx + R * 0.004, H * 0.7 - R * 0.11);
      ctx.stroke();
      ctx.fillStyle = I(S.future ? "#8a7bff" : "#c2233a");
      ctx.beginPath();
      ctx.arc(vx + R * 0.004, H * 0.7 - R * 0.115, R * 0.01, 0, 7);
      ctx.fill();
    }

    sleeper(ctx, W, H, R, holes, pal, I, L, S) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, I(S.future ? pal.wall2 : "#5a3d2b", 0.8));
      g.addColorStop(1, I(S.future ? pal.wall2 : "#3e2a1e", 0.8));
      this.wall(ctx, W, H, holes, g);
      const h = holes[0];
      // blind, part way down
      ctx.save();
      ctx.beginPath();
      this.round(ctx, h);
      ctx.clip();
      const by = h.y + h.h * 0.22;
      ctx.fillStyle = I(S.future ? "#cdd6e0" : "#d9c9a8", 0.85);
      ctx.fillRect(h.x, h.y, h.w, by - h.y);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      for (let yy = h.y + 6; yy < by; yy += 8) {
        ctx.beginPath();
        ctx.moveTo(h.x, yy);
        ctx.lineTo(h.x + h.w, yy);
        ctx.stroke();
      }
      ctx.fillStyle = I(pal.frame);
      ctx.fillRect(h.x, by - 4, h.w, 6);
      ctx.fillRect(h.x + h.w / 2 - R * 0.015, by, R * 0.03, R * 0.02);
      ctx.restore();
      this.frames(ctx, holes, R, pal, I, S);
      // reading lamp
      const lx = W * 0.88, ly = H * 0.28;
      ctx.fillStyle = I(pal.metal);
      ctx.fillRect(lx - R * 0.004, ly, R * 0.008, R * 0.06);
      SKY.glow(ctx, lx, ly, R * 0.2, [255, 200, 140], 0.2 + 0.4 * L.lamp);
      ctx.fillStyle = `rgba(255,${200 + L.lamp * 30},150,${0.5 + L.lamp * 0.5})`;
      ctx.beginPath();
      ctx.arc(lx, ly, R * 0.016, 0, 7);
      ctx.fill();
      // bed with pillow and blanket
      const bedTop = H * 0.64;
      ctx.fillStyle = I("#f1ede4", 0.95);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(W * 0.04, bedTop - H * 0.07, W * 0.26, H * 0.12, R * 0.04);
      else ctx.rect(W * 0.04, bedTop - H * 0.07, W * 0.26, H * 0.12);
      ctx.fill();
      const bg = ctx.createLinearGradient(0, bedTop, 0, H);
      const blanket = S.future ? "#3a4a66" : "#2f4a6b";
      bg.addColorStop(0, I(blanket, 1.1));
      bg.addColorStop(1, I(blanket, 0.55));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(0, bedTop + H * 0.02);
      ctx.bezierCurveTo(W * 0.3, bedTop - H * 0.03, W * 0.6, bedTop + H * 0.05, W, bedTop);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = R * 0.008;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.15 + k * 0.22), bedTop + H * 0.06);
        ctx.quadraticCurveTo(W * (0.25 + k * 0.22), bedTop + H * 0.18, W * (0.2 + k * 0.2), H);
        ctx.stroke();
      }
      // fold of white sheet
      ctx.fillStyle = I("#f4f1ea", 0.9);
      ctx.beginPath();
      ctx.moveTo(0, bedTop + H * 0.02);
      ctx.bezierCurveTo(W * 0.3, bedTop - H * 0.03, W * 0.6, bedTop + H * 0.05, W, bedTop);
      ctx.lineTo(W, bedTop + H * 0.025);
      ctx.bezierCurveTo(W * 0.6, bedTop + H * 0.075, W * 0.3, bedTop, 0, bedTop + H * 0.045);
      ctx.fill();
    }

    dome(ctx, W, H, R, pal, I, L, S) {
      // glass roof ribs curving overhead
      ctx.strokeStyle = I(pal.frame, 0.8);
      ctx.lineWidth = R * 0.018;
      ctx.beginPath();
      ctx.moveTo(-W * 0.1, H * 0.2);
      ctx.quadraticCurveTo(W * 0.5, -H * 0.12, W * 1.1, H * 0.2);
      ctx.stroke();
      ctx.lineWidth = R * 0.01;
      for (let k = 0; k < 5; k++) {
        const x = W * (0.1 + k * 0.2);
        ctx.beginPath();
        ctx.moveTo(x, H * 0.82);
        ctx.quadraticCurveTo(x + (x - W / 2) * 0.1, H * 0.3, x + (x - W / 2) * 0.25, -10);
        ctx.stroke();
      }
      // top edge of the roof
      ctx.fillStyle = I(pal.frame, 0.7);
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(W + 10, -10);
      ctx.lineTo(W + 10, H * 0.12);
      ctx.quadraticCurveTo(W * 0.5, -H * 0.18, -10, H * 0.12);
      ctx.fill();
      // low wall, brass rail and seat backs
      ctx.fillStyle = I(S.future ? pal.wall2 : "#5a3a28", 0.8);
      ctx.fillRect(0, H * 0.82, W, H * 0.2);
      ctx.fillStyle = I(pal.metal);
      ctx.fillRect(0, H * 0.815, W, R * 0.008);
      for (let k = 0; k < 4; k++) {
        const x = W * (0.06 + k * 0.25);
        ctx.fillStyle = I(pal.seat, 0.9);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, H * 0.86, W * 0.18, H * 0.2, R * 0.05);
        else ctx.rect(x, H * 0.86, W * 0.18, H * 0.2);
        ctx.fill();
      }
    }

    // Everything seen through the glass: drops, frost and reflections.
    glass(ctx, S, env, L, dt, holes) {
      const { W, H, t, weather: w } = S;
      const rain = S.space ? 0 : clamp(w.rain + w.storm * 0.8, 0, 1) * (1 - env.tunnel);
      // spawn and move drops
      const rate = rain * 45;
      this.acc = (this.acc || 0) + rate * dt;
      while (this.acc > 1) {
        this.acc -= 1;
        if (this.drops.length < 260) this.drops.push({ x: Math.random() * W * 1.1, y: Math.random() * H, r: 1 + Math.random() * 2.6, k: Math.random() });
      }
      const moving = clamp(S.v / 25, 0, 1.6);
      for (const dr of this.drops) {
        dr.vx = -(8 + moving * 180) * (0.4 + dr.r / 4);
        dr.vy = 12 + dr.r * 10 + (1 - Math.min(1, moving)) * 30;
        dr.x += dr.vx * dt;
        dr.y += dr.vy * dt * (0.4 + dr.k);
      }
      this.drops = this.drops.filter((dr) => dr.x > -20 && dr.y < H + 20);
      if (this.drops.length) {
        ctx.lineCap = "round";
        for (const dr of this.drops) {
          const tx = dr.x - dr.vx * 0.09, ty = dr.y - dr.vy * 0.09;
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.lineWidth = dr.r * 0.7;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(dr.x, dr.y);
          ctx.stroke();
          ctx.fillStyle = "rgba(20,30,45,0.28)";
          ctx.beginPath();
          ctx.arc(dr.x, dr.y, dr.r, 0, 7);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.fillRect(dr.x - dr.r * 0.4, dr.y - dr.r * 0.5, dr.r * 0.5, dr.r * 0.4);
        }
        ctx.lineCap = "butt";
      }
      // tiny beads that stay on the glass while it rains
      if (rain > 0.05) {
        ctx.fillStyle = `rgba(230,240,255,${0.18 * rain})`;
        for (let k = 0; k < 160; k++) ctx.fillRect(hash(k, 1) * W, hash(k, 2) * H, 1.4, 1.4);
      }
      // frost creeping in from the corners in the cold
      const cold = S.frost || 0;
      if (cold > 0.02) {
        for (const h of holes) {
          const g = ctx.createRadialGradient(h.x + h.w / 2, h.y + h.h / 2, Math.min(h.w, h.h) * 0.35, h.x + h.w / 2, h.y + h.h / 2, Math.max(h.w, h.h) * 0.75);
          g.addColorStop(0, "rgba(235,245,255,0)");
          g.addColorStop(1, `rgba(235,245,255,${0.45 * cold})`);
          ctx.fillStyle = g;
          ctx.fillRect(h.x, h.y, h.w, h.h);
        }
      }
      // At night and in tunnels the glass reflects the lit carriage.
      const refl = clamp(env.night * 0.1 + env.tunnel * 0.22, 0, 0.3) * (S.view === "open" ? 0.2 : 1) * (S.reflections ? 1 : 0);
      if (refl > 0.01) {
        for (const h of holes) {
          const g = ctx.createLinearGradient(0, h.y, 0, h.y + h.h);
          g.addColorStop(0, `rgba(255,210,150,${refl * 0.6})`);
          g.addColorStop(1, `rgba(255,190,120,${refl})`);
          ctx.fillStyle = g;
          ctx.fillRect(h.x, h.y, h.w, h.h);
          SKY.glow(ctx, h.x + h.w * 0.2, h.y + h.h * 0.15, Math.min(h.w, h.h) * 0.25, [255, 220, 170], refl * 1.6);
        }
      }
    }

    vignette(ctx, W, H, view) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${view === "open" || view === "dome" ? 0.35 : 0.25})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  window.Interior = Interior;
  window.VIEWS = VIEWS;
})();
