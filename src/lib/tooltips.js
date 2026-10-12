// tooltipFor(thing): the tooltip component for a model instance (by its tooltipKind), or null.
import BeltTooltip from "../components/tooltips/BeltTooltip.svelte"
import BuildingTooltip from "../components/tooltips/BuildingTooltip.svelte"
import FuelTooltip from "../components/tooltips/FuelTooltip.svelte"
import ItemTooltip from "../components/tooltips/ItemTooltip.svelte"
import ModuleTooltip from "../components/tooltips/ModuleTooltip.svelte"
import RecipeTooltip from "../components/tooltips/RecipeTooltip.svelte"

const BY_KIND = {
    belt: BeltTooltip,
    building: BuildingTooltip,
    miner: BuildingTooltip,
    pump: BuildingTooltip,
    plain: BuildingTooltip,
    fuel: FuelTooltip,
    item: ItemTooltip,
    module: ModuleTooltip,
    recipe: RecipeTooltip,
}

export function tooltipFor(thing) {
    return BY_KIND[thing?.tooltipKind] ?? null
}
