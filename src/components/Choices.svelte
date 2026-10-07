<script>
    import { iconOf } from "../lib/icon-attach.js"
    import { qualityIconUrl } from "../lib/quality-ui.js"

    let { items, variant = "slot", key = item => item.key, label = item => item.name, selected = () => false, off = () => false, onpick } = $props()
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
{#each items as item (key(item))}
    {#if variant === "tier"}
        <button type="button" class:on={selected(item)} data-tier={item.key} title={item.name} aria-label={item.name} aria-pressed={String(selected(item))} onclick={() => onpick(item)}><img src={qualityIconUrl(item.key)} alt="" width="18" height="18"></button>
    {:else if variant === "check" || variant === "dot"}
        <span class="radio" style="cursor: pointer;" data-value={variant === "dot" ? key(item) : undefined} onclick={event => onpick(item, event)}>{#if variant === "check"}<span class="check">{selected(item) ? "✓" : ""}</span> {label(item)}{:else}<span class="dot" class:on={selected(item)}></span>{label(item)}{/if}</span>
    {:else}
        <button type="button" class="slot" class:sel={selected(item)} class:off={off(item)} title={label(item)} onclick={() => onpick(item)} {@attach iconOf(item, 28)}></button>
    {/if}
{/each}
