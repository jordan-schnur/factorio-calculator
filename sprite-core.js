// calc/sprite-core.js — where one icon sits on the sprite sheet, as CSS
// background-size/background-position that hold at any displayed size.
// Pure, so node can test it (tests/js/calc_sprite_check.mjs).

export const PX_WIDTH = 32
export const PX_HEIGHT = 32

// The sheet is a grid of PX_WIDTH x PX_HEIGHT cells. Sizing it in percent
// of the icon box (cols x 100%) instead of in pixels for one requested size
// means a stylesheet that shows the <img> at another size (.slot img is
// 28px) still crops exactly one cell, rather than a corner of its neighbours.
export function spriteCrop(col, row, sheetWidth, sheetHeight) {
    let cols = Math.round(sheetWidth / PX_WIDTH)
    let rows = Math.round(sheetHeight / PX_HEIGHT)
    // With the background cols times the box wide, position p% lines up the
    // sheet's p% point with the box's p% point: cell col sits at col/(cols-1).
    let x = cols > 1 ? (col / (cols - 1)) * 100 : 0
    let y = rows > 1 ? (row / (rows - 1)) * 100 : 0
    return {
        size: `${cols * 100}% ${rows * 100}%`,
        position: `${x}% ${y}%`,
    }
}
