// calc/savesettings-core.js — pure fragment/save bookkeeping for the
// savesettings unit. No DOM, no fetch: savesettings.js wraps these with the
// network call and the page's element ids.

export const FIELDS = ["belt", "buildings", "mprod", "planet", "recipes"]

// fragment.js's formatSettings() OMITS each of these keys when the spec is
// at its engine default rather than writing the default out -- so merging
// a default-valued fetched field must delete the key too, or every poll of
// an ordinary (never-customised) save would see a merged fragment that
// differs from the omit-defaults fragment the page actually wrote, and
// reload forever.
const DEFAULTS = { belt: "transport-belt", buildings: "", mprod: "0", planet: "nauvis" }

function setOrDeleteDefault(map, key, value, defaultValue) {
    if (value === defaultValue) {
        map.delete(key)
    } else {
        map.set(key, value)
    }
}

// Returns a COPY of `settings` in which every field of FIELDS not present in
// `overrides` is replaced by its value from the C5 `fetched` payload (or
// deleted, when that value is the engine default -- see DEFAULTS above).
// `recipes` maps onto two fragment keys: `disable` (the fetched list, or
// deleted when the list is empty) and `enable` (always deleted -- a
// from-save merge has no "re-enable this locked recipe" concept).
export function mergeFragment(settings, fetched, overrides) {
    let out = new Map(settings)
    if (!overrides.has("belt")) {
        setOrDeleteDefault(out, "belt", fetched.belt, DEFAULTS.belt)
    }
    if (!overrides.has("buildings")) {
        let keys = Object.keys(fetched.buildings).sort()
        let buildings = keys.map(k => fetched.buildings[k]).join(",")
        setOrDeleteDefault(out, "buildings", buildings, DEFAULTS.buildings)
    }
    if (!overrides.has("mprod")) {
        setOrDeleteDefault(out, "mprod", String(fetched.mining_productivity), DEFAULTS.mprod)
    }
    if (!overrides.has("planet")) {
        setOrDeleteDefault(out, "planet", fetched.planet, DEFAULTS.planet)
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

// Drops belt/buildings/mprod/planet keys that hold their engine-default
// value, so a fragment that (unusually) spells out a default explicitly
// compares equal to one that omits it -- used to compare a merged fragment
// against the fragment already on the page before deciding to reload.
export function normalizeDefaults(settings) {
    let out = new Map(settings)
    for (let key of Object.keys(DEFAULTS)) {
        if (out.get(key) === DEFAULTS[key]) {
            out.delete(key)
        }
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
