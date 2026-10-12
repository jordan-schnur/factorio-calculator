import { saveLabel } from "./savesettings-core.js"

let saves = $state.raw(null)
let selected = $state("")
let status = $state("")
let note = $state("")

// What the top bar's save picker, status and page note show; savesettings.js writes it after each fetch.
export const saveUi = {
    get saves() { return saves },
    get selected() { return selected },
    get status() { return status },
    get note() { return note },
}

export function showSaves(fetched) {
    saves = fetched.saves
    selected = fetched.save ? fetched.save.name : ""
    status = saveLabel(fetched.save)
    note = ""
}

export function showSaveError(text) {
    note = text
}
