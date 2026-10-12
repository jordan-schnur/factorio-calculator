// {@attach inlineStyle({ left: "4px" })}: inline styles only a computation knows (layout geometry, per-item colours); null removes one.
export function inlineStyle(props) {
    return node => {
        for (let [name, value] of Object.entries(props)) {
            if (value === null || value === undefined) node.style.removeProperty(name)
            else node.style.setProperty(name, value)
        }
    }
}
