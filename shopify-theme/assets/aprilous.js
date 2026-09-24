/* ==========================================================
   APRILOUS — Shopify theme UI: nav, reveals, counters,
   light modes, hero video, product form and AJAX cart
   ========================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = window.Aprilous || { routes: {}, strings: {} };
  const S = A.strings;

  /* ---------- money ---------- */
  function money(cents) {
    const fmt = A.moneyFormat || "{{amount}}";
    const n = (cents || 0) / 100;
    const withDelims = (num, dec, thou, decSep) => {
      const [i, d] = num.toFixed(dec).split(".");
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, thou) + (d ? decSep + d : "");
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case "amount_no_decimals": return withDelims(n, 0, ",", ".");
        case "amount_with_comma_separator": return withDelims(n, 2, ".", ",");
        case "amount_no_decimals_with_comma_separator": return withDelims(n, 0, ".", ",");
        case "amount_with_apostrophe_separator": return withDelims(n, 2, "'", ".");
        default: return withDelims(n, 2, ",", ".");
      }
    });
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    const el = $(".toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2200);
  }

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
  // the theme editor re-renders sections; reveal them immediately there
  document.addEventListener("shopify:section:load", (e) => $$(".reveal", e.target).forEach((el) => el.classList.add("in")));

  /* ---------- count-up numbers ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseFloat(el.dataset.count);
      countIO.unobserve(el);
      if (isNaN(end)) return;
      const dec = (el.dataset.count.split(".")[1] || "").length;
      const suffix = el.dataset.suffix || "", start = performance.now(), dur = 1600;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur), v = end * (1 - Math.pow(1 - p, 3));
        el.textContent = v.toFixed(dec) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- hero video: play / pause ---------- */
  const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor"/><rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor"/></svg>';
  const PLAY_ICON = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7-4.5z" fill="currentColor"/></svg>';
  $$(".video-player").forEach((player) => {
    const video = $("video", player);
    const btn = $(".video-toggle", player);
    if (!video || !btn) return;
    video.muted = true;
    video.playsInline = true;
    const sync = () => {
      btn.innerHTML = video.paused ? PLAY_ICON : PAUSE_ICON;
      btn.setAttribute("aria-label", video.paused ? S.play || "Play" : S.pause || "Pause");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.pause();
    else video.play().catch(() => {});
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    btn.addEventListener("click", () => (video.paused ? video.play() : video.pause()));
    sync();
  });

  /* ---------- ambient light modes ---------- */
  $$(".design").forEach((design) => {
    const modes = $$(".mode", design);
    if (!modes.length) return;
    let idx = 0, auto = null, touched = false;
    const pick = (i) => {
      idx = i;
      modes.forEach((m, j) => { m.classList.toggle("active", j === i); m.setAttribute("aria-pressed", j === i); });
      design.style.setProperty("--mode", modes[i].dataset.color);
    };
    modes.forEach((m, i) => {
      m.style.setProperty("--c", m.dataset.color);
      m.addEventListener("click", () => { touched = true; clearInterval(auto); auto = null; pick(i); });
    });
    pick(0);
    new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !auto && !touched) auto = setInterval(() => pick((idx + 1) % modes.length), 2600);
      else if (!e[0].isIntersecting && auto) { clearInterval(auto); auto = null; }
    }, { threshold: 0.3 }).observe(design);
  });

  /* ---------- steps follow the brush film ---------- */
  document.addEventListener("filmscene", (e) => {
    $$(".step-list li").forEach((li, i) => li.classList.toggle("active", i === e.detail));
  });

  /* ---------- collection filters (by product type) ---------- */
  $$(".filters button").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".filters button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.dataset.filter;
      $$(".product[data-cat]").forEach((p) => p.classList.toggle("hide", f !== "all" && p.dataset.cat !== f));
    });
  });

  /* ==========================================================
     CART
     ========================================================== */
  const drawer = $(".drawer");

  const openCart = () => { if (!drawer) return false; document.body.classList.add("cart-open"); drawer.setAttribute("aria-hidden", "false"); return true; };
  const closeCart = () => { document.body.classList.remove("cart-open"); drawer && drawer.setAttribute("aria-hidden", "true"); };

  async function getCart() {
    const res = await fetch(`${A.routes.cart}.js`, { headers: { Accept: "application/json" } });
    return res.json();
  }

  function renderCart(cart) {
    $$(".cart-count").forEach((el) => {
      el.textContent = cart.item_count;
      el.classList.toggle("show", cart.item_count > 0);
    });
    const items = $("#cartItems");
    if (!items) return;
    items.innerHTML = cart.items.length
      ? cart.items.map((i) => `
        <div class="cart-item">
          <a class="thumb" href="${i.url}">${i.image ? `<img src="${i.image}${i.image.includes("?") ? "&" : "?"}width=160" alt="" loading="lazy">` : ""}</a>
          <div>
            <a href="${i.url}"><strong>${i.product_title}</strong></a>
            ${i.variant_title && !i.product_has_only_default_variant ? `<small>${i.variant_title}</small>` : ""}
            <small>${i.quantity} × ${money(i.final_price)}</small>
          </div>
          <button data-remove="${i.key}" aria-label="${S.remove || "Remove"}">✕</button>
        </div>`).join("")
      : `<div class="cart-empty">${S.empty || ""}</div>`;
    const total = $("#cartTotal");
    if (total) total.textContent = money(cart.total_price);
    const checkout = $("#checkout");
    if (checkout) checkout.disabled = !cart.item_count;
    const bar = $("#shipBar"), note = $("#shipNote");
    if (bar && note && A.freeShipping > 0) {
      const sub = cart.total_price;
      bar.style.width = `${Math.min(100, (sub / A.freeShipping) * 100)}%`;
      note.textContent = sub >= A.freeShipping ? S.free : (S.toFree || "").replace("[amount]", money(A.freeShipping - sub));
    }
  }

  async function refresh() {
    try { renderCart(await getCart()); } catch (_) {}
  }

  async function addToCart(id, quantity, button) {
    const label = button && button.innerHTML;
    if (button) button.disabled = true;
    try {
      const res = await fetch(`${A.routes.cartAdd}.js`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: [{ id: Number(id), quantity: Number(quantity) || 1 }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || data.message || S.error);
      await refresh();
      $$(".cart-count").forEach((el) => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
      if (button) {
        button.classList.add("added");
        button.innerHTML = "✓";
        setTimeout(() => { button.classList.remove("added"); button.innerHTML = label; }, 1400);
      }
      toast(S.added);
      openCart();
    } catch (err) {
      toast(err.message || S.error);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeLine(key) {
    const res = await fetch(`${A.routes.cartChange}.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: key, quantity: 0 }),
    });
    renderCart(await res.json());
  }

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add][data-variant-id]");
    if (add) { e.preventDefault(); addToCart(add.dataset.variantId, 1, add); return; }
    const rm = e.target.closest("[data-remove]");
    if (rm) { e.preventDefault(); removeLine(rm.dataset.remove).catch(() => toast(S.error)); return; }
    const opener = e.target.closest("[data-open-cart]");
    if (opener && !document.body.classList.contains("template-cart")) {
      if (openCart()) { e.preventDefault(); refresh(); }
      return;
    }
    if (e.target.closest("[data-close-cart]")) closeCart();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
  refresh();

  /* ==========================================================
     PRODUCT PAGE: variants, gallery, quantity, AJAX add
     ========================================================== */
  $$("[data-product-form]").forEach((root) => {
    const section = root.closest("section");
    const jsonEl = section && $("[data-product-json]", section);
    const data = jsonEl ? JSON.parse(jsonEl.textContent) : { variants: [] };
    const form = $("form[data-ajax-add]", root);
    const idInput = $("[data-variant-input]", root);
    const addBtn = $("[data-add-button]", root);
    const addLabel = $("[data-add-label]", root);
    const priceBox = $("[data-price]", root);

    // gallery
    const showMedia = (id) => {
      if (!id) return;
      $$(".pdp-slide", root).forEach((s) => s.classList.toggle("is-active", s.dataset.mediaId == id));
      $$(".pdp-thumb", root).forEach((t) => t.classList.toggle("is-active", t.dataset.thumb == id));
    };
    $$(".pdp-thumb", root).forEach((t) => t.addEventListener("click", () => showMedia(t.dataset.thumb)));

    // quantity
    const qtyOut = $("[data-qty]", root), qtyInput = $("[data-qty-input]", root);
    $$(".qty [data-step]", root).forEach((b) => b.addEventListener("click", () => {
      const v = Math.max(1, Math.min(99, (parseInt(qtyInput.value, 10) || 1) + Number(b.dataset.step)));
      qtyInput.value = v;
      qtyOut.textContent = v;
    }));

    // variant picker
    const selected = $$(".variant-picker fieldset", root).map((fs) => {
      const active = $(".active", fs);
      return active ? active.dataset.value : null;
    });
    const updateVariant = () => {
      const v = data.variants.find((vr) => vr.options.every((o, i) => selected[i] == null || o === selected[i]));
      if (!v) return;
      idInput.value = v.id;
      addBtn.disabled = !v.available;
      if (addLabel) addLabel.textContent = v.available ? S.addToCart : S.soldOut;
      if (priceBox) {
        const now = $(".now", priceBox), was = $(".was", priceBox), save = $(".save", priceBox);
        if (now) now.textContent = money(v.price);
        if (was) was.style.display = v.compare_at_price > v.price ? "" : "none";
        if (was && v.compare_at_price > v.price) was.textContent = money(v.compare_at_price);
        if (save) save.style.display = v.compare_at_price > v.price ? "" : "none";
      }
      if (v.featured_media) showMedia(v.featured_media.id);
      const url = new URL(window.location.href);
      url.searchParams.set("variant", v.id);
      window.history.replaceState({}, "", url);
    };
    $$(".variant-picker fieldset", root).forEach((fs, i) => {
      fs.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-value]");
        if (!b) return;
        $$("button", fs).forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-pressed", "false"); });
        b.classList.add("active");
        b.setAttribute("aria-pressed", "true");
        selected[i] = b.dataset.value;
        const label = $("[data-option-label]", fs);
        if (label) label.textContent = b.dataset.value;
        updateVariant();
      });
    });

    form && form.addEventListener("submit", (e) => {
      if (!drawer) return; // no drawer: let the normal form post go to /cart
      e.preventDefault();
      addToCart(idInput.value, qtyInput ? qtyInput.value : 1, addBtn);
    });
  });
})();
