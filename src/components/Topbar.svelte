<script>
    import Button from "./Button.svelte"
    import Seg from "./Seg.svelte"
    import { findGroup } from "../lib/machines-core.js"
    import { plan, refresh } from "../lib/plan.svelte.js"
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
    <select id="save-picker" class="needs-companion"></select>
    <span id="save-status" class="muted needs-companion"></span>
    <span id="page-note" class="muted"></span>
    <div class="spacer"></div>
    <Seg id="view-seg" hidden={!planned} items={VIEWS} key={([key]) => key} selected={([key]) => planned && view === key} onpick={([key]) => pick(key)} attrs={([key]) => ({ "data-view": key })}>
        {#snippet children([, label])}{label}{/snippet}
    </Seg>
    <Button id="settings-open" title="Settings" onclick={openSettings}>Settings</Button>
    <Button variant="green" class="needs-companion" id="board-button" hidden={!planned}>Add to board</Button>
    <div class="frame needs-companion" id="board-panel" hidden></div>
</div>
