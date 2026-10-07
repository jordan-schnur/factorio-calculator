// SPDX-License-Identifier: Apache-2.0 · Copyright 2024 Kirk McDonald

class Resource {
    constructor(recipe, weight) {
        this.level = null
        this.recipe = recipe
        this.weight = weight
    }
    // Removes this Resource from its level, and the level too if that leaves it empty.
    remove() {
        if (this.level === null) {
            return
        }
        this.level.resources.splice(this.level.resources.indexOf(this), 1)
        if (this.level.isEmpty()) {
            this.level.remove()
        }
        this.level = null
    }
}

class PriorityLevel {
    constructor(list) {
        this.resources = []
        this.list = list
    }
    [Symbol.iterator]() {
        return this.resources[Symbol.iterator]()
    }
    equalMap(m) {
        if (m.size !== this.resources.length) {
            return false
        }
        for (let {recipe, weight} of this) {
            if (!m.has(recipe) || !m.get(recipe).equal(weight)) {
                return false
            }
        }
        return true
    }
    has(resource) {
        return resource.level === this
    }
    // Removes this level from the PriorityList; it must be empty.
    remove() {
        if (this.resources.length !== 0) {
            throw new Error("cannot remove non-empty PriorityLevel")
        }
        this.list.removeEmptyLevels()
    }
    isEmpty() {
        return this.resources.length === 0
    }
    // Moves the given resource to this level. Removes it from its old level.
    // If the old level is left empty as a result, it will be removed.
    //
    // If the resource is already in this level, it will be re-inserted in
    // sorted order.
    insertSorted(resource) {
        if (resource.level === this && this.resources.length === 1) {
            // If it's the only resource on this level, then no re-sorting is
            // required.
            return
        } else if (resource.level !== null) {
            resource.remove()
        }
        resource.level = this
        for (let i = 0; i < this.resources.length; i++) {
            let r = this.resources[i]
            if (resource.weight.less(r.weight)) {
                this.resources.splice(i, 0, resource)
                return
            }
        }
        this.resources.push(resource)
    }
}

export class PriorityList {
    constructor() {
        this.priorities = []
    }
    [Symbol.iterator]() {
        return this.priorities[Symbol.iterator]()
    }
    static getDefaultArray(recipe) {
        let a = []
        for (let [recipeKey, recipe] of recipes) {
            if (recipe.isResource()) {
                let pri = recipe.defaultPriority
                while (a.length < pri + 1) {
                    a.push(new Map())
                }
                a.set(recipe, recipe.defaultWeight)
            }
        }
        return a
    }
    static fromArray(a) {
        let p = new PriorityList()
        for (let m of a) {
            let level = p.addPriorityBefore(null)
            for (let [recipe, weight] of m) {
                p.addRecipe(recipe, weight, level)
            }
        }
        return p
    }
    applyArray(a) {
        for (let i = 0; i < a.length; i++) {
            let m = a[i]
            while (this.priorities.length < i + 1) {
                this.addPriorityBefore(null)
            }
            let level = this.priorities[i]
            for (let [recipe, weight] of m) {
                let resource = this.getResource(recipe)
                if (resource === null) {
                    this.addRecipe(recipe, weight, level)
                } else {
                    level.insertSorted(resource)
                }
            }
        }
    }
    /*makeArray() {
        let result = []
        for (let level of this) {
            let levelMap = new Map()
            for (let {recipe, weight} of level) {
                levelMap.set(recipe, weight)
            }
            result.push(levelMap)
        }
        return result
    }*/
    equalArray(a) {
        if (a.length !== this.priorities.length) {
            return false
        }
        for (let i = 0; i < a.length; i++) {
            if (!this.priorities[i].equalMap(a[i])) {
                return false
            }
        }
        return true
    }
    // Creates a new priority level before `level`, or at the end when it is null.
    addPriorityBefore(level) {
        let newLevel = new PriorityLevel(this)
        let i = level === null ? this.priorities.length : this.priorities.indexOf(level)
        this.priorities.splice(i, 0, newLevel)
        return newLevel
    }
    getFirstLevel() {
        if (this.priorities.length === 0) {
            return null
        }
        return this.priorities[0]
    }
    getLastLevel() {
        if (this.priorities.length === 0) {
            return null
        }
        return this.priorities[this.priorities.length - 1]
    }
    addRecipe(recipe, weight, level) {
        let resource = new Resource(recipe, weight)
        level.insertSorted(resource)
    }
    getResource(recipe) {
        for (let level of this.priorities) {
            for (let resource of level.resources) {
                if (resource.recipe === recipe) {
                    return resource
                }
            }
        }
        return null
    }
    getWeight(recipe) {
        return this.getResource(recipe).weight
    }
    removeRecipe(recipe) {
        let resource = this.getResource(recipe)
        // No Resource exists for an item ignored via the fragment (or any
        // other path that adds straight to spec.ignore without going
        // through addRecipe); un-ignoring it then is a no-op here.
        if (resource === null) {
            return
        }
        resource.remove()
    }
    removeEmptyLevels() {
        this.priorities = this.priorities.filter(level => !level.isEmpty())
    }
}
