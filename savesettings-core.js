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

function sortedBuildings(buildings) {
    let out = {}
    for (let key of Object.keys(buildings || {}).sort()) {
        out[key] = buildings[key]
    }
    return out
}

// A cheap "did the save actually change" fingerprint over the C5 payload,
// used instead of comparing fragment text (formatSettings() canonicalises
// per building GROUP and drops already-default-disabled recipes, so a
// fetched payload that round-trips to an unchanged fragment can still
// differ -- e.g. a building at its group default, or a disabled recipe
// that was already locked -- which made a text compare reload forever).
// Order-insensitive over `buildings`' keys and `disabled_recipes`' entries,
// since neither ordering is meaningful. Deliberately blind to the save's
// name and mtime: every autosave is a new file, and one that derives the
// same settings must not rebuild the page (that closed the open row every
// five minutes).
export function signatureOf(fetched) {
    return JSON.stringify({
        belt: fetched.belt,
        buildings: sortedBuildings(fetched.buildings),
        mprod: fetched.mining_productivity,
        planet: fetched.planet,
        disabled: [...(fetched.disabled_recipes || [])].sort(),
    })
}

// No `zip=` here: the page re-zips (or not) when it next calls
// spec.setHash(); this only builds the plain fragment savesettings.js
// writes into location.hash.
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
