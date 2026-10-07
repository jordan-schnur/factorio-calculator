// calc/hosting.js — is the Factorio companion's local server behind this
// page (save sync, the board, the item catalog), or is this the static copy
// (GitHub Pages)? Probed once with GET /api/catalog, whose answer the search
// box needs anyway. Until it answers, <html> has no data-companion and
// calc.css keeps every .needs-companion element hidden, so the static copy
// never shows save or board controls it can't use.

let probe = null

// Resolves to the catalog payload ({entries}) when the companion answered,
// or null when there is none.
export function companion() {
    if (!probe) {
        probe = fetch("/api/catalog")
            .then(resp => resp.ok ? resp.json() : null)
            .then(data => (data && Array.isArray(data.entries)) ? data : null)
            .catch(() => null)
            .then(data => {
                document.documentElement.dataset.companion = data ? "yes" : "no"
                return data
            })
    }
    return probe
}
