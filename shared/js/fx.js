/* Tier 1 concept redesigns: effects library + per-theme choreography.
   core.js calls window.T1FX(T1) once the DOM is ready. Every effect checks
   T1.motion, so reduced-motion users and no-JS readers get a static page. */
(() => {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- canvas helper: DPR-aware, pauses offscreen and in hidden tabs ---------- */
  function stage(canvas, draw, { onResize } = {}) {
    const ctx = canvas.getContext("2d");
    const s = { ctx, w: 0, h: 0, dpr: Math.min(devicePixelRatio || 1, 2), mx: -9999, my: -9999, t: 0, visible: true };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      s.w = r.width;
      s.h = r.height;
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      if (onResize) onResize(s);
    };
    resize();
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => (s.visible = e.isIntersecting)).observe(canvas);
    const host = canvas.parentElement;
    host.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      s.mx = e.clientX - r.left;
      s.my = e.clientY - r.top;
    });
    host.addEventListener("pointerleave", () => { s.mx = -9999; s.my = -9999; });
    const loop = () => {
      requestAnimationFrame(loop);
      if (!s.visible || document.hidden) return;
      s.t += 1;
      draw(s);
    };
    requestAnimationFrame(loop);
    return s;
  }

  /* ---------- 1. embers: rising sparks with flicker (Galfar) ---------- */
  function embers(canvas, { colors = ["#ffb347", "#ff7a1a", "#ff4d00", "#ffd9a0"], density = 1 } = {}) {
    const P = [];
    const spawn = (p, s, initial) => {
      p.x = rand(0, s.w);
      p.y = initial ? rand(0, s.h) : s.h + 10;
      p.vy = -rand(0.35, 1.6);
      p.vx = rand(-0.25, 0.25);
      p.r = rand(0.5, 2.3);
      p.life = 0;
      p.max = rand(180, 520);
      p.c = colors[(Math.random() * colors.length) | 0];
      p.f = rand(0, TAU);
    };
    return stage(canvas, (s) => {
      const { ctx } = s;
      const want = Math.round((s.w < 700 ? 70 : 170) * density);
      while (P.length < want) { const p = {}; spawn(p, s, true); P.push(p); }
      ctx.clearRect(0, 0, s.w, s.h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of P) {
        p.life++;
        p.x += p.vx + Math.sin((p.life + p.f * 40) * 0.025) * 0.45;
        p.y += p.vy;
        const dx = p.x - s.mx, dy = p.y - s.my, d2 = dx * dx + dy * dy;
        if (d2 < 14000) { const k = (14000 - d2) / 14000; p.x += dx * 0.03 * k; p.y += dy * 0.03 * k; }
        const a = clamp(1 - p.life / p.max, 0, 1) * (0.55 + 0.45 * Math.sin(p.f + p.life * 0.25));
        ctx.globalAlpha = a * 0.18;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, TAU); ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        if (p.life > p.max || p.y < -20) spawn(p, s, false);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    });
  }

  /* ---------- 2. particle sphere: an LPG sphere drawn in light (National Gas) ---------- */
  function particleSphere(canvas, { color = [190, 255, 120], color2 = [120, 200, 255], count = 1400 } = {}) {
    const pts = [];
    const n = innerWidth < 700 ? Math.round(count * 0.55) : count;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, j: rand(0.85, 1.15), seed: rand(0, TAU) });
    }
    const dust = Array.from({ length: 160 }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.2, 1), s: rand(0.3, 1.2) }));
    const api = { explode: 0, ry: 0, rx: -0.25, tx: 0, ty: 0 };
    const s = stage(canvas, (s) => {
      const { ctx, w, h } = s;
      ctx.clearRect(0, 0, w, h);
      const cx = w * (w > 900 ? 0.68 : 0.5), cy = h * 0.5;
      const R = Math.min(w, h) * (w > 900 ? 0.34 : 0.3);
      if (s.mx > -999) { api.tx = (s.mx / w - 0.5) * 0.9; api.ty = (s.my / h - 0.5) * 0.6; }
      api.ry += 0.0028 + api.tx * 0.01;
      api.rx += ((-0.25 + api.ty) - api.rx) * 0.04;
      const cyR = Math.cos(api.ry), syR = Math.sin(api.ry), cxR = Math.cos(api.rx), sxR = Math.sin(api.rx);
      const ex = api.explode;
      ctx.globalCompositeOperation = "lighter";
      for (const d of dust) {
        d.y -= 0.0006 * d.s;
        if (d.y < -1) d.y = 1;
        ctx.globalAlpha = 0.25 * d.z;
        ctx.fillStyle = `rgb(${color2})`;
        ctx.fillRect(w / 2 + d.x * w * 0.6, h / 2 + d.y * h * 0.6, d.s, d.s);
      }
      for (const p of pts) {
        const wob = 1 + Math.sin(s.t * 0.02 + p.seed) * 0.015 + ex * (p.j - 1) * 6 + ex * 0.8;
        let x = p.x * wob, y = p.y * wob, z = p.z * wob;
        const x1 = x * cyR - z * syR, z1 = x * syR + z * cyR;
        const y2 = y * cxR - z1 * sxR, z2 = y * sxR + z1 * cxR;
        const f = 2.6 / (2.6 + z2);
        const sx = cx + x1 * R * f, sy = cy + y2 * R * f;
        const depth = (1 - z2) / 2;
        const mix = clamp((p.y + 1) / 2, 0, 1);
        const c = color.map((v, i) => Math.round(v * mix + color2[i] * (1 - mix)));
        ctx.globalAlpha = clamp(0.12 + depth * 0.85, 0, 1) * (1 - ex * 0.5);
        ctx.fillStyle = `rgb(${c})`;
        const size = 0.6 + depth * 1.9 * f;
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
      // equator ring + meridian, like the sphere's support frame
      ctx.globalAlpha = 0.22 * (1 - ex);
      ctx.strokeStyle = `rgb(${color})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 1.28, R * 1.28 * Math.abs(Math.sin(api.rx + 0.0001)) + 6, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    });
    api.stage = s;
    return api;
  }

  /* ---------- 3. floaters: drifting medical crosses and capsules (Badr) ---------- */
  function floaters(canvas, { colors = ["#0f766e", "#e07a5f", "#c9b79c"], count = 26 } = {}) {
    const items = Array.from({ length: innerWidth < 700 ? Math.round(count * 0.5) : count }, () => ({
      x: Math.random(), y: Math.random(), z: rand(0.3, 1), r: rand(0, TAU), vr: rand(-0.004, 0.004),
      kind: Math.random() < 0.55 ? "plus" : "pill", c: colors[(Math.random() * colors.length) | 0], vy: rand(0.0003, 0.0009),
    }));
    return stage(canvas, (s) => {
      const { ctx, w, h } = s;
      ctx.clearRect(0, 0, w, h);
      const sy = scrollY;
      for (const it of items) {
        it.y += it.vy * it.z;
        it.r += it.vr;
        if (it.y > 1.1) { it.y = -0.1; it.x = Math.random(); }
        const size = 10 + it.z * 26;
        const px = it.x * w + Math.sin(s.t * 0.01 + it.r) * 10 * it.z;
        let py = ((it.y * h - sy * 0.15 * it.z) % (h + 80) + h + 80) % (h + 80) - 40;
        const dx = px - s.mx, dy = py - s.my, d = Math.hypot(dx, dy);
        const push = d < 140 ? (140 - d) / 140 : 0;
        ctx.save();
        ctx.translate(px + dx * push * 0.25, py + dy * push * 0.25);
        ctx.rotate(it.r);
        ctx.globalAlpha = 0.18 + it.z * 0.45;
        ctx.fillStyle = it.c;
        if (it.kind === "plus") {
          const t = size * 0.32;
          ctx.beginPath();
          ctx.roundRect(-size / 2, -t / 2, size, t, t / 2);
          ctx.roundRect(-t / 2, -size / 2, t, size, t / 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size / 4.4, size, size / 2.2, size / 4.4);
          ctx.fill();
          ctx.globalAlpha *= 0.55;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.roundRect(0, -size / 4.4, size / 2, size / 2.2, [0, size / 4.4, size / 4.4, 0]);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  /* ---------- 4. dotted globe with delivery arcs from Oman (Asyad) ---------- */
  function dotGlobe(canvas, { color = "255,91,0", dots = "255,240,225" } = {}) {
    const toVec = (lat, lon) => {
      const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
      return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
    };
    const grid = [];
    for (let lat = -80; lat <= 80; lat += 5) {
      const ring = Math.max(1, Math.round(72 * Math.cos((lat * Math.PI) / 180)));
      for (let k = 0; k < ring; k++) grid.push(toVec(lat, (k / ring) * 360 - 180));
    }
    const origin = toVec(23.6, 58.5); // Muscat
    const cities = [[51.5, -0.1], [40.7, -74], [19, 72.8], [1.3, 103.8], [-33.9, 151.2], [-26.2, 28], [30, 31.2], [35.7, 139.7], [24.7, 46.7], [-1.3, 36.8], [-23.5, -46.6], [50.1, 8.7], [31.2, 121.5], [25.2, 55.3], [24.9, 67], [41, 29], [13.7, 100.5], [-6.2, 106.8], [55.7, 37.6], [6.5, 3.4]].map(([a, b]) => toVec(a, b));
    const slerp = (p, q, t) => {
      const dot = clamp(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], -1, 1);
      const om = Math.acos(dot), so = Math.sin(om) || 1;
      const a = Math.sin((1 - t) * om) / so, b = Math.sin(t * om) / so;
      const lift = 1 + Math.sin(t * Math.PI) * 0.22 * om;
      return [(a * p[0] + b * q[0]) * lift, (a * p[1] + b * q[1]) * lift, (a * p[2] + b * q[2]) * lift];
    };
    const arcs = Array.from({ length: 7 }, (_, i) => ({ to: cities[i], t: -i * 0.35 }));
    let rot = -1.0;
    return stage(canvas, (s) => {
      const { ctx, w, h } = s;
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.42, cx = w / 2, cy = h / 2;
      rot += 0.0016 + (s.mx > -999 ? (s.mx / w - 0.5) * 0.004 : 0);
      const tilt = -0.32;
      const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
      const project = (v) => {
        const x = v[0] * cr - v[2] * sr, z = v[0] * sr + v[2] * cr;
        const y = v[1] * ct - z * st, z2 = v[1] * st + z * ct;
        return [cx + x * R, cy - y * R, z2];
      };
      for (const v of grid) {
        const [x, y, z] = project(v);
        if (z < -0.05) continue;
        ctx.globalAlpha = 0.22 + z * 0.7;
        ctx.fillStyle = `rgb(${dots})`;
        const d = 1.4 + z * 1.2;
        ctx.fillRect(x - d / 2, y - d / 2, d, d);
      }
      ctx.lineCap = "round";
      for (const a of arcs) {
        a.t += 0.006;
        if (a.t > 1.6) { a.t = 0; a.to = cities[(Math.random() * cities.length) | 0]; }
        if (a.t <= 0) continue;
        const head = Math.min(a.t, 1), tail = Math.max(0, a.t - 0.6);
        ctx.beginPath();
        let first = true;
        for (let k = tail; k <= head; k += 0.02) {
          const [x, y, z] = project(slerp(origin, a.to, k));
          if (z < -0.15) { first = true; continue; }
          first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          first = false;
        }
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = `rgba(${color},0.85)`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        const [hx, hy, hz] = project(slerp(origin, a.to, head));
        if (hz > -0.15) { ctx.fillStyle = `rgb(${color})`; ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, TAU); ctx.fill(); }
      }
      const [ox, oy, oz] = project(origin);
      if (oz > 0) {
        const pulse = (s.t % 90) / 90;
        ctx.globalAlpha = 1 - pulse;
        ctx.strokeStyle = `rgb(${color})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ox, oy, 4 + pulse * 18, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${color})`;
        ctx.beginPath(); ctx.arc(ox, oy, 4, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ---------- text: scramble decode ---------- */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*+=";
  function scramble(el, { duration = 1.1 } = {}) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", final);
    const start = performance.now();
    const step = (now) => {
      const p = clamp((now - start) / (duration * 1000), 0, 1);
      const reveal = Math.floor(p * final.length);
      let out = "";
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        out += i < reveal || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- text: kinetic word swap (Starcare) ---------- */
  function wordSwap(el, T1) {
    const words = JSON.parse(el.dataset.words || "[]");
    if (words.length < 2) return;
    const { gsap } = T1;
    let i = 0;
    const build = (word) => {
      const span = document.createElement("span");
      span.className = "swap-word";
      span.setAttribute("aria-hidden", "true");
      for (const ch of word) {
        const c = document.createElement("span");
        c.className = "swap-char";
        c.textContent = ch === " " ? " " : ch;
        span.appendChild(c);
      }
      return span;
    };
    el.textContent = "";
    let cur = build(words[0]);
    el.appendChild(cur);
    const sizer = () => gsap.to(el, { width: cur.offsetWidth, duration: 0.7, ease: "expo.out" });
    gsap.set(el, { width: cur.offsetWidth });
    setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % words.length;
      const prev = cur;
      cur = build(words[i]);
      el.appendChild(cur);
      gsap.to(prev.children, { yPercent: -110, rotate: -8, opacity: 0, filter: "blur(6px)", duration: 0.6, ease: "expo.in", stagger: 0.02, onComplete: () => prev.remove() });
      gsap.from(cur.children, { yPercent: 110, rotate: 8, opacity: 0, filter: "blur(6px)", duration: 0.9, ease: "expo.out", stagger: 0.03, delay: 0.35 });
      sizer();
    }, 2600);
  }

  /* ---------- 3D tilt with glare ---------- */
  function tilt(el, T1, max = 10) {
    if (!T1.fine) return;
    const { gsap } = T1;
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * max * 2);
      rx(-(py - 0.5) * max * 2);
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
    });
    el.addEventListener("pointerleave", () => { rx(0); ry(0); });
  }

  /* ---------- cursor-follow image preview over a list (Assarain, Starcare) ---------- */
  function hoverPreview(list, T1) {
    if (!T1.fine) return;
    const { gsap } = T1;
    const box = document.createElement("div");
    box.className = "preview";
    box.setAttribute("aria-hidden", "true");
    const imgs = {};
    T1.$$("[data-preview]", list).forEach((row) => {
      const src = row.dataset.preview;
      if (!imgs[src]) {
        const im = new Image();
        im.src = src;
        im.alt = "";
        box.appendChild(im);
        imgs[src] = im;
      }
    });
    document.body.appendChild(box);
    gsap.set(box, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });
    const xTo = gsap.quickTo(box, "x", { duration: 0.7, ease: "power3.out" });
    const yTo = gsap.quickTo(box, "y", { duration: 0.7, ease: "power3.out" });
    const rTo = gsap.quickTo(box, "rotation", { duration: 0.9, ease: "power3.out" });
    let lastX = 0;
    list.addEventListener("pointermove", (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      rTo(clamp((e.clientX - lastX) * 0.6, -14, 14));
      lastX = e.clientX;
    });
    T1.$$("[data-preview]", list).forEach((row) => {
      row.addEventListener("pointerenter", () => {
        Object.entries(imgs).forEach(([src, im]) => im.classList.toggle("on", src === row.dataset.preview));
        gsap.to(box, { scale: 1, opacity: 1, duration: 0.6, ease: "expo.out" });
      });
    });
    list.addEventListener("pointerleave", () => gsap.to(box, { scale: 0, opacity: 0, duration: 0.5, ease: "expo.in" }));
  }

  /* ---------- pinned horizontal scroll ---------- */
  function hScroll(section, T1) {
    const { gsap } = T1;
    const track = section.querySelector("[data-htrack]");
    if (!track) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tw = gsap.to(track, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
      });
      T1.$$("[data-hpar]", track).forEach((img) => {
        gsap.fromTo(img, { xPercent: -12 }, { xPercent: 12, ease: "none", scrollTrigger: { trigger: img.parentElement, containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
      });
      const bar = section.querySelector("[data-hbar]");
      if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + dist(), scrub: true } });
    });
  }

  /* ---------- sticky stacked panels: each new panel slides over the last ---------- */
  function stackPanels(wrap, T1) {
    const { gsap } = T1;
    const panels = T1.$$("[data-panel]", wrap);
    panels.forEach((panel, i) => {
      const next = panels[i + 1];
      const inner = panel.querySelector("[data-panel-inner]") || panel;
      const img = panel.querySelector("img");
      if (img) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: panel, start: "top bottom", end: "top top", scrub: true } });
      if (!next) return;
      gsap.to(inner, { scale: 0.9, borderRadius: 28, filter: "brightness(0.35)", ease: "none", scrollTrigger: { trigger: next, start: "top bottom", end: "top top", scrub: true } });
    });
  }

  /* ---------- assemble: scattered pieces fly into place on scroll ---------- */
  function assemble(wrap, T1) {
    const { gsap } = T1;
    const kids = T1.$$("[data-piece]", wrap);
    kids.forEach((k, i) => {
      const [x, y, r] = (k.dataset.piece || "").split(",").map(Number);
      gsap.from(k, {
        x: Number.isFinite(x) ? x : rand(-300, 300),
        y: Number.isFinite(y) ? y : rand(-200, 260),
        rotation: Number.isFinite(r) ? r : rand(-25, 25),
        scale: 0.75,
        opacity: 0,
        ease: "power2.out",
        scrollTrigger: { trigger: wrap, start: "top 85%", end: "top 25%", scrub: 1.2 },
      });
    });
  }

  /* ---------- route: an SVG path draws itself and a parcel rides it (Asyad) ---------- */
  function route(wrap, T1) {
    const { gsap } = T1;
    const path = wrap.querySelector("[data-route-path]");
    const rider = wrap.querySelector("[data-route-rider]");
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    const stops = T1.$$("[data-stop]", wrap);
    ScrollTrigger.create({
      trigger: wrap,
      start: "top 70%",
      end: "bottom 60%",
      scrub: 1,
      onUpdate: (st) => {
        const p = st.progress;
        path.style.strokeDashoffset = `${len * (1 - p)}`;
        if (rider) {
          const pt = path.getPointAtLength(len * p);
          const pt2 = path.getPointAtLength(Math.min(len, len * p + 1));
          const ang = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
          rider.setAttribute("transform", `translate(${pt.x} ${pt.y}) rotate(${ang})`);
        }
        stops.forEach((s, i) => s.classList.toggle("is-on", p >= (i + 0.35) / stops.length));
      },
    });
  }

  /* ---------- liquid waves between sections (Badr) ---------- */
  function waves(svg) {
    const paths = Array.from(svg.querySelectorAll("path"));
    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(svg);
    const W = 1440, H = 120;
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      paths.forEach((p, k) => {
        const amp = 14 + k * 8, ph = t * 0.0006 * (k ? -1 : 1) + k * 1.7, base = 52 + k * 18;
        let d = `M0 ${H} L0 ${base}`;
        for (let x = 0; x <= W; x += 40) d += ` L${x} ${(base + Math.sin(x * 0.006 + ph) * amp + Math.sin(x * 0.013 - ph * 1.3) * amp * 0.4).toFixed(1)}`;
        p.setAttribute("d", d + ` L${W} ${H} Z`);
      });
    };
    requestAnimationFrame(loop);
  }

  /* ---------- 3D fly-through of floating glass cards (National Gas) ---------- */
  function flyThrough(section, T1) {
    const { gsap } = T1;
    const inner = section.querySelector("[data-space]");
    const cards = T1.$$("[data-z]", section);
    if (!inner) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const depth = 2600;
      const state = { z: 0 };
      const apply = () => {
        inner.style.transform = `translate3d(0,0,${state.z}px)`;
        cards.forEach((c) => {
          const eff = parseFloat(c.dataset.z) + state.z;
          c.style.opacity = clamp(Math.min((eff + 2400) / 900, (760 - eff) / 260), 0, 1);
          c.style.pointerEvents = eff > -900 && eff < 600 ? "auto" : "none";
        });
      };
      apply();
      gsap.to(state, { z: depth, ease: "none", onUpdate: apply, scrollTrigger: { trigger: section, start: "top top", end: "+=" + depth * 0.9, pin: true, scrub: 1 } });
      return () => { inner.style.transform = ""; cards.forEach((c) => { c.style.opacity = ""; c.style.pointerEvents = ""; }); };
    });
  }

  /* ---------- chapters: sticky media swaps as chapter copy scrolls by (Badr) ---------- */
  function chapters(wrap, T1) {
    const items = T1.$$("[data-chapter]", wrap);
    const media = T1.$$("[data-chapter-media]", wrap);
    const num = wrap.querySelector("[data-chapter-num]");
    const set = (i) => {
      items.forEach((it, k) => it.classList.toggle("is-on", k === i));
      media.forEach((m, k) => m.classList.toggle("is-on", k === i));
      if (num) num.textContent = String(i + 1);
    };
    items.forEach((it, i) => ScrollTrigger.create({ trigger: it, start: "top 60%", end: "bottom 60%", onToggle: (st) => st.isActive && set(i) }));
    set(0);
  }

  /* ---------- horizontal drift of giant words ---------- */
  function drift(T1) {
    T1.$$("[data-drift]").forEach((el) => {
      const amt = parseFloat(el.dataset.drift) || 20;
      T1.gsap.fromTo(el, { xPercent: amt / 2 }, { xPercent: -amt / 2, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  /* =================== themes =================== */
  const THEMES = {
    /* Galfar: Ember-style fire, condensed type, assembling units, stacked project panels */
    ember(T1) {
      const { gsap, $, $$ } = T1;
      $$("canvas[data-fx=embers]").forEach((c) => embers(c, { density: parseFloat(c.dataset.density) || 1 }));
      const heroImg = $(".hero-media img");
      if (heroImg) {
        gsap.set(heroImg, { scale: 1.25 });
        T1.onIntro(() => gsap.to(heroImg, { scale: 1.05, duration: 2.6, ease: "expo.out" }));
        gsap.to(".hero-media", { yPercent: 18, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
        gsap.to(".hero-title", { yPercent: -30, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      }
      T1.onIntro(() => {
        gsap.from(".side-label", { opacity: 0, y: 30, duration: 1.2, ease: "expo.out", stagger: 0.1, delay: 0.5 });
        gsap.from(".hero-dots i", { scaleX: 0, duration: 0.8, ease: "expo.out", stagger: 0.06, delay: 0.8 });
      });
      $$("[data-assemble]").forEach((w) => assemble(w, T1));
      $$("[data-stack]").forEach((w) => stackPanels(w, T1));
      drift(T1);
    },

    /* National Gas: Active Theory-style particle sphere, scramble text, glass cards in 3D space */
    cosmos(T1) {
      const { gsap, $, $$ } = T1;
      const c = $("canvas[data-fx=sphere]");
      if (c) {
        const sph = particleSphere(c);
        ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", scrub: true, onUpdate: (st) => (sph.explode = st.progress) });
      }
      $$("[data-scramble]").forEach((el) => {
        if (el.hasAttribute("data-intro")) T1.onIntro(() => scramble(el, { duration: 1.4 }));
        else ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: () => scramble(el) });
        if (el.matches("a, button") || el.closest("a")) (el.closest("a") || el).addEventListener("pointerenter", () => scramble(el, { duration: 0.5 }));
      });
      $$(".glass").forEach((g) => tilt(g, T1, 8));
      $$("[data-fly]").forEach((s) => flyThrough(s, T1));
      T1.onIntro(() => gsap.from(".pill-nav", { scaleX: 0.2, opacity: 0, duration: 1.2, ease: "expo.out" }));
    },

    /* Badr Al Samaa: Pour/Play-style chapters, giant words behind imagery, waves, orbiting cards */
    story(T1) {
      const { gsap, $, $$ } = T1;
      $$("canvas[data-fx=floaters]").forEach((c) => floaters(c));
      $$("svg[data-waves]").forEach(waves);
      $$("[data-chapters]").forEach((w) => chapters(w, T1));
      drift(T1);
      const orbit = $("[data-orbit]");
      if (orbit && matchMedia("(min-width: 760px)").matches) {
        gsap.to(orbit, { rotation: 40, ease: "none", scrollTrigger: { trigger: orbit.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
        $$("[data-orbit] .orbit-card").forEach((card) => {
          gsap.to(card, { rotation: -40, ease: "none", scrollTrigger: { trigger: orbit.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
          tilt(card.firstElementChild, T1, 12);
        });
      }
      T1.onIntro(() => gsap.from(".hero-arch img", { scale: 1.3, duration: 2.2, ease: "expo.out" }));
    },

    /* Starcare: kinetic italic word swap on grid paper, horizontal departments, hover previews */
    clinic(T1) {
      const { $$ } = T1;
      $$("[data-swap]").forEach((el) => T1.onIntro(() => setTimeout(() => wordSwap(el, T1), 1200)));
      $$("[data-hscroll]").forEach((s) => hScroll(s, T1));
      $$("[data-previews]").forEach((l) => hoverPreview(l, T1));
      $$(".dept-card").forEach((card) => tilt(card, T1, 6));
    },

    /* Assarain: editorial curtain intro, horizontal business groups, company index with image follow */
    editorial(T1) {
      const { gsap, $$ } = T1;
      T1.onIntro(() => {
        gsap.to(".curtain-l", { xPercent: -100, duration: 1.6, ease: "expo.inOut" });
        gsap.to(".curtain-r", { xPercent: 100, duration: 1.6, ease: "expo.inOut" });
        gsap.from(".hero-media img", { scale: 1.4, duration: 2.6, ease: "expo.out" });
      });
      gsap.to(".hero-media", { yPercent: 20, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      $$("[data-hscroll]").forEach((s) => hScroll(s, T1));
      $$("[data-previews]").forEach((l) => hoverPreview(l, T1));
      drift(T1);
    },

    /* Asyad Express: dotted globe with arcs, route drawn on scroll, conveyor marquee */
    route(T1) {
      const { gsap, $$ } = T1;
      $$("canvas[data-fx=globe]").forEach((c) => dotGlobe(c));
      $$("[data-route]").forEach((w) => route(w, T1));
      $$("[data-tile]").forEach((t, i) => gsap.from(t, { y: 120 + (i % 3) * 60, rotation: (i % 2 ? 4 : -4), opacity: 0, ease: "power2.out", scrollTrigger: { trigger: t, start: "top bottom", end: "top 55%", scrub: 1 } }));
      drift(T1);
    },
  };

  window.T1FX = (T1) => {
    const theme = document.body.dataset.theme;
    if (!T1.motion || !THEMES[theme]) return;
    THEMES[theme](T1);
  };
})();
