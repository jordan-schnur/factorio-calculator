<script>
    let { title, id, class: extra, deepId, children } = $props()
</script>

<div class={["sec", extra]} {id}>{title}</div>
<div class={["deep", extra]} id={deepId}>{@render children?.()}</div>
