<script>
    import { tick } from "svelte"
    import Button from "./Button.svelte"
    import { evaluate, formatResult, insertAtCaret } from "../lib/scratchpad-core.js"

    const STORAGE_KEY = "calc.scratch"
    const MAX_HISTORY = 20

    let { hidden } = $props()

    let history = $state([])
    let expr = $state("")
    let ans = $state(null)
    let inputEl

    let result = $derived(formatResult(evaluate(expr, ans)))

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

    function commitLine() {
        if (!expr.trim()) return
        const r = evaluate(expr, ans)
        history = [...history, { expr, result: r }].slice(-MAX_HISTORY)
        saveHistory()
        if (r.ok) ans = r
        expr = ""
    }

    async function recallLast() {
        if (!history.length) return
        expr = history[history.length - 1].expr
        await tick()
        inputEl.setSelectionRange(expr.length, expr.length)
    }

    function onKeydown(e) {
        if (e.key === "Enter") {
            e.preventDefault()
            commitLine()
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            recallLast()
        }
    }

    function clearHistory() {
        history = []
        ans = null
        saveHistory()
    }

    async function insert(value) {
        if (document.activeElement === inputEl) {
            const caret = inputEl.selectionStart ?? expr.length
            const inserted = insertAtCaret(expr, caret, value)
            expr = inserted.text
            await tick()
            inputEl.setSelectionRange(inserted.caret, inserted.caret)
        } else {
            expr = expr ? `${expr} ${value}` : String(value)
        }
    }

    function onDocumentClick(e) {
        const el = e.target.closest(".num[data-value]")
        if (el) insert(el.dataset.value)
    }

    $effect(() => {
        history = loadHistory()
        document.addEventListener("click", onDocumentClick)
        return () => document.removeEventListener("click", onDocumentClick)
    })
</script>

<details id="scratchpad-frame" {hidden}><summary>Scratch pad</summary>
    <div class="scratch-body">
        <div id="scratch-history">
            {#each history as entry (entry)}
                <div class="num muted">{entry.expr} {formatResult(entry.result)}</div>
            {/each}
        </div>
        <input class="num" id="scratch-input" placeholder="2 * 450 / 60" autocomplete="off" bind:value={expr} bind:this={inputEl} onkeydown={onKeydown}>
        <div class="num scratch-result" id="scratch-result">{result}</div>
        <div class="muted scratch-hint"><span class="key">Enter</span> keeps the line &middot; <span class="key">&uarr;</span> recalls &middot; <b>ans</b> is the last result &middot; units like kW, MW, /min pass through.</div>
        <Button size="sm" id="scratch-clear" onclick={clearHistory}>clear</Button>
    </div>
</details>

<style>
    .scratch-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .scratch-result {
        font-size: 22px;
        text-align: right;
    }
    .scratch-hint {
        font-size: 13px;
    }
</style>
