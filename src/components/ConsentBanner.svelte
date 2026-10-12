<script>
    import Button from "./Button.svelte"
    import { analytics, answer } from "../lib/analytics.svelte.js"
</script>

{#if analytics.banner !== null}
    <div id="consent-banner" class="frame" role="dialog" aria-label="Analytics consent" hidden={!analytics.banner}><span>Can this site count your visit with Google Analytics? It sets cookies; your plans stay in your browser.</span><Button data-choice="granted" onclick={() => answer("granted")}>Allow</Button><Button data-choice="denied" onclick={() => answer("denied")}>No thanks</Button></div>
{/if}
