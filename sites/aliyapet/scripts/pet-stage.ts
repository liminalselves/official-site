// Behaviour for PetStage.astro: a small state machine that mirrors the Aliya Pet app —
// blinking, a time-of-day greeting, idle lines, per-area click reactions, head petting
// (horizontal strokes over the head) and the speech bubble that pages and fades out.

type Lines = Record<string, string[]> & { time: Record<string, string[]> };
type Area = { id: string; cx: number; cy: number; rx: number; ry: number };

// Same slots as redesign/ui/src/dialogue/dialogue.ts timeScene().
export function timeScene(now: Date): string {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= 300 && m <= 479) return 'morning';
  if (m >= 480 && m <= 659) return 'forenoon';
  if (m >= 660 && m <= 839) return 'lunch';
  if (m >= 840 && m <= 1019) return 'afternoon';
  if (m >= 1020 && m <= 1139) return 'dinner';
  if (m >= 1140 && m <= 1319) return 'evening';
  return m >= 1320 ? 'late_night' : 'deep_night';
}

export function hitArea(areas: Area[], x: number, y: number): string | null {
  for (const a of areas) {
    const dx = (x - a.cx) / a.rx;
    const dy = (y - a.cy) / a.ry;
    if (dx * dx + dy * dy <= 1) return a.id;
  }
  return null;
}

/** Shuffle-bag picker per scene so the same line does not repeat until all were shown. */
function bag(list: string[]) {
  let pool: string[] = [];
  let last = '';
  return () => {
    if (!pool.length) pool = [...list].sort(() => Math.random() - 0.5);
    if (pool[0] === last && pool.length > 1) pool.push(pool.shift()!);
    last = pool.shift() ?? '';
    return last;
  };
}

// Reaction per area: pose, lean (deg) and which line set to use.
const REACTIONS: Record<string, { pose: string; lean: number; lines: string; ms: number }> = {
  head: { pose: 'happy', lean: 0, lines: 'head', ms: 2200 },
  face: { pose: 'shy', lean: -2, lines: 'face', ms: 2400 },
  ear: { pose: 'ear', lean: 1.5, lines: 'ear', ms: 1600 },
  hair: { pose: 'smug', lean: 2, lines: 'hair', ms: 2200 },
  hand: { pose: 'wave', lean: 0, lines: 'hand', ms: 2400 },
  body: { pose: 'surprised', lean: 0, lines: 'body', ms: 2000 },
};

export function mountPetStage(root: HTMLElement): void {
  const lines = JSON.parse(root.dataset.lines ?? '{}') as Lines;
  const areas = JSON.parse(root.dataset.areas ?? '[]') as Area[];
  // Full-frame poses move the silhouette, so the base must be hidden while they show.
  const full = JSON.parse(root.dataset.full ?? '{}') as Record<string, boolean>;
  const svg = root.querySelector('svg')!;
  const hit = root.querySelector<SVGRectElement>('.pet-stage__hit')!;
  const lean = root.querySelector<SVGGElement>('.pet-stage__lean')!;
  const bubble = root.querySelector<HTMLElement>('.pet-stage__bubble')!;
  const layers = new Map<string, SVGImageElement>();
  root.querySelectorAll<SVGImageElement>('.pet-stage__layer').forEach((el) => layers.set(el.dataset.pose!, el));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pick: Record<string, () => string> = {};
  for (const [k, v] of Object.entries(lines)) if (Array.isArray(v)) pick[k] = bag(v);

  // Lazy-load pose images once the stage is near the viewport.
  let loaded = false;
  const loadPoses = () => {
    if (loaded) return;
    loaded = true;
    layers.forEach((el) => {
      const href = el.dataset.href;
      if (href) el.setAttribute('href', href);
    });
  };

  // ---- Pose ----
  let pose = 'base';
  let poseTimer = 0;
  const show = (next: string) => {
    if (next === pose) return;
    loadPoses();
    const prev = layers.get(pose);
    const el = layers.get(next);
    if (!el) return;
    el.classList.add('is-on');
    if (prev && prev !== layers.get('base')) prev.classList.remove('is-on');
    layers.get('base')?.classList.toggle('is-on', !full[next]);
    pose = next;
  };
  const rest = () => {
    for (const [name, el] of layers) el.classList.toggle('is-on', name === 'base');
    pose = 'base';
  };
  const hold = (next: string, ms: number) => {
    clearTimeout(poseTimer);
    show(next);
    poseTimer = window.setTimeout(rest, ms);
  };

  // ---- Blink: 2.5–6 s apart, 120 ms closed, skipped while another pose shows ----
  const blink = () => {
    if (pose === 'base' && !document.hidden) {
      show('blink');
      setTimeout(() => { if (pose === 'blink') rest(); }, 120);
    }
    setTimeout(blink, 2500 + Math.random() * 3500);
  };

  // ---- Wave: two frames alternating, like the app's wave motion ----
  let waveTimer = 0;
  const wave = (ms: number) => {
    clearTimeout(poseTimer);
    clearInterval(waveTimer);
    let f = 0;
    show('wave1');
    waveTimer = window.setInterval(() => show(++f % 2 ? 'wave2' : 'wave1'), 260);
    poseTimer = window.setTimeout(() => { clearInterval(waveTimer); rest(); }, ms);
  };

  // ---- Bubble: up to 18 chars per page like the app; fades out after reading time ----
  let bubbleTimer = 0;
  let bubbleUntil = 0;
  const say = (text: string) => {
    if (!text) return;
    clearTimeout(bubbleTimer);
    bubble.classList.remove('is-closing');
    bubble.hidden = false;
    bubble.textContent = text;
    // Restart the enter animation.
    bubble.style.animation = 'none';
    void bubble.offsetWidth;
    bubble.style.animation = '';
    const ms = Math.min(5200, 1800 + text.length * 140);
    bubbleUntil = Date.now() + ms;
    bubbleTimer = window.setTimeout(() => {
      bubble.classList.add('is-closing');
      bubbleTimer = window.setTimeout(() => { bubble.hidden = true; bubble.classList.remove('is-closing'); }, 200);
    }, ms);
  };

  const setLean = (deg: number, dx = 0) => {
    lean.style.transform = `translateX(${dx}px) rotate(${deg}deg)`;
  };

  const bounce = () => {
    root.classList.remove('is-bounce');
    void root.offsetWidth;
    root.classList.add('is-bounce');
  };

  // ---- Pointer → model coordinates ----
  const toModel = (e: PointerEvent) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = hit.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };

  // Clicking the same place three times quickly triggers the "doubt" line, as in the app.
  let clicks: number[] = [];
  const react = (area: string) => {
    const now = Date.now();
    clicks = [...clicks.filter((t) => now - t < 1600), now];
    if (clicks.length >= 3) {
      clicks = [];
      hold('worried', 2200);
      setLean(-2);
      setTimeout(() => setLean(0), 900);
      say(pick.repeat?.() ?? '');
      return;
    }
    const r = REACTIONS[area] ?? REACTIONS.body;
    if (r.pose === 'wave') wave(r.ms);
    else hold(r.pose, r.ms);
    if (r.lean) {
      setLean(r.lean);
      setTimeout(() => setLean(0), 700);
    }
    bounce();
    say(pick[r.lines]?.() ?? '');
  };

  // ---- Petting: press over the head and stroke left/right ----
  let down: { x: number; y: number; area: string | null; t: number } | null = null;
  let petting = false;
  let strokes = 0;
  let lastDir = 0;
  let lastX = 0;
  let petLineAt = 0;

  hit.addEventListener('pointerdown', (e) => {
    const p = toModel(e);
    down = { x: p.x, y: p.y, area: hitArea(areas, p.x, p.y), t: Date.now() };
    lastX = p.x;
    lastDir = 0;
    strokes = 0;
    hit.setPointerCapture(e.pointerId);
  });

  hit.addEventListener('pointermove', (e) => {
    const p = toModel(e);
    if (!down) {
      // Idle: lean slightly toward the pointer.
      if (!reduced) {
        const nx = Math.max(-1, Math.min(1, (p.x - 340) / 500));
        setLean(nx * 1.2, nx * 6);
      }
      return;
    }
    if (down.area !== 'head' && down.area !== 'hair' && down.area !== 'ear') return;
    const dx = p.x - lastX;
    if (Math.abs(dx) < 18) return;
    const dir = Math.sign(dx);
    if (dir !== lastDir) strokes++;
    lastDir = dir;
    lastX = p.x;
    if (!petting && strokes >= 2) {
      petting = true;
      root.classList.add('is-petting');
      clearTimeout(poseTimer);
      show('sleepy');
      say(pick.pettingStart?.() ?? '');
      petLineAt = Date.now();
    }
    if (petting) {
      setLean(dir * 1.5, dir * 4);
      if (Date.now() - petLineAt > 3600 && Date.now() > bubbleUntil - 600) {
        petLineAt = Date.now();
        show(Math.random() < 0.5 ? 'happy' : 'sleepy');
        say(pick.petting?.() ?? '');
      }
    }
  });

  const release = (e: PointerEvent) => {
    if (!down) return;
    const wasPetting = petting;
    const start = down;
    down = null;
    petting = false;
    root.classList.remove('is-petting');
    setLean(0);
    if (wasPetting) {
      hold('happy', 1800);
      say(pick.pettingEnd?.() ?? '');
      return;
    }
    const p = toModel(e);
    const moved = Math.hypot(p.x - start.x, p.y - start.y);
    if (e.type === 'pointerup' && moved < 24 && start.area) react(start.area);
  };
  hit.addEventListener('pointerup', release);
  hit.addEventListener('pointercancel', release);
  hit.addEventListener('pointerleave', () => { if (!down) setLean(0); });

  // Keyboard: Enter/Space on the stage acts like a head tap.
  root.tabIndex = 0;
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      react('head');
    }
  });

  // The chat pill mirrors the app; on the web it explains where chat lives.
  root.querySelector('.pet-stage__chat')?.addEventListener('click', () => {
    hold('happy', 2000);
    say('下载 Aliya Pet 后，登录社区账号就能和我聊天。');
  });

  // ---- Start: greet by time of day, then occasional idle lines ----
  const start = () => {
    loadPoses();
    setTimeout(() => {
      wave(1600);
      say(lines.time?.[timeScene(new Date())]?.[Math.floor(Math.random() * 3)] ?? '');
    }, 700);
    if (!reduced) setTimeout(blink, 2400);
    setInterval(() => {
      if (document.hidden || down || Date.now() < bubbleUntil + 4000 || pose !== 'base') return;
      if (Math.random() < 0.5) say(pick.idle?.() ?? '');
    }, 9000);
  };

  const io = new IntersectionObserver((entries) => {
    if (entries.some((x) => x.isIntersecting)) {
      io.disconnect();
      start();
    }
  }, { rootMargin: '200px' });
  io.observe(root);
}
