// CS Coach accounts + cloud sync (Firebase Auth + Firestore).
// - Without a Firebase config in config.js, this file does nothing (the app works as before).
// - Local data on the device is the source of truth. Signing in never deletes it: it is
//   backed up, then merged with the cloud copy (see CSCloud.merge in app.js).
// - Sign out keeps all data on the device.
(function () {
  "use strict";
  const CFG = window.CS_FIREBASE || {};
  const ENABLED = !!(CFG.apiKey && CFG.projectId);
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const LS = {
    get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} },
    del: k => { try { localStorage.removeItem(k); } catch (_) {} }
  };
  const K_UID = "cscoach.acct.uid", K_SYNCED = "cscoach.acct.syncedAt", K_DIRTY = "cscoach.acct.dirty";
  const SYNCED = ["profile", "best", "starred", "stats", "history", "lessonsRead", "aiq", "rank"];
  const MAX_BYTES = 900000;   // Firestore documents are limited to 1 MiB

  // ---- text (English / Tagalog) ----
  const T = {
    secTitle: ["Account & cloud sync", "Account at cloud sync"],
    signedOut: ["Not signed in", "Hindi naka-sign in"],
    popTitle: ["Save your progress with an account", "I-save ang progress mo gamit ang account"],
    popText: ["Create a free account so your progress is backed up online and you can continue on any phone or computer. Everything you have done so far is kept and uploaded to your account.",
      "Gumawa ng libreng account para naka-backup online ang progress mo at magamit sa kahit anong phone o computer. Lahat ng nagawa mo na ay mananatili at maa-upload sa account mo."],
    create: ["Create account", "Gumawa ng account"], login: ["Log in", "Mag-log in"],
    haveAcct: ["I already have an account", "May account na ako"], needAcct: ["Create a new account instead", "Gumawa na lang ng bagong account"],
    email: ["Email", "Email"], pass: ["Password (at least 6 characters)", "Password (hindi bababa sa 6 na character)"],
    google: ["Continue with Google", "Magpatuloy gamit ang Google"], later: ["Not now", "Mamaya na"],
    forgot: ["Forgot password?", "Nakalimutan ang password?"], resetSent: ["Password reset email sent.", "Naipadala na ang email para sa pag-reset ng password."],
    enterEmail: ["Type your email first.", "I-type muna ang email mo."],
    signOut: ["Sign out", "Mag-sign out"], syncNow: ["Sync now", "I-sync ngayon"],
    signedInAs: ["Signed in as", "Naka-sign in bilang"], lastSync: ["Last synced", "Huling na-sync"], never: ["never", "wala pa"],
    keepNote: ["Signing out keeps your progress on this device.", "Mananatili sa device na ito ang progress mo kapag nag-sign out."],
    synced: ["Progress synced ✓", "Na-sync na ang progress ✓"], restored: ["Account data loaded. Restarting…", "Na-load na ang data ng account. Nagre-restart…"],
    tooBig: ["Your data is too large to sync. It is still safe on this device.", "Masyadong malaki ang data para i-sync. Ligtas pa rin ito sa device na ito."],
    syncFail: ["Couldn't sync right now. Your progress is safe on this device.", "Hindi ma-sync ngayon. Ligtas ang progress mo sa device na ito."],
    otherTitle: ["Another account's data is on this device", "May data ng ibang account sa device na ito"],
    otherText: ["This device holds progress that was synced to a different account. What should we do?", "May progress sa device na ito na naka-sync sa ibang account. Ano ang gagawin?"],
    otherMerge: ["Combine it into this account", "Pagsamahin sa account na ito"],
    otherFresh: ["Start with this account's data only (old data stays in a backup)", "Gamitin lang ang data ng account na ito (mananatili sa backup ang luma)"],
    working: ["Please wait…", "Sandali lang…"],
    e_invalid: ["Check your email and password.", "Tingnan ang email at password mo."],
    e_inuse: ["That email already has an account. Try logging in.", "May account na ang email na iyon. Subukang mag-log in."],
    e_weak: ["Password must be at least 6 characters.", "Kailangan ng hindi bababa sa 6 na character ang password."],
    e_email: ["That email doesn't look right.", "Mukhang mali ang email."],
    e_net: ["No internet connection.", "Walang internet."],
    e_domain: ["Google sign-in isn't allowed on this website yet. Add the site to Firebase → Authentication → Settings → Authorized domains.", "Hindi pa pinapayagan ang Google sign-in sa site na ito. Idagdag ang site sa Firebase → Authentication → Settings → Authorized domains."],
    e_other: ["Something went wrong. Please try again.", "May nangyaring mali. Subukan ulit."]
  };
  const lang = () => (window.CSCloud && window.CSCloud.lang() !== "en" ? 1 : 0);
  const tr = k => (T[k] || [k, k])[lang()];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const errText = e => {
    const c = (e && e.code) || "";
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return tr("e_invalid");
    if (/email-already/.test(c)) return tr("e_inuse");
    if (/weak-password/.test(c)) return tr("e_weak");
    if (/invalid-email/.test(c)) return tr("e_email");
    if (/network/.test(c)) return tr("e_net");
    if (/unauthorized-domain/.test(c)) return tr("e_domain");
    if (/popup-closed|cancelled-popup/.test(c)) return "";
    return tr("e_other");
  };

  // ---- Firebase (loaded on demand from Google's CDN) ----
  let A = null, FS = null, auth = null, db = null, user = null, ready = null, authKnown = false;
  function load() {
    if (ready) return ready;
    ready = Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]).then(([app, a, f]) => {
      A = a; FS = f;
      const fa = app.initializeApp(CFG);
      auth = a.getAuth(fa); db = f.getFirestore(fa);
    });
    ready.catch(() => { ready = null; });
    return ready;
  }

  // ---- sync ----
  let timer = null, pushing = false, warnedBig = false, listeners = [];
  const notify = () => listeners.forEach(f => { try { f(); } catch (_) {} });
  function changed(key) {
    if (!ENABLED || (key !== "restore" && SYNCED.indexOf(key) < 0)) return;
    LS.set(K_DIRTY, "1");
    if (user && authKnown) { clearTimeout(timer); timer = setTimeout(() => push().catch(() => {}), 3000); }
  }
  async function push() {
    if (!user || pushing) return;
    pushing = true;
    try {
      if (!window.CSCloud.hasData()) return;
      const str = JSON.stringify(window.CSCloud.snapshot());
      if (str.length > MAX_BYTES) { if (!warnedBig) { warnedBig = true; window.CSCloud.toast(tr("tooBig")); } return; }
      const now = Date.now();
      await FS.setDoc(FS.doc(db, "users", user.uid), { data: str, updatedAt: now, email: user.email || "" });
      LS.set(K_UID, user.uid); LS.set(K_SYNCED, String(now)); LS.del(K_DIRTY);
      notify();
    } finally { pushing = false; }
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  async function pull(manual) {
    const C = window.CSCloud, ref = FS.doc(db, "users", user.uid);
    const snap = await FS.getDoc(ref);
    const local = C.hasData() ? C.snapshot() : null;
    const linked = LS.get(K_UID) === user.uid;
    if (!snap.exists()) { LS.set(K_UID, user.uid); if (local) await push(); notify(); if (manual) C.toast(tr("synced")); return; }
    const doc = snap.data();
    let cloud; try { cloud = JSON.parse(doc.data); } catch (_) { throw new Error("bad cloud data"); }
    const dirty = LS.get(K_DIRTY) === "1", synced = +LS.get(K_SYNCED) || 0;
    if (linked && !dirty && (doc.updatedAt || 0) <= synced) { if (manual) C.toast(tr("synced")); return; }   // already up to date
    let merged, replace = false;
    if (!local) merged = cloud;
    else if (!linked && LS.get(K_UID)) {                       // device holds another account's data
      const fresh = await askOther();
      if (fresh) { merged = cloud; replace = true; } else merged = C.merge(local, cloud, true);
    } else merged = C.merge(local, cloud, linked && !dirty);   // nothing is dropped
    const changedLocal = !same(merged, local || {});
    if (changedLocal) C.apply(merged, replace);
    LS.set(K_UID, user.uid);
    if (!same(merged, cloud)) await push(); else { LS.set(K_SYNCED, String(doc.updatedAt || Date.now())); LS.del(K_DIRTY); }
    notify();
    if (changedLocal && !sessionStorage.getItem("cscoach.acct.reloaded")) {
      try { sessionStorage.setItem("cscoach.acct.reloaded", "1"); } catch (_) {}
      C.toast(tr("restored")); setTimeout(() => location.reload(), 900);
    } else if (manual) C.toast(tr("synced"));
  }
  function askOther() {
    return new Promise(res => {
      const w = overlay(`<div class="modal-title">${esc(tr("otherTitle"))}</div><p class="modal-text">${esc(tr("otherText"))}</p>
        <div class="actions" style="flex-direction:column;gap:8px"><button class="btn" data-m>${esc(tr("otherMerge"))}</button><button class="btn secondary" data-f>${esc(tr("otherFresh"))}</button></div>`);
      w.querySelector("[data-m]").onclick = () => { w.remove(); res(false); };
      w.querySelector("[data-f]").onclick = () => { w.remove(); res(true); };
    });
  }

  // ---- UI ----
  function overlay(html) {
    const w = document.createElement("div");
    w.className = "modal-bg acct-bg";
    w.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(w);
    return w;
  }
  const isOpen = () => !!document.querySelector(".acct-bg");
  function authForm(w, mode, onDone) {
    const box = w.querySelector(".modal");
    const isNew = mode === "create";
    box.innerHTML = `
      ${onDone.popup ? `<div class="modal-title">☁️ ${esc(tr("popTitle"))}</div><p class="modal-text">${esc(tr("popText"))}</p>` : `<div class="modal-title">${esc(isNew ? tr("create") : tr("login"))}</div>`}
      <button class="btn" data-g type="button" style="width:100%;margin:12px 0 4px">${esc(tr("google"))}</button>
      <div class="field-label" style="margin-top:12px">${esc(tr("email"))}</div>
      <input class="input" data-e type="email" autocomplete="email" />
      <div class="field-label" style="margin-top:10px">${esc(tr("pass"))}</div>
      <input class="input" data-p type="password" autocomplete="${isNew ? "new-password" : "current-password"}" />
      <p class="muted small" data-msg style="min-height:1.2em;margin:8px 0 0;color:#b91c1c"></p>
      <div class="actions" style="flex-direction:column;gap:8px;margin-top:8px">
        <button class="btn" data-go type="button">${esc(isNew ? tr("create") : tr("login"))}</button>
        <button class="btn secondary" data-sw type="button">${esc(isNew ? tr("haveAcct") : tr("needAcct"))}</button>
        ${isNew ? "" : `<button class="btn secondary" data-fp type="button">${esc(tr("forgot"))}</button>`}
        ${onDone.popup ? `<button class="btn secondary" data-x type="button">${esc(tr("later"))}</button>` : `<button class="btn secondary" data-x type="button">${esc(window.CSCloud.t("cancel"))}</button>`}
      </div>`;
    const msg = box.querySelector("[data-msg]"), em = box.querySelector("[data-e]"), pw = box.querySelector("[data-p]");
    const say = m => { msg.style.color = "#b91c1c"; msg.textContent = m; };
    const busy = b => box.querySelectorAll("button").forEach(x => { x.disabled = b; });
    const run = async fn => { busy(true); say(""); try { await load(); await fn(); w.remove(); } catch (e) { say(errText(e)); busy(false); } };
    box.querySelector("[data-x]").onclick = () => w.remove();
    box.querySelector("[data-sw]").onclick = () => authForm(w, isNew ? "login" : "create", onDone);
    box.querySelector("[data-g]").onclick = () => run(() => A.signInWithPopup(auth, new A.GoogleAuthProvider()));
    box.querySelector("[data-go]").onclick = () => run(() => {
      const e = em.value.trim(), p = pw.value;
      return isNew ? A.createUserWithEmailAndPassword(auth, e, p) : A.signInWithEmailAndPassword(auth, e, p);
    });
    const fp = box.querySelector("[data-fp]");
    if (fp) fp.onclick = async () => {
      if (!em.value.trim()) return say(tr("enterEmail"));
      busy(true);
      try { await load(); await A.sendPasswordResetEmail(auth, em.value.trim()); msg.style.color = "#15803d"; msg.textContent = tr("resetSent"); } catch (e) { say(errText(e)); }
      busy(false);
    };
    pw.addEventListener("keydown", e => { if (e.key === "Enter") box.querySelector("[data-go]").click(); });
  }
  function openAuth(popup, mode) {
    if (isOpen()) return;
    const w = overlay("");
    authForm(w, mode || "create", { popup });
  }

  // ---- settings panel ----
  function summary() {
    if (!ENABLED) return "";
    return esc(user ? user.email || "✓" : tr("signedOut"));
  }
  function panelHtml() {
    if (!ENABLED) return "";
    if (!user) return `<p class="muted small" style="margin:0 0 10px">${esc(tr("popText"))}</p>
      <div class="backup-btns"><button class="btn" id="acctCreate" type="button">${esc(tr("create"))}</button><button class="btn secondary" id="acctLogin" type="button">${esc(tr("login"))}</button></div>`;
    const s = +LS.get(K_SYNCED);
    return `<p style="margin:0 0 4px">${esc(tr("signedInAs"))} <b>${esc(user.email || "")}</b></p>
      <p class="muted small" style="margin:0 0 10px">${esc(tr("lastSync"))}: ${s ? esc(new Date(s).toLocaleString()) : esc(tr("never"))}<br>${esc(tr("keepNote"))}</p>
      <div class="backup-btns"><button class="btn" id="acctSync" type="button">🔄 ${esc(tr("syncNow"))}</button><button class="btn secondary" id="acctOut" type="button">${esc(tr("signOut"))}</button></div>`;
  }
  function bindPanel(root, rerender) {
    const on = (id, fn) => { const b = root.querySelector("#" + id); if (b) b.onclick = fn; };
    on("acctCreate", () => openAuth(false, "create"));
    on("acctLogin", () => openAuth(false, "login"));
    on("acctSync", async () => { try { await pull(true); await push(); } catch (_) { window.CSCloud.toast(tr("syncFail")); } });
    on("acctOut", async () => { try { await A.signOut(auth); } catch (_) {} });
    listeners = [rerender];
  }

  function init() {
    if (!ENABLED) return;
    load().then(() => {
      A.onAuthStateChanged(auth, async u => {
        const first = !authKnown;
        user = u; authKnown = true;
        if (u) {
          try { await pull(false); if (LS.get(K_DIRTY) === "1") await push(); } catch (_) { window.CSCloud.toast(tr("syncFail")); }
        } else if (first) {
          // keeps appearing on every open until an account exists; waits for the welcome tour to finish
          const show = () => { if (user) return; if (document.querySelector(".tour, .modal-bg")) return setTimeout(show, 1000); openAuth(true, "create"); };
          setTimeout(show, 900);
        }
        notify();
      });
    }).catch(() => {});   // offline or blocked: the app keeps working locally
  }

  window.Account = { enabled: ENABLED, init, changed, tr, summary, panelHtml, bindPanel };
  if (!ENABLED) window.Account = null;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && user && LS.get(K_DIRTY) === "1") push().catch(() => {}); });
})();
