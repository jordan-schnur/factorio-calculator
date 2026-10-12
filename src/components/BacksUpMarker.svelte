<script>
    import { showByproducts } from "../lib/byproducts.svelte.js"

    let { size } = $props()

    function jump(event) {
        event.stopPropagation()
        event.preventDefault()
        showByproducts()
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<span class="bp-marker" title="Something it makes has nowhere to go: see the fixes above" onclick={jump}><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5"></path></svg>backs up</span>
