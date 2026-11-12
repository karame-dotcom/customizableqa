// "Install app" helper: Chrome/Edge/Samsung on Android give a real install prompt
// (beforeinstallprompt). iPhone/iPad need Share → Add to Home Screen. Pages opened
// inside other apps' built-in browsers (Messenger, Facebook, Gmail, Claude…) can't
// install, so we offer to reopen the page in Chrome.
window.CSInstall = (function () {
  "use strict";
  let deferred = null;
  const listeners = [];
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|GSA\/|; wv\)/i.test(ua);
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; listeners.forEach(f => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach(f => f()); });
  return {
    isIOS, isAndroid, inAppBrowser, isStandalone,
    canPrompt: () => !!deferred,
    onChange: f => listeners.push(f),
    async prompt() {
      if (!deferred) return false;
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      deferred = null;
      return !!(choice && choice.outcome === "accepted");
    },
    // Android intent link that reopens this page in the Chrome app
    chromeLink() {
      const u = new URL(location.href);
      return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
    }
  };
})();
