// calc/targets.js — the empty-state panel, example chips and "Restore last"
// link around ul#targets. BuildTarget itself (the target rows) lives in
// target.js; the search box and browse grid live in search.js.
import { spec } from "./factory.js"
import { Rational } from "./rational.js"
import { registerRenderer } from "./render.js"

function addTargetAtPerMinute(itemKey, perMinute) {
    let target = spec.addTarget(itemKey)
    target.setRate(Rational.from_float(perMinute).div(Rational.from_float(60)))
    spec.updateSolution()
}

function wireExampleChips() {
    for (let chip of document.querySelectorAll("#factory-empty .example-target")) {
        chip.addEventListener("click", () => {
            addTargetAtPerMinute(chip.dataset.item, Number(chip.dataset.rate))
        })
    }
}

function wireRestoreLast() {
    let link = document.getElementById("restore-last")
    if (!link) {
        return
    }
    link.addEventListener("click", async () => {
        let hash = localStorage.getItem("calc.lastHash")
        if (!hash) {
            return
        }
        location.hash = hash
        let { reloadFromHash } = await import("./init.js")
        reloadFromHash()
    })
}

function renderTargets(spec) {
    let empty = document.getElementById("factory-empty")
    empty.hidden = spec.buildTargets.length > 0
    if (spec.buildTargets.length > 0) {
        try {
            localStorage.setItem("calc.lastHash", location.hash)
        } catch (err) {
            // Private browsing / storage disabled: losing "restore last" is
            // harmless, so swallow it rather than break rendering.
        }
    }
}

export function initTargets() {
    wireExampleChips()
    wireRestoreLast()
    registerRenderer(renderTargets)
}
