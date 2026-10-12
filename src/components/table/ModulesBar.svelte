<script>
    import { flushSync } from "svelte"
    import { iconOf } from "../../lib/icon-attach.js"
    import { legacyNode } from "../../lib/legacy-attach.js"
    import { plan } from "../../lib/plan.svelte.js"
    import { isNormal } from "../../lib/quality-core.js"
    import { qualityBadge } from "../../lib/quality-ui.js"
    import { openSettings } from "../../lib/ui.svelte.js"
    import Button from "../Button.svelte"

    let { bar } = $props()

    function openModuleSettings() {
        openSettings()
        flushSync()
        document.getElementById("modules-sec")?.scrollIntoView({ block: "start" })
    }

    function resetHand() {
        plan.spec.commitModules(() => bar.hand.forEach(recipe => plan.spec.releaseRow(recipe)))
    }
</script>

<div id="modules-bar">
    <span class={["slot sm", { qwrap: !isNormal(bar.tier) }]} {@attach iconOf(bar.icon, 24, true)} {@attach legacyNode(() => qualityBadge(bar.tier, 12))}></span>
    <span class="mb-words">{bar.words}</span>
    <Button size="sm" class="mb-change" onclick={openModuleSettings}>Change</Button>
    {#if bar.hand.length > 0}
        <span class="lbl mb-hand">{bar.handText}</span>
        <Button size="sm" class="mb-reset" onclick={resetHand}>Reset them</Button>
    {/if}
</div>
