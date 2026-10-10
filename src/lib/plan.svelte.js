let current = $state.raw({ spec: null, totals: null })

export const plan = {
    get spec() { return current.spec },
    get totals() { return current.totals },
    get planned() { return current.spec?.buildTargets.length > 0 },
}

export function renderPlan(spec, totals) {
    current = { spec, totals }
}

export function refresh() {
    current = { ...current }
}
