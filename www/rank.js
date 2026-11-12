// CS Coach ranks: 20 tiers earned with XP. Pure functions, no DOM.
// XP goes up for correct, fast answers and down for mistakes. Each rank costs more than the last.
(function () {
  "use strict";
  const NAMES = ["Class 101", "Novice", "Rookie", "Cadet", "Apprentice", "Competent", "Adept", "Challenger", "Accomplished", "Specialist",
    "Contender", "Veteran", "Expert", "General", "Warlord", "Master", "Elite", "Grandmaster", "Legend", "Apex"];
  // 4 ranks per stage
  const STAGES = [
    { key: "stBeginner", color: "#64748b" }, { key: "stInter", color: "#16a34a" }, { key: "stAdv", color: "#2563eb" },
    { key: "stHigh", color: "#9333ea" }, { key: "stPro", color: "#d97706" }
  ];
  const MAX = NAMES.length, GATE_FROM = 10, GATE_PCT = 80, SEC_Q = 72;

  // XP needed to climb from rank n to n+1; grows faster than linearly so high ranks are slow
  const cost = n => Math.round(27 * Math.pow(n, 1.7));
  const CUM = [0, 0];                                   // CUM[r] = total XP at which rank r starts
  for (let r = 2; r <= MAX; r++) CUM[r] = CUM[r - 1] + cost(r - 1);

  const stageOf = r => STAGES[Math.floor((r - 1) / 4)];
  const rankFor = xp => { let r = 1; while (r < MAX && xp >= CUM[r + 1]) r++; return r; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 100 at or under the target pace, 0 at double the target
  const speedScore = avgSec => clamp(100 * (2 * SEC_Q - avgSec) / SEC_Q, 0, 100);
  // Timed: 70% accuracy + 30% speed. Untimed: accuracy only.
  const performance = (accPct, avgSec) => avgSec == null ? accPct : 0.7 * accPct + 0.3 * speedScore(avgSec);

  // XP change for one finished set. Unanswered items count against you, so skipping can't dodge a penalty.
  // s: { total, correct, avgSec (null if untimed), repeatFrac (0..1 share of items already done today) }
  function xpChange(s) {
    const acc = s.total ? s.correct / s.total * 100 : 0;
    const perf = performance(acc, s.avgSec);
    const per = clamp(10 * (perf - 60) / 40, -10, 10);   // -10 .. +10 XP per question; break-even at performance 60
    let xp = per * s.total;
    if (xp > 0) {
      if (acc >= GATE_PCT) xp *= 1.1;
      if (s.avgSec == null) xp *= 0.5;                       // untimed practice earns half
      xp *= 1 - 0.5 * (s.repeatFrac || 0);                   // same questions again today earn less
    }
    return { delta: Math.round(xp), perf: Math.round(perf) };
  }

  // From rank 10 up, advancing needs the last 3 timed sets to average 80% or better
  const gateOk = history => {
    const timed = history.filter(h => h.timer).slice(-3);
    return timed.length === 3 && timed.reduce((a, h) => a + h.pct, 0) / 3 >= GATE_PCT;
  };

  // state: { xp, rank }. Returns the new { xp, rank, gated } (gated: XP says higher but the promotion gate holds you back).
  function apply(state, delta, gate) {
    const xp = Math.max(0, (state.xp || 0) + delta), target = rankFor(xp), cur = state.rank || rankFor(state.xp || 0);
    let rank = target;
    if (target > cur && !gate) rank = Math.min(target, Math.max(GATE_FROM - 1, cur));
    return { xp, rank, gated: rank < target };
  }

  function progress(xp, rank) {
    if (rank >= MAX) return { cur: 0, need: 0, pct: 100, toNext: 0 };
    const cur = xp - CUM[rank], need = cost(rank);
    return { cur: Math.max(0, cur), need, pct: clamp(Math.round(cur / need * 100), 0, 100), toNext: Math.max(0, CUM[rank + 1] - xp) };
  }

  // Shield badge (inline SVG) in the stage colour, with the rank number
  const badge = (r, size) => {
    const c = stageOf(r).color;
    return `<svg class="rk-badge" width="${size || 28}" height="${size || 28}" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5 28 7v8.5c0 7.2-4.9 12.6-12 14-7.1-1.4-12-6.8-12-14V7z" fill="${c}" stroke="#0f2a3d" stroke-width="1.8" stroke-linejoin="round"/><text x="16" y="20.5" text-anchor="middle" font-size="${r > 9 ? 12 : 14}" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">${r}</text></svg>`;
  };

  window.Rank = { NAMES, STAGES, MAX, GATE_FROM, GATE_PCT, SEC_Q, cost, CUM, stageOf, rankFor, speedScore, performance, xpChange, gateOk, apply, progress, badge };
})();
