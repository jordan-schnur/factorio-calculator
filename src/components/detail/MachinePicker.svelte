<script>
    import { iconOf } from "../../lib/icon-attach.js"
    import { plan } from "../../lib/plan.svelte.js"
    import Button from "../Button.svelte"
    import MachineQuality from "./MachineQuality.svelte"

    let { m } = $props()

    let actions = $derived(m.slots.length > 0 && (m.others.length > 0 || m.pinned))

    function pick(event, building) {
        event.stopPropagation()
        if (building === m.current) return
        plan.spec.setRecipeBuilding(m.recipe, building)
        plan.spec.updateSolution()
    }

    function useForAll(event) {
        event.stopPropagation()
        for (const recipe of m.others) plan.spec.setRecipeBuilding(recipe, m.current)
        plan.spec.updateSolution()
    }

    function automatic(event) {
        event.stopPropagation()
        plan.spec.setRecipeBuilding(m.recipe, null)
        plan.spec.updateSolution()
    }
</script>

{#if m.slots.length > 0 || m.quality}<span class="lbl">Machine</span>{/if}
{#if m.slots.length > 0}<div class="machines">{#each m.slots as s (s.building.key)}<button type="button" class={["slot", { sel: s.sel, dim: s.off }]} data-machine={s.building.key} title={s.building.name + (s.off ? " (off in Settings → Machines)" : "")} onclick={event => pick(event, s.building)} {@attach iconOf(s.building, 28)}></button>{/each}</div>{/if}
{#if m.quality}<MachineQuality building={m.quality.building} tier={m.quality.tier} />{/if}
{#if actions}<div class="machine-actions">{#if m.others.length > 0}<Button size="sm" class="machine-all" onclick={useForAll}>Use {m.current.name.toLowerCase()} for everything in this build ({m.others.length} more)</Button>{/if}{#if m.pinned}<Button size="sm" class="machine-auto" onclick={automatic}>Automatic</Button>{/if}</div>{/if}
