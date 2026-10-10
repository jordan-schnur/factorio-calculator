// {@attach iconOf(thing, size)} draws thing.icon through icon.js and removes it on teardown.
export function iconOf(obj, size, suppressTooltip = false) {
    return node => {
        if (!obj) return
        let img = obj.icon.make(size, suppressTooltip)
        node.prepend(img)
        return () => img.remove()
    }
}
