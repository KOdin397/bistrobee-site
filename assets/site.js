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
  // Samedi (6) et dimanche (0) : ouvert seulement pendant les mois de la saison
  WEEKEND_DAYS: [0, 6],
  WEEKEND_SEASON_MONTHS: [5, 6, 7, 8, 9, 10],   // mai à octobre
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
  if (tabs.length) { const h = location.hash.replace("#", ""); if (["carte", "jour", "vins"].includes(h)) showTab(h); }

  /* Heure de Paris */
  function parisNow() {
    const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date());
    const g = t => (p.find(x => x.type === t) || {}).value;
    const days = { "lun.": 1, "mar.": 2, "mer.": 3, "jeu.": 4, "ven.": 5, "sam.": 6, "dim.": 0 };
    return { date: `${g("year")}-${g("month")}-${g("day")}`, min: (+g("hour") % 24) * 60 + +g("minute"), dow: days[g("weekday")] };
  }

  /* Ouvert en ce moment */
  const st = $("#openStatus");
  if (st) {
    try {
      const n = parisNow();
      const open = !isClosed(n.dow, +n.date.slice(5, 7)) && CONFIG.SERVICES.some(s => n.min >= toMin(s.open) && n.min < toMin(s.close));
      st.classList.toggle("on", open);
      st.lastElementChild.textContent = open ? "Ouvert en ce moment" : "Fermé en ce moment";
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
    if (isClosed(d.getDay(), d.getMonth() + 1)) { timeSel.innerHTML = '<option value="">Fermé le week-end de novembre à avril</option>'; return; }
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
      if (bad) { say(form, "Merci de compléter les champs en rouge.", true); bad.focus(); return; }
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

  /* Plan : chargé uniquement au clic (pas de cookies Google sans accord) */
  const mapBtn = $("#loadMap");
  if (mapBtn) mapBtn.addEventListener("click", () => {
    const box = mapBtn.closest(".map");
    const f = document.createElement("iframe");
    f.title = "Plan d'accès au restaurant";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.src = "https://maps.google.com/maps?q=45.8204651,4.7607888&z=15&output=embed";
    box.appendChild(f);
    $(".cover", box).hidden = true;
  });

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
