<script>
    import RecipePicker from "./RecipePicker.svelte"
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { changeAmount, changeUnit, dropTarget, pickRecipe, UNITS } from "../lib/target.js"

    let { row } = $props()

    function removeKey(event) {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        dropTarget(plan.spec, row.target)
    }
</script>

<li class="target row"><span class="slot" {@attach iconOf(row.target.item, 32, true)}></span><RecipePicker recipes={row.recipes} recipe={row.recipe} onpick={recipe => pickRecipe(plan.spec, row.target, recipe)} /><span class="h name">{row.target.item.name}</span><input class="num amount" value={row.amount} onchange={event => changeAmount(plan.spec, row.target, event.currentTarget.value)}><select class="muted" value={row.unit} onchange={event => changeUnit(plan.spec, row.target, event.currentTarget.value)}>{#each UNITS as unit (unit)}<option value={unit}>{unit}</option>{/each}</select><span class="btn btn-red btn-sm" role="button" tabindex="0" title="Remove this item." onclick={() => dropTarget(plan.spec, row.target)} onkeydown={removeKey}>×</span></li>

<style>
    .name { flex: 1; }
    .amount { width: 56px; text-align: right; }
</style>
