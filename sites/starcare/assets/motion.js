/* Tier 1 concept redesigns: progressive motion layer.
   The page is fully readable without this file; it only adds movement and validation. */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  /* ---------- header, progress bar, parallax, back-to-top ---------- */
  const header = $("[data-header]");
  const progress = $(".progress");
  const toTop = $("[data-to-top]");
  const heroBg = $(".hero-bg");
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : "0");
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (toTop) toTop.classList.toggle("is-visible", y > 700);
    if (heroBg && !reduce && y < window.innerHeight * 1.2) {
      heroBg.style.transform = `translate3d(0, ${(y * 0.25).toFixed(1)}px, 0)`;
    }
    ticking = false;
  };
  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  onScroll();

  /* ---------- mobile menu ---------- */
  const toggle = $("[data-menu]");
  if (header && toggle) {
    const setOpen = (open) => {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
    $$(".nav a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------- reveal on scroll ---------- */
  const revealEls = $$("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-in"));
  } else {
    const revealIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealIO.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach((el) => revealIO.observe(el));
  }

  /* ---------- count-up figures (values come from the HTML, so no-JS shows the real number) ---------- */
  const countUp = (el) => {
    const to = parseFloat(el.dataset.to);
    const suffix = el.dataset.suffix || "";
    if (!Number.isFinite(to)) return;
    const duration = 1600;
    const start = performance.now();
    const fmt = (n) => n.toLocaleString("en-US") + suffix;
    el.textContent = fmt(0);
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const countEls = $$("[data-count]");
  if (reduce || !("IntersectionObserver" in window)) {
    // Leave the server-rendered final values in place.
  } else {
    const countIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            countUp(entry.target);
            countIO.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.6 }
    );
    countEls.forEach((el) => countIO.observe(el));
  }

  /* ---------- active section in the nav ---------- */
  const navLinks = $$(".nav a[href^='#']");
  if (navLinks.length && "IntersectionObserver" in window) {
    const targets = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
    const navIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    targets.forEach((t) => navIO.observe(t));
  }

  /* ---------- card spotlight follows the pointer ---------- */
  if (!reduce && finePointer) {
    $$(".spot").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- location filter ---------- */
  const filterWrap = $("[data-filters]");
  const locItems = $$("[data-country]");
  const result = $("[data-result]");
  const empty = $("[data-empty]");
  if (locItems.length && result) {
    const total = locItems.length;
    const update = (value) => {
      let shown = 0;
      if (filterWrap) {
        $$("[data-filter]", filterWrap).forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.filter === value))
        );
      }
      locItems.forEach((el) => {
        const match = value === "all" || el.dataset.country === value;
        if (match) {
          if (el.hidden) {
            el.hidden = false;
            if (!reduce && el.animate) {
              el.animate(
                [
                  { opacity: 0, transform: "translateY(12px)" },
                  { opacity: 1, transform: "none" },
                ],
                { duration: 420, easing: "cubic-bezier(0.2, 0.7, 0.1, 1)" }
              );
            }
          }
          shown += 1;
        } else {
          el.hidden = true;
        }
      });
      result.textContent = `Showing ${shown} of ${total} locations`;
      if (empty) empty.hidden = shown !== 0;
    };
    if (filterWrap) {
      filterWrap.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-filter]");
        if (btn) update(btn.dataset.filter);
      });
    }
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
        const value = v.trim();
        if (value.includes("@")) return /^\S+@\S+\.\S+$/.test(value) || "Enter a valid email address.";
        return /^\+?[\d\s-]{7,}$/.test(value) || "Enter an email address or phone number.";
      },
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let firstBad = null;
      $$("[data-rule]", form).forEach((input) => {
        const wrap = input.closest("[data-field]");
        const check = rules[input.dataset.rule];
        const message = check ? check(input.value) : true;
        const bad = message !== true;
        const err = $("[data-err]", wrap);
        wrap.toggleAttribute("data-invalid", bad);
        input.setAttribute("aria-invalid", String(bad));
        if (err) err.textContent = bad ? message : "";
        if (bad && !firstBad) firstBad = input;
      });

      if (firstBad) {
        status.textContent = "";
        firstBad.focus();
        return;
      }

      if (!endpoint) {
        status.textContent = "Preview only: this form is not connected to a backend yet.";
        return;
      }

      try {
        status.textContent = "Sending…";
        const res = await fetch(endpoint, { method: "POST", body: new FormData(form) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        form.reset();
        status.textContent = "Thank you. We will be in touch.";
      } catch (err) {
        status.textContent = "Something went wrong. Please try again or call us directly.";
      }
    });
  }
})();
