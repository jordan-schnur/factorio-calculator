// calc/supplied.js — flips an item's supplied/ignore membership on the solver.
import { spec } from "./factory.js"

export function initSupplied() {
    document.addEventListener("calc:toggle-supplied", event => {
        // `items`: every output a multi-output row brings in at once.
        let keys = event.detail.items || [event.detail.item]
        // A target can't be supplied from elsewhere: there would be nothing
        // left to compute. ensureTargetsProducible() would undo it anyway.
        let items = keys.map(k => spec.items.get(k))
            .filter(item => item && !spec.buildTargets.some(t => t.item === item))
        if (items.length === 0) return
        // toggleIgnore alone doesn't re-solve; it only flips membership.
        for (let item of items) spec.toggleIgnore(item)
        spec.updateSolution()
    })
}
