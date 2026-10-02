// calc/supplied.js — flips an item's supplied/ignore membership on the solver.
import { spec } from "./factory.js"

export function initSupplied() {
    document.addEventListener("calc:toggle-supplied", event => {
        let item = spec.items.get(event.detail.item)
        // A target can't be supplied from elsewhere: there would be nothing
        // left to compute. ensureTargetsProducible() would undo it anyway.
        if (item && !spec.buildTargets.some(t => t.item === item)) {
            // toggleIgnore alone doesn't re-solve; it only flips membership.
            spec.toggleIgnore(item)
            spec.updateSolution()
        }
    })
}
