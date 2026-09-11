// calc/supplied.js — the calc:toggle-supplied handler. Rendering of what's
// supplied lives in ledger.js/bringin.js now (Task 4 of the graph-first
// plan); this module only flips the solver's ignore set.
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
