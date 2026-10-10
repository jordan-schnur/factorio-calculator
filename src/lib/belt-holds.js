// The "Graph lines" Display setting: line chips say what one belt holds; per browser, never in the link.
import { readStore, writeStore } from "./storage.js"

const KEY = "calc.beltholds"

export function beltHoldsOn() {
    return readStore(KEY) === "1"
}

export function setBeltHolds(on) {
    writeStore(KEY, on ? "1" : null)
}
