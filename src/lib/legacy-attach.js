// {@attach legacyNode(() => node)} appends what a legacy DOM builder made (a node, an array or null) and removes it on teardown.
export function legacyNode(make, prepend = false) {
    return host => {
        const nodes = [make()].flat().filter(Boolean)
        if (prepend) host.prepend(...nodes)
        else host.append(...nodes)
        return () => nodes.forEach(node => node.remove())
    }
}
