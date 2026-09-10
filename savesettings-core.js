// calc/savesettings-core.js — pure fragment/save bookkeeping for the
// savesettings unit. No DOM, no fetch: savesettings.js wraps these with the
// network call and the page's element ids.

export const FIELDS = ["belt", "buildings", "mprod", "planet", "recipes"]

// Returns a COPY of `settings` in which every field of FIELDS not present in
// `overrides` is replaced by its value from the C5 `fetched` payload.
// `recipes` maps onto two fragment keys: `disable` (the fetched list, or
// deleted when the list is empty) and `enable` (always deleted -- a
// from-save merge has no "re-enable this locked recipe" concept).
export function mergeFragment(settings, fetched, overrides) {
    let out = new Map(settings)
    if (!overrides.has("belt")) {
        out.set("belt", fetched.belt)
    }
    if (!overrides.has("buildings")) {
        let keys = Object.keys(fetched.buildings).sort()
        out.set("buildings", keys.map(k => fetched.buildings[k]).join(","))
    }
    if (!overrides.has("mprod")) {
        out.set("mprod", String(fetched.mining_productivity))
    }
    if (!overrides.has("planet")) {
        out.set("planet", fetched.planet)
    }
    if (!overrides.has("recipes")) {
        if (fetched.disabled_recipes.length === 0) {
            out.delete("disable")
        } else {
            out.set("disable", fetched.disabled_recipes.join(","))
        }
        out.delete("enable")
    }
    return out
}

// No `zip=` here: the page re-zips (or not) when it next calls
// spec.setHash(); this is only used to compare "did the merge change
// anything" and to build the plain fragment savesettings.js writes.
export function serialize(settings) {
    return [...settings].map(([k, v]) => `${k}=${v}`).join("&")
}

export function saveLabel(save) {
    if (!save) {
        return "no save"
    }
    return `${save.name} · ${save.version ?? "?"} · ${ago(save.mtime)}`
}

export function ago(mtimeSeconds, now = Date.now() / 1000) {
    let m = Math.max(0, Math.round((now - mtimeSeconds) / 60))
    if (m < 1) {
        return "just now"
    }
    if (m < 60) {
        return `${m} min ago`
    }
    return `${Math.round(m / 60)} h ago`
}
