// calc/savesettings.js — fetches C5 (`GET /api/calc/spec?save=`), merges the
// non-overridden fields into the fragment, and keeps the picker/status/note
// UI in sync. The pure merge/format logic lives in ./savesettings-core.js.
import { reloadFromHash } from "./init.js"
import { loadSettings } from "./fragment.js"
import { spec } from "./factory.js"
import { mergeFragment, serialize, saveLabel } from "./savesettings-core.js"

const FOLLOW_INTERVAL_MS = 5 * 60 * 1000

// Set while a fetch is in flight so a picker change and the follow timer
// can't overlap and race each other's reload.
let fetching = false

export function initSaveSettings() {
    document.getElementById("save-picker").addEventListener("change", event => {
        spec.saveState.save = event.target.value
        spec.saveState.follow = true
        applyFromServer()
    })
}

export function markOverride(field) {
    spec.saveState.overrides.add(field)
    spec.setHash()
}

export function clearOverrides() {
    spec.saveState.overrides.clear()
    applyFromServer()
}

async function applyFromServer() {
    if (fetching) {
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

        let current = loadSettings(location.hash)
        let merged = mergeFragment(current, fetched, spec.saveState.overrides)
        if (serialize(merged) !== serialize(current)) {
            location.hash = "#" + serialize(merged)
            // Rebuilds `spec`, so anything read off it below must come after.
            reloadFromHash()
        }
        // The Settings tab's "what it set" panel reads this.
        spec.saveState.fetched = fetched
    } finally {
        fetching = false
    }
}

// Called once by init.js, after the first solve, with the boot-time
// fragment Map (before any reload this module might trigger).
export async function applySaveSettings(settings) {
    if (!settings.has("save") && !settings.has("follow") && !settings.has("items")) {
        spec.saveState = { save: "", follow: true, overrides: new Set() }
    }
    if (spec.saveState.save !== null) {
        await applyFromServer()
    }
    setInterval(() => {
        if (!spec.saveState.follow) {
            return
        }
        let active = document.activeElement
        if (active && active.closest && active.closest("#targets-frame")) {
            return
        }
        applyFromServer()
    }, FOLLOW_INTERVAL_MS)
}
