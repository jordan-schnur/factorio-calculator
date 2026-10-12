import { Icon, sprites } from "./icon.js"

let cached = null

// The game's empty module-slot sprite, titled "Empty slot", in the shape iconOf draws.
export function emptySlot() {
    let sprite = sprites.get("slot_icon_module")
    if (cached?.sprite !== sprite) {
        cached = { sprite, name: "Empty slot", icon: new Icon({ ...sprite, name: "Empty slot" }, sprite.name) }
    }
    return cached
}
