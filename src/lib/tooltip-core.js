// What the model tooltips say: plain values and strings from a model instance, no DOM.
import { powerRepr } from "./power.js"
import { one, Rational, zero } from "./rational.js"

const HUNDRED = Rational.from_float(100)

export function signedPercent(x) {
    return `${x.less(zero) ? "" : "+"}${x.mul(HUNDRED).toDecimal()}%`
}

// The {label, value} lines under a building's name; `format` is spec.format.
export function buildingStats(building, format) {
    if (building.tooltipKind === "plain") return []
    if (building.tooltipKind === "pump") return [{ label: "Pumping speed: ", value: `${format.rate(building.pumpingSpeed)}/${format.rateName}` }]
    const { power, suffix } = powerRepr(building.power)
    const energy = { label: "Energy consumption: ", value: `${power.toDecimal(0)} ${suffix}` }
    const slots = { label: "Module slots: ", value: String(building.moduleSlots) }
    if (building.tooltipKind === "miner") return [energy, { label: "Mining speed: ", value: building.miningSpeed.toDecimal() }, slots]
    return [energy, { label: "Crafting speed: ", value: building.speed.toDecimal() }, slots]
}

export function moduleStats(module) {
    const stats = []
    if (!module.power.isZero()) stats.push({ label: "Energy consumption: ", value: signedPercent(module.power) })
    if (!module.speed.isZero()) stats.push({ label: "Speed: ", value: signedPercent(module.speed) })
    if (!module.productivity.isZero()) stats.push({ label: "Productivity: ", value: signedPercent(module.productivity) })
    return stats
}

// A recipe tooltip's heading: a no-break space, then "N × " when its one product is itself made N at a time.
export function recipeTitle(recipe) {
    const [first] = recipe.products
    const batch = recipe.products.length === 1 && first.item.name === recipe.name && one.less(first.amount)
    return " " + (batch ? `${first.amount.toDecimal()} × ${recipe.name}` : recipe.name)
}

export function showsProducts(recipe) {
    return recipe.products.length > 1 || recipe.products[0].item.name !== recipe.name
}

// The recipe an item's tooltip shows instead of its own, or null.
export function soleRecipe(item) {
    return item.recipes.length === 1 && item.recipes[0].name === item.name ? item.recipes[0] : null
}
