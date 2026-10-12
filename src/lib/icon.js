// SPDX-License-Identifier: Apache-2.0 · Copyright 2021 Kirk McDonald
import { tooltip } from "./tooltip.svelte.js"
import { tooltipFor } from "./tooltips.js"
import { badgeUrl, tierOf } from "./colorblind-core.js"
import { spriteCrop } from "./sprite-core.js"

export { PX_WIDTH, PX_HEIGHT } from "./sprite-core.js"

// The icon of an item, recipe, belt, building or sprite; `name` (default obj.name) is its alt text.
export class Icon {
    constructor(obj, name) {
        if (name === undefined) {
            this.name = obj.name
        } else {
            this.name = name
        }
        this.obj = obj
    }
    // A new <img>, `size` px square (unset: CSS sizes it), with obj's tooltip beside `target` (default: the img) unless suppressed.
    make(size, suppressTooltip, target) {
        let img = makeEmptyIcon(size)
        let sheet = `url(${new URL(`images/sprite-sheet-${sheetHash}.png`, document.baseURI)})`
        // In percent of the box, so the crop holds when CSS shows the icon
        // at a size other than `size` (sprite-core.js).
        let crop = spriteCrop(this.obj.icon_col, this.obj.icon_row, sheetWidth, sheetHeight)
        // A belt-family or inserter icon hands its sprite to calc.css as
        // variables instead of inline background, so html.colorblind can
        // layer its colour word over it (colorblind-core.js).
        let tier = tierOf(this.obj.key)
        if (tier) {
            img.setAttribute("data-tier", tier)
            img.style.setProperty("--sprite", sheet)
            img.style.setProperty("--sprite-size", crop.size)
            img.style.setProperty("--sprite-pos", crop.position)
            img.style.setProperty("--tier-badge", badgeUrl(tier, size !== null && size !== undefined && size < 24))
        } else {
            img.style.setProperty("background", sheet)
            img.style.setProperty("background-size", crop.size)
            img.style.setProperty("background-position", crop.position)
        }
        let component = suppressTooltip ? null : tooltipFor(this.obj)
        if (component) {
            tooltip(component, { thing: this.obj }, target)(img)
        } else {
            img.setAttribute("title", this.obj.name)
        }
        img.setAttribute("alt", this.name)
        return img
    }
}

export function makeEmptyIcon(size) {
    let img = document.createElement("img")
    img.classList.add("icon")
    img.setAttribute("src", "images/pixel.gif")
    if (size) {
        img.setAttribute("width", size)
        img.setAttribute("height", size)
    }
    return img
}

class Sprite {
    constructor(name, col, row) {
        this.name = name
        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
}

export let sprites
export let sheetHash
export let sheetWidth
export let sheetHeight

export function getSprites(data) {
    sheetHash = data.sprites.hash
    sheetWidth = data.sprites.width
    sheetHeight = data.sprites.height
    sprites = new Map()
    for (var name in data.sprites.extra) {
        var d = data.sprites.extra[name]
        sprites.set(name, new Sprite(d.name, d.icon_col, d.icon_row))
    }
}
