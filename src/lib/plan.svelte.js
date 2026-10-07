let current = $state.raw({ spec: null, totals: null })

export const plan = {
    get spec() { return current.spec },
    get totals() { return current.totals },
}

export function renderPlan(spec, totals) {
    current = { spec, totals }
}
