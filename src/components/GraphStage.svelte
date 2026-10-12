<script>
    import { stageLabel } from "../lib/graph-core.js"
    import { inlineStyle } from "../lib/style-attach.js"

    let { column, last, height } = $props()

    let box = $derived({ left: `${column.x}px`, width: `${column.w}px`, height: `${height}px` })
</script>

<div class="stage" {@attach inlineStyle(box)}><div class="stage-label">{stageLabel(column.rank, last)}</div><div class="stage-sub">{column.kinds.join(", ")}</div></div>
