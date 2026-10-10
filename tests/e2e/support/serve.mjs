// Serves the built site (dist/) as GitHub Pages would: node tests/e2e/support/serve.mjs <port> <host> <root>
import { createServer } from "node:http"
import { createReadStream, statSync } from "node:fs"
import { extname, join, normalize, resolve } from "node:path"

const PORT = Number(process.argv[2] || 4173)
const HOST = process.argv[3] || "127.0.0.1"
const ROOT = resolve(import.meta.dirname, "..", "..", "..", process.argv[4] || "dist")

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
    ".wasm": "application/wasm",
}

createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname)
    let file = normalize(join(ROOT, path))
    if (!file.startsWith(ROOT)) {
        res.writeHead(403).end()
        return
    }
    let stat
    try {
        stat = statSync(file)
        if (stat.isDirectory()) {
            file = join(file, "index.html")
            stat = statSync(file)
        }
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found")
        return
    }
    res.writeHead(200, {
        "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
    })
    if (req.method === "HEAD") {
        res.end()
        return
    }
    createReadStream(file).pipe(res)
}).listen({ port: PORT, host: HOST, backlog: 1024 }, () => {
    console.log(`serving ${ROOT} on http://${HOST}:${PORT}`)
})
