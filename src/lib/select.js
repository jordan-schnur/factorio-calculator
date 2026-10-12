import { spec } from "./factory.js"

// Opens `key`'s details (null closes them): writes item= to the hash, then tells every view via calc:select.
export function selectItem(key) {
    spec.whereItem = key
    spec.setHash()
    document.dispatchEvent(new CustomEvent("calc:select", { detail: { item: key } }))
}
