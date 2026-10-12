<script>
    import Button from "./Button.svelte"
    import ModuleSlot from "./ModuleSlot.svelte"
    import QualityIcon from "./QualityIcon.svelte"
    import TierPicker from "./TierPicker.svelte"
    import { MAX_BEACONS, selectSlot, stepBeacons, write } from "../lib/modules-editor.svelte.js"
    import { moduleLabel } from "../lib/modules-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { tierOf } from "../lib/quality-core.js"

    let { opts, entry, disp, target, sel } = $props()

    let beacon = $derived(plan.spec.items.get("beacon"))
    let slots = $derived(disp.beaconModules.map((module, index) => ({ module, tier: disp.beaconModuleTiers[index], index })))

    function step(event, delta) {
        event.stopPropagation()
        stepBeacons(plan.spec, opts, target, entry, delta)
    }
</script>

<div class="me-block me-beacons"><span class="lbl">Beacons around each machine</span><div class="me-row"><Button size="sm" class="me-minus" disabled={entry.beaconCount <= 0} onclick={event => step(event, -1)}>−</Button><span class="num me-count">{disp.beaconCount}</span><Button size="sm" class="me-plus" disabled={entry.beaconCount >= MAX_BEACONS} onclick={event => step(event, 1)}>+</Button>{#if beacon}<QualityIcon thing={beacon} size={28} tier={disp.beaconTier} badge={12} />{/if}{#each slots as slot (slot)}<ModuleSlot module={slot.module} tier={slot.tier} iconSize={28} badge={12} class="me-bslot" selected={sel?.kind === "beacon" && sel.index === slot.index} data-beacon={slot.index} title={`Beacon slot ${slot.index + 1}: ${moduleLabel(slot.module)}`} onpick={() => selectSlot(opts, "beacon", slot.index)} />{/each}</div><div class="me-tierpick me-beacon-tier"><span class="muted">Beacon quality</span><TierPicker tier={tierOf(disp.beaconTier)} label="Beacon quality" onpick={t => write(plan.spec, opts, target, { ...entry, beaconTier: t.key })} /></div></div>
