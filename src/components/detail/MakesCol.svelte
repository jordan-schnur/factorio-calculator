<script>
    import DetailRow from "./DetailRow.svelte"

    let { makes } = $props()
</script>

<div class="col goesto makes">
    <span class="lbl">Makes</span>
    {#each makes as out (out)}
        <DetailRow class="out-head" icon={out.item} name={out.item.name} text={out.text} />
        {#each out.links as link (link)}<DetailRow class="out-to" icon={link.icon} name={link.name} share={link.share} text={link.text} card={link.card} />{/each}
        {#if out.note}<span class={["muted", out.note.class]}>{out.note.text}</span>{/if}
    {/each}
</div>
