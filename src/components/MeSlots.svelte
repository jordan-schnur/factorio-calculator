<script>
    import ModuleSlot from "./ModuleSlot.svelte"
    import { hintText, selectSlot, slotTitle } from "../lib/modules-editor.svelte.js"

    let { opts, entry, target, sel } = $props()

    let slots = $derived(entry.modules.map((module, index) => ({ module, tier: entry.moduleTiers[index], index })))
</script>

<div class="me-block me-machine"><span class="lbl">In the machine</span><div class="me-row">{#each slots as slot (slot)}<ModuleSlot module={slot.module} tier={slot.tier} iconSize={34} badge={14} size="lg" class="me-slot" selected={sel?.kind === "slot" && sel.index === slot.index} data-slot={slot.index} title={slotTitle(slot.module, slot.tier, slot.index)} disabled={target === "plan"} onpick={() => selectSlot(opts, "slot", slot.index)} />{/each}</div><div class="muted me-hint">{hintText(sel, target)}</div></div>
