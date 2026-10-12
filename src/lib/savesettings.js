// Fetches C5 (GET /api/calc/spec?save=) and merges its non-overridden fields into the fragment; the merge itself is savesettings-core.js.
import { navigateToHash } from "./init.js"
import { loadSettings } from "./fragment.js"
import { spec } from "./factory.js"
import { companion } from "./hosting.js"
import { showSaveError, showSaves } from "./save-ui.svelte.js"
import { mergeFragment, serialize, signatureOf } from "./savesettings-core.js"

const FOLLOW_INTERVAL_MS = 5 * 60 * 1000

// Set while a fetch is in flight, so a picker change and the follow timer never race each other's reload.
let fetching = false

// Signature and override key of the payload last applied; module-level because reloadFromHash() rebuilds `spec`.
let appliedSignature = null
let appliedOverrides = ""

export function pickSave(name) {
    spec.saveState.save = name
    spec.saveState.follow = true
    spec.setHash()
    appliedSignature = null
    applyFromServer()
}

export function markOverride(field) {
    spec.saveState.overrides.add(field)
    spec.setHash()
}

export function clearOverrides() {
    spec.saveState.overrides.clear()
    spec.setHash()
    appliedSignature = null
    applyFromServer()
}

async function applyFromServer() {
    if (fetching || spec.saveState.save === null) {
        return
    }
    fetching = true
    try {
        let response
        try {
            response = await fetch("/api/calc/spec?save=" + encodeURIComponent(spec.saveState.save ?? ""))
        } catch (err) {
            showSaveError("Save settings unavailable: " + err.message)
            return
        }
        if (!response.ok) {
            showSaveError("Save settings unavailable: " + response.status)
            return
        }
        let fetched = await response.json()
        showSaves(fetched)

        // Compare a payload fingerprint, not fragment text: the fragment canonicalises, so text would differ on every poll.
        let sig = signatureOf(fetched)
        let ovKey = [...spec.saveState.overrides].sort().join(",")
        if (sig === appliedSignature && ovKey === appliedOverrides) {
            spec.saveState.fetched = fetched
            return
        }

        let merged = mergeFragment(loadSettings(location.hash), fetched, spec.saveState.overrides)
        // Encoded as fragment.js's formatSettings() writes it, so a save name with "&" or "=" can't corrupt the hash.
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
        // Rebuilds `spec`, so anything set on it must come after.
        navigateToHash("#" + serialize(merged))

        appliedSignature = sig
        appliedOverrides = ovKey
        spec.saveState.fetched = fetched
    } finally {
        fetching = false
    }
}

// Called once by init.js after the first solve, with the boot-time fragment Map.
export async function applySaveSettings(settings) {
    if (!(await companion())) {
        return
    }
    if (!settings.has("save") && !settings.has("follow") && !settings.has("items")) {
        spec.saveState = { save: "", follow: true, overrides: new Set() }
        // Written now, or the first merge would read a hash without save=/follow= and reset this fresh-open follow.
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
