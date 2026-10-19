// Countdown shown behind the hearts.
// Target: window.COUNTDOWN_TARGET (e.g. "2026-10-24T12:00", viewer's local time, or
// with an offset like "2026-10-24T12:00+02:00"). Empty or invalid -> next Saturday noon.
(function () {
  const el = document.createElement("div");
  el.id = "countdown";
  el.innerHTML = '<div class="time"></div><div class="label"></div>';
  document.body.appendChild(el);
  const timeEl = el.querySelector(".time");
  const labelEl = el.querySelector(".label");

  const custom = new Date(window.COUNTDOWN_TARGET || NaN);
  const useCustom = !isNaN(custom);
  labelEl.textContent = window.COUNTDOWN_LABEL || "until Saturday noon";

  function nextSaturdayNoon(now) {
    const t = new Date(now);
    t.setHours(12, 0, 0, 0);
    t.setDate(t.getDate() + ((6 - t.getDay() + 7) % 7));
    if (t <= now) t.setDate(t.getDate() + 7);
    return t;
  }

  const pad = (n) => String(n).padStart(2, "0");

  function tick() {
    const now = new Date();
    const target = useCustom ? custom : nextSaturdayNoon(now);
    const left = Math.max(0, Math.floor((target - now) / 1000));
    const d = Math.floor(left / 86400);
    const hms = `${pad(Math.floor(left / 3600) % 24)}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
    timeEl.textContent = d > 0 ? `${d}d ${hms}` : hms;
  }

  tick();
  setInterval(tick, 1000);
})();
