// calc/modules-editor.js — the module editor. A stub until the editor
// lands: it mounts the empty root other modules rely on.
//
// mountModuleEditor(container, opts) empties `container`, appends
// div.modeditor[data-scope=<opts.scope>] and returns it.
//   opts.scope:   "row" (a row's details) or "machine" (Settings' By machine)
//   opts.machine: the Building
//   opts.recipe:  the Recipe (scope "row" only)
//   opts.row:     {recipeRate, itemRate, item} (scope "row" only)
export function mountModuleEditor(container, opts) {
    container.textContent = ""
    let root = document.createElement("div")
    root.className = "modeditor"
    root.dataset.scope = opts.scope
    container.appendChild(root)
    return root
}
