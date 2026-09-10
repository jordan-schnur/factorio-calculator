// calc/scratchpad.js — DOM glue for the expression pad; the grammar and
// formatting live in scratchpad-core.js so they can be node-checked.
import { evaluate, formatResult, insertAtCaret } from "./scratchpad-core.js"

const STORAGE_KEY = "calc.scratch"
const MAX_HISTORY = 20

// {expr, result: the evaluate() return value} so ArrowUp can recall the raw
// expression and "ans" can inherit the previous result's unit.
let history = []
let ans = null

function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
    } catch (err) {
        return []
    }
}

function saveHistory() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch (err) {
        // storage unavailable or full: history just won't survive a reload.
    }
}

function renderHistory() {
    const container = document.getElementById("scratch-history")
    container.innerHTML = ""
    for (const entry of history) {
        const line = document.createElement("div")
        line.className = "num muted"
        line.textContent = `${entry.expr} ${formatResult(entry.result)}`
        container.appendChild(line)
    }
}

function liveEvaluate() {
    const input = document.getElementById("scratch-input")
    const result = document.getElementById("scratch-result")
    result.textContent = formatResult(evaluate(input.value, ans))
}

function commitLine() {
    const input = document.getElementById("scratch-input")
    const text = input.value
    if (!text.trim()) return
    const result = evaluate(text, ans)
    history.push({ expr: text, result })
    history = history.slice(-MAX_HISTORY)
    saveHistory()
    renderHistory()
    if (result.ok) ans = result
    input.value = ""
    liveEvaluate()
}

function insert(value) {
    const input = document.getElementById("scratch-input")
    if (document.activeElement === input) {
        const caret = input.selectionStart ?? input.value.length
        const inserted = insertAtCaret(input.value, caret, value)
        input.value = inserted.text
        input.setSelectionRange(inserted.caret, inserted.caret)
    } else {
        input.value = input.value ? `${input.value} ${value}` : String(value)
    }
    liveEvaluate()
}

export function initScratchpad() {
    history = loadHistory()
    renderHistory()

    const input = document.getElementById("scratch-input")
    const clear = document.getElementById("scratch-clear")

    input.addEventListener("input", liveEvaluate)
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault()
            commitLine()
        } else if (e.key === "ArrowUp" && history.length) {
            e.preventDefault()
            input.value = history[history.length - 1].expr
            input.setSelectionRange(input.value.length, input.value.length)
            liveEvaluate()
        }
    })

    clear.addEventListener("click", () => {
        history = []
        ans = null
        saveHistory()
        renderHistory()
    })

    document.addEventListener("click", e => {
        const el = e.target.closest(".num[data-value]")
        if (el) insert(el.dataset.value)
    })

    liveEvaluate()
}
