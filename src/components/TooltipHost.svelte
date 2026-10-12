<script>
    import { createPopper } from "@popperjs/core"
    import { hideTip, tip } from "../lib/tooltip.svelte.js"

    let Tip = $derived(tip.current?.component)

    // Popper beside the target; the tip clears the moment its anchor leaves the page.
    function place(shown) {
        return node => {
            const popper = createPopper(shown.target, node, { placement: "right", modifiers: [{ name: "offset", options: { offset: [0, 20] } }] })
            const gone = new MutationObserver(() => { if (!shown.anchor.isConnected) hideTip(shown.anchor) })
            gone.observe(document.body, { childList: true, subtree: true })
            return () => {
                gone.disconnect()
                popper.destroy()
            }
        }
    }
</script>

<div id="tooltip_container">{#if tip.current}{#key tip.current}<div class="tooltip" {@attach place(tip.current)}><Tip {...tip.current.props} /></div>{/key}{/if}</div>
