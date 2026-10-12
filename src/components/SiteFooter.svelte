<script>
    import { VERSION } from "../lib/version.js"
    import { FEEDBACK_BASE, feedbackUrl } from "../lib/feedback-core.js"

    function setLiveHref(event) {
        event.currentTarget.href = feedbackUrl(location.href, VERSION)
    }
</script>

<footer id="site-footer">
    <span>Factorio Calculator <a class="calc-version" href="changelog.html" title="What's new">v{VERSION}</a></span>
    <a href="changelog.html">Changelog</a>
    <a id="feedback-link" href={FEEDBACK_BASE} target="_blank" rel="noopener" onclick={setLiveHref} onauxclick={setLiveHref}>Feedback</a>
    <span>Made by <a href="https://jordanschnur.com/">Jordan Schnur</a></span>
    <span>Built on <a href="https://kirkmcdonald.github.io/calc.html">Kirk McDonald's calculator</a> (Apache-2.0)</span>
    <button type="button" id="analytics-settings" hidden>Analytics settings</button>
</footer>
