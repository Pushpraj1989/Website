/* Tier 1 concept redesigns: shared motion engine.
   Needs gsap + ScrollTrigger + Lenis (vendored). If they fail to load, the page
   falls back to a static, fully readable layout. Theme effects live in fx.js. */
(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = !!(gsap && ST) && !reduce;

  const T1 = (window.T1 = { $, $$, gsap, ST, motion, fine, reduce, lenis: null, introDone: false, introCbs: [] });
  T1.onIntro = (cb) => (T1.introDone ? cb() : T1.introCbs.push(cb));
  const fireIntro = () => {
    if (T1.introDone) return;
    T1.introDone = true;
    T1.introCbs.splice(0).forEach((cb) => cb());
  };

  if (!motion) root.classList.add("no-motion");
  if (gsap && ST) gsap.registerPlugin(ST);

  /* ---------- smooth scroll ---------- */
  if (motion && window.Lenis) {
    const lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    T1.lenis = lenis;
    lenis.on("scroll", ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToEl = (target) => {
    if (T1.lenis) T1.lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else (typeof target === "number" ? window.scrollTo({ top: target }) : target.scrollIntoView());
  };
  T1.scrollTo = scrollToEl;

  /* ---------- split text (keeps one level of inline markup such as <em>) ---------- */
  // second-language interface strings (window.T1L on /ar/ pages); {0} {1} fill values
  const L = (t, ...v) => v.reduce((x, y, i) => x.replace("{" + i + "}", y), (window.T1L && window.T1L[t]) || t);
  T1.L = L;
  const joined = /^(ar|fa|ur|he)/.test(document.documentElement.lang);  // scripts whose letters join: never split into characters
  T1.split = (el, type = "words") => {
    if (el._split) return el._split;
    if (joined && type === "chars") type = "words";
    const label = el.textContent.replace(/\s+/g, " ").trim();
    const makeWord = (text) => {
      const w = document.createElement("span");
      w.className = "split-word";
      if (type === "chars") {
        for (const ch of text) {
          const c = document.createElement("span");
          c.className = "split-char";
          c.textContent = ch;
          w.appendChild(c);
        }
      } else w.textContent = text;
      return w;
    };
    const top = [];
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).filter(Boolean).forEach((t) => top.push(makeWord(t)));
      } else if (node.nodeType === 1) {
        if (node.tagName === "BR") { top.push(node.cloneNode()); return; }
        const shell = node.cloneNode(false);
        node.textContent.split(/\s+/).filter(Boolean).forEach((t, i, arr) => {
          shell.appendChild(makeWord(t));
          if (i < arr.length - 1) shell.appendChild(document.createTextNode(" "));
        });
        top.push(shell);
      }
    });
    el.textContent = "";
    top.forEach((n, i) => {
      el.appendChild(n);
      if (i < top.length - 1 && n.tagName !== "BR") el.appendChild(document.createTextNode(" "));
    });
    let lines = [];
    if (type === "lines") {
      let cur = null;
      let lastTop = null;
      top.forEach((n) => {
        if (n.tagName === "BR") { lastTop = null; return; }
        const probe = n.classList && n.classList.contains("split-word") ? n : n.querySelector(".split-word") || n;
        const t = probe.offsetTop;
        if (lastTop === null || Math.abs(t - lastTop) > 4) { cur = []; lines.push(cur); lastTop = t; }
        cur.push(n);
      });
      el.textContent = "";
      lines = lines.map((nodes) => {
        const line = document.createElement("span");
        line.className = "split-line";
        const inner = document.createElement("span");
        inner.className = "split-line-inner";
        inner.style.display = "block";
        nodes.forEach((n, i) => {
          inner.appendChild(n);
          if (i < nodes.length - 1) inner.appendChild(document.createTextNode(" "));
        });
        line.appendChild(inner);
        el.appendChild(line);
        return inner;
      });
    }
    el.setAttribute("aria-label", label);
    Array.from(el.children).forEach((c) => c.setAttribute("aria-hidden", "true"));
    el._split = { lines, words: $$(".split-word", el), chars: $$(".split-char", el) };
    return el._split;
  };

  /* ---------- reveal presets ----------
     Each reveal is a paused timeline. Hero items play once after the loader;
     everything else plays when it enters the viewport from either direction
     and reverses when it leaves, so motion happens scrolling down and back up. */
  const buildReveal = (el) => {
    const kind = el.dataset.anim;
    const tl = gsap.timeline({ paused: true });
    gsap.set(el, { visibility: "visible" });
    switch (kind) {
      case "lines": {
        const { lines } = T1.split(el, "lines");
        tl.from(lines, { yPercent: 115, rotate: 2, duration: 1.15, ease: "expo.out", stagger: 0.09 });
        break;
      }
      case "chars": {
        const { chars } = T1.split(el, "chars");
        tl.from(chars, { yPercent: 110, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.025 });
        break;
      }
      case "words": {
        const { words } = T1.split(el, "words");
        tl.from(words, { y: 24, opacity: 0, filter: "blur(6px)", duration: 0.9, ease: "power3.out", stagger: 0.035 });
        break;
      }
      case "img": {
        const img = el.querySelector("img");
        tl.from(el, { clipPath: "inset(100% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut" });
        if (img) tl.from(img, { scale: 1.35, duration: 1.8, ease: "expo.out" }, 0);
        break;
      }
      case "scale":
        tl.from(el, { scale: 0.85, opacity: 0, duration: 1.2, ease: "expo.out" });
        break;
      case "left":
        tl.from(el, { x: -60, opacity: 0, duration: 1.1, ease: "expo.out" });
        break;
      default:
        tl.from(el, { y: 40, opacity: 0, duration: 1.1, ease: "expo.out" });
    }
    return tl;
  };

  const initReveals = () => {
    $$("[data-anim]").forEach((el) => {
      const d = parseFloat(el.dataset.delay || 0);
      if (el.hasAttribute("data-intro")) {
        T1.onIntro(() => { const tl = buildReveal(el); gsap.delayedCall(0.05 + d, () => tl.play()); });
        return;
      }
      let tl = null;
      let pending = null;
      const show = () => {
        tl = tl || buildReveal(el);
        if (pending) pending.kill();
        tl.timeScale(1);
        pending = gsap.delayedCall(d, () => tl.play());
      };
      const hide = () => {
        if (!tl) return;
        if (pending) pending.kill();
        tl.timeScale(1.8).reverse();
      };
      // Inside a pinned section the element stays on screen for the whole pin, so it
      // must not reverse when its own trigger "leaves"; it only resets above the section.
      const inPin = !!el.closest("[data-hscroll], [data-fly]");
      ST.create({ trigger: el, start: "top 92%", end: "bottom 8%", onEnter: show, onEnterBack: show, onLeave: inPin ? null : hide, onLeaveBack: hide });
    });
  };

  /* ---------- counters ---------- */
  const fmt = (n, suffix, dp = 0) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) + suffix;
  const initCounters = () => {
    $$("[data-count]").forEach((el) => {
      const to = parseFloat(el.dataset.to);
      const suffix = el.dataset.suffix || "";
      const dp = (el.dataset.to.split(".")[1] || "").length;
      if (!Number.isFinite(to)) return;
      const obj = { v: 0 };
      const run = () => {
        gsap.killTweensOf(obj);
        obj.v = 0;
        gsap.to(obj, { v: to, duration: 2.2, ease: "expo.out", onUpdate: () => (el.textContent = fmt(obj.v, suffix, dp)) });
      };
      ST.create({ trigger: el, start: "top 92%", end: "bottom 8%", onEnter: run, onEnterBack: run });
      el.textContent = fmt(0, suffix, dp);
    });
  };

  /* ---------- parallax ---------- */
  const initParallax = () => {
    $$("[data-speed]").forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0;
      gsap.fromTo(el, { yPercent: speed * 10 }, {
        yPercent: -speed * 10,
        ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
  };

  /* ---------- sub-page hero: the copy lifts and softens as the page scrolls past it ---------- */
  const initHeroRecede = () => {
    const hero = $(".page-hero .ph-inner");
    if (!hero) return;
    gsap.to(hero, {
      yPercent: -14, opacity: 0.25, filter: "blur(3px)", ease: "none",
      scrollTrigger: { trigger: hero.closest(".page-hero"), start: "top top", end: "bottom top", scrub: true },
    });
  };

  /* ---------- pointer spotlight: a soft light follows the cursor across cards (fine pointers only) ---------- */
  const initSpotlight = () => {
    if (!fine || reduce) return;
    $$(".news-card, .stat-tile, .msub-card, .dr-card").forEach((el) => {
      el.classList.add("spot");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  };

  /* ---------- velocity marquee ---------- */
  const initMarquees = () => {
    $$("[data-marquee]").forEach((m) => {
      const track = $(".marquee-track", m);
      if (!track) return;
      const base = parseFloat(m.dataset.marquee) || 1;
      const flip = m.dataset.dir === "right" ? -1 : 1;
      let x = 0;
      let dir = 1;
      let visible = false;
      new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(m);
      gsap.ticker.add(() => {
        if (!visible) return;
        const half = track.scrollWidth / 2;
        const v = T1.lenis ? T1.lenis.velocity : 0;
        if (Math.abs(v) > 0.2) dir = Math.sign(v);
        x -= (base * 0.7 + Math.min(Math.abs(v) * 0.35, 30)) * dir * flip;
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        track.style.transform = `translate3d(${x}px,0,0)`;
      });
    });
  };

  /* ---------- cursor + magnetic ---------- */
  const initCursor = () => {
    const cursor = $(".cursor");
    if (!cursor || !fine) return;
    root.classList.add("has-cursor");
    const dot = $(".cursor-dot", cursor);
    const ring = $(".cursor-ring", cursor);
    const label = $(".cursor-ring span", cursor);
    let mx = -100, my = -100, rx = -100, ry = -100;
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate3d(${mx}px,${my}px,0)`; }, { passive: true });
    gsap.ticker.add(() => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    });
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("a, button, [data-cursor], input, select, textarea, label");
      cursor.classList.toggle("is-hover", !!t && !t.dataset.cursor);
      cursor.classList.toggle("is-label", !!(t && t.dataset.cursor));
      if (t && t.dataset.cursor) label.textContent = t.dataset.cursor;
    });
    document.addEventListener("pointerleave", () => cursor.classList.remove("is-hover", "is-label"));
  };

  const initMagnetic = () => {
    if (!fine) return;
    $$("[data-magnetic]").forEach((el) => {
      const s = parseFloat(el.dataset.magnetic) || 0.3;
      const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * s);
        yTo((e.clientY - r.top - r.height / 2) * s);
      });
      el.addEventListener("pointerleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
      });
    });
  };

  /* ---------- nudges, page transitions, mega menu previews, news filter ---------- */
  const ring = $("[data-ring]");
  const actionBar = $(".action-bar");
  const dockEl = $("[data-dock]");
  const offer = $("[data-offer]");
  let offerShown = false;
  const offerKey = offer ? "t1-offer-" + offer.dataset.offer : "";
  // full-screen product showcases: the offer never covers them, it waits or steps aside
  const showcases = $$(".film, .cv, .stk, .lu, .scrub");
  const inShowcase = () => showcases.some((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4; });
  const maybeOffer = (y, max) => {
    if (offer && offerShown && !offer.hidden) offer.classList.toggle("is-tucked", inShowcase());
    if (!offer || offerShown || max <= 0 || y / max < 0.35 || inShowcase()) return;
    offerShown = true;
    try { if (localStorage.getItem(offerKey)) return; } catch {}
    offer.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => offer.classList.add("is-in")));
    // step aside after a while if ignored (not remembered: it may show again next visit)
    let touched = false;
    offer.addEventListener("pointerenter", () => (touched = true), { once: true });
    setTimeout(() => { if (!touched) { offer.classList.remove("is-in"); setTimeout(() => (offer.hidden = true), 500); } }, 15000);
  };
  if (offer) $$("[data-offer-close]", offer).forEach((b) => b.addEventListener("click", () => {
    offer.classList.remove("is-in");
    setTimeout(() => (offer.hidden = true), 500);
    try { localStorage.setItem(offerKey, "1"); } catch {}
  }));

  const dock = $("[data-dock]");
  if (dock) {
    const dt = $("[data-dock-toggle]", dock);
    const setDock = (open) => { dock.classList.toggle("is-open", open); dt.setAttribute("aria-expanded", String(open)); };
    dt.addEventListener("click", () => setDock(!dock.classList.contains("is-open")));
    document.addEventListener("click", (e) => { if (!dock.contains(e.target)) setDock(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setDock(false); });
  }

  // mega menu: hovering an entry swaps the preview photo
  $$(".mega").forEach((mg) => {
    const img = $(".mega-preview img", mg);
    if (!img) return;
    $$("[data-preview]", mg).forEach((a) => a.addEventListener("pointerenter", () => {
      const src = a.dataset.preview;
      if (!src || img.getAttribute("src") === src) return;
      img.classList.add("is-swap");
      setTimeout(() => { img.src = src; img.onload = () => img.classList.remove("is-swap"); }, 180);
    }));
  });

  // news tag filter
  const nf = $("[data-news-filters]");
  if (nf) nf.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nf]");
    if (!b) return;
    $$("[data-nf]", nf).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $$(".news-card, .news-lead").forEach((c) => (c.hidden = !(b.dataset.nf === "all" || c.dataset.tag === b.dataset.nf)));
    if (motion) { gsap.from($$(".news-card:not([hidden])"), { y: 30, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.05 }); ST.refresh(); }
  });

  // page transitions: a colour wipe covers the page, the next page lifts it
  const wipe = $(".page-wipe");
  const lift = () => {
    if (!root.classList.contains("is-arriving")) return;
    root.classList.remove("is-arriving");
    if (wipe) { wipe.classList.add("is-out"); setTimeout(() => wipe.classList.remove("is-out"), 1000); }
  };
  if (wipe && motion) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href) || !/\.html(#.*)?$/.test(href)) return;
      e.preventDefault();
      try { sessionStorage.setItem("t1-nav", "1"); } catch {}
      wipe.classList.remove("is-out");
      wipe.classList.add("is-in");
      setTimeout(() => (location.href = a.href), 520);
    });
    // back/forward cache: never come back to a covered page
    addEventListener("pageshow", (e) => { if (e.persisted) { wipe.classList.remove("is-in"); lift(); } });
  }
  T1.lift = lift;

  // doctor directory: search, filters, show more
  $$("[data-doctors]").forEach((w) => {
    const q = $("[data-dq]", w), sp = $("[data-ds]", w), br = $("[data-db]", w), more = $("[data-dmore]", w);
    const cards = $$(".dr-card", w), count = $("[data-dcount]", w), empty = $("[data-dempty]", w);
    let limit = 24;
    const run = () => {
      const t = q.value.trim().toLowerCase(); let n = 0, shown = 0;
      cards.forEach((c) => {
        const ok = (!t || c.dataset.t.includes(t)) && (!sp.value || c.dataset.s === sp.value) && (!br.value || c.dataset.b === br.value);
        if (ok) n++;
        const vis = ok && n <= limit;
        if (vis) shown++;
        c.hidden = !vis;
      });
      count.textContent = (n === 1 ? L("1 doctor") : L("{0} doctors", n)) + (n > shown ? L(", showing {0}", shown) : "");
      more.hidden = n <= limit; empty.hidden = n !== 0;
      if (motion) ST.refresh();
    };
    [q, sp, br].forEach((el) => el.addEventListener("input", () => { limit = 24; run(); }));
    more.addEventListener("click", () => { limit += 24; run(); });
    const sel = new URLSearchParams(location.search).get("spec");
    if (sel) sp.value = sel;
    run();
  });

  // packages: country tabs
  $$("[data-pk-tabs]").forEach((tabs) => {
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pkc]"); if (!b) return;
      $$("[data-pkc]", tabs).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const shown = [];
      $$(".pk-card").forEach((c) => { c.hidden = c.dataset.pkc !== b.dataset.pkc; if (!c.hidden) shown.push(c); });
      if (motion) { gsap.from(shown, { y: 40, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.05 }); ST.refresh(); }
    });
  });

  // testimonials: auto-rotate, pause on hover
  $$("[data-quotes]").forEach((w) => {
    const items = $$(".q-item", w), dots = $$("[data-q]", w);
    let i = 0, hold = false;
    const show = (k) => { i = (k + items.length) % items.length; items.forEach((it, j) => it.classList.toggle("is-on", j === i)); dots.forEach((d, j) => d.classList.toggle("is-on", j === i)); };
    dots.forEach((d, j) => d.addEventListener("click", () => show(j)));
    w.addEventListener("pointerenter", () => (hold = true)); w.addEventListener("pointerleave", () => (hold = false));
    if (!reduce && items.length > 1) setInterval(() => { if (!hold && !document.hidden) show(i + 1); }, 7000);
  });

  // branch chosen in the slider (possibly on another page) preselects the booking form
  try {
    const want = sessionStorage.getItem("t1-branch"), sel = document.getElementById("f-branch");
    if (want && sel) Array.from(sel.options).forEach((o) => { if (o.text === want) sel.value = o.value || o.text; });
  } catch {}

  // catalogue: category filter + search
  $$("[data-catalogue]").forEach((w) => {
    const q = $("[data-catq]", w), cards = $$(".pc", w), empty = $("[data-cat-empty]", w);
    let cat = "all";
    const run = () => {
      const t = (q ? q.value : "").trim().toLowerCase(); let n = 0; const shown = [];
      cards.forEach((c) => { const ok = (cat === "all" || c.dataset.cat === cat) && (!t || c.dataset.q.includes(t)); if (ok && c.hidden) shown.push(c); c.hidden = !ok; if (ok) n++; });
      if (empty) empty.hidden = n !== 0;
      if (motion && shown.length) gsap.from(shown, { y: 30, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.04 });
      if (motion) ST.refresh();
    };
    $$("[data-catf]", w).forEach((b) => b.addEventListener("click", () => {
      cat = b.dataset.catf; $$("[data-catf]", w).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); run();
    }));
    if (q) q.addEventListener("input", run);
  });

  // product options: one chip per group is selected
  $$(".pd-chips").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest("[data-chip]"); if (!b) return;
    $$("[data-chip]", g).forEach((x) => x.classList.toggle("is-on", x === b));
  }));

  // drag-to-scroll strips (mouse); touch scrolls natively
  $$("[data-hdrag]").forEach((tr) => {
    let d = null;
    tr.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; d = { x: e.clientX, s: tr.scrollLeft, moved: false }; tr.classList.add("is-drag"); });
    addEventListener("pointermove", (e) => { if (!d) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 5) d.moved = true; tr.scrollLeft = d.s - dx; });
    addEventListener("pointerup", () => { if (!d) return; const moved = d.moved; d = null; tr.classList.remove("is-drag"); if (moved) { tr.dataset.dragged = "1"; setTimeout(() => delete tr.dataset.dragged, 50); } });
    tr.addEventListener("click", (e) => { if (tr.dataset.dragged) e.preventDefault(); }, true);
  });

  // loan / EMI estimate (runs on the device)
  $$("[data-emi]").forEach((f) => {
    const cur = f.dataset.cur ? f.dataset.cur + " " : "";
    const fmt = (v) => cur + Math.round(v).toLocaleString("en");
    const calc = () => {
      const P = +f.elements.p.value, r = +f.elements.r.value / 1200, N = +f.elements.n.value;
      const m = r ? (P * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1) : P / N;
      $("[data-o=p]", f).textContent = fmt(P); $("[data-o=r]", f).textContent = f.elements.r.value + "%"; $("[data-o=n]", f).textContent = N;
      $("[data-emi-v]", f).textContent = fmt(m);
      $("[data-emi-total]", f).textContent = `Total repaid ${fmt(m * N)}, of which interest ${fmt(m * N - P)}.`;
    };
    f.addEventListener("input", calc); f.addEventListener("submit", (e) => e.preventDefault()); calc();
  });

  // BMI tool (runs on the device; nothing is sent)
  $$("[data-bmi]").forEach((f) => {
    const h = f.elements.h, w = f.elements.w;
    const calc = () => {
      const v = w.value / Math.pow(h.value / 100, 2);
      $("[data-o=h]", f).textContent = h.value + " cm";
      $("[data-o=w]", f).textContent = w.value + " " + L("kg");
      $("[data-bmi-v]", f).textContent = v.toFixed(1);
      const band = L(v < 18.5 ? "Underweight" : v < 25 ? "Healthy range" : v < 30 ? "Overweight" : "Obese");
      $("[data-bmi-band]", f).textContent = band;
      const arc = $("[data-arc]", f);
      arc.style.strokeDashoffset = String(100 - Math.max(4, Math.min(100, ((v - 12) / 28) * 100)));
      arc.style.stroke = v < 18.5 || v >= 30 ? "#d9534f" : v >= 25 ? "#e3a008" : "";
    };
    f.addEventListener("input", calc);
    f.addEventListener("submit", (e) => e.preventDefault());
    calc();
  });

  /* ---------- header, progress, to-top ---------- */
  const header = $("[data-header]");
  const progress = $(".progress");
  const toTop = $("[data-to-top]");
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    const max = root.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      const open = header.classList.contains("is-open");
      header.classList.toggle("is-hidden", !open && y > 300 && y > lastY + 2);
      if (y < lastY - 2) header.classList.remove("is-hidden");
    }
    if (toTop) toTop.classList.toggle("is-visible", y > 900);
    if (ring) ring.style.strokeDashoffset = String(100 - (max > 0 ? (y / max) * 100 : 0));
    if (actionBar) actionBar.classList.toggle("is-in", y > 240);
    if (dockEl) dockEl.classList.toggle("is-in", y > innerHeight * 0.7);
    maybeOffer(y, max);
    lastY = y;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- menu + anchors ---------- */
  const toggle = $("[data-menu]");
  const setOpen = (open) => {
    if (!header || !toggle) return;
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? L("Close menu") : L("Open menu"));
    if (T1.lenis) open ? T1.lenis.stop() : T1.lenis.start();
  };
  if (toggle) toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header && header.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
  });
  matchMedia("(min-width: 961px)").addEventListener("change", (e) => e.matches && setOpen(false));
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    setOpen(false);
    scrollToEl(target);
    if (target && target.focus && id !== "#top") target.setAttribute("tabindex", "-1"), target.focus({ preventScroll: true });
  });

  const navLinks = $$(".nav a[href^='#']");
  if (navLinks.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean).forEach((s) => io.observe(s));
  }

  /* ---------- location filter ---------- */
  const filterWrap = $("[data-filters]");
  const locItems = $$("[data-country]");
  const result = $("[data-result]");
  const empty = $("[data-empty]");
  if (locItems.length && result) {
    const update = (value) => {
      let shown = 0;
      if (filterWrap) $$("[data-filter]", filterWrap).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === value)));
      const showing = [];
      locItems.forEach((el) => {
        const match = value === "all" || el.dataset.country === value;
        if (match) { if (el.hidden) showing.push(el); el.hidden = false; shown++; } else el.hidden = true;
      });
      if (motion && showing.length) gsap.from(showing, { y: 24, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.04 });
      result.textContent = `Showing ${shown} of ${locItems.length} locations`;
      if (empty) empty.hidden = shown !== 0;
      if (motion) ST.refresh();
    };
    if (filterWrap) filterWrap.addEventListener("click", (e) => { const b = e.target.closest("[data-filter]"); if (b) update(b.dataset.filter); });
    $$("[data-filter-proxy]").forEach((b) => b.addEventListener("click", () => { update(b.dataset.filterProxy); scrollToEl(filterWrap || result); }));
    update("all");
  }

  /* ---------- enquiry form ---------- */
  const form = $("[data-form]");
  if (form) {
    const status = $("[data-status]", form);
    const endpoint = form.dataset.endpoint || "";
    const rules = {
      name: (v) => v.trim().length >= 2 || L("Please enter your name."),
      contact: (v) => {
        const s = v.trim();
        if (s.includes("@")) return /^\S+@\S+\.\S+$/.test(s) || L("Enter a valid email address.");
        return /^\+?[\d\s-]{7,}$/.test(s) || L("Enter an email address or phone number.");
      },
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let firstBad = null;
      $$("[data-rule]", form).forEach((input) => {
        const wrap = input.closest("[data-field]");
        const check = rules[input.dataset.rule];
        const msg = check ? check(input.value) : true;
        const bad = msg !== true;
        wrap.toggleAttribute("data-invalid", bad);
        input.setAttribute("aria-invalid", String(bad));
        const err = $("[data-err]", wrap);
        if (err) err.textContent = bad ? msg : "";
        if (bad && !firstBad) firstBad = input;
        if (bad && motion) gsap.fromTo(input, { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
      });
      if (firstBad) { status.textContent = ""; firstBad.focus(); return; }
      if (!endpoint) { status.textContent = L("Preview only: this form is not connected to a backend yet."); return; }
      try {
        status.textContent = L("Sending…");
        const res = await fetch(endpoint, { method: "POST", body: new FormData(form) });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        status.textContent = L("Thank you. We will be in touch.");
      } catch {
        status.textContent = L("Something went wrong. Please try again or call us directly.");
      }
    });
  }

  /* ---------- opening loader ---------- */
  const loader = $(".loader");
  const runLoader = () => {
    lift();
    if (!loader || !motion) { if (loader) loader.hidden = true; fireIntro(); return; }
    let seen = false;
    const seenKey = "t1-seen-" + location.pathname.replace(/[^/]*$/, ""); // once per site, not per page
    try { seen = sessionStorage.getItem(seenKey) === "1"; sessionStorage.setItem(seenKey, "1"); } catch {}
    if (T1.lenis) T1.lenis.stop();
    const count = $(".loader-count", loader);
    const bar = $(".loader-bar i", loader);
    const nameChars = $$(".loader-name span", loader);
    const obj = { v: 0 };
    const dur = seen ? 0.5 : 1.5;
    const tl = gsap.timeline({
      onComplete: () => { loader.hidden = true; if (T1.lenis) T1.lenis.start(); },
    });
    tl.from(nameChars, { yPercent: 110, duration: 0.8, ease: "expo.out", stagger: 0.03 }, 0)
      .to(obj, { v: 100, duration: dur, ease: "power2.inOut", onUpdate: () => { if (count) count.textContent = String(Math.round(obj.v)).padStart(3, "0"); } }, 0)
      .to(bar, { scaleX: 1, duration: dur, ease: "power2.inOut" }, 0)
      .to(nameChars, { yPercent: -110, duration: 0.6, ease: "expo.in", stagger: 0.02 }, dur)
      .to(loader, { clipPath: "inset(0% 0% 100% 0%)", duration: 1, ease: "expo.inOut" }, dur + 0.25)
      .add(fireIntro, dur + 0.55);
  };

  /* ---------- boot ---------- */
  const boot = () => {
    // Theme effects first: they create the pinned sections, and every reveal
    // trigger further down the page must be measured with that pin spacing.
    if (window.T1FX) window.T1FX(T1);
    if (motion) {
      initReveals();
      initCounters();
      initParallax();
      initMarquees();
      initCursor();
      initMagnetic();
      initSpotlight();
      initHeroRecede();
      ST.sort();
    }
    runLoader();
    if (motion) {
      let t;
      const refresh = () => { clearTimeout(t); t = setTimeout(() => ST.refresh(), 150); };
      addEventListener("load", refresh);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
      // lazy images change the layout when they arrive; re-measure triggers
      $$("img").forEach((img) => { if (!img.complete) img.addEventListener("load", refresh, { once: true }); });
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
