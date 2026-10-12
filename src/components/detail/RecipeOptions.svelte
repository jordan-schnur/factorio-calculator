<script>
    import { iconOf } from "../../lib/icon-attach.js"
    import { useOnly } from "../../lib/source.js"
    import Badge from "../Badge.svelte"

    let { item, options } = $props()

    function pick(event, option) {
        event.stopPropagation()
        useOnly(item, option.recipe)
    }
</script>

{#each options as o (o.key)}<button type="button" class={["opt", { cur: o.inUse }]} data-option={o.key} onclick={event => pick(event, o)}><span class="mark">{o.inUse ? "●" : "○"}</span><span class="slot slot-sm" {@attach iconOf(o.thing, 24, true)}></span><span class="grow"><span class="oname">{o.name}</span>{o.locked ? " " : ""}{#if o.locked}<Badge kind="locked" text="not researched" />{/if}<span class="oline muted num">{o.line}</span></span><span class="ocount num">{o.countText + (o.shareText ? ` · ${o.shareText}` : "")}<span class="muted">{o.exactText}</span></span></button>{/each}
