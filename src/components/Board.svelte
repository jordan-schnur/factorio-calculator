<script>
    import Button from "./Button.svelte"
    import { onActivate } from "../lib/activate.js"
    import { COLUMNS } from "../lib/boardcore.js"
    import { boardForm, calcTargets, capitalize, cardRequest } from "../lib/board-panel-core.js"
    import { companion } from "../lib/hosting.js"

    let { planned } = $props()

    let open = $state(false)
    let note = $state("")
    let form = $state(null)

    async function toggle() {
        open = !open
        if (!open) return
        const targets = calcTargets(location.hash)
        if (!targets.some(t => t.mode === "r")) {
            note = "Set at least one rate target first."
            return
        }
        note = "Loading…"
        const catalog = (await companion()) || { entries: [] }
        form = boardForm(targets, catalog)
        note = ""
    }

    async function add() {
        const card = form
        const request = cardRequest(card, location.hash)
        card.added = false
        if (request.message) {
            card.result = request.message
            return
        }
        card.result = "Adding…"
        try {
            const resp = await fetch("/api/board/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) })
            const payload = await resp.json().catch(() => null)
            if (!resp.ok) {
                card.result = payload?.error || "Could not add the card."
                return
            }
            card.result = `Added to ${capitalize(request.body.column)} — `
            card.added = true
        } catch {
            card.result = "Could not reach the board server."
        }
    }

    function close() {
        open = false
    }
</script>

<Button variant="green" class="needs-companion" id="board-button" hidden={!planned} onclick={toggle}>Add to board</Button>
<div class="frame needs-companion" id="board-panel" hidden={!open}>
    {#if note}
        <div class="deep muted" id="board-note">{note}</div>
    {:else if form}
        <div class="deep form">
            <input type="text" id="board-title-input" bind:value={form.title}>
            <select id="board-column-select" bind:value={form.column}>{#each COLUMNS as column (column)}<option value={column}>{capitalize(column)}</option>{/each}</select>
            <div id="board-checks">
                {#each form.checks as check (check)}
                    <div class="row"><span class="check board-check" role="checkbox" aria-checked={check.on} tabindex="0" data-checked={check.on ? "1" : "0"} data-item={check.item} data-value={check.value} onclick={() => (check.on = !check.on)} onkeydown={onActivate(() => (check.on = !check.on))}>{check.on ? "✓" : ""}</span><span>{check.label}</span></div>
                {/each}
            </div>
            <div class="row"><span class="btn btn-green" id="board-add-btn" role="button" tabindex="0" onclick={add} onkeydown={onActivate(add)}>Add</span><span class="btn" id="board-cancel-btn" role="button" tabindex="0" onclick={close} onkeydown={onActivate(close)}>Cancel</span></div>
            <div id="board-result">{form.result}{#if form.added}<a href="/board/board.html" target="_blank" rel="noopener">open board</a>{/if}</div>
        </div>
    {/if}
</div>

<style>
    .form { display: flex; flex-direction: column; gap: 6px; }
</style>
