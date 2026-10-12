<script>
    import { onMount } from "svelte"
    import { pickShots, pickStyle, shotUrl } from "../lib/intro-bg-core.js"

    let { intro } = $props()

    const SLIDE_MS = 7000

    let style = $state("")
    let tiles = $state.raw([])
    let ready = $state(false)
    let shown = $state(0)

    const paint = url => node => {
        node.style.backgroundImage = `url("${url}")`
    }

    // Picked in the browser (random order, ?bg=), so the prerendered page has no background at all.
    onMount(() => {
        style = pickStyle(location.search)
        tiles = pickShots(style).map(name => ({ url: shotUrl(name) }))
        if (tiles.length === 0) return
        const first = new Image()
        first.onload = () => (ready = true)
        first.src = tiles[0].url
        if (style !== "slideshow" || matchMedia("(prefers-reduced-motion: reduce)").matches) return
        const timer = setInterval(() => {
            if (intro && !document.hidden) shown = (shown + 1) % tiles.length
        }, SLIDE_MS)
        return () => clearInterval(timer)
    })
</script>

{#if tiles.length > 0}
    <div id="intro-bg" class={[`bg-${style}`, { ready }]} aria-hidden="true"><div class="wall">{#each tiles as tile, i (tile)}<div class={["shot", { on: style === "slideshow" && i === shown }]} {@attach ready && paint(tile.url)}></div>{/each}</div></div>
{/if}
