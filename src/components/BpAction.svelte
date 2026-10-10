<script>
    import { iconOf } from "../lib/icon-attach.js"
    import Button from "./Button.svelte"

    let { dataFix, variant, icon, label, best = false, onclick, what } = $props()
</script>

<div class="bp-fix">
    <Button class="bp-btn" {variant} data-fix={dataFix} {onclick}>
        {#if icon}<span {@attach iconOf(icon, 24, true)}></span>{/if}{label}
    </Button>
    <span class="bp-what">{@render what()}</span>
    {#if best}<span class="badge best">Fewest machines</span>{/if}
</div>
