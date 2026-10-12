<script>
    import { soleRecipe } from "../../lib/tooltip-core.js"
    import RecipeTooltip from "./RecipeTooltip.svelte"
    import TooltipFrame from "./TooltipFrame.svelte"

    let { thing } = $props()
    let recipe = $derived(soleRecipe(thing))
</script>

{#if recipe}<RecipeTooltip thing={recipe} />{:else}<TooltipFrame {thing} />{/if}
