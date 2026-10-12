import ModuleEditor from "../components/ModuleEditor.svelte"
import { mountInto } from "./legacy-mount.js"

// ModBand.svelte mounts the editor here; opts: {scope, machine, recipe?, row?}.
export function mountModuleEditor(container, opts) {
    return mountInto(container, ModuleEditor, { opts })
}
