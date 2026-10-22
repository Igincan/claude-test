// Pink hearts playground: works with a mouse or a finger.
(function () {
  const canvas = document.createElement("canvas");
  canvas.id = "bubbles";
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // [tiniest heart color, biggest heart color] per palette; hearts start red and move
  // to the next palette each time one bursts from gathering BURST_AT hearts.
  const PALETTES = [
    [[255, 196, 200], [200, 0, 24]], // red
    [[255, 214, 170], [224, 90, 0]], // orange
    [[255, 236, 150], [214, 160, 0]], // gold
    [[200, 240, 190], [30, 150, 60]], // green
    [[180, 236, 240], [0, 140, 160]], // teal
    [[196, 214, 255], [30, 70, 210]], // blue
    [[226, 200, 255], [120, 40, 200]], // purple
    [[255, 200, 236], [214, 30, 140]], // pink
  ];
  const BURST_AT = 100; // hearts gathered into one before it bursts by itself
  const RED_AT = 140; // radius at which a heart is fully deep red
  const MAX_TRAIL = 120;
  const MAX_BUBBLES = 250; // no new hearts past this many, to keep things smooth
  const MIN_R = 4; // smallest bubble a split can produce
  const REPEL = 50; // strength of bubble-to-bubble antigravity
  const SPAWN_EVERY = 60; // frames between new little hearts
  const CROWDED = 0.45; // share of the screen covered by hearts that triggers a restart
  const MERGE_COOLDOWN = 90; // frames a fresh split piece can't merge

  let width, height, dpr;
  let ambient = []; // floating bubbles: repel each other, dodge the cursor, merge and split
  const trail = []; // short-lived bubbles spawned by the cursor
  const mouse = { x: -9999, y: -9999, lastX: null, lastY: null };
  let frame = 0;

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
      count: 1, // how many hearts have been gathered into this one
      palette: 0,
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

  // Join b into a, keeping total area, momentum and gathered count; the bigger one's color wins.
  function merge(a, b) {
    const ma = a.r * a.r;
    const mb = b.r * b.r;
    const m = ma + mb;
    a.count += b.count;
    if (mb > ma) a.palette = b.palette;
    a.x = (a.x * ma + b.x * mb) / m;
    a.y = (a.y * ma + b.y * mb) / m;
    a.vx = (a.vx * ma + b.vx * mb) / m;
    a.vy = (a.vy * ma + b.vy * mb) / m;
    a.r = Math.sqrt(m);
  }

  // Break a bubble into a random number of random-sized pieces with the same total area.
  // A burst (from gathering BURST_AT hearts) makes more pieces, all in the next color,
  // each starting its count over.
  function split(b, burst = false) {
    const palette = burst ? (b.palette + 1) % PALETTES.length : b.palette;
    const room = MAX_BUBBLES - ambient.length + 1;
    const maxPieces = Math.min(burst ? 12 : 7, Math.floor((b.r / MIN_R) ** 2), room);
    if (maxPieces < 2) {
      // too small to split: just pop it
      ambient.splice(ambient.indexOf(b), 1);
      spawnTrail(b.x, b.y, 8, 3, palette);
      return;
    }

    const minPieces = burst ? Math.min(8, maxPieces) : 2;
    const n = minPieces + Math.floor(Math.random() * (maxPieces - minPieces + 1));
    const weights = Array.from({ length: n }, () => rand(0.2, 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const startAngle = rand(0, Math.PI * 2);

    ambient.splice(ambient.indexOf(b), 1);
    weights.forEach((w, i) => {
      const r = Math.max(MIN_R, b.r * Math.sqrt(w / total));
      const angle = startAngle + (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = burst ? rand(3, 6) : rand(1.5, 4);
      ambient.push(
        makeAmbient({
          x: b.x + Math.cos(angle) * b.r * 0.5,
          y: b.y + Math.sin(angle) * b.r * 0.5,
          r,
          vx: b.vx + Math.cos(angle) * speed,
          vy: b.vy + Math.sin(angle) * speed,
          cooldown: MERGE_COOLDOWN,
          count: burst ? 1 : Math.max(1, Math.round((b.count * w) / total)),
          palette,
        })
      );
    });
    if (burst) spawnTrail(b.x, b.y, 30, 5, palette);
    else spawnTrail(b.x, b.y, 6, 2, palette);
  }

  function spawnTrail(x, y, count, speed, palette = 0) {
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
        palette,
      });
    }
  }

  // Heart outline that fits inside a circle of radius r around (x, y).
  function heartPath(x, y, r) {
    const px = (u) => x + u * r;
    const py = (v) => y + v * r;
    ctx.beginPath();
    ctx.moveTo(px(0), py(-0.45));
    ctx.bezierCurveTo(px(-0.15), py(-0.9), px(-1), py(-0.95), px(-1), py(-0.3));
    ctx.bezierCurveTo(px(-1), py(0.2), px(-0.45), py(0.5), px(0), py(0.95));
    ctx.bezierCurveTo(px(0.45), py(0.5), px(1), py(0.2), px(1), py(-0.3));
    ctx.bezierCurveTo(px(1), py(-0.95), px(0.15), py(-0.9), px(0), py(-0.45));
    ctx.closePath();
  }

  // 0 for the tiniest hearts, 1 for the biggest; log scale so mid-size hearts get warmer too.
  function redness(r) {
    return Math.min(1, Math.max(0, Math.log(r / MIN_R) / Math.log(RED_AT / MIN_R)));
  }

  // The bigger the heart, the deeper its color and the more solid it is.
  function drawBubble(x, y, r, alpha, palette = 0, count = 0) {
    const t = redness(r);
    const [light, deep] = PALETTES[palette];
    const [cr, cg, cb] = light.map((c, i) => Math.round(c + (deep[i] - c) * t));
    const color = (a) => `rgba(${cr},${cg},${cb},${a})`;
    ctx.globalAlpha = Math.min(1, alpha + 0.4 * t);
    const g = ctx.createRadialGradient(x - r * 0.45, y - r * 0.45, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, `rgba(255,255,255,${0.9 - 0.5 * t})`);
    g.addColorStop(0.35, color(1));
    g.addColorStop(1, color(0.2 + 0.6 * t));
    ctx.fillStyle = g;
    heartPath(x, y, r);
    ctx.fill();

    // little shine on the left lobe
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.5, y - r * 0.4, r * 0.18, r * 0.12, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // how many hearts it has gathered so far, once that's worth showing
    if (count >= 10 && r >= 18) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `700 ${Math.round(r * 0.42)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count, x, y + r * 0.05);
    }
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);

    // a new little heart pops in every so often, to be gathered into a bigger one
    frame++;
    if (frame % SPAWN_EVERY === 0 && ambient.length < MAX_BUBBLES) {
      const b = makeAmbient({ r: rand(5, 10) });
      if (!isPushed(b)) {
        ambient.push(b);
        spawnTrail(b.x, b.y, 3, 1);
      }
    }
    if (isCrowded()) reset();

    const maxR = Math.min(width, height) * 0.35;
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
    for (const b of ambient.filter((b) => b.count >= BURST_AT)) split(b, true);

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
      drawBubble(b.x, b.y, b.r, 0.55, b.palette, b.count);
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
      drawBubble(p.x, p.y, r, p.life, p.palette);
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

  function releasePointer() {
    mouse.x = mouse.y = -9999;
    mouse.lastX = mouse.lastY = null;
  }

  document.addEventListener("pointerleave", releasePointer);
  window.addEventListener("pointercancel", releasePointer);
  // a lifted finger shouldn't keep pushing bubbles from where it was
  window.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "mouse") releasePointer();
  });

  // stop the browser from scrolling, zooming or refreshing while a finger drags
  const blockGesture = (e) => e.preventDefault();
  for (const type of ["touchstart", "touchmove", "gesturestart", "dblclick", "contextmenu"]) {
    document.addEventListener(type, blockGesture, { passive: false });
  }

  // tap/click a bubble to split it, or empty space for a burst
  window.addEventListener("pointerdown", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
    for (let i = ambient.length - 1; i >= 0; i--) {
      const b = ambient[i];
      if (Math.hypot(b.x - e.clientX, b.y - e.clientY) <= b.r) {
        split(b);
        return;
      }
    }
    spawnTrail(e.clientX, e.clientY, 18, 4);
  });

  // Hearts cover so much of the screen there's no room left to move them.
  function isCrowded() {
    const area = ambient.reduce((sum, b) => sum + 3 * b.r * b.r, 0); // roughly a heart's area
    return area > width * height * CROWDED;
  }

  // Back to a fresh screen of hearts.
  function reset() {
    ambient = [];
    trail.length = 0;
    frame = 0;
    const count = Math.round((width * height) / 15000);
    for (let i = 0; i < count; i++) ambient.push(makeAmbient());
  }

  resize();
  reset();

  if (reduceMotion) {
    // static bubbles only, no animation
    for (const b of ambient) drawBubble(b.x, b.y, b.r, 0.55);
  } else {
    requestAnimationFrame(tick);
  }
})();
