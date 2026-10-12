// Fails when src/lib touches the page outside ALLOW, or imports d3 anywhere but the zoom module: components own the DOM.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(import.meta.dirname, "..")
const DOM = /document\.|d3\.select|createElement|innerHTML|addEventListener/
const D3 = /from "d3"/
const D3_HOME = "src/lib/graph-view.svelte.js"
const ALLOW = [
    ["src/lib/analytics.svelte.js", "", "Google Analytics: consent banner and gtag loader sit outside the app root, public host only"],
    ["src/lib/colorblind.js", "document.documentElement.classList", "the colour-blind class lives on <html>"],
    ["src/lib/hosting.js", "document.documentElement.dataset", "data-companion lives on <html>"],
    ["src/lib/icon.js", 'document.createElement("img")', "Icon.make, the one sprite engine iconOf draws through (C2)"],
    ["src/lib/icon.js", "document.baseURI", "the sprite sheet URL resolves against the page"],
    ["src/lib/byproducts.svelte.js", 'document.getElementById("byproducts")', "a backs-up marker scrolls to the Byproducts bar"],
    ["src/lib/legacy-mount.js", "document.createElement", "a spare host span a component mounts into for a legacy DOM builder (mountNode/mountInto)"],
    ["src/lib/select.js", "document.dispatchEvent", "calc:select tells every view (and the legacy modules that still listen) that the open item changed"],
    ["*", "document.title", "the page title lives in <head>"],
    ["*", "document.activeElement", "reads focus, changes nothing"],
]

const walk = path => statSync(path).isDirectory() ? readdirSync(path).flatMap(name => walk(join(path, name))) : [path]
const failures = []
for (const path of walk(join(ROOT, "src"))) {
    const file = relative(ROOT, path).replaceAll("\\", "/")
    if (!/\.(js|svelte)$/.test(file)) continue
    readFileSync(path, "utf8").split("\n").forEach((line, i) => {
        if (D3.test(line) && file !== D3_HOME) failures.push(`${file}:${i + 1}: d3 outside ${D3_HOME}: ${line.trim()}`)
        if (!file.startsWith("src/lib/") || !DOM.test(line)) return
        if (!ALLOW.some(([where, text]) => (where === "*" || where === file) && line.includes(text))) failures.push(`${file}:${i + 1}: ${line.trim()}`)
    })
}
for (const failure of failures) console.log(`✘ ${failure}`)
if (failures.length) {
    console.log(`\nDOM boundary check failed (${failures.length}): move page work into a component, or add a reasoned ALLOW entry.`)
    process.exit(1)
}
console.log("✓ DOM boundary check passed")
