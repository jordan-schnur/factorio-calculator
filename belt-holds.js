// SPDX-License-Identifier: Apache-2.0 · Copyright 2026 Jordan Schnur
// The "one belt holds" setting: remembered per browser (like colour-blind mode), never in the link.

const KEY = "calc.beltholds"

let current = null

export function beltHoldsOn() {
    if (current === null) {
        try {
            current = localStorage.getItem(KEY) === "1"
        } catch (e) {
            current = false
        }
    }
    return current
}

export function setBeltHolds(on) {
    current = on
    try {
        if (on) {
            localStorage.setItem(KEY, "1")
        } else {
            localStorage.removeItem(KEY)
        }
    } catch (e) {
        // private window / blocked storage: still applies for this visit
    }
    applyBeltHolds()
}

export function applyBeltHolds() {
    let box = document.getElementById("belt_holds_toggle")
    if (box) {
        box.checked = beltHoldsOn()
    }
}
