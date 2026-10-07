// The one way to touch localStorage: blocked storage reads as the fallback and drops writes.
export function readStore(key, fallback = null) {
    try {
        return localStorage.getItem(key) ?? fallback
    } catch {
        return fallback
    }
}

export function writeStore(key, value) {
    try {
        if (value === null || value === undefined || value === "") localStorage.removeItem(key)
        else localStorage.setItem(key, value)
    } catch {
        // Private window or blocked storage: the value lasts this visit only.
    }
}

export function readList(key) {
    try {
        const list = JSON.parse(readStore(key, "[]"))
        return Array.isArray(list) ? list : []
    } catch {
        return []
    }
}

export function writeList(key, list) {
    writeStore(key, list.length ? JSON.stringify(list) : null)
}
