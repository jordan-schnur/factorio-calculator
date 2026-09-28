// calc/savesettings.js — fetches C5 (`GET /api/calc/spec?save=`), merges the
// non-overridden fields into the fragment, and keeps the picker/status/note
// UI in sync. The pure merge/format logic lives in ./savesettings-core.js.
import { navigateToHash } from "./init.js"
import { loadSettings } from "./fragment.js"
import { spec } from "./factory.js"
import { companion } from "./hosting.js"
import { mergeFragment, serialize, saveLabel, signatureOf } from "./savesettings-core.js"

const FOLLOW_INTERVAL_MS = 5 * 60 * 1000

// Set while a fetch is in flight so a picker change and the follow timer
// can't overlap and race each other's reload.
let fetching = false

// The signature (see savesettings-core.js) and override set of the fetched
// payload last actually applied to the fragment. Module-level, not on
// `spec`: reloadFromHash() rebuilds `spec`, so these two must survive that.
// A poll whose payload/overrides match neither reloads nor reapplies.
let appliedSignature = null
let appliedOverrides = ""

export function initSaveSettings() {
    document.getElementById("save-picker").addEventListener("change", event => {
        spec.saveState.save = event.target.value
        spec.saveState.follow = true
        // Persists save=/follow=1 even when the merge below leaves the
        // fragment's other fields unchanged.
        spec.setHash()
        // Force one apply even if this save's payload matches the one
        // already applied (e.g. switching back to a previously-picked save).
        appliedSignature = null
        applyFromServer()
    })
}

export function markOverride(field) {
    spec.saveState.overrides.add(field)
    spec.setHash()
    // An override never needs a re-apply: it stops a field from being
    // fetched at all, so it can't itself be the reason a payload differs.
}

export function clearOverrides() {
    spec.saveState.overrides.clear()
    spec.setHash()
    // The now-unoverridden fields need re-applying even if the payload
    // itself hasn't changed since the last apply.
    appliedSignature = null
    applyFromServer()
}

async function applyFromServer() {
    if (fetching) {
        return
    }
    // null means "no save opted in" -- never fetched, even on demand
    // (markOverride/clearOverrides/the picker never set it to null, but a
    // fresh call from the follow timer must not treat it as "newest").
    if (spec.saveState.save === null) {
        return
    }
    fetching = true
    try {
        let response
        try {
            response = await fetch("/api/calc/spec?save=" + encodeURIComponent(spec.saveState.save ?? ""))
        } catch (err) {
            document.getElementById("page-note").textContent = "Save settings unavailable: " + err.message
            return
        }
        if (!response.ok) {
            document.getElementById("page-note").textContent = "Save settings unavailable: " + response.status
            return
        }
        let fetched = await response.json()

        let picker = document.getElementById("save-picker")
        picker.innerHTML = ""
        let newest = document.createElement("option")
        newest.value = ""
        newest.textContent = "newest save"
        picker.appendChild(newest)
        for (let s of fetched.saves) {
            let option = document.createElement("option")
            option.value = s.name
            option.textContent = s.name
            picker.appendChild(option)
        }
        picker.value = fetched.save ? fetched.save.name : ""
        document.getElementById("save-status").textContent = saveLabel(fetched.save)
        document.getElementById("page-note").textContent = ""

        // Decide on a fingerprint of the payload, not fragment text: the
        // fragment canonicalises (per building group, dropping recipes
        // already default-disabled), so a payload that IS unchanged can
        // still round-trip to a fragment that looks different, and a text
        // compare would reload on every poll -- see savesettings-core.js.
        let sig = signatureOf(fetched)
        let ovKey = [...spec.saveState.overrides].sort().join(",")
        if (sig === appliedSignature && ovKey === appliedOverrides) {
            spec.saveState.fetched = fetched
            return
        }

        let merged = mergeFragment(loadSettings(location.hash), fetched, spec.saveState.overrides)
        // Belt and braces: the hash should already carry save=/follow=/ov=
        // from a prior spec.setHash() (the picker change handler and
        // applySaveSettings's fresh-open branch both call it), but write
        // them from spec.saveState here too so a merge can never drop them.
        // Encoded like fragment.js's formatSettings() writes it (and
        // init.js's applyPageState decodes it): a save name containing "&"
        // or "=" would otherwise corrupt the hash's own key=value&... syntax.
        merged.set("save", encodeURIComponent(spec.saveState.save))
        if (spec.saveState.follow) {
            merged.set("follow", "1")
        } else {
            merged.delete("follow")
        }
        if (spec.saveState.overrides.size > 0) {
            merged.set("ov", [...spec.saveState.overrides].join(","))
        } else {
            merged.delete("ov")
        }
        // Rebuilds `spec`, so anything read off it below must come after.
        navigateToHash("#" + serialize(merged))

        appliedSignature = sig
        appliedOverrides = ovKey
        // The Settings tab's "what it set" panel reads this.
        spec.saveState.fetched = fetched
    } finally {
        fetching = false
    }
}

// Called once by init.js, after the first solve, with the boot-time
// fragment Map (before any reload this module might trigger).
export async function applySaveSettings(settings) {
    // No companion server (the static copy): there are no saves to follow.
    if (!(await companion())) {
        return
    }
    if (!settings.has("save") && !settings.has("follow") && !settings.has("items")) {
        spec.saveState = { save: "", follow: true, overrides: new Set() }
        // Persists save=/follow=1 into the fragment immediately: without
        // this, the first applyFromServer() below merges from a hash that
        // still has neither key, and reloadFromHash() would reset saveState
        // right back to {save: null, follow: false} -- silently dropping
        // the fresh-open follow before the timer ever gets to use it.
        spec.setHash()
    }
    if (spec.saveState.save !== null) {
        await applyFromServer()
    }
    setInterval(() => {
        if (!spec.saveState.follow || spec.saveState.save === null) {
            return
        }
        let active = document.activeElement
        if (active && active.closest && (active.closest("#make-panel") || active.closest("#target-search-results"))) {
            return
        }
        applyFromServer()
    }, FOLLOW_INTERVAL_MS)
}
