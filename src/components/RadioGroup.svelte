<script>
    import Radio from "./Radio.svelte"

    let { name, options, value, onchange, br = false } = $props()
</script>

{#each options as option (option.value)}<Radio id={option.id} {name} value={option.value} label={option.label} checked={option.value === value} onchange={() => onchange(option.value)} />{br ? "" : " "}{#if br}<br>{/if}{/each}
