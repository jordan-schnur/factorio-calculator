<script>
    import { iconOf } from "../../lib/icon-attach.js"

    let { thing, title, recipe = false, children } = $props()
</script>

<div class={["frame", { recipe }]}><h3 {@attach iconOf(thing, 32, true)}>{title ?? thing.name}</h3>{@render children?.()}</div>
