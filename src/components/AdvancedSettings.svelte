<script>
    import Field from "./Field.svelte"
    import SubSection from "./SubSection.svelte"
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
    <SubSection label="Toggle recipes" override="recipes">
        <div id="recipe_toggles" class="toggle-list">
            {#each recipeGroups as group (group[0].key)}
                <div class="toggle-row">{#each group as recipe (recipe.key)}<button type="button" class="toggle recipe" aria-label={recipe.name} class:selected={!plan.spec.disable.has(recipe)} onclick={() => toggleRecipe(recipe)} {@attach iconOf(recipe, 32)}></button>{/each}</div>
            {/each}
        </div>
    </SubSection>
    <SubSection label="Resource priority"><ResourcePriority /></SubSection>
    <Field label="Data"><select id="data_set" disabled value={dataSet}>{#each DATA_SETS as [key, mod] (key)}<option value={key}>{mod.name}</option>{/each}</select></Field>
    <Field label="Title"><input id="title_setting" type="text" size="30" placeholder="Factorio Calculator" value={title} oninput={changeTitle}></Field>
</details>
