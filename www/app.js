(function () {
  "use strict";

  const PASSING = 80;          // CSC passing rate for the Professional level
  const MOCK_SIZE = 30;
  const SEC_Q = 72;             // target seconds per question (3 hours for 150 items)
  const ROUND_SIZE = 10;       // questions per subject round
  const COOLDOWN_DAYS = 30;    // an answered question won't come back for this long
  const DAY = 86400000;
  const LETTERS = "ABCDEFGH";
  const app = document.getElementById("app");
  const backBtn = document.getElementById("backBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const tabbar = document.getElementById("tabbar");
  const I = window.I18N;
  const t = (k, v) => I.t(k, v);
  const sn = s => I.subj(s);   // translated subject name/desc/tips

  // ---------- storage (safe: may be unavailable in some web views) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} if (k.indexOf("cscoach.") === 0 && window.Account) window.Account.changed(k.slice(8)); }
  };
  let profile = store.get("cscoach.profile", null);           // { name, instant, examDate, pet, lang }
  let best = store.get("cscoach.best", {});                    // { key: pct }
  let starred = new Set(store.get("cscoach.starred", []));     // question ids
  let stats = store.get("cscoach.stats", {});                  // { qid: { n, c, last } }
  let history = store.get("cscoach.history", []);              // past sessions
  let lessonsRead = new Set(store.get("cscoach.lessonsRead", []));
  // Rank: { xp, rank, day, seen } (seen = question ids answered today, to dampen repeats). Optional; absent = starting fresh.
  let rankState = store.get("cscoach.rank", null) || { xp: 0, rank: 1, day: "", seen: [] };
  const saveStars = () => store.set("cscoach.starred", [...starred]);
  const pet = () => window.Pet || { cheer() {}, cry() {}, say() {}, hop() {}, setVisible() {} };
  if (profile && profile.lang) I.setLang(profile.lang);
  if (profile && profile.petName) I.petName = profile.petName;

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Give every question a stable id and subject reference
  const byId = new Map();
  SUBJECTS.forEach(s => s.questions.forEach((q, i) => { q.id = s.id + "-" + i; q.sid = s.id; byId.set(q.id, q); }));
  const allQuestions = () => SUBJECTS.flatMap(s => s.questions);
  const subjectOf = q => SUBJECTS.find(s => s.id === q.sid);
  const LESSONS = window.LESSONS || {};
  const lessonById = new Map();
  // Lessons follow the official CSC scope. A lesson may list a question that lives in
  // another subject (e.g. word analogies from Verbal belong to Analytical in the
  // syllabus): that question moves to the lesson's subject but keeps its id (and stats).
  SUBJECTS.forEach(s => (LESSONS[s.id] || []).forEach(l => {
    l.sid = s.id; lessonById.set(l.id, l);
    l.qs.forEach(i => {
      const q = byId.get(typeof i === "string" ? i : s.id + "-" + i);
      if (!q) return;
      if (q.sid !== s.id) {
        const from = SUBJECTS.find(x => x.id === q.sid);
        from.questions.splice(from.questions.indexOf(q), 1);
        s.questions.push(q); q.sid = s.id;
      }
      q.lid = l.id;
    });
  }));
  const SYL = window.SYLLABUS || {};
  const unitName = l => (SYL[l.sid] || [])[l.unit - 1] || "";
  const lessonQs = (sid, l) => SUBJECTS.find(x => x.id === sid).questions.filter(q => q.lid === l.id);
  const impOf = q => (q.lid && lessonById.get(q.lid) ? lessonById.get(q.lid).imp : 2);
  const impLabel = imp => t(imp >= 3 ? "impHigh" : imp === 2 ? "impMid" : "impLow");

  // AI-generated questions are saved on the device and join the bank
  let aiBank = store.get("cscoach.aiq", []);
  function addToBank(q) {
    const s = SUBJECTS.find(x => x.id === q.sid);
    if (!s || byId.has(q.id)) return;
    s.questions.push(q); byId.set(q.id, q);
  }
  aiBank.forEach(addToBank);

  // ---------- DATA SAFETY: versions, automatic backups, question remapping ----------
  // All progress lives in this browser's localStorage under "cscoach.*". Updating the
  // app's code never clears it. On top of that:
  //  1. Before a new app version runs for the first time, a full backup is saved.
  //  2. A daily backup is kept (last 5 backups).
  //  3. Questions are fingerprinted by their text, so if the question bank is ever
  //     reordered or reorganized, progress (stats, stars) follows the right question.
  //  4. Users can export/import a backup file or code (Settings → Backup & restore).
  const APP_VERSION = "1.32.0";
  const REPORT_EMAIL = "sharematerials2026@gmail.com";
  const DATA_KEYS = ["profile", "best", "starred", "stats", "history", "lessonsRead", "aiq", "qmap", "rank"];
  function snapshot(reason) {
    const data = {};
    DATA_KEYS.forEach(k => { try { const v = localStorage.getItem("cscoach." + k); if (v != null) data[k] = JSON.parse(v); } catch (_) {} });
    return { app: "cs-coach", version: APP_VERSION, savedAt: Date.now(), reason: reason || "manual", data };
  }
  const hasData = () => { try { return !!localStorage.getItem("cscoach.profile"); } catch (_) { return false; } };
  function autoBackup(reason) {
    if (!hasData()) return;
    const list = store.get("cscoach.backups", []);
    list.push(snapshot(reason));
    while (list.length > 5) list.shift();
    try { localStorage.setItem("cscoach.backups", JSON.stringify(list)); }
    catch (_) { // storage full: keep only the newest backup
      try { localStorage.setItem("cscoach.backups", JSON.stringify(list.slice(-1))); } catch (__) {}
    }
  }
  function applyBackup(snap) {
    if (!snap || snap.app !== "cs-coach" || !snap.data || typeof snap.data !== "object") throw new Error("bad");
    autoBackup("before-restore");
    DATA_KEYS.forEach(k => {
      try { if (k in snap.data) localStorage.setItem("cscoach." + k, JSON.stringify(snap.data[k])); else localStorage.removeItem("cscoach." + k); } catch (_) {}
    });
    if (window.Account) window.Account.changed("restore");
  }
  // ---------- ACCOUNT SYNC helpers (used by account.js) ----------
  // Merge two copies of the data so that nothing is ever lost: best scores = max, stars and
  // lessons = union, per-question stats = the copy with more attempts, history = union.
  const CLOUD_KEYS = DATA_KEYS.filter(k => k !== "qmap");   // qmap is per-device bookkeeping
  function mergeData(a, b, preferB) {
    a = a || {}; b = b || {};
    const out = {};
    CLOUD_KEYS.forEach(k => { if (k in a) out[k] = a[k]; else if (k in b) out[k] = b[k]; });
    if (a.profile && b.profile) out.profile = preferB ? b.profile : a.profile;
    out.best = Object.assign({}, a.best, b.best);
    Object.keys(out.best).forEach(k => { out.best[k] = Math.max((a.best || {})[k] || 0, (b.best || {})[k] || 0); });
    out.starred = [...new Set([...(a.starred || []), ...(b.starred || [])])];
    out.lessonsRead = [...new Set([...(a.lessonsRead || []), ...(b.lessonsRead || [])])];
    out.stats = Object.assign({}, a.stats);
    Object.keys(b.stats || {}).forEach(id => {
      const x = out.stats[id], y = b.stats[id];
      if (!x || (y.n || 0) > (x.n || 0) || ((y.n || 0) === (x.n || 0) && (y.t || 0) > (x.t || 0))) out.stats[id] = y;
    });
    const seen = new Set();
    out.history = [...(a.history || []), ...(b.history || [])].filter(h => { const j = JSON.stringify(h); if (seen.has(j)) return false; seen.add(j); return true; })
      .sort((x, y) => (x.t || 0) - (y.t || 0)).slice(-100);
    const ids = new Set(); out.aiq = [...(a.aiq || []), ...(b.aiq || [])].filter(q => q && !ids.has(q.id) && ids.add(q.id));
    const ra = a.rank, rb = b.rank;
    if (ra && rb) out.rank = (rb.xp || 0) > (ra.xp || 0) ? rb : ra;
    Object.keys(out).forEach(k => { if (out[k] === undefined) delete out[k]; });
    return out;
  }
  window.CSCloud = {
    snapshot() { const d = snapshot("cloud").data; delete d.qmap; return d; },
    hasData,
    backup: autoBackup,
    merge: mergeData,
    // write data into this device (caller reloads the page afterwards)
    apply(data, replace) { autoBackup("before-account-sync"); CLOUD_KEYS.forEach(k => { try { if (k in data) localStorage.setItem("cscoach." + k, JSON.stringify(data[k])); else if (replace) localStorage.removeItem("cscoach." + k); } catch (_) {} }); },
    t: (k, v) => t(k, v), toast: m => toast(m), lang: () => I.lang
  };

    // 1 + 2: backup on version change and once a day
  (function () {
    const last = store.get("cscoach.version", null);
    if (last && last !== APP_VERSION) autoBackup("update " + last + " → " + APP_VERSION);
    const backups = store.get("cscoach.backups", []);
    const newest = backups.length ? backups[backups.length - 1].savedAt : 0;
    if (Date.now() - newest > DAY) autoBackup("daily");
    store.set("cscoach.version", APP_VERSION);
    // ask the browser not to clear our storage under pressure
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) {}
  })();
  // 3: question fingerprints → remap progress if questions moved
  (function () {
    const fp = q => { let h = 5381; const str = q.q + "|" + q.c.join("|"); for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const now = {}, byHash = {};
    byId.forEach((q, id) => { const h = fp(q); now[id] = h; byHash[h] = id; });
    const old = store.get("cscoach.qmap", null);
    if (old) {
      const remap = {};
      Object.keys(old).forEach(id => {
        if (now[id] === old[id]) return;               // same question, same place
        const moved = byHash[old[id]];
        if (moved && moved !== id) remap[id] = moved;  // question moved to a new id
        // otherwise: question text was edited (keep id) or removed (keep data, harmless)
      });
      if (Object.keys(remap).length) {
        autoBackup("before-remap");
        const ns = {};
        Object.keys(stats).forEach(id => { ns[remap[id] || id] = stats[id]; });
        stats = ns; store.set("cscoach.stats", stats);
        starred = new Set([...starred].map(id => remap[id] || id)); store.set("cscoach.starred", [...starred]);
      }
    }
    store.set("cscoach.qmap", now);
  })();

  // Rotation: a question you answered won't come back for COOLDOWN_DAYS.
  // Fresh questions are ordered: never seen first (high-yield topics first),
  // then old mistakes, then the rest. Rounds use ONLY fresh questions; older
  // ones come back only when the student explicitly chooses "Review older".
  const isFresh = q => { const st = stats[q.id]; return !st || !st.t || Date.now() - st.t >= COOLDOWN_DAYS * DAY; };
  let lastRecycled = 0;
  function smartPick(qs, n, allowRepeat) {
    const rank = q => {
      const st = stats[q.id], imp = impOf(q) * 0.15;
      if (!st) return Math.random() - imp;
      if (!st.last) return 1 + Math.random() - imp;
      return 2 + st.c / st.n + Math.random() * 0.5 - imp;
    };
    const fresh = qs.filter(isFresh).map(q => [rank(q), q]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const picked = fresh.slice(0, n);
    lastRecycled = 0;
    if (allowRepeat && picked.length < n) {
      const old = qs.filter(q => !isFresh(q)).sort((a, b) => (stats[a.id].t || 0) - (stats[b.id].t || 0));
      const fill = old.slice(0, n - picked.length);
      lastRecycled = fill.length;
      picked.push(...fill);
    }
    return picked;
  }
  const freshCount = qs => qs.filter(isFresh).length;

  // Mistakes (last attempt wrong) + starred, compiled into one review set
  const mistakeIds = () => Object.keys(stats).filter(id => stats[id].last === 0 && byId.has(id));
  function reviewQs() {
    const ids = new Set([...mistakeIds(), ...starred]);
    return [...ids].map(id => byId.get(id)).filter(Boolean);
  }

  // Shuffle the choice order while tracking the correct answer
  // Error-recognition items ("Identify the part with an error: X (A) / Y (B) / … / No error (D)")
  // are shown as a sentence with each underlined part's letter below it, like the real exam.
  function errParts(q) {
    const m = q.q.match(/^(.*?:)\s*(.+)$/);
    if (!m || !/\([A-E]\)\s*$/.test(m[2])) return null;
    const parts = m[2].split(/\s*\/\s*/).map(p => { const x = p.match(/^(.*?)\s*\(([A-E])\)\s*$/); return x ? { text: x[1], letter: x[2] } : null; });
    if (parts.length < 3 || parts.some(p => !p)) return null;
    return { prompt: m[1], parts };
  }
  const isNoError = txt => /^(no error|walang mali)$/i.test(txt.trim());
  // Paragraph-organization items "(1) … (2) … (3) …" are shown one sentence per line
  function numParts(q) {
    const i = q.q.indexOf("(1)");
    if (i < 0) return null;
    const items = [...q.q.slice(i).matchAll(/\((\d)\)\s*([^()]+?)(?=\s*\(\d\)|$)/g)].map(m => ({ n: m[1], t: m[2].trim() }));
    return items.length >= 3 ? { head: q.q.slice(0, i).trim(), items } : null;
  }
  function qHtml(q) {
    const np = !errParts(q) && numParts(q);
    if (np) return `${np.head ? `<span class="err-prompt">${esc(np.head)}</span>` : ""}
      <span class="num-list">${np.items.map(it => `<span class="num-item"><b>(${it.n})</b><span>${esc(it.t)}</span></span>`).join("")}</span>`;
    const ep = errParts(q);
    if (!ep) return esc(q.q);
    const segs = ep.parts.filter(p => !isNoError(p.text)), none = ep.parts.find(p => isNoError(p.text));
    return `<span class="err-prompt">${esc(ep.prompt)}</span>
      <span class="err-sentence">${segs.map(p => `<span class="seg"><u>${esc(p.text)}</u><b>${p.letter}</b></span>`).join(" ")}</span>
      ${none ? `<span class="err-sentence noerr"><span class="seg"><span>${esc(none.text)}</span><b>${none.letter}</b></span></span>` : ""}`;
  }
  // Choice text: for error items, show the underlined words for that letter
  function cText(q, i) {
    const ep = errParts(q), c = q.c[i];
    if (!ep) return c;
    const part = ep.parts.find(p => p.letter === c);
    return part ? part.text : c;
  }

  function prepare(q) {
    if (errParts(q)) return { ...q };   // letters must stay in order
    const order = shuffle(q.c.map((_, i) => i));
    return { ...q, c: order.map(i => q.c[i]), a: order.indexOf(q.a) };
  }

  function accOf(qs) {
    let n = 0, c = 0, seen = 0;
    qs.forEach(q => { const st = stats[q.id]; if (st) { seen++; n += st.n; c += st.c; } });
    return { n, c, seen, acc: n ? Math.round(c / n * 100) : null };
  }

  const goal = () => (profile && +profile.dailyGoal) || 20;
  const dayKey = ts => new Date(ts).toDateString();
  function answeredOn(key) { return history.filter(h => dayKey(h.t) === key).reduce((n, h) => n + (h.answered != null ? h.answered : h.total), 0); }

  // Analytics used by the Analytics tab and the AI coach
  function analytics() {
    const subjects = SUBJECTS.map(s => {
      let seen = 0, attempts = 0, correct = 0, wrongNow = 0;
      s.questions.forEach(q => { const st = stats[q.id]; if (st) { seen++; attempts += st.n; correct += st.c; if (!st.last) wrongNow++; } });
      return { id: s.id, name: sn(s).name, total: s.questions.length, seen, attempts, correct, wrongNow, acc: attempts ? Math.round(correct / attempts * 100) : null };
    });
    const topics = [];
    SUBJECTS.forEach(s => (LESSONS[s.id] || []).forEach(l => { const a = accOf(lessonQs(s.id, l)); topics.push({ sid: s.id, id: l.id, title: l.title, importance: l.imp, attempts: a.n, acc: a.acc }); }));
    const attempts = subjects.reduce((a, x) => a + x.attempts, 0), correct = subjects.reduce((a, x) => a + x.correct, 0);
    const days = [...new Set(history.map(h => new Date(h.t).toDateString()))];
    let streak = 0; const d = new Date();
    if (!days.includes(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.includes(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    const examDate = profile && profile.examDate ? profile.examDate : null;
    const daysLeft = examDate ? Math.ceil((new Date(examDate + "T08:00:00") - new Date()) / 86400000) : null;
    return {
      name: profile && profile.name || "", mode: profile && profile.instant ? "practice" : "exam", language: I.names[I.lang],
      overall: { attempts, correct, acc: attempts ? Math.round(correct / attempts * 100) : null },
      subjects, weakTopics: topics.filter(x => x.attempts >= 2).sort((a, b) => (a.acc - b.acc) || (b.importance - a.importance)).slice(0, 5),
      mistakes: mistakeIds().length, aiQuestions: aiBank.length, dailyGoal: goal(),
      answeredToday: answeredOn(new Date().toDateString()),
      sessions: history.length, recent: history.slice(-5).map(h => ({ title: h.title, pct: h.pct, date: new Date(h.t).toLocaleDateString() })),
      lessonsRead: lessonsRead.size, daysActive: days.length, streak, examDate, daysLeft, starred: starred.size, passing: PASSING
    };
  }

  function recordSession(S) {
    S.items.forEach((q, i) => {
      const ans = S.answers[i]; if (ans === null) return;
      const ok = ans === q.a ? 1 : 0;
      const st = stats[q.id] || (stats[q.id] = { n: 0, c: 0, last: 0 });
      st.n++; st.c += ok; st.last = ok; st.t = Date.now();
      if (S.timer && S.timer !== "off") {   // optional speed fields (older saves simply don't have them)
        const ms = S.qTime[i], slow = ms > SEC_Q * 1000 ? 1 : 0;
        st.tn = (st.tn || 0) + 1; st.ts = (st.ts || 0) + Math.round(ms / 1000); st.sl = (st.sl || 0) + slow; st.slast = slow;
      }
    });
    const correct = S.items.filter((q, i) => S.answers[i] === q.a).length;
    const answered = S.answers.filter(a => a !== null).length;
    const rec = { t: Date.now(), key: S.key, title: S.title, total: S.items.length, answered, correct, pct: Math.round(correct / S.items.length * 100) };
    if (S.timer && S.timer !== "off") {
      rec.timer = S.timer; rec.secs = Math.round(S.total / 1000); rec.avg = Math.round(S.total / 1000 / Math.max(1, answered));
      rec.slow = S.qTime.filter(ms => ms > SEC_Q * 1000).length; if (S.timedOut) rec.timedOut = 1;
    }
    history.push(rec);
    history = history.slice(-100);
    store.set("cscoach.stats", stats); store.set("cscoach.history", history);
    const b = store.get("cscoach.backups", []);
    if (!b.length || Date.now() - b[b.length - 1].savedAt > DAY) autoBackup("daily");
  }

  // ---------- navigation ----------
  let onBack = null;
  const HOME = "practice";   // the home tab (Learn now lives inside Settings)
  // Lessons are still being written: shown as "Coming soon" and not openable.
  // Set to true to turn the Learn section (and every link to it) back on.
  const LESSONS_ON = false;
  let tab = HOME;
  function setBack(fn) { onBack = fn; backBtn.classList.toggle("hidden", !fn); ensureGuard(); }

  // ---------- Phone back button / back gesture ----------
  // Keep one extra history entry while there is something to go back from, so the
  // phone's Back closes (in order) a pop-up, the chat, the current inner screen,
  // or returns to the Learn tab, instead of leaving the app.
  let guard = false;
  const modalOpen = () => document.querySelector(".modal-bg");
  const chatIsOpen = () => !!(window.CoachUI && window.CoachUI.isOpen && window.CoachUI.isOpen());
  const tourOpen = () => document.querySelector(".tour");
  const canGoBack = () => !!(tourOpen() || modalOpen() || chatIsOpen() || onBack || (profile && tab !== HOME));
  // Chrome skips history entries a page adds without a user tap, so only add one
  // while the user is interacting (right after a tap/click/keypress).
  const userActive = () => !navigator.userActivation || navigator.userActivation.isActive;
  function ensureGuard() {
    if (guard || !canGoBack() || !userActive()) return;
    try { window.history.pushState({ cscoach: Date.now() }, ""); guard = true; } catch (_) {}
  }
  window.CSBack = ensureGuard;
  // after every tap, make sure Back has something to close
  ["click", "keydown"].forEach(ev => document.addEventListener(ev, () => setTimeout(ensureGuard, 0), true));
  window.addEventListener("popstate", () => {
    guard = false;
    const m = modalOpen();
    if (tourOpen()) endTour();
    else if (m) m.remove();
    else if (chatIsOpen()) window.CoachUI.close();
    else if (onBack) onBack();
    else if (profile && tab === "settings" && settingsDirty()) guardLeave(() => openTab(HOME));
    else if (profile && tab === "learn") openTab("settings");
    else if (profile && tab !== HOME) openTab(HOME);
    else { try { window.history.back(); } catch (_) {} return; }   // nothing left: leave the app
    setTimeout(ensureGuard, 0);
  });
  backBtn.addEventListener("click", () => onBack && onBack());
  settingsBtn.addEventListener("click", () => {
    if (session && !session.done) return confirmBox(t("leaveForSettings"), t("leave"), () => { session = null; renderSettings(false); });
    if (settingsDirty()) return guardLeave(() => renderSettings(false));   // already in Settings with edits
    renderSettings(false);
  });
  function showTabbar(on) {
    tabbar.classList.toggle("hidden", !on);
    document.body.classList.toggle("has-tabbar", on);
  }
  function paintTabbar() {
    paintRank();
    tabbar.querySelectorAll("[data-tab]").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === (tab === "learn" ? "settings" : tab));
      b.querySelector(".tab-label").textContent = t({ learn: "tabLearn", practice: "tabPractice", chat: "tabChat", calendar: "tabCalendar", analytics: "tabAnalytics", settings: "tabSettings" }[b.dataset.tab]);
      if (b.dataset.tab === "chat") { b.classList.remove("active"); const ico = b.querySelector(".tab-ico"); if (window.Pet && Pet.avatar && !ico.dataset.char) { ico.innerHTML = Pet.avatar(); ico.dataset.char = "1"; } }
    });
  }
  tabbar.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tab === "chat") return window.CoachUI && window.CoachUI.toggleFull();
    if (chatIsOpen()) window.CoachUI.close();   // leaving the chat tab
    if (tab === "settings" && settingsDirty()) return guardLeave(() => openTab(b.dataset.tab));
    openTab(b.dataset.tab);
  }));
  // refresh the chat tab's face when the character changes
  document.addEventListener("cscoach:pet", () => { const ico = tabbar.querySelector(".tab-chat .tab-ico"); if (ico) { delete ico.dataset.char; paintTabbar(); } });
  function openTab(name) {
    settingsDirty = () => false;
    pet().setBusy && pet().setBusy(false);
    tab = name || tab;
    session = null;
    paintTabbar(); showTabbar(true);
    setTimeout(ensureGuard, 0);
    if (tab === "learn") renderLearn();
    else if (tab === "settings") renderSettings(false);
    else if (tab === "analytics") renderAnalytics();
    else if (tab === "calendar") renderCalendar();
    else renderPractice();
  }
  const goHome = () => openTab();

  // ---------- modal ----------
  function modal(html, bind) {
    const wrap = document.createElement("div");
    wrap.className = "modal-bg";
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    ensureGuard();
    const close = () => wrap.remove();
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    bind(wrap, close);
    return close;
  }
  function confirmBox(msg, yesLabel, onYes) {
    modal(`<p class="modal-text">${esc(msg)}</p>
      <div class="actions"><button class="btn secondary" data-n>${t("cancel")}</button><button class="btn" data-y>${esc(yesLabel)}</button></div>`,
      (w, close) => { w.querySelector("[data-n]").onclick = close; w.querySelector("[data-y]").onclick = () => { close(); onYes(); }; });
  }

  // ---------- setup / settings ----------
  let settingsDirty = () => false, saveSettingsNow = () => {};
  function restoreSaved() {
    // undo live previews (language, character, name) when changes are discarded
    I.setLang((profile && profile.lang) || "en");
    I.petName = (profile && profile.petName) || "Kiko";
    if (window.Pet && Pet.setCharacter) Pet.setCharacter((profile && profile.petChar) || "sprout");
  }
  function guardLeave(next) {
    if (!settingsDirty()) { settingsDirty = () => false; restoreSaved(); return next(); }
    modal(`
      <div class="modal-title">💾 ${t("unsavedTitle")}</div>
      <p class="modal-text">${t("unsavedText")}</p>
      <div class="actions">
        <button class="btn secondary" data-discard>${t("discard")}</button>
        <button class="btn" data-save>${t("saveChanges")}</button>
      </div>
      <div class="center" style="margin-top:8px"><button class="link" data-cancel>${t("cancel")}</button></div>
    `, (w, close) => {
      w.querySelector("[data-save]").onclick = () => { close(); saveSettingsNow(); toast(t("settingsSaved")); next(); };
      w.querySelector("[data-discard]").onclick = () => { close(); settingsDirty = () => false; restoreSaved(); next(); };
      w.querySelector("[data-cancel]").onclick = close;
    });
  }
  const CHAR_KEYS = { sprout: "charSprout", kitty: "charKitty", bunny: "charBunny", puppy: "charPuppy", chick: "charChick" };
  const settingsSnap = p => JSON.stringify({ name: p.name || "", instant: !!p.instant, examDate: p.examDate || "", pet: p.pet !== false, lang: p.lang || "en", dailyGoal: +p.dailyGoal || 20, timer: p.timer || "question", petChar: p.petChar || "sprout", petName: p.petName || "Kiko", petMode: p.petMode || (p.pet === false ? "home" : "still") });

  // Settings sections are collapsible (tap the header). Open sections stay open on re-render.
  const openSecs = new Set();
  function sec(id, icon, title, summary, body, firstRun) {
    if (firstRun) return `<div class="setup-sec"><div class="setup-h">${icon} ${title}</div>${body}</div>`;
    return `<details class="set-sec" data-sec="${id}" ${openSecs.has(id) ? "open" : ""}>
      <summary><span class="sec-ico">${icon}</span><span class="sec-txt"><b>${title}</b>${summary ? `<small>${summary}</small>` : ""}</span><span class="sec-chev">▾</span></summary>
      <div class="sec-body">${body}</div>
    </details>`;
  }

  function renderSettings(firstRun, draft) {
    // Leaving with unsaved changes asks first
    setBack(null);
    if (firstRun) showTabbar(false);
    else { tab = "settings"; paintTabbar(); showTabbar(true); }
    const p = draft || profile || { name: "", timer: "question", instant: false, examDate: "", pet: true, lang: "en", dailyGoal: 20, petChar: "sprout", petName: "Kiko" };
    I.setLang(p.lang || "en");
    I.petName = (p.petName || "Kiko").trim() || "Kiko";
    if (window.Pet && Pet.setCharacter) Pet.setCharacter(p.petChar || "sprout");
    const langOpt = (v, flag, label, sample) => `
      <label class="lang-opt">
        <input type="radio" name="lang" value="${v}" ${(p.lang || "en") === v ? "checked" : ""} />
        <span class="lang-flag">${flag}</span><b>${label}</b><span>${sample}</span>
      </label>`;
    app.innerHTML = `
      <h2>${firstRun ? t("welcome") : t("settings")}</h2>
      <p class="sub">${firstRun ? t("setupSub") : t("settingsSub")}</p>
      <form id="setupForm" class="${firstRun ? "panel" : "settings-form"}">
        ${sec("profile", "👤", t("secProfile"), esc((p.name ? p.name + " · " : "") + I.names[p.lang || "en"]), `
          <div class="field-label">${t("language")}</div>
          <div class="lang-row">
            ${langOpt("en", "🇺🇸", "English", "Let's review!")}
            ${langOpt("tl", "🇵🇭", "Tagalog", "Magrebyu tayo!")}
            ${langOpt("tg", "💬", "Taglish", "Review na tayo!")}
          </div>
          <p class="muted small" style="margin:6px 0 0">${t("languageNote")}</p>
          <label class="field-label" for="name" style="margin-top:18px">${t("yourName")}</label>
          <input id="name" class="input" type="text" maxlength="40" placeholder="${t("namePh")}" value="${esc(p.name || "")}" autocomplete="given-name" />`, firstRun)}

        ${sec("quiz", "📝", t("secQuiz"), esc((p.instant ? t("practiceMode") : t("examMode")) + (p.examDate ? " · " + p.examDate : "") + " · " + (p.dailyGoal || 20) + "/" + t("perDay") + ((p.timer || "question") === "question" ? " · ⏱ " + t("timerSumQ") : p.timer === "set" ? " · ⏱ " + t("timerSumSet") : "")), `
          ${firstRun ? "" : `
          <button class="learn-card ${LESSONS_ON ? "" : "soon"}" id="openLearn" type="button" ${LESSONS_ON ? "" : `disabled aria-disabled="true"`}>
            <span class="lc-ico">📖</span>
            <span class="lc-txt"><b>${t("learnTitle")}</b><small>${t("learnCardDesc")}</small></span>
            ${LESSONS_ON ? "<span>→</span>" : `<span class="soon-badge">${t("comingSoon")}</span>`}
          </button>`}
          <div class="field-label">${t("revealQ")}</div>
          <label class="mode-opt">
            <input type="radio" name="mode" value="exam" ${!p.instant ? "checked" : ""} />
            <div><b>📝 ${t("examMode")} <span class="badge">${t("recommended")}</span></b>
            <span>${t("examModeDesc")}</span></div>
          </label>
          <label class="mode-opt">
            <input type="radio" name="mode" value="instant" ${p.instant ? "checked" : ""} />
            <div><b>⚡ ${t("practiceMode")}</b>
            <span>${t("practiceModeDesc")}</span></div>
          </label>
          <label class="field-label" for="examDate" style="margin-top:18px">${t("examDate")}</label>
          <input id="examDate" class="input" type="date" value="${esc(p.examDate || "")}" />
          <p class="muted small" style="margin:6px 0 0">${t("examDateNote")}</p>
          <label class="field-label" for="dailyGoal" style="margin-top:18px">${t("dailyGoal")}</label>
          <input id="dailyGoal" class="input" type="number" min="5" max="200" step="5" value="${esc(p.dailyGoal || 20)}" />
          <div class="field-label" style="margin-top:18px">⏱ ${t("timerLabel")}</div>
          <select id="timerSel" class="input" aria-label="${t("timerLabel")}">
            ${[["off", "timerOff"], ["question", "timerQ"], ["set", "timerSet"]].map(([v, n]) => `<option value="${v}" ${(p.timer || "question") === v ? "selected" : ""}>${t(n)}</option>`).join("")}
          </select>
          <p class="muted small" id="timerDesc" style="margin:6px 0 0">${t({ off: "timerOffDesc", question: "timerQDesc", set: "timerSetDesc" }[p.timer || "question"], { s: SEC_Q })}</p>`, firstRun)}

        ${sec("buddy", "🐾", t("buddySection"), esc((p.petName || "Kiko") + " · " + t(CHAR_KEYS[p.petChar || "sprout"]) + " · " + t({ home: "petModeHome", still: "petModeStill", walk: "petModeWalk" }[p.petMode || (p.pet === false ? "home" : "still")])), `
          <div class="muted small" style="margin-bottom:8px">${t("buddyChar")}</div>
          <div class="char-row">
            ${Object.keys(CHAR_KEYS).map(k => `
              <label class="char-opt">
                <input type="radio" name="petChar" value="${k}" ${(p.petChar || "sprout") === k ? "checked" : ""} />
                ${window.Pet && Pet.preview ? Pet.preview(k) : ""}
                <span>${t(CHAR_KEYS[k])}</span>
              </label>`).join("")}
          </div>
          <label class="field-label" for="petName" style="margin-top:12px">${t("buddyName")}</label>
          <input id="petName" class="input" type="text" maxlength="16" placeholder="Kiko" value="${esc(p.petName || "Kiko")}" />
          <div class="field-label" style="margin-top:16px">${t("petModeLabel")}</div>
          ${["home", "still", "walk"].map(m => {
            const cur = p.petMode || (p.pet === false ? "home" : "still");
            const key = { home: "petModeHome", still: "petModeStill", walk: "petModeWalk" }[m];
            return `<label class="mode-opt"><input type="radio" name="petMode" value="${m}" ${cur === m ? "checked" : ""} /><div><b>${t(key)}</b><span>${t(key + "Desc")}</span></div></label>`;
          }).join("")}`, firstRun)}

        <div class="actions save-row"><span class="unsaved-badge hidden" id="unsavedBadge">● ${t("unsavedBadge")}</span><button class="btn" type="submit">${firstRun ? t("startReviewing") : t("saveSettings")}</button></div>
      </form>
      ${firstRun ? "" : sec("ai", "✨", t("aiTutorTitle"), aiSummary(), aiPanelHtml())}
      ${firstRun ? "" : (IN ? sec("install", "📲", t("installShort"), IN.isStandalone() ? t("installedShort") : "", installHtml(false)) : "")}
      ${firstRun || !window.Account ? "" : sec("account", "☁️", window.Account.tr("secTitle"), window.Account.summary(), window.Account.panelHtml())}
      ${firstRun ? "" : sec("backup", "🛡️", t("backupTitle"), "", backupPanelHtml())}
      ${firstRun ? "" : sec("tour", "🧭", t("tourAgain"), "", `<p class="muted small" style="margin:0 0 10px">${t("tourAgainDesc")}</p><button class="btn" id="tourBtn">${t("tourAgain")}</button>`)}
      ${firstRun ? "" : sec("report", "🐞", t("reportTitle"), t("reportSummary"), reportPanelHtml())}
      ${firstRun || !hasDonate() ? "" : sec("donate", "💚", t("donTitle"), t("donAny"), donatePanelHtml())}
      ${firstRun ? "" : sec("reset", "🗑️", t("resetProgress"), "", `
          <p class="sub" style="margin:0 0 12px">${t("resetDesc")}</p>
          <button class="btn secondary" id="resetBtn">${t("resetProgress")}</button>`)}
      <p class="note">${t("profileNote")}${firstRun ? "" : ` · CS Coach v${APP_VERSION}`}</p>
    `;
    const read = () => ({
      name: document.getElementById("name").value.trim(),
      instant: app.querySelector("input[name=mode]:checked").value === "instant",
      examDate: document.getElementById("examDate").value,
      timer: (document.getElementById("timerSel") || {}).value || "off",
      petMode: (app.querySelector("input[name=petMode]:checked") || {}).value || "still",
      pet: ((app.querySelector("input[name=petMode]:checked") || {}).value || "still") !== "home",
      lang: app.querySelector("input[name=lang]:checked").value,
      dailyGoal: Math.max(5, Math.min(200, +document.getElementById("dailyGoal").value || 20)),
      petChar: (app.querySelector("input[name=petChar]:checked") || {}).value || "sprout",
      petName: document.getElementById("petName").value.trim().slice(0, 16) || "Kiko",
      created: (profile && profile.created) || (draft && draft.created) || Date.now()
    });
    // Re-render immediately in the chosen language / character (live preview)
    app.querySelectorAll("input[name=lang], input[name=petChar]").forEach(r => r.addEventListener("change", () => { const y = window.scrollY; renderSettings(firstRun, read()); window.scrollTo(0, y); }));
    const tsel = document.getElementById("timerSel");
    tsel.addEventListener("change", () => { document.getElementById("timerDesc").textContent = t({ off: "timerOffDesc", question: "timerQDesc", set: "timerSetDesc" }[tsel.value], { s: SEC_Q }); });
    // Track unsaved changes
    const saved = settingsSnap(profile || {});
    const badge = document.getElementById("unsavedBadge");
    settingsDirty = () => !firstRun && settingsSnap(read()) !== saved;
    const paintDirty = () => badge.classList.toggle("hidden", !settingsDirty());
    app.querySelector("#setupForm").addEventListener("input", paintDirty);
    app.querySelector("#setupForm").addEventListener("change", paintDirty);
    paintDirty();
    saveSettingsNow = () => {
      profile = read();
      I.setLang(profile.lang); I.petName = profile.petName;
      if (window.Pet && Pet.setMode) Pet.setMode(profile.petMode || "still"); else pet().setVisible(profile.pet);
      if (window.Pet && Pet.setCharacter) Pet.setCharacter(profile.petChar);
      store.set("cscoach.profile", profile);
      settingsDirty = () => false;
      document.dispatchEvent(new CustomEvent("cscoach:lang"));
    };
    document.getElementById("setupForm").addEventListener("submit", e => {
      e.preventDefault();
      saveSettingsNow();
      openTab(firstRun ? HOME : "settings");
      if (firstRun) setTimeout(startTour, 500);
      else toast(t("settingsSaved"));
    });
    app.querySelectorAll("details.set-sec").forEach(d => d.addEventListener("toggle", () => { d.open ? openSecs.add(d.dataset.sec) : openSecs.delete(d.dataset.sec); }));
    const ol = document.getElementById("openLearn");
    if (ol && LESSONS_ON) ol.onclick = () => settingsDirty() ? guardLeave(() => openTab("learn")) : openTab("learn");
    const tb = document.getElementById("tourBtn"); if (tb) tb.onclick = () => { if (settingsDirty()) return guardLeave(startTour); startTour(); };
    if (!firstRun) { bindAiPanel(); if (window.Account) window.Account.bindPanel(app, () => { const y = window.scrollY; renderSettings(false); window.scrollTo(0, y); }); bindBackupPanel(); bindReportPanel(); bindDonatePanel(); bindInstall(app, () => { const y = window.scrollY; renderSettings(false); window.scrollTo(0, y); }); }
    const reset = document.getElementById("resetBtn");
    if (reset) reset.addEventListener("click", () => confirmBox(t("resetConfirm"), t("reset"), () => {
      autoBackup("before-reset");
      best = {}; starred = new Set(); stats = {}; history = []; lessonsRead = new Set();
      ["best", "stats", "history"].forEach(k => store.set("cscoach." + k, k === "history" ? [] : {}));
      store.set("cscoach.lessonsRead", []); rankState = { xp: 0, rank: 1, day: "", seen: [] }; store.set("cscoach.rank", rankState); saveStars(); goHome();
    }));
    window.scrollTo(0, 0);
  }


  // ---------- Backup & restore UI ----------
  const fmtDate = ts => new Date(ts).toLocaleString(I.lang === "en" ? "en-US" : "fil-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const reasonLabel = r => (r || "").startsWith("update") ? t("reasonUpdate") : t({ daily: "reasonDaily", manual: "reasonManual", "before-restore": "reasonRestore", "before-reset": "reasonReset", "before-remap": "reasonUpdate" }[r] || "reasonManual");
  function backupPanelHtml() {
    const lastExport = store.get("cscoach.lastExport", null);
    return `
      <div class="panel backup-panel">
        <p class="muted small" style="margin:0 0 10px">${t("backupDesc")}</p>
        <div class="backup-meta"><span>💾 ${t("lastExport")}: <b>${lastExport ? fmtDate(lastExport) : t("never")}</b></span></div>
        <div class="backup-btns">
          <button class="btn" id="bkDownload">⬇️ ${t("backupDownload")}</button>
          <label class="btn secondary file-btn">📂 ${t("restoreFile")}<input type="file" id="bkFile" accept=".json,application/json,text/plain" hidden /></label>
        </div>
      </div>`;
  }
  function confirmRestore(snap) {
    const n = snap.data && snap.data.stats ? Object.keys(snap.data.stats).length : 0;
    confirmBox(t("restoreConfirm", { d: fmtDate(snap.savedAt || Date.now()), n }), t("restoreBtn"), () => {
      try { applyBackup(snap); toast(t("restored")); setTimeout(() => location.reload(), 700); }
      catch (_) { toast(t("badBackup")); }
    });
  }
  function parseBackup(text) {
    try { const s = JSON.parse(text.trim()); if (s && s.app === "cs-coach" && s.data) return s; } catch (_) {}
    try { const s = JSON.parse(decodeURIComponent(escape(atob(text.trim())))); if (s && s.app === "cs-coach" && s.data) return s; } catch (_) {}
    return null;
  }
  // ---------- REPORT A PROBLEM (opens the user's email app) ----------
  function reportPanelHtml() {
    const opt = (v, k) => `<option value="${v}">${t(k)}</option>`;
    return `
      <p class="sub" style="margin:0 0 12px">${t("reportDesc")}</p>
      <label class="field-label" for="rpType">${t("reportType")}</label>
      <select id="rpType" class="input">
        ${opt("Wrong answer", "reportWrong")}${opt("Bug", "reportBug")}${opt("Suggestion", "reportIdea")}${opt("Other", "reportOther")}
      </select>
      <label class="field-label" for="rpMsg" style="margin-top:14px">${t("reportMsg")}</label>
      <textarea id="rpMsg" class="input" rows="5" maxlength="1500" placeholder="${esc(t("reportPh"))}"></textarea>
      <label class="field-label" style="margin-top:14px">${t("reportPic")}</label>
      <div class="rp-pics" id="rpPics"></div>
      <label class="btn secondary file-btn rp-add" id="rpAddWrap">📷 ${t("reportPicBtn")}<input type="file" id="rpFile" accept="image/*" multiple hidden /></label>
      <div class="actions" style="margin-top:12px"><button class="btn" type="button" id="rpSend">${t("reportSend")}</button></div>
      <p class="muted small" style="margin:12px 0 4px">${t("reportNoApp")} <b>${REPORT_EMAIL}</b></p>
      <button class="btn secondary" type="button" id="rpCopy">${t("reportCopy")}</button>
      <p class="muted small" style="margin:10px 0 0">${t("reportPrivacy")}</p>`;
  }
  // Pictures for the report: shrunk to max 1600 px JPEG so they send quickly
  let rpFiles = [];
  function shrinkImage(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => resolve(b ? new File([b], "cs-coach-report-" + (rpFiles.length + 1) + ".jpg", { type: "image/jpeg" }) : file), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function paintPics() {
    const box = document.getElementById("rpPics"); if (!box) return;
    box.innerHTML = rpFiles.map((f, i) => `<span class="rp-pic"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" data-rm="${i}" aria-label="${t("reportPicRemove")}">✕</button></span>`).join("");
    box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { rpFiles.splice(+b.dataset.rm, 1); paintPics(); });
    document.getElementById("rpAddWrap").style.display = rpFiles.length >= 3 ? "none" : "";
  }
  function bindReportPanel() {
    const send = document.getElementById("rpSend");
    if (!send) return;
    paintPics();
    document.getElementById("rpFile").onchange = async e => {
      for (const f of [...e.target.files].slice(0, 3 - rpFiles.length)) if (f.type.startsWith("image/")) rpFiles.push(await shrinkImage(f));
      e.target.value = "";
      paintPics();
    };
    send.onclick = async () => {
      const msg = document.getElementById("rpMsg").value.trim();
      if (!msg) { toast(t("reportEmpty")); return document.getElementById("rpMsg").focus(); }
      const type = document.getElementById("rpType").value;
      const subject = "CS Coach " + type + " (v" + APP_VERSION + ")";
      const body = msg + "\n\n---\nApp: CS Coach v" + APP_VERSION +
        "\nLanguage: " + I.lang +
        "\nInstalled as app: " + (IN && IN.isStandalone() ? "yes" : "no") +
        "\nScreen: " + screen.width + "x" + screen.height +
        "\nDevice: " + navigator.userAgent +
        (rpFiles.length ? "" : "\n\n(You can attach a screenshot to this email.)");
      if (rpFiles.length && navigator.canShare && navigator.canShare({ files: rpFiles })) {
        try { await navigator.clipboard.writeText(REPORT_EMAIL); } catch (_) {}
        toast(t("reportShareHint", { e: REPORT_EMAIL }));
        try {
          await navigator.share({ title: subject, text: "To: " + REPORT_EMAIL + "\n" + subject + "\n\n" + body, files: rpFiles });
          rpFiles = []; paintPics(); document.getElementById("rpMsg").value = "";
        } catch (err) { if (err && err.name !== "AbortError") toast(t("reportAttachManual")); }
        return;
      }
      if (rpFiles.length) toast(t("reportAttachManual"));
      const url = "mailto:" + REPORT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      try { const w = window.open(url, "_top"); if (!w) location.href = url; } catch (_) { location.href = url; }
      toast(t("reportOpened"));
    };
    document.getElementById("rpCopy").onclick = () => {
      const done = () => toast(t("reportCopied"));
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(REPORT_EMAIL).then(done, () => toast(REPORT_EMAIL));
      else toast(REPORT_EMAIL);
    };
  }

  function bindBackupPanel() {
    const fileName = () => "cs-coach-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.getElementById("bkDownload").onclick = () => {
      if (window.claude && typeof window.claude.use === "function") return toast(t("backupUseCopy"));   // claude.ai blocks downloads
      const json = JSON.stringify(snapshot("manual"));
      try {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
        store.set("cscoach.lastExport", Date.now());
        toast(t("backupSaved"));
      } catch (_) { toast(t("backupUseCopy")); }
      const y = window.scrollY; renderSettings(false); window.scrollTo(0, y);
    };
    document.getElementById("bkFile").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const snap = parseBackup(String(r.result)); snap ? confirmRestore(snap) : toast(t("badBackup")); };
      r.readAsText(f);
    };
  }


  // ---------- WORD HELPER: long-press any word ----------
  // Shows meaning, an example sentence and the Tagalog (or English, for Filipino words).
  // Advanced words also show a "picture" and a fun memory trick.
  const G = window.GLOSSARY || {}, GF = window.GLOSSARY_FIL || {};
  function lookupWord(raw) {
    const w = raw.toLowerCase().replace(/[^a-zà-ÿñ'-]/g, "").replace(/^['-]+|['-]+$/g, "");
    const c = [w, w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, ""), w.replace(/ed$/, ""), w.replace(/ed$/, "e"), w.replace(/d$/, ""), w.replace(/ing$/, ""), w.replace(/ing$/, "e"), w.replace(/ly$/, "")];
    for (const k of c) { if (G[k]) return { word: k, en: G[k] }; if (GF[k]) return { word: k, fil: GF[k] }; }
    return { word: w };
  }
  function say(text, lang) {
    try { const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) {}
  }
  function wordBody(r, ai) {
    if (r.en) {
      const e = r.en;
      return `
        <div class="w-row"><span class="w-label">${t("wMeaning")}</span><span>${esc(e.m)}</span></div>
        <div class="w-row"><span class="w-label">${t("wExample")}</span><span><i>“${esc(e.s)}”</i></span></div>
        <div class="w-row"><span class="w-label">🇵🇭 ${t("wTagalog")}</span><span><b>${esc(e.tl)}</b></span></div>
        ${e.pic && e.trick ? `<div class="w-memory"><div class="w-pic">${e.pic}</div><div><b>${t("wRemember")}</b><p>${esc(e.trick)}</p></div></div>` : ""}
        ${ai ? `<p class="muted small">✨ ${t("wAiNote")}</p>` : ""}`;
    }
    const f = r.fil;
    return `
      <div class="w-row"><span class="w-label">${t("wMeaning")}</span><span>${esc(f.m)}</span></div>
      <div class="w-row"><span class="w-label">🇺🇸 ${t("wEnglish")}</span><span><b>${esc(f.en)}</b></span></div>
      <div class="w-row"><span class="w-label">${t("wExample")}</span><span><i>“${esc(f.s)}”</i></span></div>`;
  }
  function showWord(raw) {
    const r = lookupWord(raw);
    const isFil = !!r.fil;
    const title = r.word || raw;
    modal(`
      <div class="w-head"><span class="w-word">${esc(title)}</span>${r.en && r.en.pos ? `<span class="w-pos">${esc(r.en.pos)}</span>` : ""}
        <button class="tool icon" data-say aria-label="${t("wSay")}">🔊</button></div>
      <div id="wBody">${(r.en || r.fil) ? wordBody(r) : `<div class="ai-loading"><div class="spinner"></div><span class="muted small">${t("wLoading")}</span></div>`}</div>
      <div class="actions"><button class="btn" data-x>${t("gotIt")}</button></div>
    `, (w, close) => {
      w.querySelector("[data-x]").onclick = close;
      w.querySelector("[data-say]").onclick = () => say(title, isFil ? "fil-PH" : "en-US");
      w.classList.add("word-sheet");
      if (!r.en && !r.fil) fetchWord(title).then(html => { const b = w.querySelector("#wBody"); if (b) b.innerHTML = html; });
    });
  }
  async function fetchWord(word) {
    // 1) AI (claude.ai, or the website's AI server if set up)
    if (sampleFn) {
      try {
        const lang = I.lang === "en" ? "English" : "Tagalog/Filipino";
        const d = await sampleFn.json(`Explain the word "${word}" for a Filipino reviewing for the Civil Service Exam. Return JSON only: {"pos":"noun|verb|adj|adv|…","m":"short meaning in ${lang}","s":"one example sentence using the word","tl":"Tagalog equivalent (or English equivalent if the word is Filipino)","pic":"2–4 emoji that picture the meaning","trick":"one short, fun way to remember it"}`, { cache: true });
        if (d && d.m) { G[word.toLowerCase()] = { pos: d.pos, m: d.m, s: d.s || "", tl: d.tl || "", pic: d.pic, trick: d.trick, adv: 1 }; return wordBody({ en: G[word.toLowerCase()] }, true); }
      } catch (_) {}
    }
    // 2) free online dictionary (works on the website, not inside claude.ai)
    try {
      const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word));
      if (res.ok) {
        const data = await res.json(), m = data[0] && data[0].meanings && data[0].meanings[0], def = m && m.definitions[0];
        if (def) return `
          <div class="w-row"><span class="w-label">${t("wMeaning")}</span><span>${esc(def.definition)}</span></div>
          ${def.example ? `<div class="w-row"><span class="w-label">${t("wExample")}</span><span><i>“${esc(def.example)}”</i></span></div>` : ""}
          <a class="btn secondary w-link" href="https://translate.google.com/?sl=en&tl=tl&text=${encodeURIComponent(word)}" target="_blank" rel="noopener">${t("wTranslate")}</a>`;
      }
    } catch (_) {}
    // 3) nothing available: offer a search
    return `<p class="muted">${t("wNotFound")}</p>
      <a class="btn secondary w-link" href="https://www.google.com/search?q=${encodeURIComponent(word + " meaning tagalog")}" target="_blank" rel="noopener">${t("wLookUp")}</a>`;
  }

  // Long-press detection (touch and mouse). A long-press never answers a question.
  const LP_SEL = ".qtext, .choice, .step-card, .review-item, .feedback, .why, .wb-card, .modal-text, .coach-block";
  let lpTimer = null, lpPos = null, swallow = false;
  function wordAt(x, y) {
    let node, off;
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; off = r.startOffset; }
    else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; off = p.offset; }
    if (!node || node.nodeType !== 3) return null;
    const txt = node.textContent, re = /[A-Za-zÀ-ÿñÑ'-]/;
    let a = off, b = off;
    while (a > 0 && re.test(txt[a - 1])) a--;
    while (b < txt.length && re.test(txt[b])) b++;
    const w = txt.slice(a, b).replace(/^['-]+|['-]+$/g, "");
    return w.length > 1 ? w : null;
  }
  function lpBegin(x, y, target) {
    if (!target.closest || !target.closest(LP_SEL)) return;
    lpPos = { x, y }; clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      const w = wordAt(lpPos.x, lpPos.y);
      if (!w) return;
      swallow = true; setTimeout(() => { swallow = false; }, 900);
      try { navigator.vibrate && navigator.vibrate(15); } catch (_) {}
      showWord(w);
    }, 550);
  }
  const lpCancel = () => clearTimeout(lpTimer);
  document.addEventListener("touchstart", e => lpBegin(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  document.addEventListener("touchmove", e => { if (lpPos && Math.hypot(e.touches[0].clientX - lpPos.x, e.touches[0].clientY - lpPos.y) > 10) lpCancel(); }, { passive: true });
  document.addEventListener("touchend", lpCancel); document.addEventListener("touchcancel", lpCancel);
  document.addEventListener("mousedown", e => { if (e.button === 0) lpBegin(e.clientX, e.clientY, e.target); });
  document.addEventListener("mousemove", e => { if (lpPos && Math.hypot(e.clientX - lpPos.x, e.clientY - lpPos.y) > 10) lpCancel(); });
  document.addEventListener("mouseup", lpCancel);
  document.addEventListener("click", e => { if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true);
  document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest(LP_SEL)) e.preventDefault(); });

  // ---------- WORD BANK: advanced words as flip cards with pictures ----------
  function renderWordBank() {
    setBack(() => openTab("learn"));
    showTabbar(true);
    const words = Object.keys(G).filter(k => G[k] && G[k].adv && G[k].pic).sort();
    app.innerHTML = `
      <h2>🧠 ${t("wordBankTitle")}</h2>
      <p class="sub">${t("wordBankDesc")}. ${t("tapToFlip")}.</p>
      <div class="wb-grid">${words.map(k => {
        const e = G[k];
        return `<button class="wb-card" data-w="${esc(k)}">
          <span class="wb-front"><span class="wb-pic">${e.pic}</span><b>${esc(k)}</b><small>${esc(e.pos || "")}</small></span>
          <span class="wb-back"><b>${esc(k)}</b><span>${esc(e.m)}</span><span class="wb-tl">🇵🇭 ${esc(e.tl)}</span><span class="wb-trick">🧠 ${esc(e.trick)}</span></span>
        </button>`;
      }).join("")}</div>`;
    app.querySelectorAll(".wb-card").forEach(c => c.addEventListener("click", () => { c.classList.toggle("flipped"); if (c.classList.contains("flipped")) say(c.dataset.w, "en-US"); }));
    window.scrollTo(0, 0);
  }



  // ---------- AI tutor: bring your own key ----------
  function aiSummary() {
    if (window.CSAI.builtIn()) return t("aiBuiltInShort");
    const c = window.CSAI.current();
    return c && c.key ? "✅ " + (c.provider === "claude" ? t("aiProvClaude") : t("aiProvGemini")) : t("aiOffShort");
  }
  function aiPanelHtml() {
    if (window.CSAI.builtIn()) return `<div class="panel ai-panel"><b>✨ ${t("aiTutorTitle")}</b><p class="muted small" style="margin:6px 0 0">${t("aiBuiltIn")}</p></div>`;
    const cur = window.CSAI.current() || {};
    const prov = cur.provider || "gemini";
    const name = cur.key ? (cur.provider === "claude" ? t("aiProvClaude") : t("aiProvGemini")) : "";
    return `
      <div class="panel ai-panel" id="aiPanel">
        <b>✨ ${t("aiTutorTitle")}</b>
        <p class="muted small" style="margin:4px 0 10px">${t("aiTutorDesc")}</p>
        <div class="ai-status ${cur.key ? "on" : ""}">${cur.key ? t("aiConnected", { p: esc(name) }) : t("aiNotConnected")}</div>
        <div class="ai-provs">
          <label class="ai-prov"><input type="radio" name="aiProv" value="gemini" ${prov === "gemini" ? "checked" : ""} /><b>${t("aiProvGemini")}</b><span>${t("aiProvGeminiNote")}</span></label>
          <label class="ai-prov"><input type="radio" name="aiProv" value="claude" ${prov === "claude" ? "checked" : ""} /><b>${t("aiProvClaude")}</b><span>${t("aiProvClaudeNote")}</span></label>
        </div>
        <a class="ai-get" id="aiGet" target="_blank" rel="noopener"></a>
        <label class="field-label" for="aiKey" style="margin-top:10px">${t("aiKeyLabel")}</label>
        <input id="aiKey" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="${t("aiKeyPh")}" value="${esc(cur.key || "")}" />
        <div id="aiModelRow" style="margin-top:10px">
          <label class="field-label" for="aiModel">${t("aiModel")}</label>
          <select id="aiModel" class="input">
            <option value="claude-opus-5-5" ${cur.model !== "claude-haiku-5-5" ? "selected" : ""}>${t("aiModelOpus")}</option>
            <option value="claude-haiku-5-5" ${cur.model === "claude-haiku-5-5" ? "selected" : ""}>${t("aiModelHaiku")}</option>
          </select>
        </div>
        <div class="backup-btns" style="margin-top:12px">
          <button class="btn" id="aiSave">${t("aiSaveTest")}</button>
          ${cur.key ? `<button class="btn secondary" id="aiRemove">${t("aiRemove")}</button>` : ""}
        </div>
        <p class="muted small" style="margin:6px 0 0">${t("aiPrivacy")}</p>
        <p class="muted small" id="aiGemNote" style="margin:4px 0 0">${t("aiGeminiPrivacy")}</p>
      </div>`;
  }
  function bindAiPanel() {
    const panel = document.getElementById("aiPanel");
    if (!panel) return;
    const prov = () => panel.querySelector("input[name=aiProv]:checked").value;
    const paint = () => {
      const g = prov() === "gemini", a = document.getElementById("aiGet");
      a.href = g ? "https://aistudio.google.com/app/apikey" : "https://console.anthropic.com/settings/keys";
      a.textContent = "🔑 " + (g ? t("aiGetGemini") : t("aiGetClaude")) + " ↗";
      document.getElementById("aiModelRow").style.display = g ? "none" : "";
      document.getElementById("aiGemNote").style.display = g ? "" : "none";
    };
    panel.querySelectorAll("input[name=aiProv]").forEach(r => r.addEventListener("change", paint));
    paint();
    const rerender = () => { const y = window.scrollY; renderSettings(false); window.scrollTo(0, y); };
    document.getElementById("aiSave").onclick = async () => {
      const cfg = { provider: prov(), key: document.getElementById("aiKey").value.trim(), model: document.getElementById("aiModel").value };
      if (!cfg.key) return toast(t("aiBadKey"));
      const btn = document.getElementById("aiSave"); btn.disabled = true; btn.textContent = t("aiTesting");
      try {
        await window.CSAI.test(cfg);
        window.CSAI.setKey(cfg);
        toast(t("aiSaved")); pet().cheer("✨🤖");
        rerender();
      } catch (e) {
        btn.disabled = false; btn.textContent = t("aiSaveTest");
        const detail = e && e.message && e.message !== e.code ? " (" + String(e.message).slice(0, 140) + ")" : "";
        toast((e && e.code === "bad_key" ? t("aiBadKey") : e && e.code === "rate_limited" ? t("aiQuota") : t("aiTestFail")) + detail);
      }
    };
    const rm = document.getElementById("aiRemove");
    if (rm) rm.onclick = () => { window.CSAI.setKey(null); toast(t("aiRemoved")); rerender(); };
  }


  // ---------- SUPPORT / DONATIONS (GCash, Maya) ----------
  const DON = window.CS_DONATE || {};
  const hasDonate = () => !!(DON.gcash || DON.maya);
  const isAndroid = /Android/i.test(navigator.userAgent);
  // Android intent: opens the wallet app (or its Play Store page if it isn't installed)
  const appLink = pkg => `intent://#Intent;package=${pkg};S.browser_fallback_url=${encodeURIComponent("https://play.google.com/store/apps/details?id=" + pkg)};end`;
  function donatePanelHtml() {
    const row = (key, label, num, pkg, color) => num ? `
      <div class="don-row" style="--don:${color}">
        <div class="don-top"><span class="don-logo">${label}</span><span class="don-num">${esc(num)}</span></div>
        ${DON.name ? `<div class="muted small">${t("donName")}: <b>${esc(DON.name)}</b></div>` : ""}
        <div class="backup-btns" style="margin:8px 0 0">
          <button class="btn secondary" type="button" data-copynum="${esc(num.replace(/\s/g, ""))}">📋 ${t("donCopy")}</button>
          ${isAndroid ? `<a class="btn" href="${appLink(pkg)}" data-open="${key}">${t("donOpen", { a: label })}</a>` : ""}
        </div>
      </div>` : "";
    return `
      <p class="sub" style="margin:0 0 10px">${t("donDesc")}</p>
      <div class="don-note">💚 ${t("donAny")}</div>
      ${row("gcash", "GCash", DON.gcash, "com.globe.gcash.android", "#0a5bd8")}
      ${row("maya", "Maya", DON.maya, "com.paymaya", "#0b8a3a")}
      ${DON.qr ? `<div class="don-qr"><img src="${esc(DON.qr)}" alt="QR"><span class="muted small">${t("donQr")}</span></div>` : ""}
      <p class="muted small" style="margin:10px 0 0">${t("donSteps")}</p>`;
  }
  function bindDonatePanel() {
    app.querySelectorAll("[data-copynum]").forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copynum); toast(t("donCopied")); } catch (_) { toast(b.dataset.copynum); }
    });
    app.querySelectorAll("[data-open]").forEach(a => a.addEventListener("click", async () => {
      // copy the number first, so it's ready to paste in Send Money
      const n = a.closest(".don-row").querySelector("[data-copynum]").dataset.copynum;
      try { await navigator.clipboard.writeText(n); } catch (_) {}
    }));
  }

  // ---------- Install on phone ----------
  const IN = (window.claude && typeof window.claude.use === "function") ? null : window.CSInstall;   // not offered inside claude.ai
  function installHtml(compact) {
    if (!IN || IN.isStandalone()) return compact ? "" : `<div class="panel install-panel"><b>📲 ${t("installTitle")}</b><p class="muted small" style="margin:6px 0 0">${t("installDone")}</p></div>`;
    let body;
    if (IN.canPrompt()) body = `<button class="btn" data-install>${t("installBtn")}</button>`;
    else if (IN.isIOS) body = `<p class="install-steps">${t("installIOS")}</p>`;
    else if (IN.isAndroid && IN.inAppBrowser) body = `<p class="install-steps">${t("installInApp")}</p><a class="btn" href="${IN.chromeLink()}">${t("openInChrome")}</a>`;
    else body = `<p class="install-steps">${t("installManual")}</p>${IN.isAndroid ? `<a class="btn secondary" href="${IN.chromeLink()}">${t("openInChrome")}</a>` : ""}`;
    return `<div class="panel install-panel ${compact ? "compact" : ""}">
      ${compact ? `<button class="install-x" data-install-x aria-label="${t("installLater")}">✕</button>` : ""}
      <b>📲 ${t("installTitle")}</b>
      <p class="muted small" style="margin:6px 0 10px">${t("installDesc")}</p>
      ${body}
    </div>`;
  }
  function bindInstall(root, rerender) {
    root.querySelectorAll("[data-install]").forEach(b => b.onclick = async () => { const ok = await IN.prompt(); if (ok) pet().cheer("📲 🎉"); rerender(); });
    root.querySelectorAll("[data-install-x]").forEach(b => b.onclick = () => { store.set("cscoach.installLater", Date.now()); rerender(); });
  }
  // show the banner on Learn at most once every 3 days until installed
  const showInstallBanner = () => IN && !IN.isStandalone() && Date.now() - (store.get("cscoach.installLater", 0) || 0) > 3 * DAY;
  if (IN) IN.onChange(() => { if (!session && tab === HOME && !document.querySelector(".modal-bg")) { const slot = document.getElementById("installSlot"); if (slot) { slot.innerHTML = showInstallBanner() ? installHtml(true) : ""; bindInstall(slot, () => openTab(HOME)); } } });


  // ---------- Guided tour (first visit; replay from Settings) ----------
  // Each step spotlights one element (or shows a centered card) with a speech bubble from the buddy.
  const TOUR = [
    { sel: null, k: "tour1" },
    { sel: '.tabbar [data-tab="practice"]', k: "tour4" },
    { sel: '.tabbar [data-tab="analytics"]', k: "tour7" },
    { sel: ".tabbar .tab-chat", k: "tour5" },
    { sel: '.tabbar [data-tab="calendar"]', k: "tour6" },
    { sel: '.tabbar [data-tab="settings"]', k: "tour8" },
    { sel: null, k: "tour9" }
  ];
  let tourStep = 0, tourEl = null;
  function startTour() {
    if (tourOpen()) return;
    openTab(HOME);
    tourStep = 0;
    tourEl = document.createElement("div");
    tourEl.className = "tour";
    tourEl.innerHTML = `<div class="tour-spot"></div><div class="tour-card" role="dialog" aria-live="polite"></div>`;
    document.body.appendChild(tourEl);
    document.body.classList.add("touring");
    window.addEventListener("resize", placeTour);
    ensureGuard();
    showTourStep();
  }
  function endTour() {
    if (!tourEl) return;
    tourEl.remove(); tourEl = null;
    document.body.classList.remove("touring");
    window.removeEventListener("resize", placeTour);
    store.set("cscoach.tourDone", true);
  }
  const visible = el => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  function showTourStep() {
    // skip steps whose target isn't on screen (e.g. no recommended lesson)
    while (TOUR[tourStep] && TOUR[tourStep].sel && !visible(document.querySelector(TOUR[tourStep].sel))) tourStep++;
    if (tourStep >= TOUR.length) return endTour();
    const st = TOUR[tourStep], last = tourStep === TOUR.length - 1, n = TOUR.length;
    const card = tourEl.querySelector(".tour-card");
    const face = window.Pet && Pet.preview ? Pet.preview((profile && profile.petChar) || "sprout") : "";
    card.innerHTML = `
      <div class="tour-head"><span class="tour-face">${face}</span><b>${t(st.k + "t")}</b></div>
      <p>${t(st.k, { name: profile && profile.name ? " " + esc(profile.name) : "" })}</p>
      <div class="tour-dots">${TOUR.map((_, i) => `<span class="${i === tourStep ? "on" : i < tourStep ? "done" : ""}"></span>`).join("")}</div>
      <div class="tour-btns">
        ${last ? "" : `<button class="link" data-skip>${t("tourSkip")}</button>`}
        <span class="tour-gap"></span>
        ${tourStep > 0 ? `<button class="btn secondary" data-prev>${t("back")}</button>` : ""}
        <button class="btn" data-next>${last ? t("tourDone") : tourStep === 0 ? t("tourStart") : t("next")}</button>
      </div>`;
    card.querySelector("[data-next]").onclick = () => { tourStep++; if (tourStep >= n) { endTour(); pet().cheer("🎉"); } else showTourStep(); };
    const pv = card.querySelector("[data-prev]"); if (pv) pv.onclick = () => { do { tourStep--; } while (tourStep > 0 && TOUR[tourStep].sel && !visible(document.querySelector(TOUR[tourStep].sel))); showTourStep(); };
    const sk = card.querySelector("[data-skip]"); if (sk) sk.onclick = endTour;
    placeTour();
    const target = st.sel && document.querySelector(st.sel);
    if (target && target.scrollIntoView) target.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(placeTour, 350);
  }
  function placeTour() {
    if (!tourEl) return;
    const st = TOUR[tourStep], spot = tourEl.querySelector(".tour-spot"), card = tourEl.querySelector(".tour-card");
    const target = st && st.sel && document.querySelector(st.sel);
    if (!target) {   // centered card, dimmed screen
      spot.style.cssText = "left:50%;top:50%;width:0;height:0;";
      card.classList.add("center"); card.style.top = ""; card.style.left = ""; card.style.bottom = "";
      return;
    }
    card.classList.remove("center");
    const r = target.getBoundingClientRect(), pad = 6;
    spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;`;
    const ch = card.offsetHeight, below = r.bottom + 14 + ch < innerHeight;
    card.style.left = Math.max(10, Math.min(innerWidth - card.offsetWidth - 10, r.left + r.width / 2 - card.offsetWidth / 2)) + "px";
    if (below) { card.style.top = (r.bottom + 14) + "px"; card.style.bottom = ""; }
    else { card.style.top = ""; card.style.bottom = (innerHeight - r.top + 14) + "px"; }
  }

  // ---------- LEARN tab: lectures + questions ----------
  // Syllabus order: official topic number, then lesson order
  const sortedLessons = sid => (LESSONS[sid] || []).map((l, i) => ({ l, i })).sort((x, y) => (x.l.unit - y.l.unit) || (x.i - y.i));
  function recommendedLesson() {
    // High-yield first: unread lessons, then lessons below 80%
    const all = SUBJECTS.flatMap(s => sortedLessons(s.id).map(x => x.l));
    const byImp = all.slice().sort((a, b) => b.imp - a.imp);
    return byImp.find(l => !lessonsRead.has(l.id)) || byImp.find(l => { const a = accOf(lessonQs(l.sid, l)); return a.acc != null && a.acc < PASSING; }) || null;
  }

  function renderLearn() {
    if (!LESSONS_ON) return openTab("settings");
    setBack(() => openTab("settings"));
    const rec = recommendedLesson();
    app.innerHTML = `
      <h2>📖 ${t("learnTitle")}</h2>
      <p class="sub">${t("learnSub")}</p>
      ${rec ? `
        <button class="rec-card" id="recLesson">
          <span class="rec-kicker">${t("recommendedLesson")} · ${impLabel(rec.imp)}</span>
          <b>${SUBJECTS.find(x => x.id === rec.sid).icon} ${esc(rec.title)}</b>
          <span>⏱ ${t("minRead", { n: rec.mins })} · ${t("qCount", { n: lessonQs(rec.sid, rec).length })}</span>
        </button>` : ""}
      <button class="wb-entry" id="wordBank"><span class="wb-pics">🧠🖼️</span><span><b>${t("wordBankTitle")}</b><small>${t("wordBankDesc")}</small></span><span>→</span></button>
      <div class="grid">
        ${SUBJECTS.map(s => {
          const L = LESSONS[s.id] || [], read = L.filter(l => lessonsRead.has(l.id)).length, a = accOf(s.questions), tr = sn(s);
          const high = L.filter(l => l.imp >= 3).length;
          return `
          <button class="card" data-sid="${s.id}">
            <span class="ico">${s.icon}</span>
            <h3>${esc(tr.name)}</h3>
            <p>${esc(tr.desc)}</p>
            <div class="mini-bar"><div style="width:${L.length ? Math.round(read / L.length * 100) : 0}%"></div></div>
            <div class="meta">
              <span class="badge blue">${t("lessonsN", { a: read, b: L.length })}</span>
              <span>${a.acc != null ? `<span class="badge ${a.acc >= PASSING ? "" : "blue"}">${t("accuracy", { p: a.acc })}</span>` : `<span class="imp-chip imp3">${impLabel(3)} ×${high}</span>`}</span>
            </div>
          </button>`;
        }).join("")}
      </div>
    `;
    document.getElementById("wordBank").onclick = renderWordBank;

    const rc = document.getElementById("recLesson");
    if (rc) rc.addEventListener("click", () => renderLesson(rec.sid, LESSONS[rec.sid].indexOf(rec)));
    app.querySelectorAll("[data-sid]").forEach(b => b.addEventListener("click", () => renderLessonList(b.dataset.sid)));
    window.scrollTo(0, 0);
  }

  function renderLessonList(sid) {
    const s = SUBJECTS.find(x => x.id === sid), tr = sn(s);
    setBack(() => openTab("learn"));
    showTabbar(true);
    const list = sortedLessons(sid);
    app.innerHTML = `
      <h2>${s.icon} ${esc(tr.name)}</h2>
      <p class="sub">${esc(tr.desc)}</p>
      <details class="tips-card" open>
        <summary>💡 <b>${t("tipsTricks", { s: esc(tr.name) })}</b><span class="sec-chev">▾</span></summary>
        <ul>${tr.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      </details>
      <p class="syllabus-note">📋 ${t("syllabusNote")}</p>
      <p class="muted small" style="margin:0 0 14px">${t("impNote")}${sid !== "filipino" && t("lessonsLangNote") ? " " + t("lessonsLangNote") : ""}</p>
      <div class="set-list">
        ${list.map(({ l, i }, n) => {
          const qs = lessonQs(sid, l), a = accOf(qs), read = lessonsRead.has(l.id);
          const head = n === 0 || list[n - 1].l.unit !== l.unit
            ? `<div class="unit-head"><span class="unit-num">${l.unit}</span>${esc(unitName(l))}</div>` : "";
          return `${head}
          <button class="set-item imp-border${l.imp}" data-l="${i}">
            <div class="set-num ${read ? "read" : ""}">${read ? "✓" : n + 1}</div>
            <div class="set-info"><b>${esc(l.title)}</b><span><span class="imp-chip imp${l.imp}">${impLabel(l.imp)}</span> ⏱ ${t("minRead", { n: l.mins })} · ${t("qCount", { n: qs.length })}</span></div>
            <div class="set-score">${a.acc != null ? `<span class="badge ${a.acc >= PASSING ? "" : "blue"}">${a.acc}%</span>` : `<span class="muted">→</span>`}</div>
          </button>`;
        }).join("")}
      </div>
    `;
    app.querySelectorAll("[data-l]").forEach(b => b.addEventListener("click", () => renderLesson(sid, +b.dataset.l)));
    window.scrollTo(0, 0);
  }

  const ytSearch = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) + "&sp=CAM%253D";
  const inArtifact = () => !!(window.claude && typeof window.claude.use === "function");

  // Step-by-step lesson: intro → one key point per step → example → quick check → wrap-up
  function renderLesson(sid, i, step) {
    const s = SUBJECTS.find(x => x.id === sid), L = LESSONS[sid], l = L[i];
    const qs = lessonQs(sid, l);
    step = step || 0;
    const steps = ["intro", ...l.points.map((_, k) => "p" + k), "example", "check", "done"];
    const kind = steps[step];
    if (kind === "done") { lessonsRead.add(l.id); store.set("cscoach.lessonsRead", [...lessonsRead]); }
    pet().setBusy && pet().setBusy(kind !== "done");
    setBack(() => renderLessonList(sid));
    showTabbar(true);
    const go = n => renderLesson(sid, i, n);
    const order = sortedLessons(sid), pos = order.findIndex(x => x.i === i), nextL = order[pos + 1];
    const video = l.video ? (inArtifact()
      ? `<a class="video-card" href="https://www.youtube.com/watch?v=${esc(l.video.id)}" target="_blank" rel="noopener"><span class="vc-play">▶</span><span><small>${t("featuredVideo")}</small><b>${esc(l.video.title)}</b></span></a>`
      : `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(l.video.id)}" title="${esc(l.video.title)}" allowfullscreen loading="lazy"></iframe></div>`) : "";
    const ytBtn = `<a class="yt-btn" href="${ytSearch(l.yt)}" target="_blank" rel="noopener">${t("watchVideos")}</a><p class="muted small center">${t("watchVideosNote")}</p>`;

    let body = "";
    if (kind === "intro") {
      body = `
        <div class="step-card intro">
          <div class="step-emoji">${s.icon}</div>
          <span class="imp-chip imp${l.imp}">${impLabel(l.imp)}</span>
          <h2>${esc(l.title)}</h2>
          <p class="lesson-intro">${esc(l.intro)}</p>
          <div class="lesson-h">🗺️ ${t("whatYouLearn")}</div>
          <ol class="mini-outline">${l.points.map(p => `<li>${esc(p.split(/[.:]/)[0])}</li>`).join("")}</ol>
          ${video}${ytBtn}
        </div>`;
    } else if (kind[0] === "p") {
      const k = +kind.slice(1);
      body = `
        <div class="step-card point">
          <div class="point-num">${k + 1}</div>
          <div class="lesson-h">📌 ${t("pointN", { i: k + 1 })} / ${l.points.length}</div>
          <p class="point-text">${esc(l.points[k])}</p>
          ${(window.LESSON_EXAMPLES && LESSON_EXAMPLES[l.id] && LESSON_EXAMPLES[l.id][k]) ? `
          <div class="ex-head">✏️ ${t("exTitle")} <span class="muted small">· ${t("tapReveal")}</span></div>
          <div class="ex-list">${LESSON_EXAMPLES[l.id][k].map(([q, a], n) => `
            <button class="ex-card" data-ex>
              <span class="ex-n">${n + 1}</span>
              <span class="ex-body"><span class="ex-q">${esc(q)}</span><span class="ex-a">✅ ${esc(a)}</span></span>
            </button>`).join("")}</div>` : ""}
        </div>`;
    } else if (kind === "example") {
      body = `
        <div class="step-card example">
          <div class="lesson-h">✏️ ${t("tryExample")}</div>
          <p class="point-text">${esc(l.example.q)}</p>
          <p class="muted small">${t("thinkFirst")}</p>
          <button class="btn secondary" id="showEx">${t("showAnswer")}</button>
          <p class="ex-answer hidden" id="exAns">✅ ${esc(l.example.a)}</p>
        </div>`;
    } else if (kind === "check") {
      const cq = prepare(qs[(Date.now() / DAY | 0) % qs.length]);
      body = `
        <div class="step-card check">
          <div class="lesson-h">🧠 ${t("quickCheck")}</div>
          <p class="muted small" style="margin-top:0">${t("quickCheckSub")}</p>
          <p class="point-text qtext">${qHtml(cq)}</p>
          <div class="choices">${cq.c.map((c, n) => `<button class="choice" data-ci="${n}"><span class="letter">${LETTERS[n]}</span><span>${esc(cText(cq, n))}</span></button>`).join("")}</div>
          <div id="checkFb"></div>
        </div>`;
      setTimeout(() => app.querySelectorAll("[data-ci]").forEach(b => b.addEventListener("click", () => {
        const n = +b.dataset.ci;
        app.querySelectorAll("[data-ci]").forEach((x, m) => { x.disabled = true; if (m === cq.a) x.classList.add("correct"); else if (m === n) x.classList.add("wrong"); });
        n === cq.a ? pet().cheer() : pet().cry();
        document.getElementById("checkFb").innerHTML = `<div class="feedback ${n === cq.a ? "ok" : "no"}"><b>${n === cq.a ? t("correctFb") : t("wrongFb", { x: LETTERS[cq.a] + ": " + esc(cText(cq, cq.a)) })}</b>${esc(cq.e)}</div>`;
      })), 0);
    } else {
      const a = accOf(qs);
      body = `
        <div class="step-card done">
          <div class="step-emoji">🎉</div>
          <h2>${t("wellDone")}</h2>
          <div class="lesson-remember"><b>💡 ${t("remember")}:</b> ${esc(l.remember)}</div>
          <p class="muted small center">${t("freshLeft", { n: freshCount(qs) })}${a.acc != null ? " · " + t("accuracy", { p: a.acc }) : ""}</p>
          <div class="actions col">
            <button class="btn" id="practiceTopic">${t("practiceTopic", { n: Math.min(10, qs.length) })}</button>
            ${aiReady() ? `<button class="btn blue" id="aiTopic">${t("aiGenTopic")}</button>` : ""}
            ${nextL ? `<button class="btn secondary" id="nextLesson">${t("nextLesson")}: ${esc(nextL.l.title)} →</button>` : ""}
          </div>
          ${ytBtn}
        </div>`;
      pet().cheer(t("wellDone"));
    }

    app.innerHTML = `
      <div class="lesson-kicker">${s.icon} ${esc(sn(s).name)} · ${t("unitLabel", { n: l.unit })}: ${esc(unitName(l))}</div>
      <div class="stepper">
        <div class="step-count">${t("stepOf", { i: step + 1, n: steps.length })}</div>
        <div class="step-dots">${steps.map((_, n) => `<span class="${n < step ? "done" : n === step ? "on" : ""}"></span>`).join("")}</div>
      </div>
      ${body}
      ${kind !== "done" ? `
      <div class="nav step-nav">
        <button class="btn secondary" id="stepBack" ${step === 0 ? "disabled" : ""}>← ${t("back")}</button>
        <button class="btn" id="stepNext">${step === 0 ? t("letsStart") : kind === "check" ? t("finishLesson") : t("continue")} →</button>
      </div>` : ""}
    `;
    app.querySelectorAll("[data-ex]").forEach(b => b.addEventListener("click", () => { if (!b.classList.contains("open")) { b.classList.add("open"); pet().hop(); } }));
    if (kind[0] === "p" && !store.get("cscoach.lpTip", false)) { store.set("cscoach.lpTip", true); setTimeout(() => toast(t("lpTip")), 600); }
    const sb = document.getElementById("stepBack"); if (sb) sb.onclick = () => go(step - 1);
    const sx = document.getElementById("stepNext"); if (sx) sx.onclick = () => go(step + 1);
    const ex = document.getElementById("showEx");
    if (ex) ex.addEventListener("click", () => { ex.remove(); document.getElementById("exAns").classList.remove("hidden"); pet().hop(); });
    const pt = document.getElementById("practiceTopic");
    if (pt) pt.addEventListener("click", () => {
      const exit = () => renderLesson(sid, i, steps.length - 1);
      const picked = smartPick(qs, 10);
      if (!picked.length) return caughtUp({ name: l.title, pool: qs, key: "lesson:" + l.id, title: l.title, exit, sid, lesson: l, n: 10 });
      startSession("lesson:" + l.id, l.title, picked, exit);
    });
    const at = document.getElementById("aiTopic");
    if (at) at.addEventListener("click", () => generateAI(sid, l, 5, () => renderLesson(sid, i, steps.length - 1)));
    const nl = document.getElementById("nextLesson");
    if (nl) nl.addEventListener("click", () => renderLesson(sid, nextL.i, 0));
    window.scrollTo(0, 0);
  }

  // ---------- PRACTICE tab ----------
  function renderPractice() {
    setBack(null);
    const a = analytics();
    app.innerHTML = `
      <h2>${profile && profile.name ? t("hi", { name: esc(profile.name) }) : ""}${window.Tone.heading()}</h2>
      <p class="sub">${t("homeSub", { n: ROUND_SIZE, p: PASSING })}</p>
      <div id="installSlot">${showInstallBanner() ? installHtml(true) : ""}</div>
      <div class="mode-chip">${profile.instant ? t("modePracticeChip") : t("modeExamChip")} · <button class="link" id="changeMode">${t("change")}</button></div>
      <div class="grid">
        ${a.subjects.map(x => {
          const s = SUBJECTS.find(y => y.id === x.id), tr = sn(s);
          return `
          <button class="card" data-id="${s.id}">
            <span class="ico">${s.icon}</span>
            <h3>${esc(tr.name)}</h3>
            <p>${esc(tr.desc)}</p>
            <div class="mini-bar"><div style="width:${Math.round(x.seen / x.total * 100)}%"></div></div>
            <div class="meta">
              <span class="badge blue">${t("freshLeft", { n: freshCount(s.questions) })}</span>
              <span>${x.acc != null ? `<span class="badge ${x.acc >= PASSING ? "" : "blue"}">${t("accuracy", { p: x.acc })}</span>` : t("notStarted")}</span>
            </div>
          </button>`;
        }).join("")}
        ${reviewQs().length ? `
          <button class="card starred-card" data-id="review">
            <span class="ico">🎯</span>
            <h3>${t("reviewTitle")}</h3>
            <p>${t("reviewDesc")}</p>
            <div class="meta"><span class="badge blue">${t("reviewCounts", { m: mistakeIds().length, s: starred.size })}</span></div>
          </button>` : ""}
        <button class="card mock" data-id="mock">
          <span class="ico">📝</span>
          <h3>${t("mockTitle")}</h3>
          <p>${t("mockDesc", { n: MOCK_SIZE })}</p>
          <div class="meta"><span class="badge">${t("items", { n: MOCK_SIZE })}</span><span>${best.mock != null ? t("best", { p: best.mock }) : t("notTaken")}${best["mock:t"] != null ? " · ⏱ " + best["mock:t"] + "%" : ""}</span></div>
        </button>
        ${aiReady() ? `
          <button class="card ai-card" data-id="ai">
            <span class="ico">✨</span>
            <h3>${t("aiTitle")}</h3>
            <p>${t("aiDesc")}</p>
            <div class="meta"><span class="badge">${t("aiCount", { n: aiBank.length })}</span></div>
          </button>` : ""}
      </div>
      <p class="note">🔄 ${t("rotationNote")}</p>
      <p class="note">${t("disclaimer")}</p>
    `;
    document.getElementById("changeMode").addEventListener("click", () => { openSecs.add("quiz"); openTab("settings"); });
    bindInstall(app, () => openTab(HOME));
    app.querySelectorAll(".card").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (id === "mock") return startMock();
      if (id === "review") return startReview();
      if (id === "ai") return pickAISubject();
      startSubject(id);
    }));
    window.scrollTo(0, 0);
  }

  // Fill a short round with new AI questions when an AI is connected
  async function topUp(sid, picked, n) {
    if (!sampleFn || picked.length >= n) return picked;
    const s = SUBJECTS.find(x => x.id === sid), lesson = weakestLesson(sid);
    const close = modal(`<div class="ai-loading"><div class="spinner"></div><b>${t("aiTopUp")}</b><span class="muted small">${esc(sn(s).name)} · ${esc(lesson.title)}</span></div>`, () => {});
    try { picked = picked.concat(await genQuestions(sid, lesson, n - picked.length)); } catch (_) {}
    close();
    return picked;
  }
  // Shown when every question in a set was answered in the last 30 days
  function caughtUp(o) {
    const ts = o.pool.map(q => stats[q.id] && stats[q.id].t).filter(Boolean);
    const next = ts.length ? new Date(Math.min(...ts) + COOLDOWN_DAYS * DAY) : new Date();
    const aiSid = o.sid || SUBJECTS.map(x => x.id).sort((x, y) => freshCount(SUBJECTS.find(z => z.id === x).questions) - freshCount(SUBJECTS.find(z => z.id === y).questions))[0];
    modal(`
      <div class="caught">
        <div class="caught-ico">🎉</div>
        <div class="modal-title">${t("caughtTitle")}</div>
        <p class="modal-text">${t("caughtText", { s: esc(o.name), d: next.toLocaleDateString(I.lang === "en" ? "en-US" : "fil-PH", { month: "long", day: "numeric" }) })}</p>
        <div class="actions col">
          <button class="btn" data-ai>${sampleFn ? t("caughtAI") : t("caughtConnect")}</button>
          <button class="btn secondary" data-older>${t("caughtReview")}</button>
          ${reviewQs().length ? `<button class="btn secondary" data-rev>${t("reviewBtn", { n: reviewQs().length })}</button>` : ""}
          <button class="link" data-x>${t("cancel")}</button>
        </div>
      </div>`, (w, close) => {
      w.querySelector("[data-x]").onclick = close;
      w.querySelector("[data-ai]").onclick = () => {
        close();
        if (sampleFn) return generateAI(aiSid, o.lesson || weakestLesson(aiSid), 10, o.exit);
        openSecs.add("ai"); renderSettings(false);
      };
      w.querySelector("[data-older]").onclick = () => { close(); startSession(o.key + ":retry", o.title + " (" + t("reviewOlder") + ")", smartPick(o.pool, o.n || ROUND_SIZE, true), o.exit); };
      const rv = w.querySelector("[data-rev]"); if (rv) rv.onclick = () => { close(); startReview(o.exit); };
    });
  }
  async function startMock() {
    const exit = () => openTab("practice");
    // balanced: an equal share of fresh questions from each subject
    const per = Math.ceil(MOCK_SIZE / SUBJECTS.length);
    let picked = [];
    for (const s of SUBJECTS) picked.push(...await topUp(s.id, smartPick(s.questions, per), sampleFn ? per : 0));
    picked = shuffle(picked).slice(0, MOCK_SIZE);
    if (picked.length < 10) return caughtUp({ name: t("mockTitle"), pool: allQuestions(), key: "mock", title: t("mockTitle"), exit, n: MOCK_SIZE });
    startSession("mock", t("mockTitle"), picked, exit);
    if (picked.length < MOCK_SIZE) setTimeout(() => toast(t("onlyFresh", { n: picked.length })), 300);
  }
  function startStarred() { if (starred.size) startSession("starred", t("starredTitle"), [...starred].map(i => byId.get(i)).filter(Boolean), () => openTab("practice")); }
  // Mistakes & starred are grouped by subject: pick one to focus on, or take all.
  function startReview(exit, sid) {
    const all = reviewQs();
    if (!all.length) return toast(t("reviewEmpty"));
    const ex = exit || (() => openTab(tab));
    const run = (qs, title) => startSession("review", title, qs.slice(0, 30), ex);
    if (sid) {
      const s = SUBJECTS.find(x => x.id === sid);
      return run(all.filter(q => q.sid === sid), t("reviewTitle") + " · " + sn(s).name);
    }
    const groups = SUBJECTS.map(s => {
      const qs = all.filter(q => q.sid === s.id);
      const m = qs.filter(q => stats[q.id] && stats[q.id].last === 0).length;
      return { s, n: qs.length, m, st: qs.filter(q => starred.has(q.id)).length };
    }).filter(g => g.n);
    if (groups.length <= 1) return run(all, t("reviewTitle"));
    modal(`
      <div class="modal-title">${t("reviewPick")}</div>
      <div class="set-list">
        ${groups.map(g => `<button class="set-item" data-sid="${g.s.id}"><div class="set-num">${g.s.icon}</div><div class="set-info"><b>${esc(sn(g.s).name)}</b><span>${t("reviewCounts", { m: g.m, s: g.st })}</span></div></button>`).join("")}
        <button class="set-item" data-sid=""><div class="set-num">🎯</div><div class="set-info"><b>${t("reviewAll")}</b><span>${t("reviewCounts", { m: mistakeIds().length, s: starred.size })}</span></div></button>
      </div>
      <div class="actions col"><button class="link" data-x>${t("cancel")}</button></div>`, (w, close) => {
      w.querySelector("[data-x]").onclick = close;
      w.querySelectorAll("[data-sid]").forEach(b => b.onclick = () => {
        close();
        const id = b.dataset.sid;
        id ? startReview(exit, id) : run(all, t("reviewTitle"));
      });
    });
  }
  async function startSubject(id) {
    const s = SUBJECTS.find(x => x.id === id), exit = () => openTab("practice");
    const picked = await topUp(id, smartPick(s.questions, ROUND_SIZE), ROUND_SIZE);
    if (!picked.length) return caughtUp({ name: sn(s).name, pool: s.questions, key: s.id, title: sn(s).name, exit, sid: id });
    startSession(s.id, sn(s).name, picked, exit);
    if (picked.length < ROUND_SIZE) setTimeout(() => toast(t("onlyFresh", { n: picked.length })), 300);
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("out"), 3800);
    setTimeout(() => el.remove(), 4300);
  }

  // ---------- AI-generated questions (Claude via the artifact "sample" capability) ----------
  let sampleFn = null;
  document.addEventListener("cscoach:ai", () => window.CSAI.get().then(fn => { sampleFn = fn; }));
  window.CSAI.get().then(fn => { sampleFn = fn; if (fn && session == null && tab === "practice" && !document.querySelector(".modal-bg")) openTab("practice"); }).catch(() => {});
  function aiReady() { return !!sampleFn; }

  function weakestLesson(sid) {
    return sortedLessons(sid).map(x => x.l)
      .map(l => ({ l, a: accOf(lessonQs(sid, l)) }))
      .sort((x, y) => ((x.a.acc == null ? 50 : x.a.acc) - x.l.imp * 5) - ((y.a.acc == null ? 50 : y.a.acc) - y.l.imp * 5))[0].l;
  }

  function pickAISubject() {
    modal(`
      <div class="modal-title">${t("aiTitle")}</div>
      <p class="modal-text">${t("aiPick")}</p>
      <div class="set-list">${SUBJECTS.map(s => `<button class="set-item" data-ai="${s.id}"><div class="set-num">${s.icon}</div><div class="set-info"><b>${esc(sn(s).name)}</b><span>${esc(t("aiTopicAuto", { t: weakestLesson(s.id).title }))}</span></div></button>`).join("")}</div>
      <div class="actions"><button class="btn secondary" data-x>${t("cancel")}</button></div>
    `, (w, close) => {
      w.querySelector("[data-x]").onclick = close;
      w.querySelectorAll("[data-ai]").forEach(b => b.onclick = () => { close(); const sid = b.dataset.ai; generateAI(sid, weakestLesson(sid), 10, () => openTab("practice")); });
    });
  }

  async function generateAI(sid, lesson, n, exitTo) {
    if (!sampleFn) return toast(t("aiUnavailable"));
    const s = SUBJECTS.find(x => x.id === sid);
    const close = modal(`<div class="ai-loading"><div class="spinner"></div><b>${t("aiGenerating")}</b><span class="muted small">${esc(sn(s).name)} · ${esc(lesson.title)}</span></div>`, () => {});
    try {
      const valid = await genQuestions(sid, lesson, n);
      close();
      if (!valid.length) return toast(t("aiFail"));
      startSession("ai:" + sid, "✨ " + lesson.title, valid, exitTo || (() => openTab("practice")), true);
    } catch (e) { close(); toast(t("aiFail")); }
  }

  // Creates n new questions with the connected AI, saves them, and returns them
  async function genQuestions(sid, lesson, n) {
    const s = SUBJECTS.find(x => x.id === sid);
    const examples = lessonQs(sid, lesson).filter(q => !q.ai).slice(0, 3).map(q => ({ q: q.q, c: q.c, a: q.a, e: q.e, h: q.h }));
    const avoid = s.questions.filter(q => q.lid === lesson.id).map(q => q.q.slice(0, 90));
    const explainLang = { en: "English", tl: "Tagalog (Filipino)", tg: "Taglish (casual mix of Tagalog and English)" }[I.lang];
    const prompt = `You write practice questions for the Philippine Civil Service Exam (Professional level).
Subject: ${s.name}. Topic: ${lesson.title}.
Topic notes: ${lesson.points.join(" | ")}
Write ${n} NEW multiple-choice questions on this topic, in the same style and difficulty as the real exam.
Rules:
- Question and choices language: ${sid === "filipino" ? "Filipino" : "English"} (as in the real exam).
- Explanation "e" and coaching hint "h" language: ${explainLang}.
- Exactly 4 choices, one clearly correct answer; "a" is the 0-based index of the correct choice. Vary the position of the correct answer.
- Facts (laws, RA numbers, constitutional provisions, dates) must be accurate. If unsure of a fact, choose a different question.
- Math must be correct; double-check every computation.
- "h" coaches HOW to approach the question without giving away the answer.
- Do not copy or closely paraphrase these existing questions: ${JSON.stringify(avoid)}
Style examples: ${JSON.stringify(examples)}
Return JSON only: {"questions":[{"q":"...","c":["...","...","...","..."],"a":0,"e":"...","h":"..."}]}`;
    {
      const out = await sampleFn.json(prompt, { modelTier: "default", cache: false });
      const list = (out && out.questions) || [];
      const now = Date.now();
      const valid = list.filter(q => q && typeof q.q === "string" && Array.isArray(q.c) && q.c.length === 4 && q.c.every(c => typeof c === "string" && c.trim())
        && new Set(q.c).size === 4 && Number.isInteger(q.a) && q.a >= 0 && q.a < 4 && typeof q.e === "string")
        .map((q, k) => ({ id: `ai-${sid}-${now}-${k}`, sid, lid: lesson.id, ai: true, created: now, q: q.q.trim(), c: q.c.map(c => c.trim()), a: q.a, e: q.e, h: q.h || lesson.remember }));
      aiBank = aiBank.concat(valid).slice(-600);
      store.set("cscoach.aiq", aiBank);
      valid.forEach(addToBank);
      return valid;
    }
  }

  // ---------- CALENDAR tab ----------
  let calMonth = null, calSel = null;
  function dayStats() {
    const m = new Map();
    history.forEach(h => {
      const k = dayKey(h.t), d = m.get(k) || { n: 0, c: 0, sessions: [] };
      d.n += h.answered != null ? h.answered : h.total; d.c += h.correct; d.sessions.push(h);
      m.set(k, d);
    });
    return m;
  }
  function renderCalendar() {
    setBack(null);
    const ds = dayStats(), g = goal(), today = new Date(); today.setHours(0, 0, 0, 0);
    if (!calMonth) calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const exam = profile && profile.examDate ? new Date(profile.examDate + "T00:00:00") : null;
    const daysLeft = exam ? Math.round((exam - today) / DAY) : null;
    const startTs = Math.min(profile && profile.created || Date.now(), history.length ? history[0].t : Date.now());
    const start = new Date(startTs); start.setHours(0, 0, 0, 0);
    const totalDays = exam ? Math.max(1, Math.round((exam - start) / DAY)) : null;
    const dayNum = exam ? Math.min(totalDays, Math.round((today - start) / DAY) + 1) : null;
    const todayN = (ds.get(today.toDateString()) || { n: 0 }).n;
    const lvl = n => n === 0 ? 0 : n < g / 2 ? 1 : n < g ? 2 : 3;

    // month grid
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    const first = new Date(y, mo, 1).getDay(), dim = new Date(y, mo + 1, 0).getDate();
    let monthN = 0, monthActive = 0;
    const cells = [];
    for (let k = 0; k < first; k++) cells.push(`<div class="cal-cell empty"></div>`);
    for (let d = 1; d <= dim; d++) {
      const date = new Date(y, mo, d), key = date.toDateString(), st = ds.get(key);
      const n = st ? st.n : 0; monthN += n; if (n) monthActive++;
      const isToday = date.getTime() === today.getTime(), isExam = exam && date.getTime() === exam.getTime();
      cells.push(`<button class="cal-cell l${lvl(n)} ${isToday ? "today" : ""} ${isExam ? "exam" : ""} ${calSel === key ? "sel" : ""}" data-day="${key}" aria-label="${date.toLocaleDateString()}: ${n}">
        <span class="cal-d">${d}${isExam ? " 🎯" : ""}</span>${n ? `<span class="cal-n">${n}${n >= g ? "✓" : ""}</span>` : ""}</button>`);
    }
    // best streak overall
    const keys = [...ds.keys()].map(k => new Date(k).getTime()).sort((a, b) => a - b);
    let bestStreak = 0, run = 0;
    keys.forEach((k, i) => { run = i && Math.round((k - keys[i - 1]) / DAY) === 1 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); });
    const sel = calSel && ds.get(calSel);

    app.innerHTML = `
      <h2>📅 ${t("calTitle")}</h2>
      <p class="sub">${t("calSub")}</p>
      ${exam ? `
        <div class="countdown">
          <div class="cd-num">${Math.max(0, daysLeft)}</div>
          <div class="cd-info"><b>${t("daysToGo")}</b><span>${t("examOn", { d: exam.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) })}</span>
            <button class="cd-change" id="changeExam">✏️ ${t("changeDate")}</button></div>
        </div>
        <form class="panel exam-form hidden" id="examForm">
          <label class="field-label" for="calExam">🎯 ${t("examDateL")}</label>
          <div class="date-row"><input id="calExam" class="input" type="date" value="${esc(profile.examDate || "")}" required /><button class="btn" type="submit">${t("saveDate")}</button></div>
        </form>
        <div class="panel">
          <div class="prep-row"><b>${t("prepDay", { i: Math.max(1, dayNum), n: totalDays })}</b><span class="muted small">${t("prepPct", { p: Math.min(100, Math.round(dayNum / totalDays * 100)) })}</span></div>
          <div class="progress big"><div style="width:${Math.min(100, Math.round(dayNum / totalDays * 100))}%"></div></div>
        </div>` : `
        <form class="panel set-exam" id="examForm">
          <label class="field-label" for="calExam">🎯 ${t("setExamDate")}</label>
          <span class="muted small">${t("setExamDateNote")}</span>
          <div class="date-row"><input id="calExam" class="input" type="date" required /><button class="btn" type="submit">${t("saveDate")}</button></div>
        </form>`}

      <div class="panel goal-panel">
        <div class="prep-row"><b>${t("todayGoal")}</b><span>${todayN >= g ? t("goalMet") : t("todayCount", { a: todayN, g })}</span></div>
        <div class="progress big"><div style="width:${Math.min(100, Math.round(todayN / g * 100))}%"></div></div>
        ${todayN < g ? `<div class="actions"><button class="btn" id="goalStart">${t("startNow")} →</button></div>` : ""}
      </div>

      <div class="panel">
        <div class="cal-head">
          <button class="arrow" id="calPrev" aria-label="${t("prev")}">‹</button>
          <b>${calMonth.toLocaleDateString(I.lang === "en" ? "en-US" : "fil-PH", { month: "long", year: "numeric" })}</b>
          <button class="arrow" id="calNext" aria-label="${t("next")}">›</button>
        </div>
        <div class="cal-grid">
          ${t("weekdays").map(w => `<div class="cal-wd">${w}</div>`).join("")}
          ${cells.join("")}
        </div>
        <div class="cal-legend">
          <span>${t("less")}</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><span>${t("more")}</span>
          <span class="muted">· ${t("goalMark")} · ${t("examDayMark")}</span>
        </div>
        ${calSel ? `<div class="day-detail"><b>${new Date(calSel).toLocaleDateString()}</b>
          ${sel ? `<span>${t("dayDetail", { n: sel.n, p: sel.n ? Math.round(sel.c / sel.n * 100) : 0 })}</span>
            <ul>${sel.sessions.map(h => `<li>${esc(h.title)}: ${h.pct}%</li>`).join("")}</ul>` : `<span class="muted">${t("noActivity")}</span>`}</div>` : ""}
      </div>

      <div class="tiles">
        <div class="tile"><b>${monthN}</b><span>${t("monthTotal")}</span></div>
        <div class="tile"><b>${monthActive}</b><span>${t("activeDays")}</span></div>
        <div class="tile"><b>🔥 ${bestStreak}</b><span>${t("bestStreak")}</span></div>
      </div>
    `;
    document.getElementById("calPrev").onclick = () => { calMonth = new Date(y, mo - 1, 1); renderCalendar(); };
    document.getElementById("calNext").onclick = () => { calMonth = new Date(y, mo + 1, 1); renderCalendar(); };
    app.querySelectorAll("[data-day]").forEach(b => b.addEventListener("click", () => { calSel = calSel === b.dataset.day ? null : b.dataset.day; const yy = window.scrollY; renderCalendar(); window.scrollTo(0, yy); }));
    const ef = document.getElementById("examForm");
    ef.addEventListener("submit", e => {
      e.preventDefault();
      const v = document.getElementById("calExam").value;
      if (!v) return;
      profile.examDate = v; store.set("cscoach.profile", profile);
      toast(t("dateSaved")); pet().cheer("🎯 " + new Date(v + "T00:00:00").toLocaleDateString());
      renderCalendar();
    });
    const ce = document.getElementById("changeExam");
    if (ce) ce.onclick = () => { ef.classList.toggle("hidden"); if (!ef.classList.contains("hidden")) document.getElementById("calExam").focus(); };
    const gs = document.getElementById("goalStart");
    if (gs) gs.onclick = () => { const a = analytics(); const w = a.subjects.slice().sort((p, q) => (p.acc == null ? -1 : p.acc) - (q.acc == null ? -1 : q.acc))[0]; startSubject(w.id); session.exitTo = () => openTab("calendar"); };
  }

  // ---------- ANALYTICS tab ----------
  // Questions that were slow the last time they were answered under a timer
  const slowQs = () => Object.keys(stats).filter(id => stats[id].slast === 1).map(id => byId.get(id)).filter(Boolean);
  function speedPanel() {
    const timedH = history.filter(h => h.timer);
    if (!timedH.length) return `<div class="panel"><div class="chart-title">${t("tmSpeedTitle")}</div><p class="muted small">${t("tmSpeedNone")}</p></div>`;
    const avg = Math.round(timedH.reduce((a, h) => a + h.avg, 0) / timedH.length), last = timedH[timedH.length - 1].avg;
    const slow = slowQs();
    const subj = SUBJECTS.map(s => {
      let n = 0, sec = 0; s.questions.forEach(q => { const st = stats[q.id]; if (st && st.tn) { n += st.tn; sec += st.ts; } });
      return { s, avg: n ? Math.round(sec / n) : null };
    }).filter(x => x.avg != null).sort((a, b) => b.avg - a.avg);
    return `<div class="panel">
      <div class="chart-title">${t("tmSpeedTitle")}</div>
      <div class="chart-sub">${t("tmSpeedSub", { g: SEC_Q })}</div>
      <div class="tm-grid">
        <div class="${avg > SEC_Q ? "slow" : "fast"}"><b>${avg}s</b><span>${t("tmAvgTile")}</span></div>
        <div class="${last > SEC_Q ? "slow" : "fast"}"><b>${last}s</b><span>${t("tmAvgL")} · last</span></div>
        <div class="${slow.length ? "slow" : "fast"}"><b>${slow.length}</b><span>${t("tmSlowL")}</span></div>
      </div>
      ${subj.length ? `<div class="topic-list">${subj.map(x => `<div class="topic-row"><span class="topic-name">${x.s.icon} ${esc(sn(x.s).short)}</span><span class="badge ${x.avg > SEC_Q ? "blue" : ""}">${t("tmAvgSubj", { s: x.avg })}</span></div>`).join("")}</div>` : ""}
      ${slow.length ? `<div class="actions"><button class="btn blue" id="speedDrill">${t("tmDrill", { n: Math.min(30, slow.length) })}</button></div>` : ""}
    </div>`;
  }

  function renderAnalytics() {
    setBack(null);
    const a = analytics();
    if (!a.overall.attempts) {
      app.innerHTML = `<h2>📊 ${t("analyticsTitle")}</h2><p class="sub">${t("analyticsSub")}</p>
        <div class="panel empty-state"><div class="empty-ico">📈</div><p>${t("noAnalytics")}</p>
        <div class="actions">${LESSONS_ON ? `<button class="btn" id="goLearn">📖 ${t("tabLearn")}</button>` : ""}<button class="btn blue" id="goPractice">✏️ ${t("tabPractice")}</button></div></div>`;
      const gl = document.getElementById("goLearn"); if (gl) gl.onclick = () => openTab("learn");
      document.getElementById("goPractice").onclick = () => openTab("practice");
      return;
    }
    const passingCount = a.subjects.filter(x => x.acc != null && x.acc >= PASSING).length;
    const tiles = [
      [a.overall.attempts, t("answeredQ")],
      [a.overall.acc + "%", t("accuracyL")],
      ["🔥 " + a.streak, t("streakL")],
      [passingCount + "/" + a.subjects.length, t("subjectsPassing")]
    ];
    if (a.daysLeft != null && a.daysLeft >= 0) tiles.push([a.daysLeft, t("daysToExam")]);
    const recent = history.slice(-15);

    app.innerHTML = `
      <h2>📊 ${t("analyticsTitle")}</h2>
      <p class="sub">${t("analyticsSub")}</p>
      <div class="tiles">${tiles.map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
      <div class="panel rk-panel"><div class="chart-title">${t("rankTitle")}</div>${rankHtml(true)}</div>
      ${reviewQs().length ? `<button class="review-banner" id="reviewTop"><span>🎯</span><span><b>${t("reviewBtn", { n: reviewQs().length }).replace(/^🎯 /, "")}</b><small>${t("reviewCounts", { m: mistakeIds().length, s: starred.size })}</small></span><span>→</span></button>` : ""}

      <div class="panel chart-panel">
        <div class="chart-title">${t("accBySubject")}</div>
        <div class="chart-legend"><span><i class="lg-bar pass"></i>${t("passingTag")} (≥80%)</span><span><i class="lg-bar below"></i>${t("belowTag")}</span><span><i class="lg-line"></i>${t("target")}</span></div>
        <div class="hbar-chart" id="subjChart">
          ${a.subjects.map(x => {
            const s = SUBJECTS.find(y => y.id === x.id);
            const cls = x.acc == null ? "none" : x.acc >= PASSING ? "pass" : "below";
            return `
            <div class="hbar-row" tabindex="0" data-tip="${esc(x.name)}|${x.acc == null ? t("notYet") : x.acc + "%"}|${x.correct}/${x.attempts} · ${t("practiced", { a: x.seen, b: x.total })}">
              <div class="hbar-label">${s.icon} ${esc(sn(s).short)}</div>
              <div class="hbar-track">
                <div class="hbar-fill ${cls}" style="width:${x.acc || 0}%"></div>
                <div class="hbar-target" style="left:${PASSING}%"></div>
              </div>
              <div class="hbar-val">${x.acc == null ? "–" : x.acc + "%"}</div>
            </div>`;
          }).join("")}
        </div>
      </div>

      ${recent.length >= 2 ? `
      <div class="panel chart-panel">
        <div class="chart-title">${t("scoreTrend")}</div>
        <div class="chart-sub">${t("scoreTrendSub", { n: recent.length })}</div>
        <div class="line-chart" id="trendChart"></div>
      </div>` : ""}

      ${speedPanel()}

      <div class="panel">
        <div class="chart-title">${t("weakTopics")}</div>
        <div class="chart-sub">${t("weakTopicsSub")}</div>
        ${a.weakTopics.length ? `<div class="topic-list">${a.weakTopics.map(w => {
          const s = SUBJECTS.find(y => y.id === w.sid);
          return `<div class="topic-row">
            <span class="topic-name">${s.icon} ${esc(w.title)}<br><span class="imp-chip imp${w.importance}">${impLabel(w.importance)}</span></span>
            <span class="badge ${w.acc >= PASSING ? "" : "blue"}">${w.acc}%</span>
            ${LESSONS_ON ? `<button class="btn-mini" data-study="${w.sid}|${w.id}">${t("studyLesson")} →</button>` : ""}
          </div>`;
        }).join("")}</div>` : `<p class="muted small">${t("noTopicData")}</p>`}
      </div>

      <details class="panel table-view">
        <summary>${t("tableView")}</summary>
        <table class="data-table">
          <thead><tr><th>${t("subjectCol")}</th><th>${t("accuracyL")}</th><th>${t("practicedCol")}</th><th>${t("attemptsCol")}</th></tr></thead>
          <tbody>${a.subjects.map(x => `<tr><td>${esc(x.name)}</td><td>${x.acc == null ? "–" : x.acc + "%"}</td><td>${x.seen}/${x.total}</td><td>${x.attempts}</td></tr>`).join("")}</tbody>
        </table>
        <div class="chart-title" style="margin-top:14px">${t("recentSessions")}</div>
        <table class="data-table">
          <thead><tr><th>${t("dateCol")}</th><th>${t("sessionCol")}</th><th>${t("scoreCol")}</th></tr></thead>
          <tbody>${history.slice(-10).reverse().map(h => `<tr><td>${new Date(h.t).toLocaleDateString()}</td><td>${esc(h.title)}</td><td>${h.pct}%</td></tr>`).join("")}</tbody>
        </table>
      </details>

      <div class="actions col">
        <button class="btn" id="practiceReview" ${reviewQs().length ? "" : "disabled"}>${t("reviewBtn", { n: reviewQs().length })}</button>
        <button class="btn blue" id="askCoach">${t("askCoachPlan")}</button>
      </div>
      <div class="chart-tip hidden" id="chartTip"></div>
    `;

    // tooltips for bars
    const tip = document.getElementById("chartTip");
    const showTip = (el, html) => {
      tip.innerHTML = html; tip.classList.remove("hidden");
      const r = el.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)) + "px";
      tip.style.top = (r.top + window.scrollY - tip.offsetHeight - 8) + "px";
    };
    const hideTip = () => tip.classList.add("hidden");
    app.querySelectorAll(".hbar-row").forEach(row => {
      const [name, val, sub] = row.dataset.tip.split("|");
      const html = `<b>${val}</b><span>${name}</span><span class="muted">${sub}</span>`;
      ["pointerenter", "focus"].forEach(ev => row.addEventListener(ev, () => showTip(row.querySelector(".hbar-track"), html)));
      ["pointerleave", "blur"].forEach(ev => row.addEventListener(ev, hideTip));
    });
    if (recent.length >= 2) drawTrend(document.getElementById("trendChart"), recent, showTip, hideTip);
    app.querySelectorAll("[data-study]").forEach(b => b.addEventListener("click", () => {
      const [sid, lid] = b.dataset.study.split("|");
      tab = "learn"; paintTabbar();
      renderLesson(sid, LESSONS[sid].findIndex(l => l.id === lid));
    }));
    document.getElementById("askCoach").addEventListener("click", () => window.CoachUI && window.CoachUI.open("plan"));
    const sd = document.getElementById("speedDrill");
    if (sd) sd.onclick = () => { const qs = slowQs(); if (qs.length) startSession("speed", t("tmDrillTitle"), qs.slice(0, 30), () => openTab("analytics"), false, "question"); };
    const rt = document.getElementById("reviewTop");
    if (rt) rt.addEventListener("click", () => startReview(() => openTab("analytics")));
    document.getElementById("practiceReview").addEventListener("click", () => startReview(() => openTab("analytics")));
    window.scrollTo(0, 0);
  }

  // Line chart of session scores with an 80% reference line, crosshair and tooltip
  function drawTrend(el, data, showTip, hideTip) {
    const W = 640, H = 220, L = 36, R = 12, T = 12, B = 26;
    const x = i => L + (data.length === 1 ? 0 : i * (W - L - R) / (data.length - 1));
    const y = v => T + (100 - v) * (H - T - B) / 100;
    const pts = data.map((d, i) => [x(i), y(d.pct)]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="trend-svg" role="img" aria-label="${esc(t("scoreTrend"))}">
        ${[0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid-line"/><text x="${L - 6}" y="${y(v) + 4}" class="axis-text" text-anchor="end">${v}%</text>`).join("")}
        <line x1="${L}" x2="${W - R}" y1="${y(PASSING)}" y2="${y(PASSING)}" class="target-line"/>
        <text x="${W - R}" y="${y(PASSING) - 5}" class="axis-text target-text" text-anchor="end">${t("target")}</text>
        <path d="${path}" class="trend-line"/>
        <line class="crosshair hidden" y1="${T}" y2="${H - B}"/>
        ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" class="trend-dot ${data[i].pct >= PASSING ? "pass" : ""}"/>`).join("")}
        ${data.map((_, i) => `<text x="${x(i)}" y="${H - 8}" class="axis-text" text-anchor="middle">${data.length > 10 && i % 2 ? "" : i + 1}</text>`).join("")}
        <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/>
      </svg>`;
    const svg = el.querySelector("svg"), hit = el.querySelector(".hit"), ch = el.querySelector(".crosshair");
    const dots = el.querySelectorAll(".trend-dot");
    const move = e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * W / r.width;
      let i = Math.round((px - L) / ((W - L - R) / Math.max(1, data.length - 1)));
      i = Math.max(0, Math.min(data.length - 1, i));
      ch.setAttribute("x1", x(i)); ch.setAttribute("x2", x(i)); ch.classList.remove("hidden");
      dots.forEach((d, j) => d.classList.toggle("hover", j === i));
      const h = data[i];
      showTip(dots[i], `<b>${h.pct}%</b><span>${esc(h.title)}</span><span class="muted">${new Date(h.t).toLocaleDateString()} · ${h.correct}/${h.total}</span>`);
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", () => { ch.classList.add("hidden"); dots.forEach(d => d.classList.remove("hover")); hideTip(); });
  }

  // ---------- quiz session ----------
  let session = null;

  // ---------- rank (XP) ----------
  function applyRank(S, correct, total, avgSec) {
    const today = new Date().toDateString();
    if (rankState.day !== today) rankState = { ...rankState, day: today, seen: [] };
    const seen = new Set(rankState.seen);
    const repeatFrac = S.items.filter(q => seen.has(q.id)).length / (S.items.length || 1);
    const { delta } = Rank.xpChange({ total, correct, avgSec, repeatFrac });
    const before = { xp: rankState.xp, rank: rankState.rank };
    const after = Rank.apply(rankState, delta, Rank.gateOk(history));
    S.items.forEach(q => seen.add(q.id));
    rankState = { xp: after.xp, rank: after.rank, day: today, seen: [...seen].slice(-400) };
    store.set("cscoach.rank", rankState);
    const h = history[history.length - 1];
    const applied = after.xp - before.xp;   // XP can't go below 0, so show what actually changed
    if (h) { h.xp = applied; store.set("cscoach.history", history); }
    paintRank();
    return { delta: applied, before, after };
  }
  function paintRank() {
    const el = document.getElementById("rankChip");
    if (!el) return;
    el.classList.toggle("hidden", !profile);
    if (!profile) return;
    const r = rankState.rank, pr = Rank.progress(rankState.xp, r);
    el.innerHTML = Rank.badge(r, 30) + `<span class="rk-txt"><b>${esc(Rank.NAMES[r - 1])}</b><i class="rk-bar"><i style="width:${pr.pct}%"></i></i></span>`;
    el.setAttribute("aria-label", t("rankTitle") + ": " + Rank.NAMES[r - 1]);
  }
  function rankHtml(full) {
    const r = rankState.rank, xp = rankState.xp, st = Rank.stageOf(r), pr = Rank.progress(xp, r);
    const gated = Rank.rankFor(xp) > r;
    const ladder = Rank.STAGES.map((sg, si) => `
      <div class="rk-stage-h" style="color:${sg.color}">${t(sg.key)}</div>
      ${[1, 2, 3, 4].map(k => { const n = si * 4 + k; return `<div class="rk-row ${n === r ? "me" : ""} ${n < r ? "done" : ""}">${Rank.badge(n, 24)}<span class="rk-rn">${esc(Rank.NAMES[n - 1])}</span><span class="rk-need">${Rank.CUM[n].toLocaleString()} XP</span>${n === r ? `<b class="rk-you">${t("rankYou")}</b>` : ""}</div>`; }).join("")}`).join("");
    return `<div class="rk-card">
      <div class="rk-top">${Rank.badge(r, 56)}
        <div><div class="rk-name">${esc(Rank.NAMES[r - 1])}</div><div class="rk-stage" style="color:${st.color}">${t(st.key)} · ${t("rankN", { n: r })}</div></div>
        <div class="rk-xp"><b>${xp.toLocaleString()}</b> ${t("rankXp")}</div></div>
      ${r < Rank.MAX ? `<div class="rk-prog" role="progressbar" aria-valuenow="${pr.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pr.pct}%;background:${st.color}"></i></div>
        <div class="rk-sub">${t("rankToNext", { x: pr.toNext.toLocaleString(), name: esc(Rank.NAMES[r]) })}</div>` : `<div class="rk-sub">${t("rankMax")}</div>`}
      ${gated ? `<div class="rk-gate">${t("rankGated")}</div>` : r >= Rank.GATE_FROM - 1 && r < Rank.MAX ? `<div class="rk-sub">🔒 ${t("rankGate", { p: Rank.GATE_PCT })}</div>` : ""}
      ${full ? `<p class="muted small">${t("rankHow")}</p><div class="rk-ladder">${ladder}</div>` : ""}
    </div>`;
  }
  function openRankModal() {
    modal(`${rankHtml(true)}<div class="actions"><button class="btn" data-close>${t("gotIt")}</button></div>`, (w, close) => { w.querySelector("[data-close]").onclick = close; });
  }
  document.getElementById("rankChip").addEventListener("click", openRankModal);

  // ---------- speed timer ----------
  // Off / per-question (72 s target, keeps counting when over) / per-set (72 s x items, auto-submits).
  const pad2 = n => String(n).padStart(2, "0");
  const fmtClock = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + ":" + pad2(m) + ":" + pad2(s % 60) : m + ":" + pad2(s % 60); };
  const fmtDur = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + "h " + (m ? m + "m" : "") : m ? m + "m " + (sec % 60 ? sec % 60 + "s" : "") : sec + "s"; };
  function tmFlush(S) {
    if (!S || !S.timer || S.done) return;
    const n = Date.now();
    if (S.lastTs) {
      const d = n - S.lastTs; S.total += d;
      if (!(S.instant && S.answers[S.idx] !== null)) S.qTime[S.idx] += d;   // clock stops on an answered instant-mode item
    }
    S.lastTs = document.hidden ? null : n;   // paused while the app is in the background
  }
  document.addEventListener("visibilitychange", () => { if (session && session.timer && !session.done) tmFlush(session); });
  // The clock is a bar that drains (no digits, so the numbers don't distract). Empty/over turns red.
  function tmPaint() {
    const S = session, el = document.getElementById("tmBar");
    if (!el || !S || !S.timer) return;
    const total = S.timer === "set" ? S.limit : SEC_Q * 1000;
    const left = total - (S.timer === "set" ? S.total : S.qTime[S.idx]);
    const frac = Math.max(0, Math.min(1, left / total));
    el.className = "tm-bar " + (left <= 0 ? "bad" : frac <= 0.2 ? "low" : "ok");
    el.querySelector(".tm-fill").style.width = (left <= 0 ? 100 : frac * 100) + "%";
    el.setAttribute("aria-valuenow", Math.round(frac * 100));
  }
  function tmTick(S) {
    if (session !== S || S.done) { clearInterval(S.timerId); return; }
    tmFlush(S);
    if (S.timer === "set") {
      if (!S.warned && S.limit > 120000 && S.limit - S.total <= 60000) { S.warned = true; toast(t("tmWarn1")); }
      if (S.total >= S.limit) {
        clearInterval(S.timerId);
        document.querySelectorAll(".modal-bg").forEach(m => m.remove());
        S.timedOut = true; renderResults(); return;
      }
    }
    tmPaint();
  }

  function startSession(key, title, questions, exitTo, keepOrder, timerOver) {
    const list = keepOrder ? questions : shuffle(questions);
    const timer = timerOver || (profile ? profile.timer || "question" : "off");   // timer is on unless the user turned it off
    session = {
      key, title, exitTo,
      timer, timerOver, qTime: new Array(list.length).fill(0), total: 0, limit: list.length * SEC_Q * 1000, lastTs: Date.now(),
      items: list.map(prepare),
      idx: 0,
      answers: new Array(list.length).fill(null),
      unsure: new Set(),
      instant: !!(profile && profile.instant),
      showPalette: true,
      done: false
    };
    showTabbar(false);
    pet().setBusy && pet().setBusy(true);
    if (session.timer !== "off") {   // explain how to turn the timer off, during the first 3 sessions only
      const n = store.get("cscoach.timerTips", 0);
      if (n < 3) { session.tipUntil = Date.now() + 8000; store.set("cscoach.timerTips", n + 1); }
    }
    renderQuestion(true);
    if (session.timer !== "off") { const S = session; S.timerId = setInterval(() => tmTick(S), 250); }
  }

  function leaveSession() {
    const answered = session.answers.some(a => a !== null);
    const exit = session.exitTo || goHome;
    if (!answered) { session = null; return exit(); }
    confirmBox(t("leaveQuiz"), t("leave"), () => { session = null; exit(); });
  }

  function qState(i) {
    const S = session, q = S.items[i], ans = S.answers[i];
    if (S.instant && ans !== null) return ans === q.a ? "correct" : "wrong";
    if (S.unsure.has(i)) return "unsure";
    return ans !== null ? "answered" : "";
  }

  const ARROW_L = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ARROW_R = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function goTo(i) {
    if (!session || session.done) return;
    if (i < 0 || i >= session.items.length) return;
    tmFlush(session); session.idx = i; renderQuestion(true);
  }
  function goNext() {
    if (session.idx === session.items.length - 1) openSubmit(); else goTo(session.idx + 1);
  }

  function renderQuestion(scrollTop) {
    setBack(leaveSession);
    const S = session, { items, idx } = S, q = items[idx];
    const ans = S.answers[idx];
    const locked = S.instant && ans !== null;
    const answeredCount = S.answers.filter(a => a !== null).length;
    const isStar = starred.has(q.id);
    const isUnsure = S.unsure.has(idx);
    const last = idx === items.length - 1;
    const mixed = new Set(items.map(it => it.sid)).size > 1;

    app.innerHTML = `
      <div class="quiz-sticky" id="quizSticky">
      ${S.timer !== "off" ? `<div class="tm-bar ok" id="tmBar" role="progressbar" aria-label="${t("timerLabel")}" aria-valuemin="0" aria-valuemax="100"><div class="tm-fill"></div></div>
        ${S.timer !== "off" && S.tipUntil > Date.now() ? `<div class="tm-tip" id="tmTip" role="status">${t("tmTip")}</div>` : ""}` : ""}
      <div class="quiz-head">
        <div>
          <div class="quiz-title">${esc(S.title)}</div>
          <div class="quiz-count">${t("quizCount", { i: idx + 1, n: items.length, a: answeredCount })}</div>
        </div>
        <button class="link" id="togglePal">${S.showPalette ? t("hideOverview") : t("showOverview")}</button>
      </div>
      <div class="progress"><div style="width:${Math.round(answeredCount / items.length * 100)}%"></div></div>
      ${S.showPalette ? `
        <div class="palette" id="palette">
          ${items.map((it, i) => `<button class="pal ${qState(i)} ${i === idx ? "current" : ""}" data-go="${i}" aria-label="${i + 1}">${i + 1}${starred.has(it.id) ? '<i class="pal-star">★</i>' : ""}</button>`).join("")}
        </div>
        <div class="legend">
          ${S.instant
            ? `<span><i class="dot correct"></i>${t("correct")}</span><span><i class="dot wrong"></i>${t("wrong")}</span>`
            : `<span><i class="dot answered"></i>${t("answered")}</span><span><i class="dot unsure"></i>${t("notSure")}</span>`}
          <span><i class="dot"></i>${t("unanswered")}</span><span>★ ${t("starred")}</span>
        </div>` : ""}

      <div class="qcard qcard-top">
        <div class="qrow">
          <div class="qtools">
            <button class="tool icon ${isStar ? "on" : ""}" id="starBtn" aria-pressed="${isStar}" aria-label="${t("star")}" title="${t("starTitle")}">${isStar ? "★" : "☆"}</button>
            <button class="tool icon clock ${S.timer !== "off" ? "on" : ""}" id="clockBtn" aria-pressed="${S.timer !== "off"}" aria-label="${t("timerLabel")}" title="${t("timerBtnTitle")}">⏱</button>
            <button class="tool icon help" id="helpBtn" aria-label="${t("helpMe")}" title="${t("helpTitle")}">💡</button>
            ${mixed ? `<span class="qsubject">${subjectOf(q).icon} ${esc(sn(subjectOf(q)).short)}</span>` : ""}
            ${q.ai ? `<span class="ai-badge" title="${esc(t("aiCaution"))}">✨ ${t("aiBadge")}</span>` : ""}
          </div>
          <div class="qnav">
            <button class="arrow" id="prevBtn" ${idx === 0 ? "disabled" : ""} aria-label="${t("prev")}" title="${t("prev")}">${ARROW_L}</button>
            <button class="arrow ${last ? "submit" : ""} ${locked && !last ? "pulse" : ""}" id="nextBtn" aria-label="${last ? t("reviewSubmit") : t("next")}" title="${last ? t("reviewSubmit") : t("next")}">${ARROW_R}</button>
          </div>
        </div>
        <div class="qtext">${qHtml(q)}</div>
      </div>
      </div>
      <div class="qcard qcard-bottom">
        <div class="choices">
          ${q.c.map((c, i) => {
            let cls = "";
            if (locked) cls = i === q.a ? "correct" : (i === ans ? "wrong" : "");
            else if (i === ans) cls = "selected";
            return `<button class="choice ${cls}" data-i="${i}" ${locked ? "disabled" : ""}><span class="letter">${LETTERS[i]}</span><span>${esc(cText(q, i))}</span></button>`;
          }).join("")}
        </div>
        ${locked ? `
          <div class="feedback ${ans === q.a ? "ok" : "no"}">
            <b>${ans === q.a ? t("correctFb") : t("wrongFb", { x: LETTERS[q.a] + ": " + esc(cText(q, q.a)) })}</b>
            ${esc(q.e)}
          </div>` : `
          <button class="unsure-toggle ${isUnsure ? "on" : ""}" id="unsureBtn" aria-pressed="${isUnsure}">
            <span class="box">${isUnsure ? "✓" : ""}</span>
            <span>${t("unsureToggle")}</span>
          </button>`}
      </div>
      ${last
        ? `<div class="actions"><button class="btn" id="submitBtn">${t("reviewSubmit")}</button></div>`
        : `<div class="submit-row"><button class="link" id="submitEarly">${t("finishSubmit")}</button></div>`}
    `;

    app.querySelectorAll(".pal").forEach(b => b.addEventListener("click", () => goTo(+b.dataset.go)));
    document.getElementById("togglePal").addEventListener("click", () => { S.showPalette = !S.showPalette; renderQuestion(false); });
    app.querySelectorAll(".choice").forEach(b => b.addEventListener("click", () => {
      const i = +b.dataset.i;
      if (locked) return;
      tmFlush(S);
      const was = S.answers[idx];
      S.answers[idx] = (!S.instant && was === i) ? null : i;   // tap again to clear (exam mode)
      if (S.instant) {
        S.unsure.delete(idx);
        i === q.a ? pet().cheer() : pet().cry();
      } else if (S.answers[idx] !== null) pet().hop();
      // Answered: go straight to the next question (stay put on the last one, where Submit is shown)
      if (S.answers[idx] !== null && idx < items.length - 1) goTo(idx + 1);
      else renderQuestion(false);
    }));
    document.getElementById("starBtn").addEventListener("click", () => {
      const on = !starred.has(q.id);
      on ? starred.add(q.id) : starred.delete(q.id);
      if (on) pet().say(t("petStarred"));
      saveStars(); renderQuestion(false);
    });
    document.getElementById("helpBtn").addEventListener("click", () => showHelp(q));
    document.getElementById("clockBtn").addEventListener("click", () => {
      S.tipUntil = 0;
      if (S.timer === "off") {   // start the clock now, using the Settings choice (per-question if Settings says no timer)
        S.timer = (profile && profile.timer && profile.timer !== "off") ? profile.timer : "question";
        S.qTime.fill(0); S.total = 0; S.lastTs = Date.now(); S.warned = false;
        S.timerId = setInterval(() => tmTick(S), 250);
      } else { tmFlush(S); clearInterval(S.timerId); S.timer = "off"; }
      renderQuestion(false);
    });
    const ub = document.getElementById("unsureBtn");
    if (ub) ub.addEventListener("click", () => {
      S.unsure.has(idx) ? S.unsure.delete(idx) : (S.unsure.add(idx), pet().say(t("petUnsure")));
      renderQuestion(false);
    });
    document.getElementById("prevBtn").addEventListener("click", () => goTo(idx - 1));
    document.getElementById("nextBtn").addEventListener("click", goNext);
    const sb = document.getElementById("submitBtn");
    if (sb) sb.addEventListener("click", openSubmit);
    const se = document.getElementById("submitEarly");
    if (se) se.addEventListener("click", openSubmit);

    // Swipe left/right on the question card to navigate
    let sx = 0, sy = 0;
    app.querySelectorAll(".qcard").forEach(card => {
      card.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      card.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 45) dx < 0 ? goNext() : goTo(idx - 1);
      }, { passive: true });
    });
    tmPaint();
    const tip = document.getElementById("tmTip");
    if (tip) { tip.onclick = () => { S.tipUntil = 0; tip.remove(); }; setTimeout(() => { const e = document.getElementById("tmTip"); if (e) e.remove(); }, Math.max(0, S.tipUntil - Date.now())); }
    fitSticky();

    // Keep the current number visible in the one-line overview
    const pal = document.getElementById("palette");
    if (pal) {
      const cur = pal.children[idx];
      pal.scrollLeft = cur.offsetLeft - pal.clientWidth / 2 + cur.clientWidth / 2;
    }
    if (scrollTop) window.scrollTo(0, 0);
  }

  // Freeze the question header under the top bar, unless it would take up
  // too much of the screen (e.g. a long reading passage on a small phone)
  function fitSticky() {
    const st = document.getElementById("quizSticky");
    if (!st) return;
    document.documentElement.style.setProperty("--topbar-h", document.querySelector(".topbar").offsetHeight + "px");
    st.classList.remove("unstick");
    if (st.offsetHeight > window.innerHeight * 0.6) st.classList.add("unstick");
  }
  window.addEventListener("resize", fitSticky);

  document.addEventListener("keydown", e => {
    if (!session || session.done || document.querySelector(".modal-bg") || /input|textarea/i.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goTo(session.idx - 1);
  });

  // A similar worked example for the Help button: the lesson rule that best matches
  // this question, and the example under it that is closest to the question.
  const wordsOf = x => (String(x || "").toLowerCase().match(/[a-zà-ÿñ']{3,}/g) || []);
  function similarExample(q) {
    const givesAway = givesAwayFor(q);
    // 1) Best: another question of the SAME TYPE (same wording pattern, same kind of choices)
    // wording pattern: lower-case words incl. short ones; numbers → "#", % → "percent";
    // ALL-CAPS target words (the word being asked about) are ignored
    const stem = x => String(x.q).replace(/\b[A-Z][A-Z'’-]{2,}\b/g, " ").replace(/%/g, " percent ").replace(/[\d.,]+/g, " # ")
      .toLowerCase().replace(/["“”'‘’]/g, " ").match(/[a-zà-ÿñ#]{1,}/g)?.filter(w => w.length > 1 || w === "#").slice(0, 9) || [];
    const STOP = new Set("the what which and for with that this are was were from under known following choose word words meaning means mean following question answer true false best most into each than then they their there your about when where will would should could also only just very more less philippines philippine filipino constitution republic act article section known government public law laws year many much how number total every again after before both other same together one two three four five first second each some none these those make made have has had can its twice times half equal".split(" "));
    const content = x => new Set(wordsOf(x.q + " " + (x.e || "")).filter(w => !STOP.has(w)));
    const kind = x => errParts(x) ? "err" : numParts(x) ? "num-order" : /::/.test(x.q) ? (/\d/.test(x.q) ? "analogy-num" : "analogy")
      : x.c.every(c => /^[\d₱%.,:\/\s°−+×÷()=-]+$/.test(c) || /^[\d.,]+\s*(km|h|days?|hours?|minutes?|cm²?|L|°)?$/.test(c)) ? "numeric" : "words";
    const qs = new Set(stem(q)), qk = kind(q), qc = content(q), factual = q.sid === "geninfo";
    const qw = new Set(wordsOf(q.q + " " + (q.e || "")));
    let best = null, bs = 0;
    subjectOf(q).questions.forEach(x => {
      if (x.id === q.id || kind(x) !== qk || givesAway(x.c[x.a])) return;
      const st = stem(x), shared = st.filter(w => qs.has(w)).length;
      const pattern = qk.startsWith("analogy") ? 10 : shared / Math.max(3, Math.min(qs.size, st.length)) * 10;
      let overlap = 0; content(x).forEach(w => { if (qc.has(w)) overlap++; });
      if (factual && overlap < 2) return;          // facts: only when the topic itself matches
      if (qk === "numeric" && q.q.length > 60 && overlap < 1) return;   // word problems: same real-world topic
      const sc = pattern + (x.lid && x.lid === q.lid ? 3 : 0) + Math.min(3, overlap * 0.75) + (isFresh(x) ? 0 : 0.5);
      if (sc > bs) { bs = sc; best = x; }
    });
    if (best && bs >= 7) return { q: best, a: LETTERS[best.a] + ". " + cText(best, best.a), why: best.e, html: true };
    // 2) Otherwise a worked example from the matching lesson rule, only if clearly related
    const l = q.lid && lessonById.get(q.lid), ex = l && window.LESSON_EXAMPLES && LESSON_EXAMPLES[l.id];
    if (ex) {
      let pick = null, ps = 0;
      l.points.forEach((pt, i) => (ex[i] || []).forEach(([eq, ea]) => {
        if (eq.trim() === q.q.trim() || givesAway(ea)) return;
        const sc = wordsOf(pt + " " + eq).filter(w => qw.has(w)).length;
        if (sc > ps) { ps = sc; pick = { q: eq, a: ea, why: pt }; }
      }));
      if (pick && ps >= 3) return pick;
    }
    return null;   // nothing close enough: better to show nothing than something unrelated
  }
  const norm = x => String(x || "").toLowerCase().replace(/[^a-z0-9à-ÿñ%₱.\s]/g, " ").replace(/\s+/g, " ").trim();
  function givesAwayFor(q) {
    const correct = norm(cText(q, q.a));
    const has = (hay, needle) => needle && new RegExp("(^|\\s)" + needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)").test(hay);
    return ans => { const a = norm(ans), core = norm(String(ans).split(/[:(→·]/)[0]); return has(a, correct) || (core.length > 2 && has(correct, core)); };
  }

  function showHelp(q) {
    const sim = similarExample(q);
    const simHtml = !sim ? "" : sim.html ? `
        <div class="sim-q qtext">${qHtml(sim.q)}</div>
        <ol class="sim-choices" type="A">${sim.q.c.map((c, i) => `<li>${esc(cText(sim.q, i))}</li>`).join("")}</ol>`
      : `<p class="sim-q">${esc(sim.q)}</p>`;
    modal(`
      <div class="modal-title">💡 ${t("coach")}</div>
      <div class="coach-block">
        <div class="coach-label">${t("howApproach")}</div>
        <p>${esc(q.h)}</p>
      </div>
      ${sim ? `
      <div class="coach-block">
        <div class="coach-label">🧩 ${t("similarQ")}</div>
        ${simHtml}
        <button class="ex-card sim-a" data-reveal><span class="ex-body"><span class="ex-q muted small">${t("tapReveal")}</span><span class="ex-a">✅ ${esc(sim.a)}</span></span></button>
        ${sim.why ? `<p class="small sim-rule">💡 ${esc(sim.why)}</p>` : ""}
      </div>` : ""}
      ${sampleFn ? `<button class="btn secondary sim-ask" data-ask>🪜 ${t("askExplain")}</button>` : ""}
      <p class="muted small">${t("coachNote")}</p>
      <div class="actions"><button class="btn" data-close>${t("gotIt")}</button></div>
    `, (w, close) => {
      w.querySelector("[data-close]").onclick = close;
      const r = w.querySelector("[data-reveal]");
      if (r) r.onclick = () => { r.classList.add("open"); const rule = w.querySelector(".sim-rule"); if (rule) rule.classList.add("show"); };
      const ask = w.querySelector("[data-ask]");
      if (ask) ask.onclick = () => { close(); const c = window.CSApp.current(); if (c && window.CoachUI) window.CoachUI.explain(c); };
    });
  }

  function openSubmit() {
    const S = session;
    const unanswered = S.answers.map((a, i) => a === null ? i : -1).filter(i => i >= 0);
    const unsure = [...S.unsure].filter(i => !(S.instant && S.answers[i] !== null)).sort((a, b) => a - b);
    const starIdx = S.items.map((q, i) => starred.has(q.id) ? i : -1).filter(i => i >= 0);
    const chips = (list, cls) => list.map(i => `<button class="chip ${cls}" data-go="${i}">${i + 1}</button>`).join("");
    const clean = !unanswered.length && !unsure.length;

    modal(`
      <div class="modal-title">${clean ? t("readySubmit") : t("beforeSubmit")}</div>
      ${clean ? `<p class="modal-text">${t("allAnswered", { n: S.items.length })}</p>` : ""}
      ${unanswered.length ? `
        <div class="sum-block">
          <div class="sum-label">⭕ ${t("unanswered")} (${unanswered.length})</div>
          <div class="chips">${chips(unanswered, "")}</div>
        </div>` : ""}
      ${unsure.length ? `
        <div class="sum-block">
          <div class="sum-label">✓ ${t("markedNotSure")} (${unsure.length})</div>
          <div class="chips">${chips(unsure, "unsure")}</div>
        </div>` : ""}
      ${starIdx.length ? `
        <div class="sum-block">
          <div class="sum-label">★ ${t("starred")} (${starIdx.length})</div>
          <div class="chips">${chips(starIdx, "star")}</div>
        </div>` : ""}
      ${!clean ? `<p class="muted small">${t("tapNumber")}${unanswered.length ? t("countWrong") : ""}</p>` : ""}
      <div class="actions">
        <button class="btn secondary" data-back>${t("keepReviewing")}</button>
        <button class="btn" data-submit>${unanswered.length ? t("submitAnyway") : t("submit")}</button>
      </div>
    `, (w, close) => {
      w.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { close(); tmFlush(S); S.idx = +b.dataset.go; renderQuestion(true); });
      w.querySelector("[data-back]").onclick = close;
      w.querySelector("[data-submit]").onclick = () => { close(); renderResults(); };
    });
  }


  // ---------- Score celebration pop-up ----------
  // ≥ passing: fireworks + dancing buddy · 60–79: sparkles + happy bounce · < 60: hearts + encouragement
  function celebrate(pct, correct, total, tm, xr) {
    const tier = pct >= PASSING ? "good" : pct >= 60 ? "mid" : "low";
    const name = profile && profile.name ? ", " + esc(profile.name) : "";
    // how many rounds just before this one landed in the same tier (history already includes this round)
    const tierOf = p => p >= PASSING ? "good" : p >= 60 ? "mid" : "low";
    let prior = 0;
    for (let i = history.length - 2; i >= 0 && tierOf(history[i].pct) === tier && prior < 3; i--) prior++;
    const tone = window.Tone ? Tone.result(tier, name, prior) : null;
    const title = tone ? tone.title : t({ good: "celGoodTitle", mid: "celMidTitle", low: "celLowTitle" }[tier], { name });
    const text = tone ? tone.text : t({ good: "celGoodText", mid: "celMidText", low: "celLowText" }[tier]);
    const charKey = (profile && profile.petChar) || "sprout";
    const kiko = window.Pet && Pet.preview ? Pet.preview(charKey) : "";
    modal(`
      <div class="cel cel-${tier}">
        <div class="cel-kiko ${tier === "low" ? "cheerup" : "happy"} ${tier === "good" ? "dance" : "bounce"}">${kiko}</div>
        <div class="cel-ring" style="--p:0"><div><span class="cel-num"><span id="celPct">0</span>%</span></div></div>
        <div class="cel-count">${t("celCorrect", { c: correct, n: total })}</div>
        ${tm ? `<div class="cel-time">${t("tmUsed", { used: fmtDur(tm.used), limit: fmtDur(tm.allowed) })}<br>${t("tmAvg", { s: tm.avg, g: SEC_Q })}</div>` : ""}
        ${xr ? xpLineHtml(xr) : ""}
        <h2 class="cel-title">${title}</h2>
        <p class="cel-text">${text}</p>
        <div class="actions"><button class="btn" data-see>${t("celSee")}</button></div>
      </div>
    `, (w, close) => {
      w.classList.add("cel-bg");
      w.querySelector("[data-see]").onclick = close;
      // count the score up and fill the ring
      const ring = w.querySelector(".cel-ring"), num = w.querySelector("#celPct"), t0 = performance.now(), dur = 1200;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), v = Math.round(pct * (1 - Math.pow(1 - k, 3)));
        num.textContent = v; ring.style.setProperty("--p", v);
        if (k < 1 && document.body.contains(w)) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) particles(w, tier);
      try { navigator.vibrate && navigator.vibrate(tier === "good" ? [30, 40, 30, 40, 60] : 25); } catch (_) {}
    });
  }

  function xpLineHtml(xr) {
    const up = xr.delta >= 0, rb = xr.before.rank, ra = xr.after.rank;
    const msg = ra > rb ? t("rankUp", { from: Rank.NAMES[rb - 1], to: Rank.NAMES[ra - 1] })
      : ra < rb ? t("rankDown", { from: Rank.NAMES[rb - 1], to: Rank.NAMES[ra - 1] })
      : xr.after.gated ? t("rankGated") : "";
    return `<div class="cel-xp ${up ? "up" : "down"}">${up ? "+" : "−"}${Math.abs(xr.delta)} ${t("rankXp")}</div>${msg ? `<div class="cel-rank ${ra < rb ? "down" : ""}">${msg}</div>` : ""}`;
  }

  // Lightweight canvas effects: fireworks, sparkles, or floating hearts
  function particles(host, kind) {
    const c = document.createElement("canvas");
    c.className = "cel-canvas";
    host.insertBefore(c, host.firstChild);
    const ctx = c.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const COLORS = ["#22c55e", "#3b82f6", "#facc15", "#f472b6", "#ffffff", "#34d399", "#60a5fa"];
    const P = [], W = () => innerWidth, H = () => innerHeight;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function burst() {
      const x = rnd(W() * 0.15, W() * 0.85), y = rnd(H() * 0.12, H() * 0.45), col = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < 46; i++) {
        const a = (Math.PI * 2 * i) / 46, sp = rnd(1.8, 4.6);
        P.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: rnd(0.012, 0.02), col, r: rnd(1.6, 2.8), g: 0.05 });
      }
    }
    function sparkle() {
      P.push({ x: rnd(0, W()), y: rnd(H() * 0.2, H()), vx: rnd(-0.3, 0.3), vy: rnd(-1.2, -0.4), life: 1, decay: rnd(0.008, 0.016), col: COLORS[Math.floor(Math.random() * 4)], r: rnd(1.5, 3.5), g: 0, star: true });
    }
    function heart() {
      P.push({ x: rnd(W() * 0.1, W() * 0.9), y: H() + 20, vx: rnd(-0.4, 0.4), vy: rnd(-2.2, -1.2), life: 1, decay: rnd(0.004, 0.008), txt: ["💚", "💙", "🤍", "✨"][Math.floor(Math.random() * 4)], s: rnd(18, 30), g: 0 });
    }
    const t0 = performance.now(), RUN = kind === "good" ? 3200 : 2600;
    let last = 0;
    function frame(now) {
      if (!document.body.contains(c)) return;
      const el = now - t0;
      if (el < RUN && now - last > (kind === "good" ? 380 : kind === "mid" ? 40 : 160)) {
        last = now;
        if (kind === "good") burst(); else if (kind === "mid") sparkle(); else heart();
      }
      ctx.clearRect(0, 0, W(), H());
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.life -= p.decay;
        if (p.life <= 0) { P.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.txt) { ctx.font = p.s + "px serif"; ctx.fillText(p.txt, p.x, p.y); }
        else if (p.star) { ctx.fillStyle = p.col; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.lineTo(p.x + Math.cos(a) * p.r * 2.2, p.y + Math.sin(a) * p.r * 2.2); ctx.lineTo(p.x + Math.cos(a + Math.PI / 4) * p.r * 0.7, p.y + Math.sin(a + Math.PI / 4) * p.r * 0.7); } ctx.closePath(); ctx.fill(); }
        else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      if (el < RUN + 2500 || P.length) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }

  // ---------- results & review ----------
  function renderResults(filter) {
    const S = session;
    const timed = S.timer && S.timer !== "off";
    if (timed) { tmFlush(S); clearInterval(S.timerId); if (S.timedOut) S.total = Math.min(S.total, S.limit); }
    S.done = true;
    pet().setBusy && pet().setBusy(false);
    setBack(S.exitTo || goHome);
    const rows = S.items.map((q, i) => {
      const ans = S.answers[i], ms = timed ? S.qTime[i] : 0;
      return { i, q, ans, ms, slow: timed && ms > SEC_Q * 1000, status: ans === null ? "unanswered" : (ans === q.a ? "correct" : "wrong"), unsure: S.unsure.has(i) };
    });
    const score = rows.filter(r => r.status === "correct").length;
    const pct = Math.round(score / rows.length * 100);
    const counts = {
      all: rows.length,
      correct: score,
      wrong: rows.filter(r => r.status === "wrong").length,
      unanswered: rows.filter(r => r.status === "unanswered").length,
      unsure: rows.filter(r => r.unsure).length,
      starred: rows.filter(r => starred.has(r.q.id)).length,
      slow: rows.filter(r => r.slow).length
    };
    const answeredN = rows.length - counts.unanswered;
    const tm = timed ? {
      used: Math.round(S.total / 1000), allowed: S.timer === "set" ? Math.round(S.limit / 1000) : rows.length * SEC_Q,
      avg: Math.round(S.total / 1000 / Math.max(1, answeredN))
    } : null;
    const missed = rows.filter(r => r.status !== "correct");

    if (!S.saved) {
      S.saved = true;
      recordSession(S);
      S.xr = applyRank(S, counts.correct, rows.length, tm ? tm.avg : null);
      const saveable = !S.key.endsWith(":retry") && !["starred", "review", "speed"].includes(S.key) && !S.key.startsWith("ai:");
      if (saveable && timed) {   // timed results keep their own bests, so a timed run never replaces the untimed best
        const kt = S.key + ":t", ks = S.key + ":spd";
        if (best[kt] == null || pct > best[kt]) best[kt] = pct;
        if (answeredN >= Math.ceil(rows.length / 2) && (best[ks] == null || tm.avg < best[ks])) best[ks] = tm.avg;
        store.set("cscoach.best", best);
      } else if (saveable && (best[S.key] == null || pct > best[S.key])) { best[S.key] = pct; store.set("cscoach.best", best); }
      S.bestT = timed ? { pct: best[S.key + ":t"], spd: best[S.key + ":spd"] } : null;
      setTimeout(() => celebrate(pct, counts.correct, rows.length, tm, S.xr), 250);
    }

    filter = filter || "all";
    const shown = rows.filter(r =>
      filter === "all" ? true :
      filter === "unsure" ? r.unsure :
      filter === "starred" ? starred.has(r.q.id) :
      filter === "slow" ? r.slow :
      r.status === filter);

    const tabBtn = (id, label) => counts[id] || id === "all"
      ? `<button class="tab ${filter === id ? "active" : ""}" data-f="${id}">${label} <span>${counts[id]}</span></button>` : "";
    const statusLabel = { correct: "✅ " + t("correct"), wrong: "❌ " + t("wrong"), unanswered: "⭕ " + t("unanswered") + (S.timedOut ? " · " + t("tmRanOut") : "") };
    const bT = S.bestT || {};
    const timeBlock = tm ? `
        <div class="tm-result">
          <div class="chart-title">${t("tmResTitle")}${S.timedOut ? ` <span class="badge blue">${t("tmRanOut")}</span>` : ""}</div>
          <div class="tm-grid">
            <div><b>${fmtDur(tm.used)}</b><span>${t("tmTimeUsed")}</span></div>
            <div><b>${fmtDur(tm.allowed)}</b><span>${t("tmAllowed")}</span></div>
            <div class="${tm.avg > SEC_Q ? "slow" : "fast"}"><b>${tm.avg}s</b><span>${t("tmAvgL")}</span></div>
            <div class="${counts.slow ? "slow" : "fast"}"><b>${counts.slow}</b><span>${t("tmSlowL")}</span></div>
          </div>
          ${S.timedOut ? `<p class="muted small">${t("tmTimedOut")}</p>` : ""}
          <p class="muted small">${bT.pct != null ? t("tmBestTimed", { p: bT.pct }) : ""}${bT.pct != null && bT.spd != null ? " · " : ""}${bT.spd != null ? t("tmBestSpeed", { s: bT.spd }) : ""}</p>
        </div>` : "";
    const isSubjectRound = SUBJECTS.some(x => x.id === S.key);

    app.innerHTML = `
      <div class="result-head">
        <h2>${esc(S.title)}</h2>
        <div class="ring" style="--p:${pct}"><div>${pct}%</div></div>
        <div class="verdict ${pct >= PASSING ? "pass" : "fail"}">
          ${pct >= PASSING ? t("passed", { name: profile && profile.name ? ", " + esc(profile.name) : "" }) : t("keepGoing", { p: PASSING })}
        </div>
        <div class="result-stats">
          <span class="ok">✅ ${t("nCorrect", { n: counts.correct })}</span>
          <span class="no">❌ ${t("nWrong", { n: counts.wrong })}</span>
          ${counts.unanswered ? `<span>⭕ ${t("nUnanswered", { n: counts.unanswered })}</span>` : ""}
        </div>
        ${S.xr ? `<div class="xp-line">${Rank.badge(rankState.rank, 22)} <b class="${S.xr.delta >= 0 ? "up" : "down"}">${S.xr.delta >= 0 ? "+" : "−"}${Math.abs(S.xr.delta)} ${t("rankXp")}</b> · ${esc(Rank.NAMES[rankState.rank - 1])}</div>` : ""}
        ${timeBlock}
        <div class="actions">
          ${missed.length ? `<button class="btn" id="retryWrong">${t("retryMissed", { n: missed.length })}</button>` : ""}
          <button class="btn blue" id="again">${isSubjectRound ? t("nextRound") : t("takeAgain")}</button>
          <button class="btn secondary" id="exit">${t("done")}</button>
        </div>
      </div>

      <h3 class="review-title">${t("reviewAll")}</h3>
      <div class="tabs">
        ${tabBtn("all", t("all"))}${tabBtn("correct", t("correct"))}${tabBtn("wrong", t("wrong"))}${tabBtn("unanswered", t("unanswered"))}${tabBtn("unsure", t("notSure"))}${tabBtn("starred", "★ " + t("starred"))}${tabBtn("slow", "🐢 " + t("tmSlowTab"))}
      </div>
      ${shown.length ? shown.map(r => `
        <div class="review-item ${r.status}">
          <div class="review-top">
            <span class="review-status">Q${r.i + 1} · ${statusLabel[r.status]}${r.unsure ? ` <span class="badge unsure-badge">${t("notSure")}</span>` : ""}</span>
            <button class="tool small-tool ${starred.has(r.q.id) ? "on" : ""}" data-star="${r.q.id}" title="${t("star")}">${starred.has(r.q.id) ? "★" : "☆"}</button>
          </div>
          <div class="q qtext">${qHtml(r.q)}</div>
          ${r.status === "correct"
            ? `<div class="row right">${t("yourAnswer")}: ${LETTERS[r.ans]}. ${esc(cText(r.q, r.ans))}</div>`
            : `<div class="row yours">${t("yourAnswer")}: ${r.ans === null ? t("noAnswer") : LETTERS[r.ans] + ". " + esc(cText(r.q, r.ans))}</div>
               <div class="row right">${t("correctAnswer")}: ${LETTERS[r.q.a]}. ${esc(cText(r.q, r.q.a))}</div>`}
          ${r.slow ? `<div class="slow-note"><p class="slow-time">🐢 ${t("tmSlowTime", { took: fmtDur(r.ms / 1000), goal: fmtDur(SEC_Q) })}</p><p>${t("tmSlowNote")}</p><p><b>${r.status === "correct" ? t("tmSlowRight") : t("tmSlowWrong")}</b></p></div>` : ""}
          <div class="why">💡 ${esc(r.q.e)}</div>
          <button class="link explain-link" data-explain="${r.i}">${t("askExplain")}</button>
        </div>`).join("") : `<div class="perfect">${t("nothingHere")}</div>`}
    `;

    app.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
      renderResults(b.dataset.f);
      document.querySelector(".review-title").scrollIntoView({ block: "start" });
    }));
    app.querySelectorAll("[data-star]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.star; starred.has(id) ? starred.delete(id) : starred.add(id); saveStars();
      const y = window.scrollY; renderResults(filter); window.scrollTo(0, y);
    }));
    app.querySelectorAll("[data-explain]").forEach(b => b.addEventListener("click", () => {
      const r = rows[+b.dataset.explain];
      if (window.CoachUI) window.CoachUI.explain(qContext(r.q, true, r.ans));
    }));
    document.getElementById("exit").addEventListener("click", () => { const ex = S.exitTo || goHome; session = null; showTabbar(true); ex(); });
    document.getElementById("again").addEventListener("click", () => {
      const base = S.key.replace(/:retry$/, "");
      if (base === "mock") return startMock();
      if (SUBJECTS.some(x => x.id === base)) return startSubject(base);
      startSession(base, S.title.replace(/ \(.+\)$/, ""), S.items.map(q => byId.get(q.id)), S.exitTo, false, S.timerOver);
    });
    const rw = document.getElementById("retryWrong");
    if (rw) rw.addEventListener("click", () => {
      const base = S.key.replace(/:retry$/, "");
      startSession(base + ":retry", S.title.replace(/ \(.+\)$/, "") + " (" + t("retry") + ")", missed.map(r => byId.get(r.q.id)), S.exitTo, false, S.timerOver);
    });
    if (!filter || filter === "all") window.scrollTo(0, 0);
  }

  // Offline support when installed as a PWA (ignored where not allowed)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (_) {}
  }

  function qContext(q, revealed, ans) {
    const l = q.lid && lessonById.get(q.lid), tr = sn(subjectOf(q));
    return {
      subject: tr.name, sid: q.sid, lid: q.lid || null, topic: l ? l.title : null, question: q.q, choices: q.c.map((_, i) => cText(q, i)), hint: q.h, revealed,
      answer: revealed ? cText(q, q.a) : null, answerLetter: revealed ? LETTERS[q.a] : null,
      studentAnswer: ans != null ? cText(q, ans) : null, explanation: revealed ? q.e : null,
      trick: l ? l.remember : tr.tips[0], tips: tr.tips
    };
  }

  // Shared with coach.js (AI chat) and pet.js
  window.CSApp = {
    analytics, subjects: SUBJECTS, passing: PASSING,
    subjName: id => sn(SUBJECTS.find(s => s.id === id)),
    profile: () => profile,
    startSubject, startMock, startStarred, startReview,
    // donation reminder for the chat (only when a GCash/Maya number is configured)
    donate: { enabled: () => hasDonate(), open() { openSecs.add("donate"); renderSettings(false); setTimeout(() => { const d = document.querySelector('details[data-sec="donate"]'); if (d) d.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50); } },
    _similar(id) { const q = byId.get(id), r = q && similarExample(q); return r ? (r.html ? r.q.q : r.q) : null; },
    lessonsOn: LESSONS_ON,
    openLesson(lid) { const l = lessonById.get(lid); if (!l || !LESSONS_ON) return; session = null; tab = "learn"; paintTabbar(); showTabbar(true); renderLesson(l.sid, LESSONS[l.sid].indexOf(l), 0); },
    // Current question for the coach. The answer key is included only after it's revealed.
    current: () => {
      if (!session || session.done) return null;
      const q = session.items[session.idx], ans = session.answers[session.idx];
      return qContext(q, session.instant && ans !== null, ans);
    }
  };

  if (!profile) renderSettings(true);
  else {
    openTab(HOME);
    if (window.Pet && Pet.setMode) Pet.setMode(profile.petMode || (profile.pet === false ? "home" : "still")); else pet().setVisible(profile.pet !== false);
    const lastExport = store.get("cscoach.lastExport", 0);
    const remind = history.length >= 5 && Date.now() - lastExport > 14 * DAY;
    if (!store.get("cscoach.tourDone", false)) setTimeout(startTour, 700);
    else setTimeout(() => pet().say(remind ? t("backupRemind") : t("petHi", { name: profile.name ? " " + profile.name : "" }), remind ? 5000 : 3200), 700);
  }
  if (window.Account) window.Account.init();
})();
