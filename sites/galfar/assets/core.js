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
  T1.split = (el, type = "words") => {
    if (el._split) return el._split;
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

  /* ---------- reveal presets ---------- */
  const reveal = (el, delay = 0) => {
    const kind = el.dataset.anim;
    const d = delay + parseFloat(el.dataset.delay || 0);
    gsap.set(el, { visibility: "visible" });
    switch (kind) {
      case "lines": {
        const { lines } = T1.split(el, "lines");
        return gsap.from(lines, { yPercent: 115, rotate: 2, duration: 1.15, ease: "expo.out", stagger: 0.09, delay: d });
      }
      case "chars": {
        const { chars } = T1.split(el, "chars");
        return gsap.from(chars, { yPercent: 110, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.025, delay: d });
      }
      case "words": {
        const { words } = T1.split(el, "words");
        return gsap.from(words, { y: 24, opacity: 0, filter: "blur(6px)", duration: 0.9, ease: "power3.out", stagger: 0.035, delay: d });
      }
      case "img": {
        const img = el.querySelector("img");
        gsap.from(el, { clipPath: "inset(100% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut", delay: d });
        if (img) gsap.from(img, { scale: 1.35, duration: 1.8, ease: "expo.out", delay: d });
        return;
      }
      case "scale":
        return gsap.from(el, { scale: 0.85, opacity: 0, duration: 1.2, ease: "expo.out", delay: d });
      case "left":
        return gsap.from(el, { x: -60, opacity: 0, duration: 1.1, ease: "expo.out", delay: d });
      default:
        return gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: "expo.out", delay: d });
    }
  };

  const initReveals = () => {
    $$("[data-anim]").forEach((el) => {
      if (el.hasAttribute("data-intro")) {
        T1.onIntro(() => reveal(el, 0.05));
      } else {
        ST.create({ trigger: el, start: "top 88%", once: true, onEnter: () => reveal(el) });
      }
    });
  };

  /* ---------- counters ---------- */
  const fmt = (n, suffix) => Math.round(n).toLocaleString("en-US") + suffix;
  const initCounters = () => {
    $$("[data-count]").forEach((el) => {
      const to = parseFloat(el.dataset.to);
      const suffix = el.dataset.suffix || "";
      if (!Number.isFinite(to)) return;
      const obj = { v: 0 };
      ST.create({
        trigger: el,
        start: "top 90%",
        once: true,
        onEnter: () =>
          gsap.to(obj, { v: to, duration: 2.2, ease: "expo.out", onUpdate: () => (el.textContent = fmt(obj.v, suffix)) }),
      });
      el.textContent = fmt(0, suffix);
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
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
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
      name: (v) => v.trim().length >= 2 || "Please enter your name.",
      contact: (v) => {
        const s = v.trim();
        if (s.includes("@")) return /^\S+@\S+\.\S+$/.test(s) || "Enter a valid email address.";
        return /^\+?[\d\s-]{7,}$/.test(s) || "Enter an email address or phone number.";
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
      if (!endpoint) { status.textContent = "Preview only: this form is not connected to a backend yet."; return; }
      try {
        status.textContent = "Sending…";
        const res = await fetch(endpoint, { method: "POST", body: new FormData(form) });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        status.textContent = "Thank you. We will be in touch.";
      } catch {
        status.textContent = "Something went wrong. Please try again or call us directly.";
      }
    });
  }

  /* ---------- opening loader ---------- */
  const loader = $(".loader");
  const runLoader = () => {
    if (!loader || !motion) { if (loader) loader.hidden = true; fireIntro(); return; }
    let seen = false;
    try { seen = sessionStorage.getItem("t1-seen-" + location.pathname) === "1"; sessionStorage.setItem("t1-seen-" + location.pathname, "1"); } catch {}
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
    if (motion) {
      initReveals();
      initCounters();
      initParallax();
      initMarquees();
      initCursor();
      initMagnetic();
    }
    if (window.T1FX) window.T1FX(T1);
    runLoader();
    if (motion) {
      addEventListener("load", () => ST.refresh());
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
