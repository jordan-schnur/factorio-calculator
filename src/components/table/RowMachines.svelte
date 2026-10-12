<script>
    import { iconOf } from "../../lib/icon-attach.js"
    import { legacyNode } from "../../lib/legacy-attach.js"
    import { isNormal } from "../../lib/quality-core.js"
    import { qualityBadge } from "../../lib/quality-ui.js"

    let { m } = $props()
</script>

<span class="machines num">{#if m}<span class={["slot xs", { qwrap: !isNormal(m.tier) }]} {@attach iconOf(m.building, 18, true)} {@attach legacyNode(() => qualityBadge(m.tier, 9))}></span><span class="cnt">{m.count}</span><span class="muted">{m.building.name}</span>{/if}</span>
