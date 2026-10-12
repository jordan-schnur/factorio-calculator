import { qualityFromSave, tierOf } from "./quality-core.js"

// What Settings -> From your save shows for the followed save; no DOM.
export function fromSave(spec) {
    let { save, follow, fetched } = spec.saveState
    let saveLabel = save === null ? "not following a save" : (fetched && fetched.save ? fetched.save.name : "newest")
    if (!fetched) return { saveLabel, follow, fetched: false }
    let building = key => key && spec.buildingKeys.get(key)
    let planet = spec.planets && spec.planets.get(fetched.planet)
    let saved = fetched.machine_quality ? qualityFromSave(fetched.machine_quality, [...spec.selectedPlanets].map(p => p.key)) : new Map()
    let words = [...saved].map(([key, tier]) => `${(spec.buildingKeys.get(key) || { name: key }).name}: ${tierOf(tier).name}`)
    return {
        saveLabel,
        follow,
        fetched: true,
        sets: [
            { label: "Belt", thing: spec.belts && spec.belts.get(fetched.belt) },
            { label: "Assembling", thing: building(fetched.buildings.crafting) },
            { label: "Smelting", thing: building(fetched.buildings.smelting) },
            { label: "Mining", thing: building(fetched.buildings["basic-solid"]), extra: `+${fetched.mining_productivity}% mining productivity` },
        ],
        planet: planet ? planet.name : fetched.planet,
        recipes: `${fetched.disabled_recipes.length} recipes locked`,
        quality: words.length === 0 ? "every machine normal" : words.join(", "),
    }
}
