<script>
    import OverrideTag from "./OverrideTag.svelte"
    let { label, narrow = false, id, hidden, tag, children } = $props()
</script>

<div class={["kv", { narrow }]} {id} {hidden}><span class="muted label">{label}</span>{@render children()}{#if tag}<OverrideTag field={tag} />{/if}</div>
