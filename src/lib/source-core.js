// calc/source-core.js — pure helpers behind the card source chooser
// (source.js): which recipes are worth offering for an item, and how much of
// the item each in-use recipe contributes. Node-testable; no DOM, no spec.

// `candidates`: [{key, order, recycling, net, allowed}] describing every
// recipe that lists the item as a product. Keeps the net producers the
// selected planets allow, minus recycling, sorted by recipe order.
export function relevantCandidates(candidates) {
    return candidates
        .filter(c => !c.recycling && c.net && c.allowed)
        .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
}

export function isRecycling(key) {
    return key.endsWith("-recycling")
}

// Share (0..1) of `total` that `part` is; 0 when there is no total.
export function shareOf(part, total) {
    if (!(total > 0)) return 0
    return part / total
}

// "60%" for a share, "<1%" for a real-but-tiny one, "" for zero.
export function shareText(share) {
    if (!(share > 0)) return ""
    let percent = share * 100
    if (percent < 1) return "<1%"
    return Math.round(percent) + "%"
}
