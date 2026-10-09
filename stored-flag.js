// SPDX-License-Identifier: Apache-2.0 · Copyright 2026 Jordan Schnur
// An on/off Display setting kept in this browser's localStorage (never the link), mirrored on its checkbox.

export function storedFlag(key, boxId, onApply = () => {}) {
    let current = null
    let on = () => {
        if (current === null) {
            try {
                current = localStorage.getItem(key) === "1"
            } catch (e) {
                current = false
            }
        }
        return current
    }
    let apply = () => {
        let box = document.getElementById(boxId)
        if (box) {
            box.checked = on()
        }
        onApply(on())
    }
    let set = value => {
        current = value
        try {
            if (value) {
                localStorage.setItem(key, "1")
            } else {
                localStorage.removeItem(key)
            }
        } catch (e) {
            // private window / blocked storage: still applies for this visit
        }
        apply()
    }
    return { on, set, apply }
}
