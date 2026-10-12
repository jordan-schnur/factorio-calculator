import ModuleEditor from "../components/ModuleEditor.svelte"
import { mountInto } from "./legacy-mount.js"

// details.js's row band (and modules-settings.js until M4) draws the editor here; opts: {scope, machine, recipe?, row?}.
export function mountModuleEditor(container, opts) {
    return mountInto(container, ModuleEditor, { opts })
}
