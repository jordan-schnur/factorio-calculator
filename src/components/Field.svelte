<script>
    let { label, width = 110, lbl = false, id, children } = $props()
</script>

<div class="kv" {id}><span class="muted" class:lbl style="width: {width}px;">{label}</span>{@render children()}</div>
