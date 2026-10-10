// Hard rules from .claude/rules/code-quality.md: one-line comments, <= 3 classes per element, <= 3 copies of a block.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { extname, join, relative } from "node:path"
import { parse } from "svelte/compiler"

const ROOT = join(import.meta.dirname, "..")
const SCAN = ["src", "scripts", "tests/e2e", "calc.html", "vite.config.mjs", "playwright.config.ts"]
const SKIP = ["tests/e2e/__snapshots__", "tests/e2e/fixtures"]
const EXTS = new Set([".js", ".mjs", ".ts", ".svelte", ".html"])
const BASELINE = join(ROOT, "scripts/rules-baseline.json")
const MIN_LINES = 6
const MAX_COPIES = 3
const MAX_CLASSES = 3

const args = new Set(process.argv.slice(2))

function walk(path) {
    let rel = relative(ROOT, path)
    if (SKIP.some(s => rel.startsWith(s))) return []
    if (statSync(path).isDirectory()) return readdirSync(path).flatMap(name => walk(join(path, name)))
    return EXTS.has(extname(path)) ? [rel] : []
}

const COMMENT_LINE = /^(\/\/|\/\*.*\*\/$|<!--.*-->$)/
const EXEMPT_COMMENT = /svelte-ignore|SPDX-License-Identifier|eslint-disable/

function longComments(lines) {
    let found = []
    let run = 0
    for (let [i, raw] of lines.entries()) {
        let line = raw.trim()
        let opensBlock = (line.startsWith("/*") && !line.includes("*/")) || (line.startsWith("<!--") && !line.includes("-->"))
        if (opensBlock) found.push(i + 1)
        run = COMMENT_LINE.test(line) && !EXEMPT_COMMENT.test(line) ? run + 1 : 0
        if (run === 2) found.push(i)
    }
    return found
}

function literalClasses(node) {
    if (!node) return 0
    if (node.type === "Literal" && typeof node.value === "string") return node.value.split(/\s+/).filter(Boolean).length
    if (node.type === "ArrayExpression") return node.elements.reduce((n, el) => n + literalClasses(el), 0)
    if (node.type === "ObjectExpression") return node.properties.length
    if (node.type === "LogicalExpression") return literalClasses(node.right)
    if (node.type === "ConditionalExpression") return Math.max(literalClasses(node.consequent), literalClasses(node.alternate))
    return 0
}

function classCount(attributes) {
    let n = 0
    for (let attr of attributes) {
        if (attr.type === "ClassDirective") n++
        if (attr.type !== "Attribute" || attr.name !== "class" || attr.value === true) continue
        for (let part of [attr.value].flat()) {
            n += part.type === "Text" ? part.data.split(/\s+/).filter(Boolean).length : literalClasses(part.expression)
        }
    }
    return n
}

function crowdedElements(file, source) {
    if (file.endsWith(".html")) {
        return [...source.matchAll(/class="([^"]*)"/g)]
            .filter(m => m[1].split(/\s+/).filter(Boolean).length > MAX_CLASSES)
            .map(m => source.slice(0, m.index).split("\n").length)
    }
    if (!file.endsWith(".svelte")) return []
    let found = []
    let visit = node => {
        if (!node || typeof node !== "object") return
        if (Array.isArray(node)) return node.forEach(visit)
        if (node.attributes && classCount(node.attributes) > MAX_CLASSES) found.push(source.slice(0, node.start).split("\n").length)
        for (let [key, value] of Object.entries(node)) if (key !== "parent") visit(value)
    }
    visit(parse(source, { modern: true }).fragment)
    return found
}

const TRIVIAL = /^([\])}>;,]*|import .*|export \{.*|<\/?(script|style)>|<\/[\w-]+>|else|try|\} (else|catch).*\{)$/

function significantLines(lines) {
    let out = []
    let inBlock = false
    for (let [i, raw] of lines.entries()) {
        let line = raw.trim().replace(/\s+/g, " ")
        if (inBlock) {
            inBlock = !line.includes("*/") && !line.includes("-->")
            continue
        }
        if (line.startsWith("/*") || line.startsWith("<!--")) {
            inBlock = !line.includes("*/") && !line.includes("-->")
            continue
        }
        if (line.startsWith("//") || TRIVIAL.test(line)) continue
        out.push({ line, at: i + 1 })
    }
    return out
}

function clones(files) {
    let windows = new Map()
    for (let [file, sig] of files) {
        for (let i = 0; i + MIN_LINES <= sig.length; i++) {
            let slice = sig.slice(i, i + MIN_LINES)
            let key = slice.map(s => s.line).join("\n")
            if (key.length < 120) continue
            let list = windows.get(key) ?? []
            let last = list.findLast(o => o.file === file)
            if (!last || i - last.i >= MIN_LINES) list.push({ file, i, from: slice[0].at, to: slice.at(-1).at })
            windows.set(key, list)
        }
    }
    let covered = new Map()
    let groups = []
    let ordered = [...windows.values()].filter(list => list.length > 1).sort((a, b) => a[0].file.localeCompare(b[0].file) || a[0].i - b[0].i)
    for (let list of ordered) {
        let previous = list.map(o => covered.get(`${o.file}:${o.i - 1}`))
        let group = previous.every(g => g && g === previous[0] && g.copies.length === list.length) ? previous[0] : null
        if (group) group.copies.forEach((copy, k) => (copy.to = list[k].to))
        else groups.push((group = { copies: list.map(o => ({ file: o.file, from: o.from, to: o.to })) }))
        list.forEach(o => covered.set(`${o.file}:${o.i}`, group))
    }
    return groups
}

let files = SCAN.flatMap(p => walk(join(ROOT, p))).sort()
let sources = new Map(files.map(f => [f, readFileSync(join(ROOT, f), "utf8")]))
let current = { comments: {}, classes: {}, clones: {} }
let report = { comments: [], classes: [], clones: [], near: [] }

for (let [file, source] of sources) {
    let lines = source.split("\n")
    for (let line of longComments(lines)) report.comments.push(`${file}:${line}`)
    for (let line of crowdedElements(file, source)) report.classes.push(`${file}:${line}`)
}
for (let group of clones([...sources].map(([f, s]) => [f, significantLines(s.split("\n"))]))) {
    let where = group.copies.map(c => `${c.file}:${c.from}-${c.to}`).join("  ")
    if (group.copies.length > MAX_COPIES) {
        report.clones.push(`${group.copies.length} copies: ${where}`)
        for (let file of new Set(group.copies.map(c => c.file))) current.clones[file] = (current.clones[file] ?? 0) + 1
    } else {
        report.near.push(`${group.copies.length} copies: ${where}`)
    }
}
for (let rule of ["comments", "classes"]) {
    for (let at of report[rule]) {
        let file = at.slice(0, at.lastIndexOf(":"))
        current[rule][file] = (current[rule][file] ?? 0) + 1
    }
}

let baseline = JSON.parse(readFileSync(BASELINE, "utf8"))
let failures = []
let lowered = []
for (let rule of Object.keys(current)) {
    for (let [file, count] of Object.entries(current[rule])) {
        let allowed = baseline[rule]?.[file] ?? 0
        if (count > allowed) failures.push({ rule, file, count, allowed })
    }
    for (let [file, allowed] of Object.entries(baseline[rule] ?? {})) {
        let count = current[rule][file] ?? 0
        if (count < allowed) lowered.push({ rule, file, count, allowed })
    }
}

const TITLES = {
    comments: "Comments longer than one line",
    classes: `Elements with more than ${MAX_CLASSES} classes (make a component with variant props)`,
    clones: `Blocks repeated more than ${MAX_COPIES} times (extract a component or function)`,
}

if (args.has("--print-current")) {
    console.log(JSON.stringify(current, null, 2))
    process.exit(0)
}

if (args.has("--update-baseline")) {
    for (let { rule, file, count } of lowered) {
        if (count === 0) delete baseline[rule][file]
        else baseline[rule][file] = count
    }
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + "\n")
    console.log(`Baseline lowered for ${lowered.length} entries; it never rises.`)
    process.exit(0)
}

for (let { rule, file, count, allowed } of failures) {
    console.log(`\n✘ ${TITLES[rule]}: ${file} has ${count}, allowed ${allowed}`)
    for (let at of report[rule].filter(r => r.includes(file))) console.log(`    ${at}`)
}
if (report.near.length) {
    console.log(`\n⚠ ${report.near.length} duplicated blocks (2-${MAX_COPIES} copies; aim for none):`)
    for (let line of args.has("--verbose") ? report.near : report.near.slice(0, 15)) console.log(`    ${line}`)
    if (!args.has("--verbose") && report.near.length > 15) console.log("    ... run with --verbose for all")
}
if (lowered.length) console.log(`\n↓ ${lowered.length} baseline entries can be lowered: npm run rules -- --update-baseline`)
if (failures.length) {
    console.log(`\nRules check failed (${failures.length}). Fix the code; the baseline only ever goes down.`)
    process.exit(1)
}
console.log(`\n✓ Rules check passed: ${files.length} files.`)
