<script>
    import OverrideTag from "./OverrideTag.svelte"
    let { label, narrow = false, id, hidden, override, children } = $props()
</script>

<div class={["kv", { narrow }]} {id} {hidden}><span class="muted label">{label}</span>{@render children()}{#if override}<OverrideTag field={override} />{/if}</div>
