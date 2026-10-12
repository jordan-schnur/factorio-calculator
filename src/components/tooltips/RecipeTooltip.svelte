<script>
    import { iconOf } from "../../lib/icon-attach.js"
    import { sprites } from "../../lib/icon.js"
    import { recipeTitle, showsProducts } from "../../lib/tooltip-core.js"
    import TooltipFrame from "./TooltipFrame.svelte"

    let { thing } = $props()
</script>

<!-- No whitespace between tags: the markup must match the old d3 tooltip node for node. -->
<TooltipFrame {thing} title={recipeTitle(thing)} recipe>
    {#if thing.ingredients.length > 0}{#if showsProducts(thing)}<div><span>Products:</span><span>{#each thing.products as product (product)}<span><span>&nbsp;</span><div class="product" {@attach iconOf(product.item, 32, true)}><span class="count">{product.amount.toDecimal()}</span></div></span>{/each}</span></div>{/if}<div><div class="product" {@attach iconOf(sprites.get("clock"), 32, true)}></div><span>&nbsp;{thing.time.toDecimal()}</span></div><div>{#each thing.ingredients as ingredient (ingredient)}<div><div class="product" {@attach iconOf(ingredient.item, 32, true)}></div><span>&nbsp;{ingredient.amount.toDecimal()} × {ingredient.item.name}</span></div>{/each}</div>{/if}
</TooltipFrame>
