<script>
    import Field from "./Field.svelte"
    import ResourcePriority from "./ResourcePriority.svelte"
    import { getRecipeGroups } from "../lib/groups.js"
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { markOverride } from "../lib/savesettings.js"
    import { currentMod, customTitle, MODIFICATIONS, setTitle } from "../lib/settings.js"
    import { sorted } from "../lib/sort.js"

    const DATA_SETS = [...MODIFICATIONS]

    let recipes = $derived(plan.spec?.recipes)
    let recipeGroups = $derived(recipes ? [...getRecipeGroups(new Set(recipes.values()))].filter(g => g.size > 1).map(g => sorted(g, r => r.order)) : [])
    let dataSet = $derived(plan.spec ? currentMod() : null)
    let title = $derived(plan.spec ? customTitle : "")

    function toggleRecipe(recipe) {
        if (plan.spec.disable.has(recipe)) {
            plan.spec.setEnable(recipe)
        } else {
            plan.spec.setDisable(recipe)
        }
        markOverride("recipes")
        plan.spec.updateSolution()
    }

    function changeTitle(event) {
        setTitle(event.target.value)
        plan.spec.setHash()
    }
</script>

<details class="adv">
    <summary class="kv"><span class="title">Advanced</span></summary>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <details><summary class="kv"><span class="muted" style="width: 110px;">Toggle recipes</span></summary><div id="recipe_toggles" class="toggle-list">{#each recipeGroups as group (group[0].key)}<div class="toggle-row">{#each group as recipe (recipe.key)}<div class="toggle recipe" class:selected={!plan.spec.disable.has(recipe)} onclick={() => toggleRecipe(recipe)} {@attach iconOf(recipe, 32)}></div>{/each}</div>{/each}</div></details>
    <details><summary class="kv"><span class="muted" style="width: 110px;">Resource priority</span></summary><ResourcePriority /></details>
    <Field label="Data"><select id="data_set" disabled value={dataSet}>{#each DATA_SETS as [key, mod] (key)}<option value={key}>{mod.name}</option>{/each}</select></Field>
    <Field label="Title"><input id="title_setting" type="text" size="30" placeholder="Factorio Calculator" value={title} oninput={changeTitle}></Field>
</details>
