import { inflateRawSync, deflateRawSync } from "node:zlib"

// The plan lives in the URL fragment: `key=value&key=value`, and when that
// is longer than its compressed form, `zip=<base64 of raw deflate>`. These
// helpers read and write it in Node so tests never lean on the page's own
// decoder (or its pako global).

export type Fragment = Map<string, string>

// "#zip=..." or "zip=..." or "items=..." -> the decoded key=value string.
export function decodeFragment(hash: string): string {
    let raw = hash.startsWith("#") ? hash.slice(1) : hash
    let zip = raw.split("&").find(p => p.startsWith("zip="))
    if (zip) {
        let bytes = Buffer.from(zip.slice(4), "base64")
        return inflateRawSync(bytes).toString("latin1")
    }
    return raw
}

export function parseFragment(hash: string): Fragment {
    let map: Fragment = new Map()
    for (let pair of decodeFragment(hash).split("&")) {
        let i = pair.indexOf("=")
        if (i === -1) continue
        map.set(pair.slice(0, i), pair.slice(i + 1))
    }
    return map
}

// The same compression the page applies, for building long links in tests.
export function zipFragment(settings: string): string {
    return "zip=" + deflateRawSync(Buffer.from(settings, "latin1")).toString("base64")
}

// A stable, order-independent rendering for comparing two fragments.
export function canonical(hash: string): Record<string, string> {
    return Object.fromEntries([...parseFragment(hash)].sort(([a], [b]) => a.localeCompare(b)))
}
