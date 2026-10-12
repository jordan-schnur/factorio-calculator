// Flips the supplied/ignore membership of items (never a target: nothing would be left to compute) and re-solves.
import { spec } from "./factory.js"

export function toggleSupplied(keys) {
    let items = keys.map(k => spec.items.get(k)).filter(item => item && !spec.buildTargets.some(t => t.item === item))
    if (items.length === 0) return
    for (let item of items) spec.toggleIgnore(item)
    spec.updateSolution()
}
