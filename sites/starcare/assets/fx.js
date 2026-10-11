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
    // on narrow screens the image is pinned over the top half, so read the chapter lower down
    const line = matchMedia("(max-width: 960px)").matches ? "82%" : "60%";
    items.forEach((it, i) => ScrollTrigger.create({ trigger: it, start: `top ${line}`, end: `bottom ${line}`, onToggle: (st) => st.isActive && set(i) }));
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


  /* ---------- promo hero slider: WebGL displacement between slides, CSS crossfade fallback ---------- */
  function promoSlider(root, T1) {
    const bgs = Array.from(root.querySelectorAll(".promo-bg"));
    const copies = Array.from(root.querySelectorAll(".promo-copy"));
    const tabs = Array.from(root.querySelectorAll(".promo-tab"));
    const pauseBtn = root.querySelector("[data-ppause]");
    const n = bgs.length;
    if (n < 2) return;
    const DUR = 6500;
    const MODE = { flow: 0, burn: 1, pixel: 2, blinds: 3, streak: 4, ripple: 5 }[root.dataset.promo] || 0;
    let cur = 0, t0 = performance.now(), paused = false, hover = false, visible = true, busy = false;
    const gsap = T1.motion ? T1.gsap : null;

    /* --- WebGL --- */
    const canvas = root.querySelector(".promo-gl");
    let gl = null, prog, texs = [], uni = {}, glFrom = 0, glTo = 0, glP = 0, glAnim = null;
    const imgs = bgs.map((b) => b.querySelector("img"));
    if (canvas && !T1.reduce) {
      try { gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false }); } catch (e) { gl = null; }
    }
    const VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}";
    const FS = `precision mediump float;varying vec2 v;uniform sampler2D a,b;uniform float t,time,mode;uniform vec2 res,ra,rb;
      vec2 cover(vec2 uv,vec2 img){float s=max(res.x/img.x,res.y/img.y);vec2 sz=img*s;return (uv*res-(res-sz)*.5)/sz;}
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 uv=v;float k=t*(1.-t)*4.;float m;vec2 dA=vec2(0.),dB=vec2(0.);vec3 glow=vec3(.9,.95,1.);float gw=.12;
        if(mode<.5){float n=nz(uv*3.+time*.05)*.6+nz(uv*9.)*.4;m=1.-smoothstep(t-.25,t+.25,n*.6+uv.x*.4+(1.-uv.y)*.1);dA=vec2(n-.5,n*.3)*k*.18;dB=-dA;}
        else if(mode<1.5){float n=nz(uv*4.)*.7+nz(uv*14.)*.3;float e=n*.7+(1.-uv.y)*.3;m=1.-smoothstep(t-.04,t+.04,e*.999);float edge=1.-smoothstep(0.,.07,abs(e-t));glow=vec3(1.,.42,.08)*edge*2.2;gw=1.;dA=vec2(0.,-k*.04*n);}
        else if(mode<2.5){vec2 g=vec2(48.,27.);vec2 c=floor(uv*g)/g;float r=h(c);m=step(r,t*1.15-.08+uv.x*.1);float px=mix(1.,32.,k);vec2 q=floor(uv*res/px)*px/res;dA=q-uv;dB=dA;glow=vec3(.75,1.,.25);gw=.08*k;}
        else if(mode<3.5){float bars=10.;float f=fract(uv.x*bars);float o=(floor(uv.x*bars)/bars)*.35;m=step(f,clamp((t-o)*1.6,0.,1.));dA=vec2(0.,k*.02);dB=vec2(0.,-k*.02);glow=vec3(.85,.7,.4);gw=.06;}
        else if(mode<4.5){float row=h(vec2(floor(uv.y*70.),3.));float e=uv.x*.7+row*.3;m=1.-smoothstep(t-.03,t+.03,1.-e);dA=vec2(k*.12*row,0.);dB=vec2(-k*.12*(1.-row),0.);glow=vec3(1.,.55,.15);gw=.25*k;}
        else{float d=distance((uv-.5)*vec2(res.x/res.y,1.),vec2(0.));float R=t*1.3;m=1.-smoothstep(R-.06,R,d);float w=sin(d*40.-t*12.)*.012*k;dA=normalize(uv-.5+.0001)*w;dB=dA;glow=vec3(.8,.9,1.);gw=.1;}
        float za=1.+t*.08,zb=1.08-t*.08;
        vec4 ca=texture2D(a,cover((uv+dA-.5)/za+.5,ra));vec4 cb=texture2D(b,cover((uv+dB-.5)/zb+.5,rb));
        vec4 c=mix(ca,cb,m);
        float seam=m*(1.-m)*4.;c.rgb+=glow*(mode>.5&&mode<1.5?1.:seam)*gw*(mode>.5&&mode<1.5?k:1.);
        gl_FragColor=c;}`;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const sizeGL = () => {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const tex = (img) => {
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      return { tx, w: img.naturalWidth, h: img.naturalHeight };
    };
    const draw = (time) => {
      if (!gl || !texs[glFrom] || !texs[glTo]) return;
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs[glFrom].tx);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texs[glTo].tx);
      gl.uniform1i(uni.a, 0); gl.uniform1i(uni.b, 1);
      gl.uniform1f(uni.t, glP); gl.uniform1f(uni.time, time / 1000); gl.uniform1f(uni.mode, MODE);
      gl.uniform2f(uni.res, canvas.width, canvas.height);
      gl.uniform2f(uni.ra, texs[glFrom].w, texs[glFrom].h); gl.uniform2f(uni.rb, texs[glTo].w, texs[glTo].h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    if (gl) {
      try {
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ["a", "b", "t", "time", "mode", "res", "ra", "rb"].forEach((k) => (uni[k] = gl.getUniformLocation(prog, k)));
        const load = (i) => new Promise((res) => {
          const im = imgs[i];
          if (im.loading === "lazy") im.loading = "eager";
          const done = () => { try { texs[i] = tex(im); } catch (e) { /* cross-origin or decode failure: stay on CSS */ } res(); };
          im.complete && im.naturalWidth ? done() : im.addEventListener("load", done, { once: true });
        });
        load(0).then(() => {
          if (!texs[0]) { gl = null; return; }
          sizeGL(); draw(0); root.classList.add("has-gl");
          imgs.forEach((_, i) => i && load(i));
        });
        window.addEventListener("resize", () => { sizeGL(); draw(performance.now()); });
      } catch (e) { gl = null; }
    }

    /* --- copy animation --- */
    const showCopy = (i, dir) => {
      copies.forEach((c, k) => {
        const on = k === i;
        c.setAttribute("aria-hidden", String(!on));
        c.querySelectorAll("a").forEach((a) => (on ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
      });
      const prev = copies[cur], next = copies[i];
      if (gsap) {
        const outEls = prev.querySelectorAll(".promo-k, .promo-t, .promo-p, .cta-row, .promo-cap");
        const inEls = next.querySelectorAll(".promo-k, .promo-t, .promo-p, .cta-row, .promo-cap");
        gsap.to(outEls, { y: -40 * dir, opacity: 0, duration: 0.5, ease: "power3.in", stagger: 0.04, onComplete: () => prev.classList.remove("is-on") });
        next.classList.add("is-on");
        gsap.fromTo(inEls, { y: 60 * dir, opacity: 0, clipPath: "inset(0 0 100% 0)" }, { y: 0, opacity: 1, clipPath: "inset(0 0 -20% 0)", duration: 1.1, ease: "expo.out", stagger: 0.08, delay: 0.45 });
      } else {
        prev.classList.remove("is-on"); next.classList.add("is-on");
      }
    };
    const go = (i, dir = 1) => {
      i = (i + n) % n;
      if (i === cur || busy) return;
      busy = true;
      bgs[cur].classList.remove("is-on"); bgs[i].classList.add("is-on");
      tabs.forEach((t, k) => { t.classList.toggle("is-on", k === i); t.setAttribute("aria-selected", String(k === i)); t.classList.toggle("is-done", false); t.querySelector("b").style.transform = "scaleX(0)"; });
      showCopy(i, dir);
      if (gl && texs[i] && texs[cur]) {
        glFrom = cur; glTo = i; glP = 0;
        const start = performance.now(), D = 1600;
        cancelAnimationFrame(glAnim);
        const step = (now) => {
          const x = Math.min(1, (now - start) / D);
          glP = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
          draw(now);
          if (x < 1) glAnim = requestAnimationFrame(step); else { glFrom = i; glP = 0; draw(now); }
        };
        glAnim = requestAnimationFrame(step);
      }
      cur = i; t0 = performance.now();
      setTimeout(() => (busy = false), 900);
    };
    tabs.forEach((t, k) => t.addEventListener("click", () => go(k, k > cur ? 1 : -1)));
    root.querySelector("[data-pnext]").addEventListener("click", () => go(cur + 1, 1));
    root.querySelector("[data-pprev]").addEventListener("click", () => go(cur - 1, -1));
    if (pauseBtn) pauseBtn.addEventListener("click", () => {
      paused = !paused; pauseBtn.setAttribute("aria-pressed", String(paused));
      pauseBtn.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow");
    });
    root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
    root.addEventListener("pointerleave", () => (hover = false));
    root.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(cur + 1, 1); if (e.key === "ArrowLeft") go(cur - 1, -1); });
    let sx = null;
    root.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
    root.addEventListener("touchend", (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); sx = null; });
    new IntersectionObserver((es) => es.forEach((e) => (visible = e.isIntersecting))).observe(root);
    if (T1.reduce) { paused = true; if (pauseBtn) pauseBtn.setAttribute("aria-pressed", "true"); }

    let last = performance.now();
    const loop = (now) => {
      const dt = now - last; last = now;
      if (paused || hover || !visible || document.hidden) t0 += dt;
      const x = Math.min(1, (now - t0) / DUR);
      const bar = tabs[cur] && tabs[cur].querySelector("b");
      if (bar) bar.style.transform = `scaleX(${x})`;
      if (x >= 1) go(cur + 1, 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    T1.onIntro(() => {
      const first = copies[0].querySelectorAll(".promo-k, .promo-t, .promo-p, .cta-row, .promo-cap");
      if (gsap) gsap.from(first, { y: 70, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.1 });
      if (gsap) gsap.from(root.querySelector(".promo-ui"), { y: 40, opacity: 0, duration: 1.2, ease: "expo.out", delay: 0.5 });
    });
  }

  /* ---------- curved branch slider: cards on an arc, drag / wheel / keys / filters ---------- */
  function curveSlider(root, T1) {
    const stage = root.querySelector(".curve-stage");
    const all = Array.from(root.querySelectorAll(".curve-card"));
    if (!stage || !all.length) return;
    const counter = root.querySelector("[data-counter]");
    const bar = root.querySelector("[data-cbar]");
    const D = (k) => root.querySelector(`[data-d=${k}]`);
    const detail = root.querySelector(".curve-detail");
    const pad = (n) => String(n).padStart(2, "0");
    let cards = all.slice(), pos = 0, target = 0, drag = null, hover = false, visible = false, last = 0;
    root.classList.add("is-curve");

    const spacing = () => Math.min(Math.max(stage.clientWidth * 0.24, 170), 330);
    const layout = () => {
      const sp = spacing();
      all.forEach((c) => { if (!cards.includes(c)) c.style.cssText = "opacity:0;visibility:hidden;pointer-events:none"; });
      cards.forEach((c, i) => {
        let d = i - pos;
        const n = cards.length;
        if (n > 4) d = ((d % n) + n + n / 2) % n - n / 2; // wrap so the arc loops
        const a = Math.abs(d);
        const hide = a > 3.4;
        c.style.cssText = `transform: translate(-50%,-50%) translate3d(${d * sp}px, ${d * d * 18}px, ${-a * 170}px) rotateY(${-d * 18}deg) rotateZ(${d * 3}deg);` +
          `opacity:${hide ? 0 : Math.min(1, Math.max(0, (3.4 - a) / 0.9))};z-index:${100 - Math.round(a * 10)};visibility:${hide ? "hidden" : "visible"};` +
          `filter:brightness(${1 - Math.min(a, 3) * 0.13});`;
        c.classList.toggle("is-active", a < 0.5);
      });
    };
    const active = () => cards[((Math.round(pos) % cards.length) + cards.length) % cards.length];
    const show = () => {
      const c = active(); if (!c) return;
      const i = cards.indexOf(c);
      if (counter) counter.textContent = `${pad(i + 1)} / ${pad(cards.length)}`;
      if (bar) bar.style.transform = `scaleX(${(i + 1) / cards.length})`;
      if (c === last) return; last = c;
      const v = c.dataset;
      D("type").textContent = v.type; D("name").textContent = v.name; D("country").textContent = v.c; D("cap").textContent = v.cap;
      D("info").textContent = v.note || v.address || `${v.type} in ${v.c}, listed on the group's website. Full address and opening hours to be confirmed.`;
      const map = D("map"); if (map) map.href = v.map || "#";
      const book = D("book"); if (book && v.href) book.href = v.href;
      const ph = D("phone"); if (ph && v.phone) { ph.href = "tel:" + v.phone.replace(/[^+\d]/g, ""); ph.textContent = "Call the branch · " + v.phone; }
      if (T1.motion && T1.gsap) T1.gsap.fromTo(detail.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out", stagger: 0.05, overwrite: true });
    };
    const go = (t) => { target = t; };
    const snapTo = (i) => { // nearest equivalent index so wrap-around goes the short way
      const n = cards.length; let t = i;
      if (n > 4) t = Math.round(pos) + ((((i - Math.round(pos)) % n) + n + n / 2) % n - n / 2);
      go(t);
    };
    let dirty = true;
    window.addEventListener("resize", () => (dirty = true));
    const tick = () => {
      if (!drag) pos += (target - pos) * (T1.reduce ? 1 : 0.12);
      if (Math.abs(target - pos) < 0.001) pos = target;
      if (dirty || drag || pos !== target) { layout(); show(); dirty = pos !== target; }
      requestAnimationFrame(tick);
    };

    // pointer drag
    stage.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, p: pos, moved: false };
      root.classList.add("is-drag");
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      pos = drag.p - dx / spacing(); target = pos;
    });
    window.addEventListener("pointerup", () => {
      if (!drag) return;
      const moved = drag.moved; drag = null; root.classList.remove("is-drag");
      go(Math.round(pos));
      if (moved) { stage.dataset.justDragged = "1"; setTimeout(() => delete stage.dataset.justDragged, 50); }
    });
    stage.addEventListener("click", (e) => {
      const c = e.target.closest(".curve-card");
      if (!c || stage.dataset.justDragged) return;
      if (c === active()) { const b = root.querySelector("[data-d=book]"); if (c.dataset.href) location.href = c.dataset.href; else b.click(); } else snapTo(cards.indexOf(c));
    });
    // horizontal wheel / trackpad swipe only, so vertical page scroll is never trapped
    let wheelLock = 0;
    stage.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      const now = Date.now(); if (now - wheelLock < 260) return; wheelLock = now;
      go(Math.round(target) + Math.sign(e.deltaX));
    }, { passive: false });
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { go(Math.round(target) + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(Math.round(target) - 1); e.preventDefault(); }
    });
    root.querySelector("[data-cprev]").addEventListener("click", () => go(Math.round(target) - 1));
    root.querySelector("[data-cnext]").addEventListener("click", () => go(Math.round(target) + 1));

    // book: preselect this branch in the form
    root.querySelector("[data-d=book]").addEventListener("click", () => {
      const sel = document.getElementById("f-branch"), c = active();
      if (c && c.dataset.href) return; // goes to the branch page
      if (sel && c) { const want = `${c.dataset.name} · ${c.dataset.c}`; Array.from(sel.options).forEach((o) => { if (o.text === want) sel.value = o.value || o.text; }); }
    });

    // country filters (buttons inside the slider + the country cards above it)
    const filterBtns = Array.from(root.querySelectorAll("[data-cfilter]"));
    const filter = (val) => {
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cfilter === val)));
      cards = all.filter((c) => val === "all" || c.dataset.c === val);
      pos = Math.min(2, cards.length - 1) + 0.9; target = 0; last = 0; dirty = true;
      if (cards.length <= 4) pos = cards.length - 1 + 0.6;
    };
    filterBtns.forEach((b) => b.addEventListener("click", () => filter(b.dataset.cfilter)));
    document.querySelectorAll("[data-filter-proxy]").forEach((b) => b.addEventListener("click", () => {
      filter(b.dataset.filterProxy);
      if (T1.scrollTo) T1.scrollTo(root, { offset: -90 }); else root.scrollIntoView({ behavior: "smooth", block: "center" });
    }));

    // autoplay while on screen and not being used
    root.addEventListener("pointerenter", () => (hover = true));
    root.addEventListener("pointerleave", () => (hover = false));
    root.addEventListener("focusin", () => (hover = true));
    root.addEventListener("focusout", () => (hover = false));
    new IntersectionObserver((es) => es.forEach((e) => (visible = e.isIntersecting)), { threshold: 0.35 }).observe(root);
    if (!T1.reduce) setInterval(() => { if (visible && !hover && !drag && !document.hidden) go(Math.round(target) + 1); }, 3600);

    // entrance: fan the arc open from the centre
    pos = 3.5;
    tick();
  }

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
      const bodyWrap = $(".body-wrap");
      if (bodyWrap) {
        T1.onIntro(() => {
          gsap.from(".glass-body", { y: 70, opacity: 0, scale: 0.9, duration: 1.8, ease: "expo.out" });
          gsap.from(".hotspot", { scale: 0, duration: 0.8, ease: "back.out(2)", stagger: 0.08, delay: 0.9 });
        });
        const spots = $$(".hotspot", bodyWrap);
        let k = 0;
        setInterval(() => {
          if (document.hidden || bodyWrap.classList.contains("is-off")) return;
          spots.forEach((h, i) => h.classList.toggle("is-show", i === k));
          k = (k + 1) % spots.length;
        }, 1800);
      }
      // pause the CSS anatomy loops whenever they are offscreen
      const offIO = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-off", !e.isIntersecting)));
      $$(".organ-card, .body-wrap").forEach((el) => offIO.observe(el));
      $$(".organ-stage").forEach((st) => tilt(st, T1, 12));

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
    document.querySelectorAll("[data-curve]").forEach((r) => curveSlider(r, T1)); // works with or without motion
    document.querySelectorAll("[data-promo]").forEach((r) => promoSlider(r, T1));
    if (!T1.motion || !THEMES[theme]) return;
    THEMES[theme](T1);
  };
})();
