// Pure view-math helpers for the board page. No DOM, no imports — safe to
// run both in the browser and under node for testing (see
// tests/js/board_check.mjs and tests/test_boardcore.py).
//
// `URLSearchParams` is used below for percent-decoding calc fragments; it
// is a WHATWG URL API global in both node and the browser, not `document`/
// `window`, so this file still touches no DOM.

export const COLUMNS = ["backlog", "next", "doing", "done"]

export function groupByColumn(cards) {
  const out = {}
  for (const col of COLUMNS) out[col] = []
  for (const card of cards || []) {
    if (out[card.column]) out[card.column].push(card)
  }
  return out
}

export function wipState(cards, limit) {
  const count = (cards || []).length
  return { count, limit, over: count > limit }
}

export function fmt(n) {
  if (n === null || n === undefined) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function goalBadge(goal) {
  if (!goal) return null
  const met = !!goal.met_at
  if (goal.type === "rate") {
    return met
      ? `met ✓ ${fmt(goal.target)} per min`
      : `${fmt(goal.value)} / ${fmt(goal.target)} per min`
  }
  if (goal.type === "research") {
    return met ? `met ✓ research: ${goal.tech}` : `research: ${goal.tech}`
  }
  return null
}

export function chartPoints(series, target, w, h, pad) {
  if (!series || series.length === 0) return { line: [], target: null, max: 0 }

  const values = series.map((s) => s[1])
  const max = Math.max(...values, target || 0, 1)
  const n = series.length
  const xSpan = w - 2 * pad

  const line = series.map((sample, i) => {
    const x = n > 1 ? pad + (i / (n - 1)) * xSpan : pad
    const y = h - pad - (sample[1] / max) * (h - 2 * pad)
    return [x, y]
  })

  const targetY = target ? h - pad - (target / max) * (h - 2 * pad) : null

  return { line, target: targetY, max }
}

// A card is met when it has at least one goal and every goal is met
// (goal.met_at truthy). `met` is derived, never stored — see the phase 2
// spec's Data model section.
export function cardIsMet(card) {
  const goals = (card && card.goals) || []
  return goals.length > 0 && goals.every((g) => !!(g && g.met_at))
}

export function newlyMet(prevCards, cards) {
  if (prevCards === null) return []
  const prevMet = new Map()
  for (const card of prevCards) {
    prevMet.set(card.id, cardIsMet(card))
  }
  const out = []
  for (const card of cards || []) {
    if (!cardIsMet(card)) continue
    const wasMet = prevMet.has(card.id) ? prevMet.get(card.id) : false
    if (!wasMet) out.push(card)
  }
  return out
}

function classify(text, query) {
  if (!text) return null
  const t = String(text).toLowerCase()
  if (t === query) return "exact"
  if (t.startsWith(query)) return "prefix"
  if (t.includes(query)) return "substring"
  return null
}

// name-only matches skip the "prefix"/"substring" ranks reserved for
// label/alias (1 and 3) so a name hit never outranks a label/alias hit at
// the same specificity.
const NAME_SCORES = { exact: 0, prefix: 2, substring: 4 }
const OTHER_SCORES = { exact: 0, prefix: 1, substring: 3 }

// rankMatches(entries, query, kinds, limit=12)
//
// Case-insensitive catalogue search. Score per entry is the best of:
// exact name/label/alias = 0, label/alias prefix = 1, name prefix = 2,
// label/alias substring = 3, name substring = 4 (lower is better); ties
// break on `label`. `kinds` (an array of allowed `entry.kind` values, or
// falsy/empty for "no filter") restricts the candidate pool before
// scoring. An empty (or whitespace-only) `query` returns the first
// `limit` entries of the allowed kinds, in their given order.
//
// When an entry's winning score came from an alias (strictly better than
// what its own name/label would have scored), the returned entry is a
// shallow copy carrying `matchedAlias: <the alias string that matched>`;
// entries that matched via name or label are returned unchanged (no
// `matchedAlias` property). This is the "pick one, document it" call from
// the design spec — callers should check `entry.matchedAlias` for a
// truthy value, never assume the property exists.
export function rankMatches(entries, query, kinds, limit = 12) {
  const list = entries || []
  const allowed = kinds && kinds.length ? new Set(kinds) : null
  const filtered = allowed ? list.filter((e) => allowed.has(e.kind)) : list.slice()

  const q = (query || "").trim().toLowerCase()
  if (!q) return filtered.slice(0, limit)

  const scored = []
  for (const entry of filtered) {
    const nameClass = classify(entry.name, q)
    const labelClass = classify(entry.label, q)

    let aliasClass = null
    let aliasText = null
    for (const alias of entry.aliases || []) {
      const c = classify(alias, q)
      if (c && (aliasClass === null || OTHER_SCORES[c] < OTHER_SCORES[aliasClass])) {
        aliasClass = c
        aliasText = alias
      }
    }

    const nameScore = nameClass ? NAME_SCORES[nameClass] : Infinity
    const labelScore = labelClass ? OTHER_SCORES[labelClass] : Infinity
    const aliasScore = aliasClass ? OTHER_SCORES[aliasClass] : Infinity

    const score = Math.min(nameScore, labelScore, aliasScore)
    if (score === Infinity) continue

    const viaAlias = aliasScore < nameScore && aliasScore < labelScore
    scored.push({ entry: viaAlias ? { ...entry, matchedAlias: aliasText } : entry, score })
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return String(a.entry.label || "").localeCompare(String(b.entry.label || ""))
  })

  return scored.slice(0, limit).map((s) => s.entry)
}

// A calc target value as the calculator's `Rational.toString()` emits it:
// a bare integer ("60"), a decimal ("1.666667"), or (for a non-terminating
// fraction) "p/q" (e.g. "15/2" for 7.5). `q` must be a nonzero integer.
const RATIONAL_RE = /^-?\d+(\.\d+)?(\/\d+)?$/

// parseRationalValue(text) -> finite number, or null when `text` is empty,
// non-numeric, non-finite, or a "p/q" with q=0.
function parseRationalValue(text) {
  if (!text || !RATIONAL_RE.test(text)) return null
  const slash = text.indexOf("/")
  if (slash === -1) {
    const value = Number(text)
    return Number.isFinite(value) ? value : null
  }
  const p = Number(text.slice(0, slash))
  const q = Number(text.slice(slash + 1))
  if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return null
  const value = p / q
  return Number.isFinite(value) ? value : null
}

// parseCalcTargets(hash) — "#data=..&items=a:r:60,b:f:2&belt=.." ->
// [{item, mode: "r" | "f", value}]. `hash` may include the leading "#" or
// not. Percent-escapes (e.g. "%3A" for ":") are decoded via
// URLSearchParams before splitting. Segments that aren't
// "<item>:<r|f>:<number>[...]" (extra trailing parts, such as an `:f:`
// target's optional recipe key, are ignored) are skipped rather than
// raising. A value may be a "p/q" fraction (as `Rational.toString()`
// emits for a non-terminating decimal, e.g. "15/2" for 7.5); an empty,
// non-finite (e.g. "Infinity"), or zero-denominator ("1/0") value skips
// the segment. Returns [] when there is no `items=` key at all.
export function parseCalcTargets(hash) {
  if (!hash) return []
  const h = hash[0] === "#" ? hash.slice(1) : hash
  const params = new URLSearchParams(h)
  const raw = params.get("items")
  if (!raw) return []

  const out = []
  for (const segment of raw.split(",")) {
    if (!segment) continue
    const parts = segment.split(":")
    if (parts.length < 3) continue
    const [item, mode, valueStr] = parts
    if (!item) continue
    if (mode !== "r" && mode !== "f") continue
    const value = parseRationalValue(valueStr)
    if (value === null) continue
    out.push({ item, mode, value })
  }
  return out
}

// cardTitle(targets, labelFor) -> "60/min Automation science pack + 2x
// Steel furnace". Rate ("r") targets render as "<value>/min <label>";
// factory-count ("f") targets (J8: title text only, never goals) render
// as "<value>x <label>". `labelFor(item)` resolves the display label;
// falls back to the raw item key when `labelFor` is not given.
export function cardTitle(targets, labelFor) {
  const parts = (targets || []).map((t) => {
    const label = labelFor ? labelFor(t.item) : t.item
    return t.mode === "f" ? `${fmt(t.value)}x ${label}` : `${fmt(t.value)}/min ${label}`
  })
  return parts.join(" + ")
}
