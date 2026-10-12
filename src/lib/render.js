// The seam between the solver and the UI: factory.js calls renderAll() after every solve; a renderer that throws never stops the rest.

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
