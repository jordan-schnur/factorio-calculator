import pako from "pako"
import { cardTitle, parseCalcTargets } from "./boardcore.js"

// Matches the board server's MAX_PLAN_LEN, so an over-long plan is refused here without a round trip.
export const MAX_PLAN_LEN = 4000

export function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function labelMap(catalog) {
    const map = new Map()
    for (const entry of (catalog && catalog.entries) || []) {
        if (entry && entry.name) map.set(entry.name, entry.label || entry.name)
    }
    return item => map.get(item) || item
}

// Undoes fragment.js's zip= (raw deflate + base64); split by hand because form-decoding would corrupt "+" and "=".
export function decodeZipHash(hash) {
    if (!hash) return hash
    const h = hash[0] === "#" ? hash.slice(1) : hash
    let zip = null
    for (const pair of h.split("&")) {
        const i = pair.indexOf("=")
        if (i !== -1 && pair.slice(0, i) === "zip") {
            zip = pair.slice(i + 1)
            break
        }
    }
    if (!zip) return hash
    try {
        const raw = atob(zip)
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
        return "#" + pako.inflateRaw(bytes, { to: "string" })
    } catch (err) {
        console.warn("board: could not decompress the zipped fragment", err)
        return hash
    }
}

export function calcTargets(hash) {
    return parseCalcTargets(decodeZipHash(hash))
}

// The board form's starting state: every rate target checked, the card titled after all targets.
export function boardForm(targets, catalog) {
    const labelFor = labelMap(catalog)
    return {
        title: cardTitle(targets, labelFor),
        column: "backlog",
        checks: targets.filter(t => t.mode === "r").map(t => ({ item: t.item, value: t.value, label: `${t.value}/min ${labelFor(t.item)}`, on: true })),
        result: "",
        added: false,
    }
}

// The POST /api/board/cards body for the checked targets, or the message saying why there is none.
export function cardRequest(form, plan) {
    const checked = form.checks.filter(c => c.on)
    if (checked.length === 0) return { message: "Check at least one target first." }
    if (plan.length > MAX_PLAN_LEN) return { message: "This plan is too long to attach (over 4,000 characters); shrink the factory or add the card by hand." }
    const goals = checked.map(c => ({ type: "rate", item: c.item, target: Number(c.value) }))
    return { body: { title: form.title, column: form.column, icon: checked[0].item, goals, plan } }
}
