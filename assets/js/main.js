/* ==========================================================
   APRILOUS — shared UI: nav, scroll reveals, counters, cart
   ========================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FREE_SHIP = 299;
  const fmt = (n) => `₪${n.toLocaleString("he-IL")}`;

  /* ---------- nav ---------- */
  const nav = $(".nav");
  const onScroll = () => nav && nav.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const toggle = $(".menu-toggle");
  toggle && toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
  });
  $$(".nav-links a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- count-up stats ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length;
      const suffix = el.dataset.suffix || "", start = performance.now(), dur = 1600;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur), v = end * (1 - Math.pow(1 - p, 3));
        el.textContent = v.toFixed(dec) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- cart ---------- */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("aprilous-cart")) || []; } catch (_) { cart = []; }
  const save = () => { try { localStorage.setItem("aprilous-cart", JSON.stringify(cart)); } catch (_) {} };

  document.body.insertAdjacentHTML("beforeend", `
    <div class="drawer-backdrop" data-close-cart></div>
    <aside class="drawer" aria-label="סל הקניות" aria-hidden="true">
      <div class="drawer-head">
        <h3>הסל שלך</h3>
        <button class="icon-btn" data-close-cart aria-label="סגירה">✕</button>
      </div>
      <div class="ship-note" id="shipNote"></div>
      <div class="ship-bar"><i id="shipBar"></i></div>
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-foot">
        <div class="row"><span>משלוח</span><span id="shipCost"></span></div>
        <div class="row total"><span>סה״כ</span><span id="cartTotal"></span></div>
        <button class="btn btn-primary" id="checkout">לתשלום מאובטח <span class="arrow">←</span></button>
      </div>
    </aside>
    <div class="toast" role="status" aria-live="polite"></div>`);

  const toast = (msg) => {
    const el = $(".toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2200);
  };

  function render() {
    const count = cart.reduce((a, i) => a + i.qty, 0);
    const sub = cart.reduce((a, i) => a + i.qty * i.price, 0);
    $$(".cart-count").forEach((el) => {
      el.textContent = count;
      el.classList.toggle("show", count > 0);
    });
    $("#cartItems").innerHTML = cart.length
      ? cart.map((i) => `
        <div class="cart-item">
          <div class="thumb"><img src="${i.img}" alt=""></div>
          <div><strong>${i.name}</strong><small>${i.qty} × ${fmt(i.price)}</small></div>
          <button data-remove="${i.id}" aria-label="הסרת ${i.name}">✕</button>
        </div>`).join("")
      : `<div class="cart-empty">הסל עדיין ריק 🌸<br>בואי נמצא לך משהו יפה</div>`;
    const ship = sub === 0 || sub >= FREE_SHIP ? 0 : 29;
    $("#shipCost").textContent = ship ? fmt(ship) : "חינם";
    $("#cartTotal").textContent = fmt(sub + ship);
    $("#shipBar").style.width = `${Math.min(100, (sub / FREE_SHIP) * 100)}%`;
    $("#shipNote").textContent = sub >= FREE_SHIP
      ? "יש! קיבלת משלוח חינם ✨"
      : `עוד ${fmt(FREE_SHIP - sub)} למשלוח חינם`;
    $("#checkout").disabled = !cart.length;
  }

  const openCart = () => { document.body.classList.add("cart-open"); $(".drawer").setAttribute("aria-hidden", "false"); };
  const closeCart = () => { document.body.classList.remove("cart-open"); $(".drawer").setAttribute("aria-hidden", "true"); };

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const d = add.dataset;
      const qty = parseInt(d.qtyFrom ? $(d.qtyFrom).value : 1, 10) || 1;
      const found = cart.find((i) => i.id === d.id);
      if (found) found.qty += qty;
      else cart.push({ id: d.id, name: d.name, price: +d.price, img: d.img, qty });
      save(); render();
      $$(".cart-count").forEach((el) => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
      const label = add.innerHTML;
      add.classList.add("added");
      add.innerHTML = "נוסף לסל ✓";
      setTimeout(() => { add.classList.remove("added"); add.innerHTML = label; }, 1400);
      toast(`${d.name} נוסף לסל 💜`);
      return;
    }
    const rm = e.target.closest("[data-remove]");
    if (rm) { cart = cart.filter((i) => i.id !== rm.dataset.remove); save(); render(); return; }
    if (e.target.closest("[data-open-cart]")) { openCart(); return; }
    if (e.target.closest("[data-close-cart]")) closeCart();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
  $("#checkout").addEventListener("click", () => toast("מעבירים אותך לתשלום מאובטח…"));

  render();

  /* ---------- quantity steppers ---------- */
  $$(".qty").forEach((q) => {
    const out = $("output", q);
    q.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      out.value = Math.max(1, Math.min(9, +out.value + (+b.dataset.step)));
    });
  });

  /* ---------- colour swatches ---------- */
  $$(".swatches").forEach((group) => {
    group.addEventListener("click", (e) => {
      const sw = e.target.closest(".swatch");
      if (!sw) return;
      $$(".swatch", group).forEach((s) => { s.classList.remove("active"); s.setAttribute("aria-pressed", "false"); });
      sw.classList.add("active");
      sw.setAttribute("aria-pressed", "true");
      const label = $(group.dataset.label);
      if (label) label.textContent = sw.dataset.name;
      const img = $(group.dataset.target);
      if (img) img.style.filter = `hue-rotate(${sw.dataset.hue || 0}deg) drop-shadow(0 40px 40px rgba(111,63,224,.3))`;
    });
  });

  /* ---------- product filters ---------- */
  $$(".filters button").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".filters button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.dataset.filter;
      $$(".product").forEach((p) => p.classList.toggle("hide", f !== "all" && p.dataset.cat !== f));
    });
  });

  /* ---------- hero video: play / pause ---------- */
  const video = $("#heroVideo");
  const vToggle = $(".video-toggle");
  const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor"/><rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor"/></svg>';
  const PLAY_ICON = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7-4.5z" fill="currentColor"/></svg>';
  if (video && vToggle) {
    const sync = () => {
      vToggle.innerHTML = video.paused ? PLAY_ICON : PAUSE_ICON;
      vToggle.setAttribute("aria-label", video.paused ? "הפעלת הסרטון" : "השהיית הסרטון");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.pause();
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    vToggle.addEventListener("click", () => (video.paused ? video.play() : video.pause()));
    sync();
  }

  /* ---------- ambient light modes ---------- */
  const design = $(".design");
  const modes = $$(".mode");
  if (design && modes.length) {
    let idx = 0, auto = null;
    const pick = (i) => {
      idx = i;
      modes.forEach((m, j) => {
        m.classList.toggle("active", j === i);
        m.setAttribute("aria-pressed", j === i);
      });
      design.style.setProperty("--mode", modes[i].dataset.color);
    };
    modes.forEach((m, i) => {
      m.style.setProperty("--c", m.dataset.color);
      m.addEventListener("click", () => { clearInterval(auto); auto = null; pick(i); });
    });
    new IntersectionObserver((e) => {
      if (e[0].isIntersecting && auto === null && !design.dataset.touched) {
        auto = setInterval(() => pick((idx + 1) % modes.length), 2600);
      } else if (!e[0].isIntersecting && auto) { clearInterval(auto); auto = null; }
    }, { threshold: 0.3 }).observe(design);
    modes.forEach((m) => m.addEventListener("click", () => { design.dataset.touched = "1"; }));
  }

  /* ---------- steps follow the brush film ---------- */
  const steps = $$(".step-list li");
  document.addEventListener("filmscene", (e) => {
    steps.forEach((li, i) => li.classList.toggle("active", i === e.detail));
  });

  /* ---------- newsletter ---------- */
  $$(".newsletter").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    f.reset();
    toast("נרשמת! קוד 10% הנחה בדרך למייל שלך 💌");
  }));
})();
