// calc/intro-bg.js — the landing screen's background: screenshots of real
// plans behind "What do you want to make?", in a random order each visit.
// Built as soon as this module runs, so the image is on its way before the
// first paint (a module never holds that paint up); calc.css hides it once
// #make-panel stops being the intro.
import { pickShots, pickStyle, shotUrl } from "./intro-bg-core.js"

const SLIDE_MS = 7000

function build() {
    let panel = document.getElementById("make-panel")
    if (!panel || document.getElementById("intro-bg")) return
    let style = pickStyle(location.search)
    let shots = pickShots(style)
    if (shots.length === 0) return

    let bg = document.createElement("div")
    bg.id = "intro-bg"
    bg.className = `bg-${style}`
    bg.setAttribute("aria-hidden", "true")
    let wall = document.createElement("div")
    wall.className = "wall"
    bg.appendChild(wall)
    let tiles = shots.map(name => {
        let tile = document.createElement("div")
        tile.className = "shot"
        wall.appendChild(tile)
        return { tile, url: shotUrl(name) }
    })
    panel.prepend(bg)

    // Fade in once the first image is ready, rather than painting tiles in
    // one by one as they arrive.
    let first = new Image()
    first.onload = () => {
        for (let { tile, url } of tiles) tile.style.backgroundImage = `url("${url}")`
        bg.classList.add("ready")
    }
    first.src = tiles[0].url

    if (style === "slideshow") {
        let i = 0
        tiles[0].tile.classList.add("on")
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
        setInterval(() => {
            if (!panel.classList.contains("intro") || document.hidden) return
            tiles[i].tile.classList.remove("on")
            i = (i + 1) % tiles.length
            tiles[i].tile.classList.add("on")
        }, SLIDE_MS)
    }
}

build()
