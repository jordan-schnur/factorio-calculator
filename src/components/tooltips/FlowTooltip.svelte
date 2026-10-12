<script>
    let { heading, lines } = $props()
</script>

<div class="frame flow-card"><h3>{heading}</h3>{#each lines as line (line)}<div class={line.class}>{line.text}</div>{/each}</div>
