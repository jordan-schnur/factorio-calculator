// calc/tablelayout.js — the Display setting "Layout": spread across the page
// (the default) or packed to the left, so on a wide screen the item name
// isn't a screen-width away from its rate, and the graph's columns sit
// together on the left (flow.js's tightGraph()). Remembered in this browser
// (localStorage, not the page link), like colorblind.js: it is a reading
// preference, and a shared plan shouldn't change how its reader's table looks.
// Applied as a class on <html> that calc.css narrows #item-table with.

const KEY = "calc.tablePacked"

export function tablePacked() {
    try {
        return localStorage.getItem(KEY) === "1"
    } catch (e) {
        return false
    }
}

export function setTablePacked(on) {
    try {
        if (on) {
            localStorage.setItem(KEY, "1")
        } else {
            localStorage.removeItem(KEY)
        }
    } catch (e) {
        // private window / blocked storage: still applies for this visit
    }
    applyTableLayout(on)
}

export function applyTableLayout(on = tablePacked()) {
    document.documentElement.classList.toggle("table-packed", on)
    // flow.js redraws the graph tight or spread to match.
    document.dispatchEvent(new CustomEvent("calc:layout"))
    let input = document.getElementById(on ? "packed_table" : "spread_table")
    if (input) {
        input.checked = true
    }
}
