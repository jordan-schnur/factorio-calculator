// calc/intro-bg-core.js — what the landing screen's background shows: which
// screenshots, in what order, and in which style. intro-bg.js does the DOM.
// Pure, so node can test it (tests/js/calc_intro_bg_check.mjs).

// Screenshots of real plans, 1600x900, in images/bg/.
export const SHOTS = [
    "blue-science", "yellow-science", "purple-science", "rocket-fuel", "lds",
    "rocket-parts", "em-science", "blue-chips", "military-science",
]

export function shotUrl(name) {
    return `images/bg/${name}.webp`
}

// blur: one shot, blurred and dimmed. collage: a tilted wall of them.
// drift: one shot, light blur, slowly panning. slideshow: crossfades through
// them all. sharp: one shot, unblurred, dimmed hard. none: plain panel.
export const STYLES = ["blur", "collage", "drift", "slideshow", "sharp", "none"]
export const DEFAULT_STYLE = "blur"

// ?bg=<style> previews another style; anything else gets the default.
export function pickStyle(search) {
    let value = new URLSearchParams(search || "").get("bg")
    return STYLES.includes(value) ? value : DEFAULT_STYLE
}

// A shuffled copy (Fisher-Yates); `random` is injectable for tests.
export function shuffle(list, random = Math.random) {
    let out = list.slice()
    for (let i = out.length - 1; i > 0; i--) {
        let j = Math.floor(random() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

// How many shots each style shows at once.
export function shotCount(style) {
    if (style === "none") return 0
    if (style === "collage") return 16
    if (style === "slideshow") return SHOTS.length
    return 1
}

// `shotCount(style)` names in random order; the collage's 4x4 wall repeats
// the shuffled list rather than leaving holes.
export function pickShots(style, random = Math.random) {
    let order = shuffle(SHOTS, random)
    return Array.from({ length: shotCount(style) }, (_, i) => order[i % order.length])
}
