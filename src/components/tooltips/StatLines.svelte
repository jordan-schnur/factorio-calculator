<script>
    let { stats } = $props()
</script>

{#each stats as stat (stat.label)}<div><b>{stat.label}</b><span>{stat.value}</span></div>{/each}
