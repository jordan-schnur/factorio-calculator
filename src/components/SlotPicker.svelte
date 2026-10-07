<script>
    import { iconOf } from "../lib/icon-attach.js"

    let { items, key = item => item.key, label = item => item.name, selected = () => false, off = () => false, onpick, note } = $props()
</script>

{#each items as item (key(item))}<button type="button" class="slot" class:sel={selected(item)} class:off={off(item)} title={label(item)} onclick={() => onpick(item)} {@attach iconOf(item, 28)}></button>{/each}
{#if note}<span class="muted aside">{note}</span>{/if}
