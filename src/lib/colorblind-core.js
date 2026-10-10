// calc/colorblind-core.js — the colour-blind mode's tier labels. Belt-family
// and inserter icons differ mostly by colour (yellow, red, blue, green), so
// with the mode on each gets its colour written across the bottom of the
// icon. Pure: no DOM; icon.js and colorblind.js do the rest.

const BELT = /^(?:(fast|express|turbo)-)?(transport-belt|underground-belt|splitter|loader)$/
const BELT_TIER = {undefined: "yellow", fast: "red", express: "blue", turbo: "green"}
const INSERTER_TIER = {
    "inserter": "yellow",
    "long-handed-inserter": "red",
    "fast-inserter": "blue",
    "bulk-inserter": "green",
    "stack-inserter": "white",
}

// The colour word for an item/recipe/belt key, or null when its icon isn't
// one told apart by colour.
export function tierOf(key) {
    let m = BELT.exec(key || "")
    if (m) return BELT_TIER[m[1]]
    return INSERTER_TIER[key] || null
}

// The label layered over the icon as an SVG data URI, drawn in the icon's
// own 32x32 box so it scales with it: the whole word on a dark band at the
// bottom, or just its first letter, larger, for icons drawn under 24px
// where a word would be unreadable.
export function badgeUrl(word, small) {
    let text = small
        ? `<text x='29' y='30' font-size='15' text-anchor='end'>${word[0].toUpperCase()}</text>`
        : `<text x='16' y='30.5' font-size='9.5' text-anchor='middle' textLength='${Math.min(30, word.length * 6)}' lengthAdjust='spacingAndGlyphs'>${word}</text>`
    let band = small ? "<rect x='18' y='17' width='14' height='15' rx='2'/>" : "<rect x='0' y='22' width='32' height='10'/>"
    let svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
        + `<g fill='rgba(0,0,0,0.78)'>${band}</g>`
        + `<g fill='#ffffff' font-family='Arial,sans-serif' font-weight='700'>${text}</g></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
