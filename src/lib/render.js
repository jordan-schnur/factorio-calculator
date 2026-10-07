// The one seam between the solver and the UI: factory.js calls renderAll()
// after every solve, and each UI module registers one renderer at boot.
//
// A renderer that throws must not stop the ones registered after it, so a
// failure is logged and swallowed rather than propagated.

const renderers = []

export function registerRenderer(fn) {
    renderers.push(fn)
}

export function renderAll(spec, totals) {
    for (const fn of renderers) {
        try {
            fn(spec, totals)
        } catch (err) {
            console.error("calc renderer failed", err)
        }
    }
}
