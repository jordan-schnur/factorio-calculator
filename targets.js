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
        let { navigateToHash } = await import("./init.js")
        navigateToHash(hash)
    })
}

function renderTargets(spec) {
    let empty = document.getElementById("factory-empty")
    let hasTargets = spec.buildTargets.length > 0
    let notes = document.getElementById("target-notes")
    notes.replaceChildren()
    for (let note of spec.targetNotes) {
        let line = document.createElement("div")
        line.textContent = note
        notes.appendChild(line)
    }
    notes.hidden = spec.targetNotes.length === 0
    empty.hidden = hasTargets
    // calc.html gives #factory-empty an inline `display: flex`, which beats
    // the UA [hidden] rule; toggle it explicitly too.
    empty.style.display = hasTargets ? "none" : "flex"
    if (hasTargets) {
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
