// The page's only motion that runs on its own, and both explain something:
// 1. [data-draw]: highlighter marks on a screenshot draw in once, when it comes into view (Shot.astro).
// 2. [data-count]: a result number counts up once from 0, when it comes into view.
// Reduced motion: marks show at once and numbers stay as written. Without JavaScript the same is true.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function onceVisible(selector: string, run: (el: HTMLElement) => void, threshold = 0.35) {
  const els = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.dataset.seen);
  els.forEach((el) => (el.dataset.seen = '1'));
  if (!('IntersectionObserver' in window)) {
    els.forEach(run);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        run(entry.target as HTMLElement);
      }
    },
    { threshold },
  );
  els.forEach((el) => io.observe(el));
}

onceVisible('[data-draw]', (el) => el.classList.add('is-in'), 0.3);

if (!reduced) {
  onceVisible(
    '[data-count]',
    (el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || target < 2) return;
      const start = performance.now();
      const ms = Math.min(1100, 500 + target * 18);
      // Fix the final number's width while it counts, so "0" to "43" never moves anything next to it (CLS 0).
      // Not a min-width: some in-between numbers set a few px wider than the final one even with tabular digits.
      const cs = getComputedStyle(el);
      if (cs.display === 'inline') el.style.display = 'inline-block';
      // A live style: after the line above, width is the used width in px, in the element's own box-sizing.
      const width = cs.width;
      el.style.width = width;
      el.style.whiteSpace = 'nowrap';
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
        else el.style.width = '';
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    },
    0.6,
  );
}
