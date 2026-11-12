// One AI connection for the whole app (tutor chat, explanations, AI questions, word lookups).
// Order: 1) inside claude.ai: Claude via the page's "sample" capability
//        2) the user's OWN API key (Settings → AI tutor): Google Gemini (free tier) or Claude
//        3) the optional CS Coach server (config.js → CS_AI_ENDPOINT)
//        4) none: the built-in tutor is used
// The user's key is stored only on this device (localStorage "cscoach.aikey", not in
// backups) and is sent only to the provider they chose.
window.CSAI = (function () {
  "use strict";
  let ready = null;
  const read = () => { try { return JSON.parse(localStorage.getItem("cscoach.aikey")) || null; } catch (_) { return null; } };
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const toMessages = input => typeof input === "string" ? [{ role: "user", content: input }] : input;
  const parseJson = text => { const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); return JSON.parse(m ? m[0] : text); };
  function wrap(callText) {
    const call = async (input, opts) => {
      const onText = opts && opts.onText;
      let streamed = false;
      const text = await callText(toMessages(input), onText ? (full, delta) => { streamed = true; onText({ text: full, delta }); } : null);
      if (onText && !streamed) onText({ text, delta: text });
      return { text, truncated: false };
    };
    call.json = async (input, opts) => parseJson((await call(input, opts)).text);
    return call;
  }

  // ---- Google Gemini (free tier with a Google AI Studio key) ----
  // Speed: the working model is remembered (no model lookup per message), "thinking"
  // is turned off on Flash models, and replies stream in as they're written.
  // The key goes in the ?key= query parameter (browser-friendly, no CORS preflight issue).
  const GEMINI = "https://generativelanguage.googleapis.com/v1beta/";
  const PREFERRED = ["models/gemini-2.5-flash", "models/gemini-flash-latest", "models/gemini-2.0-flash", "models/gemini-2.5-flash-lite", "models/gemini-2.0-flash-lite"];
  async function geminiCandidates(key) {
    const cached = localStorage.getItem("cscoach.geminiModel");
    if (cached) return [...new Set([cached, ...PREFERRED])];   // fast path: no lookup
    let listed = [];
    try {
      const r = await fetch(GEMINI + "models?pageSize=200&key=" + encodeURIComponent(key));
      const d = await r.json().catch(() => ({}));
      if (r.status === 400 || r.status === 401 || r.status === 403) throw err("bad_key", d.error && d.error.message);
      listed = (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent")
        && /gemini-[\d.]+-flash(-lite)?$|gemini-flash-latest$/.test(m.name)).map(m => m.name);
    } catch (e) { if (e.code === "bad_key") throw e; }
    // known-fast models first, then anything else the key can use
    return [...new Set([...PREFERRED.filter(m => !listed.length || listed.includes(m)), ...listed])];
  }
  const noThinking = model => /gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {};
  async function geminiOnce(key, model, messages, onText, thinkingOff) {
    const body = {
      contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 2048, ...(thinkingOff ? noThinking(model) : {}) }
    };
    const stream = !!onText;
    let res;
    try {
      res = await fetch(GEMINI + model + (stream ? ":streamGenerateContent?alt=sse&key=" : ":generateContent?key=") + encodeURIComponent(key), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
    } catch (_) { throw err("offline", "Network blocked or offline"); }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = (d.error && d.error.message) || ("HTTP " + res.status);
      if (res.status === 400 && /api key/i.test(msg)) throw err("bad_key", msg);
      if (res.status === 400 && /thinking/i.test(msg)) throw err("no_thinking_cfg", msg);
      if (res.status === 401 || res.status === 403) throw err("bad_key", msg);
      if (res.status === 404) throw err("no_model", msg);
      if (res.status === 429) throw err("rate_limited", msg);
      throw err("error", msg);
    }
    const partText = d => { const c = d && d.candidates && d.candidates[0]; return c && c.content ? (c.content.parts || []).map(p => p.text || "").join("") : ""; };
    let text = "";
    if (stream && res.body && res.body.getReader) {
      // Server-sent events: "data: {...}\n\n" chunks, each with a piece of the reply
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try { const piece = partText(JSON.parse(line.slice(5))); if (piece) { text += piece; onText(text, piece); } } catch (_) {}
        }
      }
    } else {
      text = partText(await res.json().catch(() => ({})));
    }
    if (!text) throw err("refusal", "Empty reply");
    return text;
  }
  function viaGemini(key) {
    return wrap(async (messages, onText) => {
      const models = await geminiCandidates(key);
      let last = null;
      for (const model of models) {
        try {
          let text;
          try { text = await geminiOnce(key, model, messages, onText, true); }
          catch (e) { if (e.code !== "no_thinking_cfg") throw e; text = await geminiOnce(key, model, messages, onText, false); }
          try { localStorage.setItem("cscoach.geminiModel", model); } catch (_) {}
          return text;
        } catch (e) {
          last = e;
          if (e.code === "bad_key" || e.code === "offline") throw e;   // same result for every model
          if (localStorage.getItem("cscoach.geminiModel") === model) { try { localStorage.removeItem("cscoach.geminiModel"); } catch (_) {} }
          // model missing or out of free quota: try the next one
        }
      }
      throw last || err("error");
    });
  }

  // ---- Claude with the user's own Anthropic key (official SDK, loaded on demand) ----
  function viaClaude(key, model) {
    let clientP = null;
    const client = () => clientP || (clientP = import("https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm")
      .then(m => new (m.default || m.Anthropic)({ apiKey: key, dangerouslyAllowBrowser: true })));
    return wrap(async (messages) => {
      let Anthropic, c;
      try { c = await client(); Anthropic = c.constructor; } catch (_) { throw err("offline"); }
      const opus = model !== "claude-haiku-5-5";
      try {
        const response = opus
          ? await c.beta.messages.create({ model, max_tokens: 16000, output_config: { effort: "low" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", messages })
          : await c.messages.create({ model, max_tokens: 16000, output_config: { effort: "low" }, messages });
        if (response.stop_reason === "refusal") throw err("refusal");
        return response.content.filter(b => b.type === "text").map(b => b.text).join("");
      } catch (e) {
        if (e.code) throw e;
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw err("bad_key");
        if (e instanceof Anthropic.RateLimitError) throw err("rate_limited");
        throw err("error");
      }
    });
  }

  // ---- optional shared server ----
  function viaServer(url) {
    return wrap(async messages => {
      let res, data = {};
      try {
        res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
        data = await res.json().catch(() => ({}));
      } catch (_) { throw err("offline"); }
      if (!res.ok || data.error) throw err(res.status === 429 ? "rate_limited" : (data.error || "error"));
      return data.text;
    });
  }

  function get() {
    if (ready) return ready;
    ready = (async () => {
      if (window.claude && typeof window.claude.use === "function") {
        try { const s = await window.claude.use("sample"); if (s) return s; } catch (_) {}
      }
      const own = read();
      if (own && own.key) return own.provider === "claude" ? viaClaude(own.key, own.model || "claude-opus-5-5") : viaGemini(own.key);
      return window.CS_AI_ENDPOINT ? viaServer(window.CS_AI_ENDPOINT) : null;
    })();
    return ready;
  }
  function setKey(cfg) {
    try {
      if (cfg && cfg.key) localStorage.setItem("cscoach.aikey", JSON.stringify(cfg));
      else { localStorage.removeItem("cscoach.aikey"); localStorage.removeItem("cscoach.geminiModel"); }
      // keep the model that just passed the test; a stale one is skipped automatically
    } catch (_) {}
    ready = null;
    document.dispatchEvent(new CustomEvent("cscoach:ai"));
  }
  // quick check that a key works (one tiny request)
  async function test(cfg) {
    const fn = cfg.provider === "claude" ? viaClaude(cfg.key, cfg.model || "claude-opus-5-5") : viaGemini(cfg.key);
    const r = await fn("Reply with just the word OK.");
    return /ok/i.test(r.text);
  }
  const builtIn = () => !!(window.claude && typeof window.claude.use === "function");
  return { get, setKey, test, current: read, builtIn };
})();
