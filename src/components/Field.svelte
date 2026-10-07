<script>
    let { label, width = 110, id, hidden, children } = $props()
</script>

<div class="kv" {id} {hidden}><span class="muted" style="width: {width}px;">{label}</span>{@render children()}</div>
