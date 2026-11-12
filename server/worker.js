// CS Coach AI proxy (Cloudflare Worker).
// Lets the public website use Claude for the tutor chat and AI-generated questions
// without exposing your Anthropic API key. The key is stored as a Worker secret.
//
// Deploy (one time):  npm install  →  npx wrangler login  →
//   npx wrangler secret put ANTHROPIC_API_KEY  →  npx wrangler deploy
// Then put the Worker URL in www/config.js (CS_AI_ENDPOINT).
import Anthropic from "@anthropic-ai/sdk";

// Only the CS Coach website may call this endpoint.
const ALLOWED_ORIGINS = ["https://karame-dotcom.github.io"];
const MAX_MESSAGES = 24;
const MAX_CHARS = 60000;

function json(body, status, cors) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST" || !allowed) return json({ error: "forbidden" }, 403, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400, cors); }
    const messages = Array.isArray(body && body.messages) ? body.messages : null;
    const valid = messages && messages.length > 0 && messages.length <= MAX_MESSAGES &&
      messages.every(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string") &&
      messages[messages.length - 1].role === "user" &&
      messages.reduce((n, m) => n + m.content.length, 0) <= MAX_CHARS;
    if (!valid) return json({ error: "bad_request" }, 400, cors);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "low" },          // short tutor answers and question sets
        betas: ["server-side-fallback-2026-07-01"], // if a request is declined, retry on a fallback model
        fallbacks: "default",
        messages
      });
      if (response.stop_reason === "refusal") return json({ error: "refusal" }, 200, cors);
      const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
      return json({ text }, 200, cors);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429, cors);
      if (error instanceof Anthropic.AuthenticationError) return json({ error: "server_key" }, 500, cors);
      if (error instanceof Anthropic.APIError) return json({ error: "api_error" }, 502, cors);
      return json({ error: "server_error" }, 500, cors);
    }
  }
};
