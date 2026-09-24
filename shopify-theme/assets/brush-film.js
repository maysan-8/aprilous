/* ==========================================================
   APRILOUS — brush "film"
   A looping, canvas-drawn product animation in four scenes:
   wash → spin dry → UV-C → ready. Behaves like a video player
   (progress segments, play/pause, timecode) but weighs ~10KB.
   ========================================================== */
(function () {
  const canvas = document.getElementById("brushFilm");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = 400, H = 440;
  const SCENE = 3.8;
  const SCENES = [
    { title: "ניקוי בסחרור", speed: 15, flare: 3, water: 1, uv: 0 },
    { title: "ייבוש עדין ושקט", speed: 30, flare: 9, water: 0, uv: 0 },
    { title: "חיטוי UV-C · 99%", speed: 3, flare: 1, water: 0, uv: 1 },
    { title: "נקייה, רכה, מוכנה ✨", speed: 1.4, flare: 0, water: 0, uv: 0 },
  ];
  // scene titles can be overridden from the theme editor
  try {
    JSON.parse(canvas.dataset.titles || "[]").forEach((title, i) => { if (title && SCENES[i]) SCENES[i].title = title; });
  } catch (_) {}
  const TOTAL = SCENE * SCENES.length;

  const player = canvas.closest(".player") || document;
  const caption = player.querySelector(".player-caption");
  const titleEl = caption && caption.querySelector(".step-title");
  const noEl = caption && caption.querySelector(".step-no");
  const timeEl = player.querySelector(".film-time");
  const segs = [...player.querySelectorAll(".segments button")];
  const playBtn = player.querySelector(".play-btn");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BRUSHES = [
    { x: 138, top: 84, w: 17, len: 58, col: ["#e9a9b6", "#fbe1e6", "#d68b9c"], off: 0.0 },
    { x: 262, top: 92, w: 17, len: 54, col: ["#c8b0f5", "#efe6ff", "#a88bea"], off: 2.1 },
    { x: 200, top: 50, w: 24, len: 70, col: ["#e9a9b6", "#fde7ec", "#cf8395"], off: 4.2 },
  ];
  const GERMS = Array.from({ length: 9 }, (_, i) => ({
    x: 110 + ((i * 47) % 180),
    y: 232 + ((i * 29) % 80),
    r: 5 + (i % 3) * 1.6,
    ph: i * 1.7,
    pop: 0.08 + (i / 9) * 0.6,
  }));

  let bubbles = [], drops = [], sparks = [];
  let t = 0, last = performance.now(), playing = !reduced, visible = true;
  let phase = 0, curScene = -1;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const rand = (a, b) => a + Math.random() * (b - a);
  const mix = (c1, c2, k) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(",")})`;
  };

  function sceneState() {
    const i = Math.floor(t / SCENE) % SCENES.length;
    const local = t - i * SCENE;
    const k = smooth((local - (SCENE - 0.9)) / 0.9);
    const a = SCENES[i], b = SCENES[(i + 1) % SCENES.length];
    const s = { i, local, k };
    for (const key of ["speed", "flare", "water", "uv"]) s[key] = lerp(a[key], b[key], k);
    // makeup residue on the bristles: dirty at loop start, washed off during scene 0
    s.dirt = i === 0 ? 1 - smooth(local / (SCENE * 0.85)) : i === 3 ? k : 0;
    // germs: alive in 0–1, popped one by one in 2, fade back in at loop end
    s.germs = i < 2 ? 1 : i === 3 ? k : null;
    s.uvLocal = i === 2 ? local / SCENE : 0;
    return s;
  }

  /* ---------- geometry ---------- */
  function bowlPath() {
    ctx.beginPath();
    ctx.moveTo(72, 192);
    ctx.bezierCurveTo(72, 300, 120, 348, 200, 348);
    ctx.bezierCurveTo(280, 348, 328, 300, 328, 192);
    ctx.ellipse(200, 192, 128, 22, 0, 0, Math.PI, true);
    ctx.closePath();
  }

  function drawBackground(s) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, mix("#fff5f7", "#f1e8ff", s.uv * 0.8));
    g.addColorStop(1, mix("#f6e9ff", "#e3d2ff", s.uv));
    ctx.fillStyle = g;
    ctx.fillRect(-50, -50, W + 100, H + 100);
    // soft bokeh
    for (let i = 0; i < 7; i++) {
      const x = (i * 83 + t * (6 + i)) % (W + 80) - 40;
      const y = 40 + ((i * 131) % 360) + Math.sin(t * 0.6 + i) * 10;
      const r = 18 + (i % 3) * 14;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, i % 2 ? "rgba(242,185,196,.45)" : "rgba(217,196,255,.5)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // floor shadow
    const sh = ctx.createRadialGradient(200, 412, 10, 200, 412, 170);
    sh.addColorStop(0, "rgba(46,22,33,.18)");
    sh.addColorStop(1, "rgba(46,22,33,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(200, 412, 170, 18, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawBase(s) {
    const g = ctx.createLinearGradient(58, 0, 342, 0);
    g.addColorStop(0, "#ecd9dd"); g.addColorStop(0.45, "#fffafa"); g.addColorStop(1, "#dfc6cc");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(58, 336);
    ctx.lineTo(58, 396);
    ctx.ellipse(200, 396, 142, 20, 0, Math.PI, 0, true);
    ctx.lineTo(342, 336);
    ctx.closePath();
    ctx.fill();
    // top face
    ctx.fillStyle = "#fff7f8";
    ctx.beginPath(); ctx.ellipse(200, 336, 142, 22, 0, 0, Math.PI * 2); ctx.fill();
    // LED ring
    const glow = 0.35 + s.uv * 0.65;
    ctx.save();
    ctx.shadowColor = `rgba(165,123,255,${glow})`;
    ctx.shadowBlur = 8 + s.uv * 26;
    ctx.strokeStyle = mix("#d9c4ff", "#a57bff", s.uv);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(200, 364, 142, 21, 0, 0.05, Math.PI - 0.05); ctx.stroke();
    ctx.restore();
  }

  function drawBowlInterior(s) {
    ctx.save();
    bowlPath();
    ctx.clip();
    // glass back tint
    const g = ctx.createLinearGradient(0, 170, 0, 350);
    g.addColorStop(0, "rgba(255,255,255,.35)");
    g.addColorStop(1, mix("#f7e3ea", "#cbb2ff", s.uv));
    ctx.fillStyle = g;
    ctx.fillRect(60, 160, 280, 200);
    // UV bloom
    if (s.uv > 0.01) {
      const rg = ctx.createRadialGradient(200, 280, 10, 200, 280, 170);
      rg.addColorStop(0, `rgba(165,123,255,${0.75 * s.uv})`);
      rg.addColorStop(1, "rgba(165,123,255,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(60, 160, 280, 200);
      // rays from the lid
      ctx.globalCompositeOperation = "lighter";
      for (let r = 0; r < 9; r++) {
        const x = 96 + r * 26;
        const a = (0.12 + 0.08 * Math.sin(t * 5 + r)) * s.uv;
        const lg = ctx.createLinearGradient(0, 200, 0, 340);
        lg.addColorStop(0, `rgba(190,150,255,${a * 2})`);
        lg.addColorStop(1, "rgba(190,150,255,0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(x - 3, 200); ctx.lineTo(x + 3, 200);
        ctx.lineTo(x + 14 + (x - 200) * 0.15, 345); ctx.lineTo(x - 14 + (x - 200) * 0.15, 345);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }

  function drawGerms(s) {
    ctx.save();
    bowlPath(); ctx.clip();
    for (const gm of GERMS) {
      let a, sc = 1;
      if (s.germs === null) {
        const p = clamp((s.uvLocal - gm.pop) / 0.12);
        if (p >= 1) continue;
        if (p > 0 && !gm.sparked) { gm.sparked = true; burst(gm.x, gm.y, 7); }
        sc = 1 - p; a = 1 - p;
      } else {
        gm.sparked = false;
        a = s.germs; sc = 0.6 + 0.4 * s.germs;
      }
      if (a <= 0.01) continue;
      const x = gm.x + Math.sin(t * 2 + gm.ph) * 3;
      const y = gm.y + Math.cos(t * 1.7 + gm.ph) * 3;
      const r = gm.r * sc;
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = "#8bbf7a";
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 8; k++) {
        const an = (k / 8) * Math.PI * 2 + t + gm.ph;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
        ctx.lineTo(x + Math.cos(an) * r * 1.55, y + Math.sin(an) * r * 1.55);
        ctx.stroke();
      }
      ctx.fillStyle = "#a9d49a";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6f9e61";
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ---------- brushes: spin is sold by rotating stripes ---------- */
  function stripes(x, y0, y1, halfW, ph, color, alpha, n) {
    for (let k = 0; k < n; k++) {
      const a = ph + (k / n) * Math.PI * 2;
      const c = Math.cos(a);
      if (c <= 0) continue;
      ctx.globalAlpha = alpha * c;
      ctx.fillStyle = color;
      const sx = x + Math.sin(a) * halfW;
      ctx.fillRect(sx - 1.2, y0, 2.4, y1 - y0);
    }
    ctx.globalAlpha = 1;
  }

  function drawBrushLower(b, s) {
    const ph = phase + b.off;
    const wob = Math.sin(t * 40 + b.off) * Math.min(1.2, s.speed * 0.05);
    const x = b.x + wob;
    const fy = 192, fh = 30;
    // ferrule
    const fg = ctx.createLinearGradient(x - b.w / 2, 0, x + b.w / 2, 0);
    fg.addColorStop(0, "#c29a73"); fg.addColorStop(0.5, "#f7e2c8"); fg.addColorStop(1, "#b38a64");
    ctx.fillStyle = fg;
    ctx.fillRect(x - b.w / 2, fy, b.w, fh);
    // bristles
    const y0 = fy + fh - 2, len = b.len;
    const w0 = b.w - 2, w1 = b.w + 12, fl = s.flare * (b.w / 20);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - w0 / 2, y0);
    ctx.quadraticCurveTo(x - w1 / 2 - fl, y0 + len * 0.55, x - w1 * 0.28 - fl * 0.4, y0 + len * 0.9);
    ctx.quadraticCurveTo(x, y0 + len * 1.08, x + w1 * 0.28 + fl * 0.4, y0 + len * 0.9);
    ctx.quadraticCurveTo(x + w1 / 2 + fl, y0 + len * 0.55, x + w0 / 2, y0);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + len);
    bg.addColorStop(0, "#4a2c39");
    bg.addColorStop(0.55, mix("#8e6275", "#b88a6c", s.dirt));
    bg.addColorStop(1, mix("#d8b3c0", "#e2b48c", s.dirt));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.clip();
    stripes(x, y0, y0 + len * 1.1, w1 / 2 + fl, ph, "#fff", 0.35 / (1 + s.speed * 0.04), 10);
    stripes(x, y0, y0 + len * 1.1, w1 / 2 + fl, ph + 0.3, "#2e1621", 0.25 / (1 + s.speed * 0.04), 7);
    ctx.restore();
    b.tip = { x, y: y0 + len * 0.9 };
  }

  function drawBrushUpper(b, s) {
    const ph = phase + b.off;
    const wob = Math.sin(t * 40 + b.off) * Math.min(1.2, s.speed * 0.05);
    const x = b.x + wob;
    const y0 = b.top, y1 = 196;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - b.w / 2, y0, b.w, y1 - y0, [b.w / 2, b.w / 2, 0, 0]);
    const g = ctx.createLinearGradient(x - b.w / 2, 0, x + b.w / 2, 0);
    g.addColorStop(0, b.col[2]); g.addColorStop(0.45, b.col[1]); g.addColorStop(1, b.col[0]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    stripes(x, y0, y1, b.w / 2, ph, "#ffffff", 0.7 / (1 + s.speed * 0.05), 4);
    stripes(x, y0 + 30, y0 + 44, b.w / 2, ph + 1, "#d6b08a", 0.9, 3);
    ctx.restore();
    // gold band
    const fg = ctx.createLinearGradient(x - b.w / 2, 0, x + b.w / 2, 0);
    fg.addColorStop(0, "#c29a73"); fg.addColorStop(0.5, "#f7e2c8"); fg.addColorStop(1, "#b38a64");
    ctx.fillStyle = fg;
    ctx.fillRect(x - b.w / 2, y0 + 34, b.w, 5);
    // collar where it enters the lid
    ctx.fillStyle = "#e6d2d8";
    ctx.beginPath(); ctx.ellipse(b.x, 194, b.w / 2 + 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(165,123,255,.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // motion lines when fast
    if (s.speed > 10) {
      ctx.strokeStyle = `rgba(90,57,71,${clamp((s.speed - 10) / 40) * 0.5})`;
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        const yy = y0 + 20 + k * 22;
        const off = ((t * 120 + k * 17) % 20) - 10;
        ctx.beginPath();
        ctx.ellipse(x, yy, b.w / 2 + 7, 3.5, 0, 0.2 + off * 0.02, Math.PI - 0.2);
        ctx.stroke();
      }
    }
  }

  function drawWater(s) {
    if (s.water < 0.01) return;
    const level = lerp(346, 214, s.water);
    ctx.save();
    bowlPath(); ctx.clip();
    const g = ctx.createLinearGradient(0, level, 0, 350);
    g.addColorStop(0, "rgba(249,200,212,.55)");
    g.addColorStop(1, "rgba(232,160,180,.7)");
    ctx.fillStyle = g;
    ctx.fillRect(60, level, 280, 360 - level);
    // swirling surface
    const rx = 118 * clamp(0.5 + s.water * 0.6);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.ellipse(200, level, rx, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const a0 = t * 5 + k * 1.57;
      ctx.beginPath();
      ctx.ellipse(200, level, rx * (0.45 + k * 0.14), 12 * (0.45 + k * 0.14), 0, a0, a0 + 1.4);
      ctx.stroke();
    }
    // bubbles
    for (const p of bubbles) {
      if (p.y < level) continue;
      ctx.globalAlpha = p.a;
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return level;
  }

  function drawDrops() {
    ctx.save();
    bowlPath(); ctx.clip();
    ctx.fillStyle = "rgba(236,160,182,.9)";
    for (const d of drops) {
      ctx.globalAlpha = d.a;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(Math.atan2(d.vy, d.vx));
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGlassFront(s) {
    ctx.save();
    bowlPath();
    ctx.fillStyle = `rgba(255,255,255,${0.08 + s.uv * 0.05})`;
    ctx.fill();
    ctx.strokeStyle = s.uv > 0.2 ? `rgba(200,170,255,${0.6 + s.uv * 0.4})` : "rgba(255,255,255,.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // reflections
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(92, 230); ctx.bezierCurveTo(94, 280, 112, 312, 136, 328);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(306, 236); ctx.bezierCurveTo(304, 262, 296, 284, 284, 300);
    ctx.stroke();
    ctx.restore();
  }

  function drawLid(s) {
    const g = ctx.createLinearGradient(72, 0, 328, 0);
    g.addColorStop(0, "#ead6db"); g.addColorStop(0.5, "#fffafb"); g.addColorStop(1, "#e2cbd1");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(200, 192, 132, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8d3d9";
    ctx.beginPath();
    ctx.ellipse(200, 192, 132, 22, 0, 0, Math.PI);
    ctx.lineTo(68, 198);
    ctx.ellipse(200, 198, 132, 22, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.strokeStyle = s.uv > 0.05 ? `rgba(165,123,255,${0.4 + s.uv * 0.6})` : "rgba(165,123,255,.35)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(200, 192, 118, 17, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function drawSparks() {
    for (const p of sparks) {
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      const r = p.r;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, -r, 0);
      ctx.quadraticCurveTo(0, 0, 0, -r);
      ctx.fill();
      ctx.restore();
    }
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(20, 60);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(3, 6), a: 1, life: rand(0.5, 0.9), rot: rand(0, 3), c: Math.random() > 0.5 ? "#ffffff" : "#d9c4ff" });
    }
  }

  /* ---------- particles ---------- */
  function step(dt, s) {
    if (s.water > 0.3 && Math.random() < dt * 40 * s.water) {
      bubbles.push({ x: rand(100, 300), y: rand(320, 345), r: rand(2, 6), vy: rand(30, 70), a: 1, sw: rand(0, 6) });
    }
    for (const p of bubbles) {
      p.y -= p.vy * dt;
      p.x += Math.sin(t * 4 + p.sw) * 0.4;
      if (p.y < 220) p.a -= dt * 3;
    }
    bubbles = bubbles.filter((p) => p.a > 0 && s.water > 0.05);

    if (s.i === 1 && s.local < SCENE - 0.6) {
      for (const b of BRUSHES) {
        if (!b.tip || Math.random() > dt * 22) continue;
        const dir = Math.random() > 0.5 ? 1 : -1;
        drops.push({ x: b.tip.x + dir * 10, y: b.tip.y - rand(10, 40), vx: dir * rand(120, 220), vy: rand(-40, 10), a: 1 });
      }
    }
    for (const d of drops) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 300 * dt; d.a -= dt * 1.4;
    }
    drops = drops.filter((d) => d.a > 0);

    if (s.i === 3 && Math.random() < dt * 7) {
      const b = BRUSHES[Math.floor(rand(0, 3))];
      sparks.push({ x: b.x + rand(-40, 40), y: rand(60, 320), vx: 0, vy: -12, r: rand(4, 9), a: 0, life: 1.4, rot: 0, grow: true, c: Math.random() > 0.4 ? "#ffffff" : "#f2b9c4" });
    }
    for (const p of sparks) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += dt * 2;
      p.life -= dt;
      p.a = p.grow ? Math.sin(clamp(p.life / 1.4) * Math.PI) : clamp(p.life * 1.5);
    }
    sparks = sparks.filter((p) => p.life > 0);
  }

  /* ---------- frame ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    // reserve the lower band of the frame for the caption + controls
    const sc = Math.min(canvas.width / W, canvas.height / (H + 90));
    const ox = (canvas.width - W * sc) / 2;
    const oy = 28 * sc;
    ctx.setTransform(sc, 0, 0, sc, ox, oy);
    draw();
  }

  function draw() {
    const s = sceneState();
    ctx.clearRect(-100, -100, W + 200, H + 200);
    drawBackground(s);
    drawBase(s);
    drawBowlInterior(s);
    drawGerms(s);
    BRUSHES.forEach((b) => drawBrushLower(b, s));
    drawWater(s);
    drawDrops();
    drawGlassFront(s);
    drawLid(s);
    BRUSHES.forEach((b) => drawBrushUpper(b, s));
    drawSparks();
    ui(s);
    return s;
  }

  function ui(s) {
    if (s.i !== curScene) {
      curScene = s.i;
      canvas.dispatchEvent(new CustomEvent("filmscene", { bubbles: true, detail: s.i }));
      if (caption) {
        caption.classList.add("swap");
        setTimeout(() => {
          titleEl.textContent = SCENES[s.i].title;
          noEl.textContent = `0${s.i + 1} / 0${SCENES.length}`;
          caption.classList.remove("swap");
        }, 250);
      }
    }
    segs.forEach((b, i) => {
      const fill = i < s.i ? 1 : i === s.i ? s.local / SCENE : 0;
      b.firstElementChild.style.width = `${fill * 100}%`;
    });
    if (timeEl) {
      const sec = Math.floor(t);
      timeEl.textContent = `0:${String(sec).padStart(2, "0")} / 0:${Math.round(TOTAL)}`;
    }
  }

  function loop(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (playing && visible) {
      t = (t + dt) % TOTAL;
      const s = sceneState();
      phase += s.speed * dt;
      step(dt, s);
      draw();
    }
    requestAnimationFrame(loop);
  }

  function setPlaying(p) {
    playing = p;
    if (playBtn) {
      playBtn.innerHTML = p
        ? '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor"/><rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7-4.5z" fill="currentColor"/></svg>';
      playBtn.setAttribute("aria-label", p ? "השהיית הסרטון" : "הפעלת הסרטון");
    }
  }

  playBtn && playBtn.addEventListener("click", () => setPlaying(!playing));
  segs.forEach((b, i) =>
    b.addEventListener("click", () => {
      t = i * SCENE + 0.01;
      bubbles = []; drops = []; sparks = [];
      draw();
    })
  );

  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.05 }).observe(canvas);
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  window.addEventListener("resize", resize);

  setPlaying(playing);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  resize();
  requestAnimationFrame(loop);
})();
