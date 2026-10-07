<script>
    import { allowLabel, itemNames, joinWords, machineDiff, shortName } from "../lib/byproduct-core.js"
    import { applyRecipes, icon, unresearched } from "../lib/byproducts.svelte.js"
    import Button from "./Button.svelte"

    let { block, fix, found } = $props()

    let diff = $derived(machineDiff(found.base, fix.result))
    let best = $derived(fix === found.best)
    let green = $derived(best || found.fixes.length === 1)
    let label = $derived(fix.kind === "allow" ? allowLabel(fix.enable) : `Use ${fix.recipe.name.toLowerCase()}`)
    let before = $derived(fix.kind === "allow" ? `Turns on ${joinWords(fix.enable.map(shortName))}.` : `${fix.item.name} without the ${itemNames(block)}.`)
    let done = $derived(fix.kind === "allow" ? `${label.replace(/^Allow/, "Allowed")}.` : `Switched ${fix.item.name.toLowerCase()} to ${fix.recipe.name.toLowerCase()}.`)
    let fullDone = $derived(`${done} ${diff.delta === 0 ? "No change in machines." : `${Math.abs(diff.delta)} ${diff.delta < 0 ? "fewer" : "more"} machines.`}`)
    let locked = $derived(unresearched())
    let buttonIcon = $derived(fix.kind === "allow" ? fix.enable[fix.enable.length - 1].icon : fix.recipe.icon)
</script>

<div class="bp-fix">
    <Button class="bp-btn" variant={green ? "green" : undefined} data-fix={fix.kind === "allow" ? "allow" : "avoid"} onclick={() => applyRecipes(fix, fullDone)}>
        <span use:icon={[buttonIcon, 24]}></span>{label}
    </Button>
    <span class="bp-what">{before} {diff.parts.join(", ")}{diff.parts.length ? ". " : ""}<strong>{diff.total}.</strong>{fix.enable.some(r => locked.has(r.key)) ? " Not researched in your save yet." : ""}</span>
    {#if best}<span class="badge best">Fewest machines</span>{/if}
</div>
