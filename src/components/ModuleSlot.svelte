<script>
    import QualityBadge from "./QualityBadge.svelte"
    import { emptySlot } from "../lib/empty-slot.js"
    import { iconOf } from "../lib/icon-attach.js"
    import { isNormal } from "../lib/quality-core.js"

    let { module, tier = "normal", iconSize, badge, size, selected = false, class: extra, onpick, ...rest } = $props()

    let badged = $derived(Boolean(module) && !isNormal(tier))

    function click(event) {
        event.stopPropagation()
        onpick()
    }
</script>

<button type="button" class={["slot", size && `slot-${size}`, extra, { sel: selected, qwrap: badged }]} {...rest} onclick={click} {@attach iconOf(module ?? emptySlot(), iconSize, true)}>{#if badged}<QualityBadge {tier} size={badge} />{/if}</button>
