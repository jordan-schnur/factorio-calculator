<script>
    import DetailRow from "./DetailRow.svelte"

    let { kind, label, col } = $props()
</script>

<div class={["col", kind]}>
    <span class="lbl">{label}</span>
    {#if col.empty}<span class="muted">{col.empty}</span>{/if}
    {#each col.lines as line (line)}
        <DetailRow icon={line.icon} name={line.name} badge={line.badge} share={line.share} text={line.text} card={line.card} />
        {#if line.ratio}<span class="muted ratio">{line.ratio}</span>{/if}
    {/each}
</div>
