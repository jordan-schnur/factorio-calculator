<script>
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { Rational } from "../lib/rational.js"

    let tiers = $derived(plan.spec?.priority?.priorities.map(level => ({ level, resources: [...level.resources] })) ?? [])

    function reweigh(resource, text) {
        resource.weight = Rational.from_string(text)
        resource.level.insertSorted(resource)
        plan.spec.updateSolution()
    }
</script>

<div id="resource_settings">{#if plan.spec}<div class="resource-tier bookend"><span>less valuable</span></div>{#each tiers as { level, resources }, i (level)}{#if i > 0}<div class="middle"></div>{/if}<div class="resource-tier">{#each resources as resource (resource.recipe.key)}<div class="resource" {@attach iconOf(resource.recipe, 48)}><input type="text" size="4" value={resource.weight.toString()} onchange={event => reweigh(resource, event.target.value)}></div>{/each}</div>{/each}<div class="resource-tier bookend"><span>more valuable</span></div>{/if}</div>
