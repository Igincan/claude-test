// Bubbly pink cursor background for the login page.
(function () {
  const canvas = document.createElement("canvas");
  canvas.id = "bubbles";
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#ff8fc7", "#ff5fa2", "#ffb3d9", "#f472b6", "#fbcfe8", "#ec4899"];
  const MAX_TRAIL = 120;
  const MAX_BUBBLES = 150;
  const MIN_R = 4; // smallest bubble a split can produce
  const REPEL = 140; // strength of bubble-to-bubble antigravity
  const MERGE_COOLDOWN = 90; // frames a fresh split piece can't merge

  let width, height, dpr;
  let ambient = []; // floating bubbles: repel each other, dodge the cursor, merge and split
  const trail = []; // short-lived bubbles spawned by the cursor
  const mouse = { x: -9999, y: -9999, lastX: null, lastY: null };

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // Keep a bubble fully inside the screen, bouncing it off the edges.
  function confine(b, r, bounce) {
    if (b.x - r < 0) {
      b.x = r;
      b.vx = Math.abs(b.vx) * bounce;
    } else if (b.x + r > width) {
      b.x = width - r;
      b.vx = -Math.abs(b.vx) * bounce;
    }
    if (b.y - r < 0) {
      b.y = r;
      b.vy = Math.abs(b.vy) * bounce;
    } else if (b.y + r > height) {
      b.y = height - r;
      b.vy = -Math.abs(b.vy) * bounce;
    }
  }

  function makeAmbient(props) {
    const r = rand(8, 34);
    return {
      x: rand(r, width - r),
      y: rand(r, height - r),
      r,
      vx: rand(-0.3, 0.3),
      vy: rand(-0.3, 0.3),
      wobble: rand(0, Math.PI * 2),
      cooldown: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      ...props,
    };
  }

  // A bubble counts as "pushed" when it's inside the cursor's reach.
  function cursorReach(b) {
    return 100 + b.r;
  }

  function isPushed(b) {
    return Math.hypot(b.x - mouse.x, b.y - mouse.y) < cursorReach(b);
  }

  // Join b into a, keeping total area and momentum.
  function merge(a, b) {
    const ma = a.r * a.r;
    const mb = b.r * b.r;
    const m = ma + mb;
    a.x = (a.x * ma + b.x * mb) / m;
    a.y = (a.y * ma + b.y * mb) / m;
    a.vx = (a.vx * ma + b.vx * mb) / m;
    a.vy = (a.vy * ma + b.vy * mb) / m;
    if (mb > ma) a.color = b.color;
    a.r = Math.sqrt(m);
  }

  // Break a bubble into a random number of random-sized pieces with the same total area.
  function split(b) {
    const maxPieces = Math.min(7, Math.floor((b.r / MIN_R) ** 2), MAX_BUBBLES - ambient.length + 1);
    if (maxPieces < 2) {
      // too small to split: just pop it
      ambient.splice(ambient.indexOf(b), 1);
      spawnTrail(b.x, b.y, 8, 3);
      return;
    }

    const n = 2 + Math.floor(Math.random() * (maxPieces - 1));
    const weights = Array.from({ length: n }, () => rand(0.2, 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const startAngle = rand(0, Math.PI * 2);

    ambient.splice(ambient.indexOf(b), 1);
    weights.forEach((w, i) => {
      const r = Math.max(MIN_R, b.r * Math.sqrt(w / total));
      const angle = startAngle + (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(1.5, 4);
      ambient.push(
        makeAmbient({
          x: b.x + Math.cos(angle) * b.r * 0.5,
          y: b.y + Math.sin(angle) * b.r * 0.5,
          r,
          vx: b.vx + Math.cos(angle) * speed,
          vy: b.vy + Math.sin(angle) * speed,
          cooldown: MERGE_COOLDOWN,
          color: b.color,
        })
      );
    });
    spawnTrail(b.x, b.y, 6, 2);
  }

  function spawnTrail(x, y, count, speed) {
    for (let i = 0; i < count; i++) {
      if (trail.length >= MAX_TRAIL) trail.shift();
      const angle = rand(0, Math.PI * 2);
      const v = rand(0.3, speed);
      trail.push({
        x,
        y,
        r: rand(3, 12),
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 0.6,
        life: 1,
        decay: rand(0.012, 0.025),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  function drawBubble(x, y, r, color, alpha) {
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.35, color);
    g.addColorStop(1, color + "33");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // little shine
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);

    const maxR = Math.min(width, height) * 0.2;
    const merged = new Set();

    // antigravity between every pair, merging when the cursor squeezes them together
    for (let i = 0; i < ambient.length; i++) {
      const a = ambient[i];
      if (merged.has(a)) continue;
      for (let j = i + 1; j < ambient.length; j++) {
        const b = ambient[j];
        if (merged.has(b)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;

        const pushed = isPushed(a) || isPushed(b);
        if (
          dist < a.r + b.r &&
          a.cooldown <= 0 &&
          b.cooldown <= 0 &&
          pushed &&
          Math.hypot(a.r, b.r) <= maxR
        ) {
          merge(a, b);
          merged.add(b);
          continue;
        }

        if (dist > 250) continue;
        // the cursor overpowers the antigravity so bubbles can be squeezed together
        const force = ((pushed ? 0.25 : 1) * REPEL * a.r * b.r) / Math.max(dist * dist, 100);
        const nx = dx / dist;
        const ny = dy / dist;
        const accA = Math.min(force / (a.r * a.r), 0.5);
        const accB = Math.min(force / (b.r * b.r), 0.5);
        a.vx -= nx * accA;
        a.vy -= ny * accA;
        b.vx += nx * accB;
        b.vy += ny * accB;
      }
    }
    if (merged.size) ambient = ambient.filter((b) => !merged.has(b));

    for (const b of ambient) {
      if (b.cooldown > 0) b.cooldown--;

      // gentle wandering
      b.wobble += 0.02;
      b.vx += Math.sin(b.wobble) * 0.01;
      b.vy += Math.cos(b.wobble * 0.7) * 0.01;

      // push away from the cursor (big bubbles are heavier)
      const dx = b.x - mouse.x;
      const dy = b.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      const reach = cursorReach(b);
      if (dist < reach && dist > 0) {
        const force = ((1 - dist / reach) * 1.2) / Math.sqrt(b.r / 15);
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;
      }

      b.vx *= 0.97;
      b.vy *= 0.97;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 6) {
        b.vx *= 6 / speed;
        b.vy *= 6 / speed;
      }
      b.x += b.vx;
      b.y += b.vy;

      confine(b, b.r, 0.8);
      drawBubble(b.x, b.y, b.r, b.color, 0.55);
    }

    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.02; // float upward
      p.life -= p.decay;
      if (p.life <= 0) {
        trail.splice(i, 1);
        continue;
      }
      const r = p.r * (0.6 + p.life * 0.4);
      confine(p, r, 0.7);
      drawBubble(p.x, p.y, r, p.color, p.life);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", () => {
    resize();
    for (const b of ambient) confine(b, b.r, 1);
  });

  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (mouse.lastX !== null) {
      const moved = Math.hypot(e.clientX - mouse.lastX, e.clientY - mouse.lastY);
      if (moved > 6) {
        spawnTrail(e.clientX, e.clientY, 1, 1.2);
        mouse.lastX = e.clientX;
        mouse.lastY = e.clientY;
      }
    } else {
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
    }
  });

  window.addEventListener("pointerleave", () => {
    mouse.x = mouse.y = -9999;
  });

  // click a bubble to split it, or empty space for a burst (ignore clicks on the login card and its toggle)
  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".card, .bubble-toggle")) return;
    for (let i = ambient.length - 1; i >= 0; i--) {
      const b = ambient[i];
      if (Math.hypot(b.x - e.clientX, b.y - e.clientY) <= b.r) {
        split(b);
        return;
      }
    }
    spawnTrail(e.clientX, e.clientY, 18, 4);
  });

  resize();
  const count = Math.round((width * height) / 30000);
  for (let i = 0; i < count; i++) ambient.push(makeAmbient());

  if (reduceMotion) {
    // static bubbles only, no animation
    for (const b of ambient) drawBubble(b.x, b.y, b.r, b.color, 0.55);
  } else {
    requestAnimationFrame(tick);
  }
})();
