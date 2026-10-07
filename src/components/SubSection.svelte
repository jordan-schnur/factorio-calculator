<script>
    import OverrideTag from "./OverrideTag.svelte"
    let { label, override, children } = $props()
</script>

<details><summary class="kv"><span class="muted label">{label}</span>{#if override}<OverrideTag field={override} />{/if}</summary>{@render children()}</details>
