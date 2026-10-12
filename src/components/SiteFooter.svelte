<script>
    import { analytics, showBanner } from "../lib/analytics.svelte.js"
    import { VERSION } from "../lib/version.js"
    import { FEEDBACK_BASE, FEEDBACK_ENDPOINT, feedbackUrl } from "../lib/feedback-core.js"
    import { openFeedback } from "../lib/feedback.svelte.js"
    import FeedbackDialog from "./FeedbackDialog.svelte"

    function setLiveHref(event) {
        event.currentTarget.href = feedbackUrl(location.href, VERSION)
    }
</script>

<footer id="site-footer">
    <span>Factorio Calculator <a class="calc-version" href="changelog.html" title="What's new">v{VERSION}</a></span>
    <a href="changelog.html">Changelog</a>
    {#if FEEDBACK_ENDPOINT}
        <button type="button" id="feedback-link" onclick={openFeedback}>Feedback</button>
        <FeedbackDialog />
    {:else}
        <a id="feedback-link" href={FEEDBACK_BASE} target="_blank" rel="noopener" onclick={setLiveHref} onauxclick={setLiveHref}>Feedback</a>
    {/if}
    <span>Made by <a href="https://jordanschnur.com/">Jordan Schnur</a></span>
    <span>Built on <a href="https://kirkmcdonald.github.io/calc.html">Kirk McDonald's calculator</a> (Apache-2.0)</span>
    <button type="button" id="analytics-settings" hidden={!analytics.settingsShown} onclick={showBanner}>Analytics settings</button>
</footer>

<style>
    #feedback-link { background: none; border: 0; margin: 0; padding: 0; font: inherit; text-decoration: underline; cursor: pointer; color: var(--muted); }
    #feedback-link:hover { color: var(--text); }
</style>
