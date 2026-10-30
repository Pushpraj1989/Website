// Runs in the page: layout and naming problems a person would see, as a list of sentences.
export const probe = () => {
  const vw = innerWidth, issues = [];
  const scrolls = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true; } return false; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden=true],.maplibregl-map,.sr-only,a.skip'); };
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.title || el.name || el.placeholder || el.className || el.tagName).trim().replace(/\s+/g,' ').slice(0,40);
  const ov = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (ov > 0) issues.push(`page scrolls sideways by ${ov}px`);
  for (const el of document.querySelectorAll('button,input,select,textarea,a,label,td,th,h1,h2,h3,.chip,.badge,.stat')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !scrolls(el)) issues.push(`off-screen ${el.tagName.toLowerCase()} "${name(el)}" (${Math.round(r.left)}–${Math.round(r.right)})`);
    let p = el.parentElement; while (p && getComputedStyle(p).display === 'contents') p = p.parentElement; if (p && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const pr = p.getBoundingClientRect(); const ps = getComputedStyle(p); if (r.right > pr.right + 1 && ps.overflowX === 'visible' && !scrolls(el)) issues.push(`${el.tagName.toLowerCase()} "${name(el)}" sticks out of its box by ${Math.round(r.right-pr.right)}px`); }
    if (/^(BUTTON|A|LABEL|TH|TD)$/.test(el.tagName) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).textOverflow !== 'ellipsis' && getComputedStyle(el).overflow !== 'visible') issues.push(`clipped text in ${el.tagName.toLowerCase()} "${name(el)}"`);
    if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'hidden') {
      const lab = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent.trim() || el.title || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label') || el.placeholder || el.alt || el.querySelector?.('img[alt]:not([alt=""])');
      if (!lab) issues.push(`unnamed ${el.tagName.toLowerCase()} (${el.className || el.type})`);
    }
  }
  // Overlapping text: leaf elements with text whose boxes intersect.
  const leaves = [...document.querySelectorAll('body *')].filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ).slice(0, 600);
  const rects = leaves.map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); });
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue;
    const a = rects[i], b = rects[j]; const w = Math.min(a.right,b.right)-Math.max(a.left,b.left), h = Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    if (!(w > 3 && h > 3)) continue;
    // Only text that is really seen on top of other text: nothing opaque in between at the shared point.
    const cx = Math.max(a.left,b.left) + w/2, cy = Math.max(a.top,b.top) + h/2;
    const stack = document.elementsFromPoint(cx, cy);
    const ia = stack.findIndex((e) => e === leaves[i] || leaves[i].contains(e)), ib = stack.findIndex((e) => e === leaves[j] || leaves[j].contains(e));
    if (ia < 0 || ib < 0) continue;
    const [top, bottom] = ia < ib ? [ia, ib] : [ib, ia];
    const lower = ia < ib ? leaves[j] : leaves[i];
    const opaque = stack.slice(top, bottom).some((e) => !e.contains(lower) && getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(e).backgroundColor !== 'transparent');
    if (!opaque) issues.push(`text overlaps: "${name(leaves[i])}" / "${name(leaves[j])}"`);
  }
  return issues;
};
