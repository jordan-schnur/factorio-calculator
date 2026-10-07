import { readFileSync, rmSync, writeFileSync } from "node:fs"

const { renderApp } = await import("../dist-ssr/render.mjs")
const page = "dist/calc.html"
writeFileSync(page, readFileSync(page, "utf8").replace("<!--app-->", renderApp()))
rmSync("dist-ssr", { recursive: true })
