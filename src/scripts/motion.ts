const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Nav: frosted after leaving the hero, hides on scroll down.
const nav = document.querySelector<HTMLElement>('[data-nav]');
if (nav) {
  let last = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > 400 && y > last);
    last = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Scroll reveal
const revealed = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (!reduce && 'IntersectionObserver' in window) {
  // Fully clipped mask elements never intersect, so their parent is observed instead.
  const targets = new Map<Element, HTMLElement[]>();
  revealed.forEach((el) => {
    const key = el.dataset.reveal === 'mask' ? el.parentElement! : el;
    targets.set(key, [...(targets.get(key) ?? []), el]);
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          targets.get(e.target)?.forEach((el) => el.classList.add('in'));
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  targets.forEach((_, key) => io.observe(key));
} else {
  revealed.forEach((el) => el.classList.add('in'));
}

// Copy buttons
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
  const label = btn.querySelector<HTMLElement>('[data-copy-label]');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      if (label) {
        const text = label.textContent;
        label.textContent = '已复制';
        setTimeout(() => (label.textContent = text), 1600);
      }
    } catch {
      /* clipboard unavailable; the value stays visible for manual copy */
    }
  });
});

// Card tilt and sheen follow the pointer.
if (!reduce && finePointer) {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      card.style.setProperty('--ry', `${(px - 0.5) * 8}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

// Hero star field with gentle parallax. Paused when offscreen or tab hidden.
const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
const parallax = document.querySelector<HTMLElement>('[data-parallax]');
if (canvas && !reduce) {
  const ctx = canvas.getContext('2d')!;
  type Star = { x: number; y: number; z: number; r: number; tw: number };
  let stars: Star[] = [];
  let w = 0, h = 0, dpr = 1;
  let mx = 0, my = 0, tx = 0, ty = 0;
  let visible = true;
  let raf = 0;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(160, (w * h) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      r: Math.random() * 1.1 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (t: number) => {
    tx += (mx - tx) * 0.05;
    ty += (my - ty) * 0.05;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.y -= s.z * 0.12;
      if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
      const x = s.x + tx * s.z * 24;
      const y = s.y + ty * s.z * 24;
      const a = 0.25 + 0.55 * s.z * (0.6 + 0.4 * Math.sin(t / 900 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#f4f1ec';
      ctx.beginPath();
      ctx.arc(x, y, s.r * s.z + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (parallax) parallax.style.transform = `translate3d(${tx * -10}px, ${ty * -10}px, 0)`;
    raf = requestAnimationFrame(draw);
  };

  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  resize();
  addEventListener('resize', resize);
  if (finePointer) {
    addEventListener('pointermove', (e) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    }, { passive: true });
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
}
