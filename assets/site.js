/* Bistrobee — scripts du site
   ===========================================================
   RÉGLAGE À FAIRE UNE SEULE FOIS :
   indiquez l'adresse email qui doit recevoir les demandes
   de réservation, les messages de contact et les inscriptions.
   =========================================================== */
const CONFIG = {
  EMAIL: "restaurant.bistrobee@gmail.com",     // ← remplacez par l'email du restaurant
  PHONE: "04 72 17 29 04",
  // Horaires utilisés pour « Ouvert en ce moment » et les créneaux de réservation
  SERVICES: [
    { name: "Midi", open: "12:00", close: "14:00", lastBooking: "13:30" },
    { name: "Soir", open: "19:00", close: "22:00", lastBooking: "21:30" }
  ],
  // Samedi (6) et dimanche (0) : ouverts sauf en octobre et novembre
  WEEKEND_DAYS: [0, 6],
  WEEKEND_SEASON_MONTHS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],   // week-ends ouverts sauf octobre et novembre
  MAX_GUESTS_ONLINE: 12                 // au-delà : on invite à téléphoner
};

(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const isClosed = (dow, month) => CONFIG.WEEKEND_DAYS.includes(dow) && !CONFIG.WEEKEND_SEASON_MONTHS.includes(month);
  const configured = /@/.test(CONFIG.EMAIL) && !/exemple\.fr$/i.test(CONFIG.EMAIL);

  /* Menu mobile */
  const burger = $("#burger"), nav = $("#nav");
  if (burger && nav) {
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open);
    });
    nav.addEventListener("click", e => {
      if (e.target.closest("a")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", false); }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", false); burger.focus(); }
    });
  }

  /* Onglets de la carte */
  const tabs = $$(".tab");
  const showTab = id => tabs.forEach(t => {
    const on = t.id === "t-" + id;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    const p = document.getElementById(t.getAttribute("aria-controls"));
    if (p) p.hidden = !on;
  });
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => showTab(t.id.slice(2)));
    t.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      showTab(n.id.slice(2)); n.focus();
    });
  });
  $$("[data-tab]").forEach(a => a.addEventListener("click", () => showTab(a.dataset.tab)));
  if (tabs.length) { const h = location.hash.replace("#", ""); if (["carte", "jour", "vins", "boissons"].includes(h)) showTab(h); }

  /* Heure de Paris */
  function parisNow() {
    const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date());
    const g = t => (p.find(x => x.type === t) || {}).value;
    const days = { "lun.": 1, "mar.": 2, "mer.": 3, "jeu.": 4, "ven.": 5, "sam.": 6, "dim.": 0 };
    return { date: `${g("year")}-${g("month")}-${g("day")}`, min: (+g("hour") % 24) * 60 + +g("minute"), dow: days[g("weekday")] };
  }

  /* Statut de la cuisine : ouverte jusqu'à…, ou réouverture à… */
  const st = $("#openStatus");
  if (st) {
    try {
      const n = parisNow();
      const month = +n.date.slice(5, 7);
      const hh = m => { const h = Math.floor(m / 60), mi = m % 60; return h + "h" + (mi ? String(mi).padStart(2, "0") : ""); };
      const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
      const closedToday = isClosed(n.dow, month);
      const cur = !closedToday && CONFIG.SERVICES.find(s => n.min >= toMin(s.open) && n.min < toMin(s.close));
      let text;
      if (cur) {
        text = `Cuisine ouverte · jusqu'à ${hh(toMin(cur.close))}`;
      } else {
        const later = !closedToday && CONFIG.SERVICES.find(s => n.min < toMin(s.open));
        if (later) {
          text = `Cuisine fermée · réouverture à ${hh(toMin(later.open))}`;
        } else {
          const base = new Date(n.date + "T12:00:00");
          let label = "";
          for (let k = 1; k <= 7; k++) {
            const d = new Date(base); d.setDate(base.getDate() + k);
            if (!isClosed(d.getDay(), d.getMonth() + 1)) { label = k === 1 ? "demain" : DAYS[d.getDay()]; break; }
          }
          const first = hh(toMin(CONFIG.SERVICES[0].open));
          text = (closedToday ? "Fermé aujourd'hui" : "Cuisine fermée") + ` · réouverture ${label} à ${first}`;
        }
      }
      st.classList.toggle("on", !!cur);
      /* la partie après « · » reste sur une seule ligne */
      const parts = text.split(" · ");
      st.lastElementChild.textContent = parts.length > 1 ? parts[0] + " · " + parts[1].replace(/ /g, "\u00a0") : text;
      st.hidden = false;
    } catch (e) { /* on laisse le statut caché */ }
  }

  /* Jour actuel dans la semaine des horaires */
  try { const w = $$(".week li"); const d = parisNow().dow; if (w.length === 7) w[(d + 6) % 7].classList.add("today"); } catch (e) {}

  /* Créneaux de réservation */
  const dateIn = $("#r-date"), timeSel = $("#r-time"), guests = $("#r-guests");
  function fillSlots() {
    if (!dateIn || !timeSel) return;
    const keep = timeSel.value;
    timeSel.innerHTML = '<option value="">Choisir…</option>';
    if (!dateIn.value) return;
    const d = new Date(dateIn.value + "T12:00:00");
    const n = parisNow();
    if (isClosed(d.getDay(), d.getMonth() + 1)) { timeSel.innerHTML = '<option value="">Fermé le week-end en octobre et novembre</option>'; return; }
    CONFIG.SERVICES.forEach(s => {
      const g = document.createElement("optgroup"); g.label = s.name;
      for (let m = toMin(s.open); m <= toMin(s.lastBooking); m += 15) {
        if (dateIn.value === n.date && m <= n.min + 30) continue;
        const v = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
        const o = document.createElement("option"); o.value = v; o.textContent = v.replace(":", "h"); g.appendChild(o);
      }
      if (g.children.length) timeSel.appendChild(g);
    });
    if (timeSel.options.length === 1) timeSel.innerHTML = '<option value="">Plus de créneau ce jour</option>';
    if ([...timeSel.options].some(o => o.value === keep)) timeSel.value = keep;
  }
  if (dateIn) {
    const n = parisNow();
    dateIn.min = n.date;
    const max = new Date(); max.setMonth(max.getMonth() + 3); dateIn.max = max.toISOString().slice(0, 10);
    dateIn.addEventListener("change", fillSlots);
  }
  if (guests) guests.max = 60;

  /* Envoi des formulaires */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validate(form) {
    let first = null;
    $$("[required]", form).forEach(f => {
      let bad = f.type === "checkbox" ? !f.checked : !f.value.trim();
      if (!bad && f.type === "email") bad = !EMAIL_RE.test(f.value.trim());
      if (!bad && f.type === "tel") bad = f.value.replace(/\D/g, "").length < 9;
      if (!bad && f.type === "date" && f.min) bad = f.value < f.min || (f.max && f.value > f.max);
      f.setAttribute("aria-invalid", bad);
      if (bad && !first) first = f;
    });
    return first;
  }
  function say(form, text, isErr) {
    const m = $(".msg", form); m.innerHTML = text; m.classList.toggle("err", !!isErr); m.hidden = false;
  }

  $$("form[data-kind]").forEach(form => {
    form.addEventListener("input", e => { if (e.target.getAttribute("aria-invalid") === "true") e.target.setAttribute("aria-invalid", "false"); });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const kind = form.dataset.kind;
      const bad = validate(form);
      if (bad) {
        const onlyBox = $$("[aria-invalid=true]", form).every(f => f.type === "checkbox");
        say(form, onlyBox ? "Merci de cocher la case d'accord pour continuer." : "Merci de compléter les champs en rouge.", true);
        bad.focus(); return;
      }
      if (kind === "reservation" && guests && +guests.value > CONFIG.MAX_GUESTS_ONLINE) {
        say(form, `Pour un groupe de plus de ${CONFIG.MAX_GUESTS_ONLINE} personnes, appelez-nous au <strong>${CONFIG.PHONE}</strong>.`, true); return;
      }
      if ($(".hp input", form) && $(".hp input", form).value) return; // robot
      if (!configured) {
        say(form, `L'envoi en ligne n'est pas encore activé. Appelez-nous au <strong>${CONFIG.PHONE}</strong>.`, true); return;
      }
      const data = {};
      $$("input,select,textarea", form).forEach(f => { if (f.name && f.type !== "checkbox" && !f.closest(".hp")) data[f.name] = f.value.trim(); });
      const subjects = {
        reservation: `Demande de réservation – ${data["Date"] || ""} ${data["Heure"] || ""} – ${data["Personnes"] || ""} pers.`,
        contact: `Message du site – ${data["Prénom"] || ""} ${data["Nom"] || ""}`,
        newsletter: "Inscription newsletter"
      };
      data._subject = subjects[kind];
      data._template = "table";
      data._captcha = "false";
      if (data["Email"]) data._replyto = data["Email"];
      const btn = $("button[type=submit]", form), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Envoi…";
      try {
        const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CONFIG.EMAIL), {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data), signal: ctrl.signal
        });
        clearTimeout(timer);
        const j = await r.json().catch(() => ({}));
        if (!r.ok || String(j.success) !== "true") throw new Error(j.message || "Envoi refusé");
        const ok = {
          reservation: "<strong>Merci !</strong> Votre demande de réservation est bien envoyée. Elle sera confirmée par téléphone ou par email. Pour une réservation le jour même, appelez-nous.",
          contact: "<strong>Merci !</strong> Nous avons bien reçu votre message. Nous revenons vers vous au plus vite.",
          newsletter: "Merci, votre inscription est enregistrée."
        };
        form.reset(); fillSlots();
        say(form, ok[kind]);
      } catch (err) {
        say(form, `Le message n'a pas pu partir. Réessayez dans un instant ou appelez-nous au <strong>${CONFIG.PHONE}</strong>.`, true);
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });
  });

  /* Plan Google Maps : inséré seulement sur le vrai site (dans un aperçu
     encadré, Google refuse de s'afficher : on garde alors le plan dessiné).
     La carte ne capte la souris / le doigt qu'après un premier clic,
     pour ne pas bloquer le défilement de la page. */
  const slot = $(".gmap-slot");
  if (slot && window.self === window.top) {
    const f = document.createElement("iframe");
    f.className = "gmap";
    f.title = "Plan Google Maps : Bistrobee, Porte de Lyon à Dardilly";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.allowFullscreen = true;
    f.src = slot.dataset.src;
    slot.appendChild(f);
    const box = slot.closest(".map");
    box.classList.add("has-gmap");
    slot.addEventListener("click", () => slot.classList.add("on"));
    box.addEventListener("mouseleave", () => slot.classList.remove("on"));
  }

  /* La carte : bascule Français / English */
  $$(".lang-switch button").forEach(btn => btn.addEventListener("click", () => {
    const sw = btn.parentElement, lang = btn.dataset.lang;
    $$("button", sw).forEach(x => x.setAttribute("aria-pressed", x === btn));
    let el = sw.nextElementSibling;
    while (el && el.classList.contains("lang-pane")) { el.hidden = el.dataset.pane !== lang; el = el.nextElementSibling; }
  }));

  /* Visionneuse plein écran des cartes (sans ouvrir de nouvel onglet) */
  (function () {
    const groups = $$(".drink-pages[data-all]");
    if (!groups.length) return;
    const box = document.createElement("div");
    box.className = "viewer"; box.hidden = true;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Carte en grand");
    box.innerHTML = '<button class="v-close" type="button" aria-label="Fermer">×</button>' +
      '<button class="v-prev" type="button" aria-label="Page précédente">‹</button>' +
      '<div class="v-stage"><img alt=""></div>' +
      '<button class="v-next" type="button" aria-label="Page suivante">›</button>' +
      '<p class="v-count"></p>';
    document.body.appendChild(box);
    const img = $("img", box), count = $(".v-count", box);
    let list = [], alts = [], i = 0, last = null;
    const show = () => { img.src = list[i]; img.alt = alts[i] || ""; count.textContent = `Page ${i + 1} / ${list.length}`;
      $(".v-prev", box).hidden = i === 0; $(".v-next", box).hidden = i === list.length - 1; $(".v-stage", box).scrollTop = 0; };
    const open = (g, src) => {
      list = g.dataset.all.split(","); alts = (g.dataset.alts || "").split("|");
      i = Math.max(0, list.indexOf(src)); last = document.activeElement;
      show(); box.hidden = false; document.documentElement.classList.add("v-lock"); $(".v-close", box).focus();
    };
    const close = () => { box.hidden = true; document.documentElement.classList.remove("v-lock"); if (last) last.focus(); };
    const go = d => { const n = i + d; if (n >= 0 && n < list.length) { i = n; show(); } };
    groups.forEach(g => $$(".drink-page", g).forEach(a => a.addEventListener("click", e => { e.preventDefault(); open(g, a.dataset.src); })));
    $$(".doc-open").forEach(btn => btn.addEventListener("click", () => {
      const scope = btn.closest("section, [role=tabpanel]") || document;
      const g = $$(".drink-pages[data-all]", scope).find(x => x.offsetParent !== null) || $(".drink-pages[data-all]", scope);
      if (g) open(g, g.dataset.all.split(",")[0]);
    }));
    $(".v-close", box).addEventListener("click", close);
    $(".v-prev", box).addEventListener("click", () => go(-1));
    $(".v-next", box).addEventListener("click", () => go(1));
    box.addEventListener("click", e => { if (e.target === box) close(); });
    document.addEventListener("keydown", e => { if (box.hidden) return;
      if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); });
    let x0 = null;
    box.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
    /* Dans un aperçu encadré, le téléchargement est bloqué : on masque le lien */
    if (window.self !== window.top) $$(".pdf-dl").forEach(a => a.hidden = true);
  })();

  /* Accueil / logo sur la page d'accueil : on remonte en douceur au lieu de recharger */
  const onHome = /(^|\/)(index\.html)?$/.test(location.pathname) || !!$(".hero");
  if (onHome) $$('a[href="index.html"]').forEach(a => a.addEventListener("click", e => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: smooth ? "smooth" : "auto" });
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }));

  /* Téléphone : la barre d'actions s'efface sur le formulaire de réservation et dans la visionneuse */
  const mbar = $(".mbar");
  if (mbar) {
    const resa = $("#reserver");
    const hideOn = new Set();
    const upd = () => mbar.classList.toggle("away", hideOn.size > 0 || document.documentElement.classList.contains("v-lock"));
    if (resa && "IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => { e.isIntersecting ? hideOn.add("resa") : hideOn.delete("resa"); upd(); }), { threshold: 0.15 }).observe(resa);
    new MutationObserver(upd).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    $$("input,select,textarea").forEach(f => { f.addEventListener("focus", () => { hideOn.add("kb"); upd(); }); f.addEventListener("blur", () => { hideOn.delete("kb"); upd(); }); });
  }

  /* Année du pied de page */
  $$(".year").forEach(y => y.textContent = new Date().getFullYear());
})();

/* Grande photo d'accueil : la photo descend plus lentement que la page,
   se resserre doucement, et le titre s'efface en remontant. */
(function () {
  const hero = document.querySelector(".hero"), bg = document.querySelector(".hero-bg"), inner = document.querySelector(".hero .in");
  if (!hero || !bg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let ticking = false, started = false;
  bg.addEventListener("animationend", () => { started = true; bg.style.animation = "none"; update(); }, { once: true });
  setTimeout(() => { if (!started) { started = true; bg.style.animation = "none"; update(); } }, 2000);
  function update() {
    ticking = false;
    const h = hero.offsetHeight, y = Math.max(0, window.scrollY);
    if (y > h * 1.2) return;                          // la photo n'est plus visible : on ne calcule rien
    const p = Math.min(1, y / h);
    if (started) bg.style.transform = `translate3d(0,${(y * 0.45).toFixed(1)}px,0) scale(${(1.08 - p * 0.06).toFixed(4)})`;
    inner.style.transform = `translate3d(0,${(-y * 0.25).toFixed(1)}px,0)`;
    inner.style.opacity = Math.max(0, 1 - p * 1.4).toFixed(3);
    hero.style.setProperty("--shade", (0.2 + p * 0.45).toFixed(3));
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

/* Réservation : boutons − / + pour le nombre de couverts */
document.querySelectorAll(".stepper [data-step]").forEach(b => b.addEventListener("click", () => {
  const i = b.parentElement.querySelector("input");
  const v = Math.min(+i.max || 60, Math.max(+i.min || 1, (+i.value || 0) + +b.dataset.step));
  i.value = v; i.dispatchEvent(new Event("input", { bubbles: true }));
}));

/* Arrivée sur une nouvelle page : on repart toujours du haut (sauf lien vers une section précise) */
(function () {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const top = () => { if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" }); };
  top();
  window.addEventListener("pageshow", top);
})();
