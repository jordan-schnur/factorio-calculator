// {@attach cssVars({ "--name": value })} sets CSS custom properties a stylesheet reads, for sizes known only at run time.
export function cssVars(vars) {
    return node => {
        for (let [name, value] of Object.entries(vars)) node.style.setProperty(name, value)
    }
}
