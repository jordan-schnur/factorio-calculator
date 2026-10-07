// Svelte action: fills the node with a game icon from icon.js (`use:icon={[thing.icon, size]}`).
export function icon(node, [source, size]) {
    if (source) node.appendChild(source.make(size, true))
}
