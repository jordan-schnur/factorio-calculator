<script>
    import Board from "./Board.svelte"
    import Button from "./Button.svelte"
    import Seg from "./Seg.svelte"
    import { findGroup } from "../lib/machines-core.js"
    import { plan, refresh } from "../lib/plan.svelte.js"
    import { saveUi } from "../lib/save-ui.svelte.js"
    import { pickSave } from "../lib/savesettings.js"
    import { openSettings } from "../lib/ui.svelte.js"

    let { planned, view } = $props()

    const VIEWS = [["table", "Table"], ["graph", "Graph"]]

    let saveLine = $derived(describeSave(plan.spec))

    function describeSave(spec) {
        if (!spec) return ""
        const fetched = spec.saveState?.fetched
        if (!fetched?.save || !spec.saveState.follow) return "not following a save"
        const planets = Array.from(spec.selectedPlanets, p => p.name).join(", ")
        const furnaces = findGroup(spec, g => g.buildings.some(b => b.key.includes("furnace")))
        return `Reading ${fetched.save.name} · ${planets} · ${spec.belt.name} · ${furnaces?.building.name ?? ""}`
    }

    function pick(key) {
        plan.spec.view = key
        plan.spec.setHash()
        document.dispatchEvent(new CustomEvent("calc:view", { detail: { view: key } }))
        refresh()
    }
</script>

<div class="frame" id="topbar">
    <h1 class="title">Factorio Calculator</h1>
    <span class="muted needs-companion" id="save-line">{saveLine}</span>
    <select id="save-picker" class="needs-companion" value={saveUi.selected} onchange={event => pickSave(event.currentTarget.value)}>{#if saveUi.saves}<option value="">newest save</option>{#each saveUi.saves as save (save)}<option value={save.name}>{save.name}</option>{/each}{/if}</select>
    <span id="save-status" class="muted needs-companion">{saveUi.status}</span>
    <span id="page-note" class="muted">{saveUi.note}</span>
    <div class="spacer"></div>
    <Seg id="view-seg" hidden={!planned} items={VIEWS} key={([key]) => key} selected={([key]) => planned && view === key} onpick={([key]) => pick(key)} attrs={([key]) => ({ "data-view": key })}>
        {#snippet children([, label])}{label}{/snippet}
    </Seg>
    <Button id="settings-open" title="Settings" onclick={openSettings}>Settings</Button>
    <Board {planned} />
</div>
