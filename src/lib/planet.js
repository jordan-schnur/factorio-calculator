// SPDX-License-Identifier: Apache-2.0 · Copyright 2024 Kirk McDonald
import { Icon } from "./icon.js"
import { blockedCategories, meets } from "./planet-core.js"

class SurfaceProperty {
}

class Planet {
    constructor(key, name, order, col, row, resources, properties) {
        this.key = key
        this.name = name
        this.order = order
        this.resources = resources
        this.properties = properties
        this.disable = new Set()
        this.blocked = new Set()

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    allows(recipe) {
        if (recipe.isResource()) {
            return this.resources.has(recipe)
        }
        // A recipe whose every machine is barred here is barred too.
        if (this.blocked.has(recipe.category)) {
            return false
        }
        return meets(recipe.conditions, this.properties, defaultProperties)
    }
}

let defaultProperties

const RECYCLING_ROOT_KEYS = new Set(["scrap"])

function traverseRecycling(recipe, found) {
    for (let {item} of recipe.products) {
        for (let subrecipe of item.uses) {
            if (subrecipe.key.endsWith("-recycling")) {
                if (!found.has(subrecipe)) {
                    found.add(subrecipe)
                    traverseRecycling(subrecipe, found)
                }
            }
        }
    }
}

export function getPlanets(data, recipes) {
    if (!data.planets) {
        // For legacy 1.1 datasets.
        return null
    }
    defaultProperties = new Map()
    for (let {name, default_value} of data.surface_properties) {
        defaultProperties.set(name, default_value)
    }

    let planets = new Map()
    for (let d of data.planets) {
        let resources = new Set()
        let roots = new Set()
        for (let key of d.resources.resource.concat(d.resources.offshore).concat(d.resources.plants)) {
            let r = recipes.get(key)
            resources.add(r)
            if (RECYCLING_ROOT_KEYS.has(key)) {
                roots.add(r)
            }
        }
        let properties = new Map()
        for (let key in d.surface_properties) {
            let value = d.surface_properties[key]
            properties.set(key, value)
        }
        let planet = new Planet(
            d.key,
            d.localized_name.en,
            d.order,
            d.icon_col,
            d.icon_row,
            resources,
            properties,
        )
        planet.blocked = blockedCategories(data.crafting_machines || [], properties, defaultProperties)
        for (let recipe of recipes.values()) {
            if (!planet.allows(recipe) || recipe.key.endsWith("-recycling")) {
                planet.disable.add(recipe)
            }
            if (roots.size > 0) {
                let recycling = new Set()
                for (let root of roots) {
                    traverseRecycling(root, recycling)
                }
                for (let recycle of recycling) {
                    planet.disable.delete(recycle)
                }
            }
        }
        planets.set(planet.key, planet)
    }
    return planets
}
