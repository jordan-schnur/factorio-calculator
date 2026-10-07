export function iconOf(obj, size, suppressTooltip = false) {
    return node => {
        let img = obj.icon.make(size, suppressTooltip)
        node.prepend(img)
        return () => img.remove()
    }
}
