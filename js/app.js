// The ride: simulation of the train, the overlays, settings, sleep timer and start screen.
(function () {
  "use strict";
  const { clamp, lerp, fbm, hash } = U;
  const { BIOMES, ROUTES } = WORLD;

  const TIMES = { dawn: ["Dawn", 6.5], day: ["Day", 12.5], dusk: ["Dusk", 18.6], night: ["Night", 23.2], cycle: ["Day & night cycle", null], local: ["Match my clock", null] };
  const WEATHERS = {
    auto: ["Changing", null],
    clear: ["Clear", { cloud: 0.05 }],
    cloudy: ["Cloudy", { cloud: 0.8 }],
    rain: ["Rain", { cloud: 0.85, rain: 0.7 }],
    storm: ["Thunderstorm", { cloud: 1, rain: 1, storm: 1 }],
    snow: ["Snow", { cloud: 0.7, snow: 0.8 }],
    fog: ["Fog", { cloud: 0.35, fog: 0.85 }],
  };
  const PACES = { gentle: ["Gentle", 0.6], normal: ["Normal", 1], express: ["Express", 1.45] };
  const OVERLAYS = { speed: "Speed", map: "Map", weather: "Weather & temperature", train: "Train information", clock: "Clock" };

  const DEFAULTS = {
    route: "countryside",
    time: "dusk",
    weather: "auto",
    view: "window",
    overlays: { speed: true, map: true, weather: true, train: true, clock: false },
    hideAll: false,
    units: "metric",
    pace: "normal",
    stops: true,
    announcements: true,
    reflections: true,
    levels: { master: 0.8, train: 0.8, weather: 0.7, music: 0 },
  };

  const store = {
    load() {
      try {
        const s = JSON.parse(localStorage.getItem("slumberline") || "{}");
        return { ...DEFAULTS, ...s, overlays: { ...DEFAULTS.overlays, ...(s.overlays || {}) }, levels: { ...DEFAULTS.levels, ...(s.levels || {}) } };
      } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULTS));
      }
    },
    save(s) {
      try {
        localStorage.setItem("slumberline", JSON.stringify(s));
      } catch (e) {}
    },
  };

  const settings = store.load();
  if (!ROUTES[settings.route]) settings.route = "countryside";
  if (!VIEWS[settings.view]) settings.view = "window";

  const $ = (sel) => document.querySelector(sel);
  const canvas = $("#scene");
  const ctx = canvas.getContext("2d");
  const scenery = new Scenery();
  const interior = new Interior();
  const audio = new TrainAudio();

  const ride = {
    d: 0, v: 0, t: 0, hour: 18.6, dwell: 0, atStation: null, boarded: false, paused: false,
    elapsed: 0, announced: {}, horned: {}, bump: 0,
    w: { cloud: 0.1, rain: 0, snow: 0, fog: 0, storm: 0, flash: 0 },
    wTarget: { cloud: 0.1, rain: 0, snow: 0, fog: 0, storm: 0 },
    wNext: 0, wName: "clear",
  };

  // ---------- helpers ----------

  const biomeNow = () => BIOMES[WORLD.biomeIdAt(settings.route, ride.d)];
  const future = () => !!biomeNow().future;
  const shownFactor = () => biomeNow().speedShown || 1;
  const cruise = () => ((biomeNow().cruise || 100) / 3.6) * PACES[settings.pace][1];

  function fmtSpeed(ms) {
    const kmh = ms * 3.6 * shownFactor();
    return settings.units === "metric" ? [Math.round(kmh), "km/h"] : [Math.round(kmh * 0.621371), "mph"];
  }
  function fmtDist(m) {
    const km = (m * shownFactor()) / 1000;
    if (settings.units === "metric") return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString()} km`;
    const mi = km * 0.621371;
    return mi < 0.2 ? `${Math.round(mi * 5280)} ft` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()} mi`;
  }
  function fmtTemp(c) {
    return settings.units === "metric" ? `${Math.round(c)}°C` : `${Math.round(c * 1.8 + 32)}°F`;
  }
  function fmtClock(h) {
    const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
    const d = new Date(2000, 0, 1, hh, mm);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  }
  function localHour() {
    const n = new Date();
    return n.getHours() + n.getMinutes() / 60 + n.getSeconds() / 3600;
  }

  function trainNumber() {
    const r = settings.route;
    const n = Math.floor(hash(r.length * 13 + r.charCodeAt(0), 3) * 90) + 10;
    return `${"1259"[r.length % 4]}${"KSAPNMWE"[r.charCodeAt(1) % 8]}${n}`;
  }

  // ---------- journey ----------

  function startJourney() {
    ride.d = 0;
    ride.elapsed = 0;
    ride.announced = {};
    ride.horned = {};
    interior.drops = [];
    const first = WORLD.station(settings.route, 0);
    const route = WORLD.routeInfo(settings.route);
    if (settings.stops) {
      ride.v = 0;
      ride.atStation = first;
      ride.dwell = 7;
    } else {
      ride.v = cruise();
      ride.atStation = null;
    }
    ride.hour = TIMES[settings.time][1] ?? (settings.time === "local" ? localHour() : ride.hour);
    pickWeather(true);
    toast(`Welcome aboard ${route.train[0]}`, `Departing ${first.name}`);
  }

  function pickWeather(immediate) {
    const b = biomeNow();
    let name = settings.weather;
    if (b.space) name = "clear";
    else if (name === "auto") {
      const pool = Object.entries(b.weather);
      const total = pool.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * total;
      name = pool[0][0];
      for (const [k, w] of pool) {
        if ((r -= w) <= 0) {
          name = k;
          break;
        }
      }
      ride.wNext = ride.elapsed + 360 + Math.random() * 480;
    }
    ride.wName = name;
    const target = { cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0, ...WEATHERS[name][1] };
    ride.wTarget = target;
    if (immediate) Object.assign(ride.w, target);
  }

  function simulate(dt) {
    ride.t += dt;
    if (!ride.boarded) {
      // The start screen still shows the view, drifting slowly.
      ride.v = lerp(ride.v, 12, dt * 0.5);
      ride.d += ride.v * dt;
      advanceClock(dt);
      return;
    }
    ride.elapsed += dt;
    const prevD = ride.d;
    const target = cruise();
    const accel = 0.45, brake = 0.55;

    if (ride.atStation) {
      ride.v = 0;
      ride.dwell -= dt;
      if (ride.dwell <= 0) {
        const st = ride.atStation;
        ride.atStation = null;
        if (settings.announcements) toast(`Departing ${st.name}`, "Doors closing");
        audio.horn(future());
      }
    } else {
      let want = target;
      const next = WORLD.nextStation(settings.route, ride.d);
      const dist = next.pos - ride.d;
      if (settings.stops) {
        const stopV = Math.sqrt(2 * brake * Math.max(0, dist - 0.5));
        want = Math.min(want, Math.max(stopV, dist > 2 ? 1.2 : 0));
        if (dist < 1.5 && ride.v < 1.5) {
          ride.d = next.pos;
          ride.v = 0;
          ride.atStation = next;
          ride.dwell = 40;
          if (settings.announcements) toast(`This is ${next.name}`, "Doors open. Please mind the gap.");
          audio.chime(future());
        }
      }
      if (!ride.atStation) {
        if (ride.v < want) ride.v = Math.min(want, ride.v + accel * dt);
        else ride.v = Math.max(want, ride.v - brake * 1.2 * dt);
        ride.d += ride.v * dt;
      }
      // Announce the next station about a minute and a half out.
      const lead = Math.max(1200, ride.v * 90);
      if (dist < lead && !ride.announced[next.i] && settings.announcements) {
        ride.announced[next.i] = true;
        if (settings.stops) toast(`Next stop: ${next.name}`, `Arriving in about ${Math.max(1, Math.round(dist / Math.max(ride.v, 5) / 60 + 0.5))} min`);
        else toast(`Passing through ${next.name}`, "This train does not stop");
        audio.chime(future());
      }
      // Sound the horn before tunnels.
      for (const tn of WORLD.tunnelsNear(settings.route, ride.d, 400)) {
        const k = Math.round(tn.a);
        if (tn.a - ride.d < 250 && tn.a - ride.d > 0 && !ride.horned[k]) {
          ride.horned[k] = true;
          audio.horn(future());
        }
      }
    }

    // Wheels over rail joints: two bogies of two axles each per 25 m rail.
    if (!biomeNow().maglev && ride.v > 0.3 && dt < 0.2) {
      const rail = 25;
      for (const off of [0, 2.5, 17, 19.5]) {
        if (Math.floor((ride.d - off) / rail) !== Math.floor((prevD - off) / rail)) {
          audio.clack(clamp(0.25 + ride.v / 30, 0.2, 1) * (0.8 + Math.random() * 0.25));
          ride.bump = 0.9;
        }
      }
    }
    ride.bump *= Math.exp(-dt * 14);

    advanceClock(dt);
    advanceWeather(dt);
  }

  function advanceClock(dt) {
    if (settings.time === "cycle") ride.hour = (ride.hour + dt * (24 / (48 * 60))) % 24;
    else if (settings.time === "local") ride.hour = localHour();
    else ride.hour = lerp(ride.hour, TIMES[settings.time][1], clamp(dt * 0.6, 0, 1));
  }

  function advanceWeather(dt) {
    if (settings.weather === "auto" && ride.elapsed > ride.wNext) pickWeather(false);
    const k = clamp(dt / 25, 0, 1);
    for (const key of ["cloud", "rain", "snow", "fog", "storm"]) ride.w[key] += (ride.wTarget[key] - ride.w[key]) * k;
    // Lightning
    const tunnel = WORLD.inTunnel(settings.route, ride.d);
    if (ride.w.storm > 0.5 && !tunnel && Math.random() < dt / 11) {
      ride.w.flash = 1;
      ride.w.boltX = 0.1 + Math.random() * 0.8;
      audio.thunder(0.4 + Math.random() * 2.5);
    }
    ride.w.flash = Math.max(0, ride.w.flash - dt * (ride.w.flash > 0.6 ? 1.2 : 3));
  }

  // ---------- rendering ----------

  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    scenery.lit.clear();
    scenery.patterns.clear();
  }
  window.addEventListener("resize", resize);

  let frameAvg = 16;
  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const clim = WORLD.climate(settings.route, ride.d, ride.hour, ride.w, ride.t);
    const S = {
      W, H, d: ride.d, t: ride.t, v: ride.v, hour: ride.hour, routeId: settings.route, weather: ride.w,
      view: settings.view, future: future(), space: !!biomeNow().space, reflections: settings.reflections,
      bump: ride.bump, frost: clim.temp !== undefined && clim.temp < 0 ? clamp(-clim.temp / 18, 0, 0.8) : 0,
    };
    // Seats further from the glass see the same landscape, framed smaller in their windows.
    const holes = interior.holes(settings.view, W, H, Math.min(W, H));
    let env;
    if (holes.length) {
      const y0 = Math.min(...holes.map((h) => h.y)), y1 = Math.max(...holes.map((h) => h.y + h.h));
      const k = clamp((y1 - y0) / (H * 0.72), 0.55, 1);
      ctx.save();
      ctx.translate(0, y0 - H * 0.06 * k);
      ctx.scale(k, k);
      env = scenery.render(ctx, { ...S, W: W / k });
      ctx.restore();
    } else env = scenery.render(ctx, S);
    interior.render(ctx, S, env, dt);
    ride.env = env;
    ride.clim = clim;
  }

  let last = performance.now();
  let hudTimer = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!ride.paused) {
      simulate(dt);
      draw(dt);
      // Keep it smooth on slower devices by lowering resolution.
      frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
      if (frameAvg > 26 && dpr > 0.75) {
        dpr = Math.max(0.75, dpr - 0.25);
        resize();
        frameAvg = 16;
      }
      hudTimer -= dt;
      if (hudTimer <= 0 && ride.boarded) {
        hudTimer = 0.25;
        updateHud();
      }
      audio.update({
        v: ride.v, maglev: !!biomeNow().maglev, space: !!biomeNow().space, tunnel: !!WORLD.inTunnel(settings.route, ride.d),
        rain: ride.w.rain, storm: ride.w.storm,
      });
      audio.tickMusic();
      tickSleep();
    }
    requestAnimationFrame(frame);
  }

  // While the tab is hidden (screen off, another window), keep the ride and its sound going.
  // Browsers slow timers in background tabs, so step by the real time that has passed.
  let hiddenLast = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - hiddenLast) / 1000);
    hiddenLast = now;
    if (!document.hidden || !ride.boarded || ride.paused) return;
    simulate(dt);
    audio.update({ v: ride.v, maglev: !!biomeNow().maglev, space: !!biomeNow().space, tunnel: !!WORLD.inTunnel(settings.route, ride.d), rain: ride.w.rain, storm: ride.w.storm });
    audio.tickMusic();
    tickSleep();
  }, 100);

  // ---------- HUD ----------

  const ICONS = {
    clear: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    cloudy: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    storm: '<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7a3.5 3.5 0 0 0 1 7z"/><path d="M12 14l-2 4h3l-2 4"/>',
    snow: '<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7a3.5 3.5 0 0 0 1 7z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"/>',
    fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
    space: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

  function currentWeatherName() {
    const w = ride.w;
    if (biomeNow().space) return "space";
    if (w.storm > 0.5) return "storm";
    if (w.snow > 0.3) return "snow";
    if (w.rain > 0.3) return "rain";
    if (w.fog > 0.4) return "fog";
    if (w.cloud > 0.5) return "cloudy";
    return "clear";
  }

  const WEATHER_WORDS = { clear: "Clear", cloudy: "Overcast", rain: "Rain", storm: "Thunderstorm", snow: "Snow", fog: "Fog", space: "Hard vacuum" };

  function elevation() {
    const id = WORLD.biomeIdAt(settings.route, ride.d);
    const n = fbm(ride.d / 5000, 17, 3);
    const m = { countryside: [60, 140], mountains: [900, 1300], city: [20, 40], coast: [4, 20], forest: [300, 400], desert: [700, 500], tundra: [200, 300] }[id];
    if (m) {
      const e = m[0] + m[1] * n;
      return settings.units === "metric" ? `Elevation ${Math.round(e).toLocaleString()} m` : `Elevation ${Math.round(e * 3.281).toLocaleString()} ft`;
    }
    if (id === "neon") return `Skyway level ${Math.round(180 + n * 120)}`;
    if (id === "celestial") return `Gliding ${Math.round(40 + n * 60)} m above the Veil`;
    return settings.units === "metric" ? "Altitude 400 km" : "Altitude 249 mi";
  }

  function updateHud() {
    const hide = settings.hideAll;
    const show = (id, on) => $(id).classList.toggle("off", hide || !on);
    show("#hud-speed", settings.overlays.speed);
    show("#hud-map", settings.overlays.map);
    show("#hud-weather", settings.overlays.weather || settings.overlays.clock);
    show("#hud-train", settings.overlays.train);
    $("#hud-weather .wx").classList.toggle("gone", !settings.overlays.weather);
    $("#hud-weather .clock").classList.toggle("gone", !settings.overlays.clock);

    // speed
    const [sv, su] = fmtSpeed(ride.v);
    $("#spd-value").textContent = sv;
    $("#spd-unit").textContent = su;
    const maxShown = cruise() * 1.1;
    $("#spd-bar").style.width = `${clamp(ride.v / maxShown, 0, 1) * 100}%`;
    $("#spd-sub").textContent = ride.atStation ? `Stopped at ${ride.atStation.name} · doors open` : elevation();

    // weather
    const clim = ride.clim || {};
    const wn = currentWeatherName();
    const isNight = ride.env && ride.env.night > 0.6;
    $("#wx-icon").innerHTML = icon(wn === "clear" && isNight ? "moon" : wn);
    if (clim.space) {
      $("#wx-temp").textContent = settings.units === "metric" ? "−270°C" : "−454°F";
      $("#wx-desc").textContent = "Outside: hard vacuum";
      $("#wx-more").textContent = "Cabin 21°C · 1 atm · radiation shield on";
    } else {
      $("#wx-temp").textContent = fmtTemp(clim.temp);
      $("#wx-desc").textContent = (wn === "clear" && isNight ? "Clear night" : WEATHER_WORDS[wn]) + (future() ? " · " + (biomeNow().sky === "alien" ? "air 1.2 atm" : "smog index low") : "");
      const wind = settings.units === "metric" ? `${Math.round(clim.wind)} km/h` : `${Math.round(clim.wind * 0.621)} mph`;
      $("#wx-more").textContent = `Wind ${wind} · Humidity ${Math.round(clim.humidity)}%`;
    }
    $("#clock-scene").textContent = fmtClock(ride.hour);
    $("#clock-local").textContent = settings.time === "local" ? "" : `Your time ${fmtClock(localHour())}`;

    // train
    const route = WORLD.routeInfo(settings.route);
    const [tname, operator, loco, consist] = route.train;
    $("#tr-name").textContent = tname;
    $("#tr-op").textContent = `${operator} · Train ${trainNumber()}`;
    $("#tr-loco").textContent = loco;
    $("#tr-consist").textContent = consist;
    const seat = 20 + Math.floor(hash(settings.route.length, 4) * 40);
    $("#tr-seat").textContent = `Coach ${"ABCDEFG"[settings.route.length % 7]} · Seat ${seat} · ${VIEWS[settings.view]}`;
    const next = WORLD.nextStation(settings.route, ride.d + (ride.atStation ? 1 : 0));
    const dist = next.pos - ride.d;
    const eta = ride.v > 1 ? dist / ride.v : dist / cruise();
    $("#tr-next").textContent = `${settings.stops ? "Next stop" : "Next station"}: ${next.name}`;
    $("#tr-eta").textContent = `${fmtDist(dist)} · about ${Math.max(1, Math.round(eta / 60))} min`;
    $("#tr-trip").textContent = `Travelled ${fmtDist(ride.d)} in ${fmtDuration(ride.elapsed)} · ${route.name}`;

    drawMap();
  }

  // Route map: the track is a gentle random curve; stations and tunnels are marked on it.
  const path = { xs: [0], ys: [0], hs: [0], step: 60 };
  function pathTo(d) {
    while ((path.xs.length - 1) * path.step < d + 8000) {
      const i = path.xs.length;
      const h = (fbm((i * path.step) / 7000, 11 + settings.route.length, 3) - 0.5) * 7;
      path.hs.push(h);
      path.xs.push(path.xs[i - 1] + Math.cos(h) * path.step);
      path.ys.push(path.ys[i - 1] + Math.sin(h) * path.step);
    }
  }
  function pathAt(d) {
    const f = Math.max(0, d) / path.step, i = Math.floor(f), k = f - i;
    return [lerp(path.xs[i], path.xs[i + 1], k), lerp(path.ys[i], path.ys[i + 1], k), path.hs[i + 1]];
  }
  function resetPath() {
    path.xs = [0];
    path.ys = [0];
    path.hs = [0];
  }

  function drawMap() {
    if (settings.hideAll || !settings.overlays.map) return;
    const cv = $("#map");
    const cw = cv.clientWidth, ch = cv.clientHeight;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(cw * r)) {
      cv.width = Math.round(cw * r);
      cv.height = Math.round(ch * r);
    }
    const c = cv.getContext("2d");
    c.setTransform(r, 0, 0, r, 0, 0);
    c.clearRect(0, 0, cw, ch);
    pathTo(ride.d);
    const range = 3500; // metres of track shown each side
    const scale = Math.min(cw, ch) / (range * 1.4);
    const [px, py, heading] = pathAt(ride.d);
    const X = (x) => cw / 2 + (x - px) * scale, Y = (y) => ch / 2 + (y - py) * scale;
    const b = biomeNow();
    const land = { countryside: "#1f3a24", mountains: "#2a3a36", city: "#262a33", coast: "#1c3448", forest: "#18301f", desert: "#4a3522", tundra: "#34404c", neon: "#1b1430", celestial: "#211a40", orbital: "#05070d" }[WORLD.biomeIdAt(settings.route, ride.d)];
    c.fillStyle = land;
    c.fillRect(0, 0, cw, ch);
    // contour-like texture
    c.strokeStyle = "rgba(255,255,255,0.05)";
    c.lineWidth = 1;
    for (let k = 0; k < 8; k++) {
      c.beginPath();
      for (let x = 0; x <= cw; x += 8) {
        const y = (k / 8) * ch * 1.2 + Math.sin((x + px * scale) / 40 + k) * 8 - ((py * scale) % (ch / 8));
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    if (WORLD.biomeIdAt(settings.route, ride.d) === "coast") {
      c.fillStyle = "#15405e";
      c.beginPath();
      const [, , h] = pathAt(ride.d);
      c.save();
      c.translate(cw / 2, ch / 2);
      c.rotate(h);
      c.fillRect(-cw, 8, cw * 2, ch);
      c.restore();
    }
    const from = Math.max(0, ride.d - range * 1.3), to = ride.d + range * 1.3;
    const line = (a, bb, style, width) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      for (let m = a; m <= bb; m += path.step / 2) {
        const [x, y] = pathAt(m);
        m === a ? c.moveTo(X(x), Y(y)) : c.lineTo(X(x), Y(y));
      }
      c.stroke();
    };
    c.lineCap = "round";
    line(from, to, "rgba(0,0,0,0.45)", 5);
    line(from, ride.d, "rgba(255,255,255,0.35)", 2.5);
    line(ride.d, to, future() ? "#7ee8ff" : "#f2c98a", 2.5);
    for (const tn of WORLD.tunnelsNear(settings.route, ride.d, range * 1.3)) {
      c.setLineDash([3, 3]);
      line(Math.max(from, tn.a), Math.min(to, tn.b), "rgba(10,10,12,0.9)", 4);
      c.setLineDash([]);
    }
    // stations
    c.font = '600 10px "Avenir Next", "Segoe UI", system-ui, sans-serif';
    c.textBaseline = "middle";
    let st = WORLD.prevStation(settings.route, ride.d);
    for (let k = 0; k < 4; k++) {
      if (st.pos > to) break;
      if (st.pos >= from) {
        const [x, y] = pathAt(st.pos);
        c.fillStyle = "#fff";
        c.strokeStyle = "rgba(0,0,0,0.6)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(X(x), Y(y), 3.5, 0, 7);
        c.stroke();
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.shadowColor = "rgba(0,0,0,0.8)";
        c.shadowBlur = 3;
        c.fillText(st.name, X(x) + 7, Y(y));
        c.shadowBlur = 0;
      }
      st = WORLD.station(settings.route, st.i + 1);
    }
    // train marker
    c.save();
    c.translate(cw / 2, ch / 2);
    c.rotate(heading);
    const pulse = 5 + (Math.sin(ride.t * 3) + 1) * 2;
    c.fillStyle = "rgba(255,255,255,0.18)";
    c.beginPath();
    c.arc(0, 0, pulse + 3, 0, 7);
    c.fill();
    c.fillStyle = future() ? "#7ee8ff" : "#ffcf7a";
    c.strokeStyle = "#1a1a1a";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(8, 0);
    c.lineTo(-5, -5);
    c.lineTo(-2, 0);
    c.lineTo(-5, 5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    // north arrow and scale
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.font = '700 10px "Avenir Next", system-ui, sans-serif';
    c.textAlign = "center";
    c.fillText("N", cw - 12, 12);
    c.beginPath();
    c.moveTo(cw - 12, 18);
    c.lineTo(cw - 15, 26);
    c.lineTo(cw - 9, 26);
    c.fill();
    c.textAlign = "left";
    const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const unitM = settings.units === "metric" ? 1000 : 1609.34;
    const want = (cw * 0.3) / scale; // metres of sim track
    const shownUnits = (want * shownFactor()) / unitM;
    const pick = nice.reduce((a, n) => (n <= shownUnits ? n : a), nice[0]);
    const barPx = ((pick * unitM) / shownFactor()) * scale;
    c.strokeStyle = "rgba(255,255,255,0.8)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(10, ch - 10);
    c.lineTo(10 + barPx, ch - 10);
    c.moveTo(10, ch - 13);
    c.lineTo(10, ch - 7);
    c.moveTo(10 + barPx, ch - 13);
    c.lineTo(10 + barPx, ch - 7);
    c.stroke();
    c.fillText(`${pick} ${settings.units === "metric" ? "km" : "mi"}`, 14 + barPx, ch - 10);
    $("#map-foot").textContent = b.name + (WORLD.inTunnel(settings.route, ride.d) ? " · in a tunnel" : "");
  }

  // ---------- announcements ----------

  let toastTimer = null;
  function toast(title, sub) {
    if (!ride.boarded) return;
    const el = $("#toast");
    el.querySelector(".t1").textContent = title;
    el.querySelector(".t2").textContent = sub || "";
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 6000);
  }

  // ---------- sleep timer ----------

  const sleep = { end: 0, total: 0 };
  function setSleep(min) {
    sleep.total = min * 60;
    sleep.end = min ? performance.now() + min * 60000 : 0;
    audio.setFade(1);
    $("#dim").style.opacity = 0;
    renderSleepButtons();
    if (min) toast("Sleep timer set", `The sound fades and the screen dims over the last few minutes of ${min}.`);
  }
  function tickSleep() {
    if (!sleep.end) return;
    const left = (sleep.end - performance.now()) / 1000;
    const fadeLen = Math.min(300, sleep.total / 3);
    const f = clamp(left / fadeLen, 0, 1);
    audio.setFade(f);
    $("#dim").style.opacity = (1 - f) * 0.92;
    $("#sleep-left").textContent = left > 0 ? `${Math.ceil(left / 60)} min` : "";
    if (left <= 0) {
      sleep.end = 0;
      ride.paused = true;
      audio.suspend();
      $("#dim").style.opacity = 0.97;
      $("#goodnight").classList.add("show");
      releaseWake();
    }
  }
  function wakeUp() {
    if (!ride.paused) return;
    ride.paused = false;
    last = performance.now();
    $("#goodnight").classList.remove("show");
    $("#dim").style.opacity = 0;
    audio.setFade(1);
    audio.start();
    requestWake();
    renderSleepButtons();
  }

  // ---------- screen wake lock ----------

  let wakeLock = null;
  async function requestWake() {
    try {
      if ("wakeLock" in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) {}
  }
  function releaseWake() {
    try {
      if (wakeLock) wakeLock.release();
    } catch (e) {}
    wakeLock = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ride.boarded && !ride.paused) requestWake();
    last = performance.now();
  });

  // ---------- settings panel ----------

  function save() {
    store.save(settings);
  }

  function segmented(container, options, current, onPick) {
    container.innerHTML = "";
    for (const [key, label] of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.className = key === current ? "on" : "";
      b.setAttribute("aria-pressed", key === current);
      b.addEventListener("click", () => onPick(key));
      container.appendChild(b);
    }
  }

  const thumbs = {};
  function routeThumb(id, w, h) {
    const key = `${id}:${settings.time}:${w}`;
    if (thumbs[key]) return thumbs[key];
    const cv = document.createElement("canvas");
    const r = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * r;
    cv.height = h * r;
    const c = cv.getContext("2d");
    c.setTransform(r, 0, 0, r, 0, 0);
    const sc = new Scenery();
    const routeId = id;
    const d = id === "tour" ? 2200 : 2600 + (id.length * 431) % 2000;
    const hour = TIMES[settings.time][1] ?? 18.6;
    const b = BIOMES[WORLD.biomeIdAt(routeId, d)];
    const weather = { cloud: 0.15, rain: 0, snow: 0, fog: 0, storm: 0, flash: 0 };
    sc.render(c, { W: w, H: h, d, t: 40, v: 0, hour, routeId, weather });
    thumbs[key] = cv.toDataURL("image/jpeg", 0.82);
    return thumbs[key];
  }

  function routeCards(container, onPick, size) {
    container.innerHTML = "";
    const groups = [["On Earth", ["countryside", "mountains", "city", "coast", "forest", "desert", "tundra", "tour"]], ["The future", ["neon", "celestial", "orbital"]]];
    for (const [title, ids] of groups) {
      const h = document.createElement("h4");
      h.textContent = title;
      container.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "routes";
      for (const id of ids) {
        const info = WORLD.routeInfo(id);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "route" + (id === settings.route ? " on" : "") + (info.future ? " future" : "");
        b.innerHTML = `<img alt="" src="${routeThumb(id, size[0], size[1])}"><span class="rn"></span><span class="rb"></span>`;
        b.querySelector(".rn").textContent = info.name;
        b.querySelector(".rb").textContent = info.blurb;
        b.addEventListener("click", () => onPick(id));
        grid.appendChild(b);
      }
      container.appendChild(grid);
    }
  }

  function renderSettings() {
    routeCards($("#set-route"), (id) => {
      if (id !== settings.route) {
        settings.route = id;
        resetPath();
        startJourney();
        save();
        renderSettings();
      }
    }, [200, 112]);
    segmented($("#set-time"), Object.entries(TIMES).map(([k, v]) => [k, v[0]]), settings.time, (k) => {
      settings.time = k;
      if (k === "local") ride.hour = localHour();
      save();
      renderSettings();
    });
    segmented($("#set-weather"), Object.entries(WEATHERS).map(([k, v]) => [k, v[0]]), settings.weather, (k) => {
      settings.weather = k;
      pickWeather(false);
      save();
      renderSettings();
    });
    segmented($("#set-view"), Object.entries(VIEWS), settings.view, (k) => {
      settings.view = k;
      save();
      renderSettings();
    });
    segmented($("#set-pace"), Object.entries(PACES).map(([k, v]) => [k, v[0]]), settings.pace, (k) => {
      settings.pace = k;
      save();
      renderSettings();
    });
    segmented($("#set-units"), [["metric", "Metric"], ["imperial", "Imperial"]], settings.units, (k) => {
      settings.units = k;
      save();
      renderSettings();
      updateHud();
    });
    const ov = $("#set-overlays");
    ov.innerHTML = "";
    const toggles = [
      ...Object.entries(OVERLAYS).map(([k, label]) => [label, () => settings.overlays[k], (v) => (settings.overlays[k] = v)]),
      ["Station announcements", () => settings.announcements, (v) => (settings.announcements = v)],
    ];
    for (const [label, get, set] of toggles) ov.appendChild(toggle(label, get(), set));
    const jr = $("#set-journey");
    jr.innerHTML = "";
    jr.appendChild(toggle("Stop at stations", settings.stops, (v) => (settings.stops = v)));
    jr.appendChild(toggle("Reflections on the glass at night", settings.reflections, (v) => (settings.reflections = v)));
    const snd = $("#set-sound");
    snd.innerHTML = "";
    for (const [k, label] of [["master", "Volume"], ["train", "Train"], ["weather", "Rain & thunder"], ["music", "Soft music"]]) {
      const row = document.createElement("label");
      row.className = "slider";
      row.innerHTML = `<span></span><input type="range" min="0" max="1" step="0.01">`;
      row.querySelector("span").textContent = label;
      const input = row.querySelector("input");
      input.value = settings.levels[k];
      input.addEventListener("input", () => {
        settings.levels[k] = +input.value;
        audio.levels = settings.levels;
        audio.applyLevels();
        save();
      });
      snd.appendChild(row);
    }
    renderSleepButtons();
  }

  function toggle(label, value, set) {
    const row = document.createElement("label");
    row.className = "toggle";
    row.innerHTML = `<span></span><input type="checkbox" role="switch"><i></i>`;
    row.querySelector("span").textContent = label;
    const input = row.querySelector("input");
    input.checked = value;
    input.addEventListener("change", () => {
      set(input.checked);
      save();
      updateHud();
    });
    return row;
  }

  function renderSleepButtons() {
    const current = sleep.end ? Math.round(sleep.total / 60) : 0;
    segmented($("#set-sleep"), [[0, "Off"], [15, "15 min"], [30, "30 min"], [60, "1 hour"], [90, "90 min"], [120, "2 hours"]], current, (k) => setSleep(+k));
    $("#btn-sleep").classList.toggle("active", !!sleep.end);
  }

  function openSettings(open) {
    const el = $("#settings");
    const willOpen = open ?? !el.classList.contains("open");
    el.classList.toggle("open", willOpen);
    el.setAttribute("aria-hidden", !willOpen);
    if (willOpen) renderSettings();
  }

  // ---------- controls ----------

  function cycle(list, current) {
    const keys = Object.keys(list);
    return keys[(keys.indexOf(current) + 1) % keys.length];
  }

  function setView(v) {
    settings.view = v;
    toast(VIEWS[v]);
    save();
  }
  function setTime(k) {
    settings.time = k;
    if (k === "local") ride.hour = localHour();
    toast(TIMES[k][0]);
    save();
  }
  function setWeather(k) {
    settings.weather = k;
    pickWeather(false);
    toast(WEATHERS[k][0], k === "auto" ? "The weather changes as you travel" : "");
    save();
  }
  function toggleOverlays() {
    settings.hideAll = !settings.hideAll;
    save();
    updateHud();
    $("#btn-hide").classList.toggle("active", settings.hideAll);
  }
  function toggleMute() {
    const muted = settings.levels.master > 0;
    settings.levels._prev = muted ? settings.levels.master : settings.levels._prev;
    settings.levels.master = muted ? 0 : settings.levels._prev || 0.8;
    audio.levels = settings.levels;
    audio.applyLevels();
    $("#btn-mute").classList.toggle("active", muted);
    save();
  }
  function fullscreen() {
    const d = document;
    if (!d.fullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen || (() => {})).call(d.documentElement);
    else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  }
  function postcard() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `slumber-line-${settings.route}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    toast("Postcard saved");
  }

  const actions = {
    settings: () => openSettings(),
    view: () => setView(cycle(VIEWS, settings.view)),
    time: () => setTime(cycle(TIMES, settings.time)),
    weather: () => setWeather(cycle(WEATHERS, settings.weather)),
    hide: toggleOverlays,
    mute: toggleMute,
    fullscreen,
    postcard,
    sleep: () => {
      openSettings(true);
      $("#set-sleep").scrollIntoView({ behavior: "smooth", block: "center" });
    },
  };
  document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    actions[b.dataset.act]();
  }));
  $("#settings-close").addEventListener("click", () => openSettings(false));

  window.addEventListener("keydown", (e) => {
    if (!ride.boarded || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.tagName === "INPUT" && e.target.type === "range") return;
    wakeUp();
    const k = e.key.toLowerCase();
    const map = { s: "settings", v: "view", t: "time", w: "weather", h: "hide", m: "mute", f: "fullscreen", p: "postcard" };
    if (k === "escape") openSettings(false);
    else if (map[k]) {
      actions[map[k]]();
      e.preventDefault();
    }
    poke();
  });

  // Controls fade away when you stop moving the mouse.
  let idle = null;
  function poke() {
    document.body.classList.remove("idle");
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!$("#settings").classList.contains("open")) document.body.classList.add("idle");
    }, 3500);
  }
  ["mousemove", "pointerdown", "touchstart"].forEach((ev) => window.addEventListener(ev, () => {
    if (!ride.boarded) return;
    wakeUp();
    poke();
  }, { passive: true }));

  // ---------- start screen ----------

  function renderStart() {
    routeCards($("#start-routes"), (id) => {
      settings.route = id;
      resetPath();
      ride.d = 0;
      save();
      renderStart();
    }, [240, 135]);
    segmented($("#start-time"), Object.entries(TIMES).filter(([k]) => k !== "cycle").map(([k, v]) => [k, v[0]]), settings.time, (k) => {
      settings.time = k;
      save();
      renderStart();
    });
    segmented($("#start-view"), Object.entries(VIEWS), settings.view, (k) => {
      settings.view = k;
      save();
      renderStart();
    });
  }

  $("#board").addEventListener("click", () => {
    $("#start").classList.add("gone");
    document.body.classList.add("boarded");
    ride.boarded = true;
    audio.levels = settings.levels;
    audio.start();
    audio.applyLevels();
    resetPath();
    startJourney();
    requestWake();
    updateHud();
    poke();
    $("#btn-hide").classList.toggle("active", settings.hideAll);
  });

  $("#goodnight").addEventListener("click", wakeUp);

  // For testing from the console: slumber.ride.d = 12000 jumps along the line.
  window.slumber = { ride, settings };

  // ---------- go ----------
  resize();
  ride.hour = TIMES[settings.time][1] ?? localHour();
  pickWeather(true);
  ride.w = { ...ride.w, cloud: 0.15, rain: 0, snow: 0, fog: 0, storm: 0 };
  ride.d = 1800;
  renderStart();
  requestAnimationFrame(frame);
})();
