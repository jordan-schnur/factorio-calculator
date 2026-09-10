// calc/scratchpad-core.js — the scratch pad's expression evaluator. No
// eval/Function: a hand-written tokeniser feeds a small recursive-descent
// parser/evaluator over
//   expr  := term (('+'|'-') term)*
//   term  := power (('*'|'/'|'×'|'÷') power)*
//   power := unary ('^' unary)?
//   unary := '-' unary | atom
//   atom  := number unit? | 'ans' | '(' expr ')'
//
// `ans` is the previous evaluate() result object ({value, unit}), not a bare
// number: its unit is folded into unitsSeen the same way a literal number's
// unit is, so "ans / 2" after "20 * 90 kW" still prints in kW/MW.

// Longest-match-first: "kW"/"MW" must be tried before "k"/"M".
const UNIT_PATTERNS = [
  { text: "kW", scale: 1e3, unit: "W" },
  { text: "MW", scale: 1e6, unit: "W" },
  { text: "k", scale: 1e3, unit: null },
  { text: "M", scale: 1e6, unit: null },
  { text: "/min", scale: 1, unit: "/min" },
  { text: "/h", scale: 1, unit: "/h" },
  { text: "/s", scale: 1, unit: "/s" },
]

function tokenize(text) {
  const s = text || ""
  const tokens = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const raw = s.slice(i, j)
      i = j
      let k = i
      while (k < s.length && /\s/.test(s[k])) k++
      const matched = UNIT_PATTERNS.find(u => s.startsWith(u.text, k))
      if (matched) {
        i = k + matched.text.length
        tokens.push({ type: "num", value: Number(raw) * matched.scale, unit: matched.unit })
      } else {
        tokens.push({ type: "num", value: Number(raw), unit: null })
      }
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      const word = s.slice(i, j)
      i = j
      tokens.push(word === "ans" ? { type: "ans" } : { type: "unknown", value: word })
      continue
    }
    if ("+-*/×÷^()".includes(c)) {
      tokens.push({ type: "op", value: c })
      i++
      continue
    }
    tokens.push({ type: "unknown", value: c })
    i++
  }
  return tokens
}

// Thrown internally and caught at the top of evaluate(); never escapes it.
class Incomplete {}
class CalcError {
  constructor(message) {
    this.message = message
  }
}

export function evaluate(text, ans) {
  const tokens = tokenize(text)
  const unitsSeen = new Set()
  let pos = 0

  const peek = () => tokens[pos]
  const take = () => tokens[pos++]

  function parseExpr() {
    let v = parseTerm()
    for (;;) {
      const t = peek()
      if (t && t.type === "op" && (t.value === "+" || t.value === "-")) {
        take()
        const rhs = parseTerm()
        v = t.value === "+" ? v + rhs : v - rhs
      } else break
    }
    return v
  }

  function parseTerm() {
    let v = parsePower()
    for (;;) {
      const t = peek()
      if (t && t.type === "op" && "*/×÷".includes(t.value)) {
        take()
        const rhs = parsePower()
        if (t.value === "*" || t.value === "×") {
          v = v * rhs
        } else {
          if (rhs === 0) throw new CalcError("division by zero")
          v = v / rhs
        }
      } else break
    }
    return v
  }

  function parsePower() {
    const v = parseUnary()
    const t = peek()
    if (t && t.type === "op" && t.value === "^") {
      take()
      return Math.pow(v, parseUnary())
    }
    return v
  }

  function parseUnary() {
    const t = peek()
    if (t && t.type === "op" && t.value === "-") {
      take()
      return -parseUnary()
    }
    return parseAtom()
  }

  function parseAtom() {
    const t = peek()
    if (!t) throw new Incomplete()
    if (t.type === "num") {
      take()
      if (t.unit) unitsSeen.add(t.unit)
      return t.value
    }
    if (t.type === "ans") {
      take()
      if (ans && ans.unit) unitsSeen.add(ans.unit)
      return ans ? ans.value : 0
    }
    if (t.type === "op" && t.value === "(") {
      take()
      const v = parseExpr()
      const close = peek()
      if (!close) throw new Incomplete()
      if (!(close.type === "op" && close.value === ")")) {
        throw new CalcError(`expected ")"`)
      }
      take()
      return v
    }
    throw new CalcError(`unexpected "${t.value ?? t.type}"`)
  }

  try {
    if (tokens.length === 0) return { ok: false, incomplete: true }
    const value = parseExpr()
    const trailing = peek()
    if (trailing) throw new CalcError(`unexpected "${trailing.value ?? trailing.type}"`)
    const unit = unitsSeen.size === 1 ? [...unitsSeen][0] : null
    return { ok: true, value, unit }
  } catch (err) {
    if (err instanceof Incomplete) return { ok: false, incomplete: true }
    if (err instanceof CalcError) return { ok: false, error: err.message }
    throw err
  }
}

function trimNumber(value, maxDecimals) {
  return String(Number(value.toFixed(maxDecimals)))
}

function formatValue(value, unit) {
  if (unit === "W") {
    const abs = Math.abs(value)
    if (abs >= 1e6) return `${trimNumber(value / 1e6, 2)} MW`
    if (abs >= 1e3) return `${trimNumber(value / 1e3, 2)} kW`
    return `${trimNumber(value, 2)} W`
  }
  const n = trimNumber(value, 4)
  return unit ? `${n} ${unit}` : n
}

export function formatResult(r) {
  if (!r || r.ok === false) return r && r.incomplete ? "= …" : "= ?"
  return `= ${formatValue(r.value, r.unit)}`
}

// Characters that already visually separate the caret from its neighbour,
// so inserting `value` next to them needs no extra space.
const LEFT_HUGS = new Set(["", " ", "("])
const RIGHT_HUGS = new Set(["", " ", ")"])

export function insertAtCaret(text, caret, value) {
  const before = text.slice(0, caret)
  const after = text.slice(caret)
  const left = LEFT_HUGS.has(before.slice(-1)) ? "" : " "
  const right = RIGHT_HUGS.has(after.slice(0, 1)) ? "" : " "
  const insert = left + value + right
  return { text: before + insert + after, caret: before.length + insert.length }
}
