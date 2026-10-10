<script>
    let { items, key = item => item, selected = () => false, onpick, attrs = () => ({}), tag = "div", class: extra, children, ...rest } = $props()
</script>

<svelte:element this={tag} class={["seg", extra]} {...rest}>{#each items as item (key(item))}<button type="button" {...attrs(item)} class:on={selected(item)} onclick={() => onpick(item)}>{@render children(item)}</button>{/each}</svelte:element>
