// SPDX-License-Identifier: Apache-2.0 · Copyright 2021 Kirk McDonald
import * as d3 from "d3"

import { spec } from "./factory.js"
import { tooltip } from "./tooltip.svelte.js"
import { tooltipFor } from "./tooltips.js"
import { badgeUrl, tierOf } from "./colorblind-core.js"
import { spriteCrop } from "./sprite-core.js"

export { PX_WIDTH, PX_HEIGHT } from "./sprite-core.js"

/*export function setSheetHash(h) {
    sheetHash = h
}*/

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
    /*path() {
        return "images/" + this.name + ".png"
    }*/
    // A new <img>, `size` px square (unset: CSS sizes it), with obj's tooltip beside `target` (default: the img) unless suppressed.
    make(size, suppressTooltip, target) {
        let img = d3.select(makeEmptyIcon(size))
            .classed("icon", true)
        let sheet = `url(${new URL(`images/sprite-sheet-${sheetHash}.png`, document.baseURI)})`
        // In percent of the box, so the crop holds when CSS shows the icon
        // at a size other than `size` (sprite-core.js).
        let crop = spriteCrop(this.obj.icon_col, this.obj.icon_row, sheetWidth, sheetHeight)
        // A belt-family or inserter icon hands its sprite to calc.css as
        // variables instead of inline background, so html.colorblind can
        // layer its colour word over it (colorblind-core.js).
        let tier = tierOf(this.obj.key)
        if (tier) {
            img.attr("data-tier", tier)
                .style("--sprite", sheet)
                .style("--sprite-size", crop.size)
                .style("--sprite-pos", crop.position)
                .style("--tier-badge", badgeUrl(tier, size !== null && size !== undefined && size < 24))
        } else {
            img.style("background", sheet)
            img.style("background-size", crop.size)
            img.style("background-position", crop.position)
        }
        let component = suppressTooltip ? null : tooltipFor(this.obj)
        if (component) {
            tooltip(component, { thing: this.obj }, target)(img.node())
        } else {
            img.attr("title", this.obj.name)
        }
        img.attr("alt", this.name)
        return img.node()
    }
}

// XXX: Not actually used, but here for reference if I decide to go with it.
export class ResourceIcon {
    constructor(recipe) {
        this.recipe = recipe
    }
    make(size) {
        let product = this.recipe.products[0].item
        let building = spec.getBuilding(this.recipe)
        if (building === null) {
            return d3.select(product.icon.make(size))
                .attr("title", this.recipe.name + " (extraction)")
                .node()
        }
        let container = d3.create("div")
            .classed("icon-container", true)
        container.append(() => product.icon.make(size))
            .attr("title", this.recipe.name + " (extraction)")
        container.append("img")
            .classed("icon-overlay", true)
            .attr("width", size/2)
            .attr("height", size/2)
            .attr("src", spec.getBuilding(this.recipe).icon.path())
            .attr("title", this.recipe.name + " (extraction)")
        return container.node()
    }
}

export function makeEmptyIcon(size) {
    let img = d3.create("img")
        .classed("icon", true)
        // Chrome wants the <img> element to have a src attribute, or it will
        // draw a border around it. Cram in this transparent 1x1 pixel image.
        .attr("src", "images/pixel.gif")
    if (size) {
        img.attr("width", size)
            .attr("height", size)
    }
    return img.node()
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
