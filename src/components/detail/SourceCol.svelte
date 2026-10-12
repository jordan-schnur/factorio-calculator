<script>
    import { toggleSupplied } from "../../lib/supplied.js"
    import Seg from "../Seg.svelte"
    import MachinePicker from "./MachinePicker.svelte"
    import RecipeOptions from "./RecipeOptions.svelte"

    let { item, source } = $props()

    const SEG = [["here", "Make here"], ["in", "Bring in from another build"]]

    function pick([key]) {
        if ((key === "in") === source.seg.supplied) return
        toggleSupplied(source.seg.keys)
    }
</script>

<div class="col source">
    {#if source.seg}<Seg tag="span" class="source" items={SEG} key={([key]) => key} selected={([key]) => (key === "in") === source.seg.supplied} attrs={([key]) => (key === "in" && source.seg.supplied ? { class: "in" } : {})} onpick={pick}>{#snippet children([, label])}{label}{/snippet}</Seg>{/if}
    {#if source.options}<span class="lbl">Recipe</span><RecipeOptions {item} options={source.options} />{/if}
    {#if source.machine}<MachinePicker m={source.machine} />{/if}
    {#if source.exact}<span class="muted exact">{source.exact}</span>{/if}
    {#if source.fallback}<span class="muted fallback">{source.fallback}</span>{/if}
</div>
