<script>
    import { untrack } from "svelte"
    import Button from "./Button.svelte"
    import { buildFeedbackPayload, CONTACT_LIMIT, MESSAGE_LIMIT, submitFeedback } from "../lib/feedback-core.js"
    import { closeFeedback, feedback } from "../lib/feedback.svelte.js"
    import { VERSION } from "../lib/version.js"

    let message = $state("")
    let contact = $state("")
    let website = $state("")
    let status = $state("idle")
    let issue = $state(null)

    let remaining = $derived(MESSAGE_LIMIT - message.length)
    let canSend = $derived(status !== "sending" && message.trim().length > 0)
    let copyStatus = $state("")

    function reset() {
        message = ""
        contact = ""
        website = ""
        status = "idle"
        issue = null
        copyStatus = ""
    }

    function focusClose(node) {
        node.focus()
    }

    // untrack status/node.open: this must only rerun on open/closed flips, not on every status change (else reset() fires the instant send() succeeds).
    function dialogSync(open) {
        return node => {
            if (open) {
                if (untrack(() => status) === "success") reset()
                if (!node.open) node.showModal()
            } else if (node.open) {
                node.close()
            }
        }
    }

    async function send() {
        status = "sending"
        const payload = buildFeedbackPayload({ message, contact, website, planUrl: location.href, version: VERSION })
        const result = await submitFeedback(payload)
        if (result.ok) {
            issue = result
            status = "success"
        } else {
            status = "error"
        }
    }

    async function copyMessage() {
        try {
            await navigator.clipboard.writeText(message)
            copyStatus = "Copied"
        } catch {
            copyStatus = "Couldn't copy"
        }
    }
</script>

<dialog id="feedback-dialog" class="frame" aria-labelledby="feedback-heading" {@attach dialogSync(feedback.open)} onclose={closeFeedback}>
    <div class="titlebar"><span class="title" id="feedback-heading">Send feedback</span></div>
    {#if status === "success"}
        {#if issue.number}
            <p id="feedback-thanks" role="status">Thanks, filed as <a href={issue.url} target="_blank" rel="noopener">#{issue.number}</a></p>
        {:else}
            <p id="feedback-thanks" role="status">Thanks!</p>
        {/if}
        <div class="feedback-actions"><Button type="button" onclick={closeFeedback} {@attach focusClose}>Close</Button></div>
    {:else}
        <label for="feedback-message">What happened, or what would you like?</label>
        <textarea id="feedback-message" maxlength={MESSAGE_LIMIT} required bind:value={message}></textarea>
        <span class="muted feedback-remaining">{remaining} left</span>
        <label for="feedback-contact">How can I reach you? (optional)</label>
        <input id="feedback-contact" type="text" maxlength={CONTACT_LIMIT} bind:value={contact} />
        <input class="feedback-honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={website} />
        {#if status === "error"}
            <p class="feedback-error" role="alert">Couldn't send it. Please try again.</p>
            <Button type="button" size="sm" onclick={copyMessage}>Copy message</Button>
            {#if copyStatus}<span class="muted feedback-copy-status" role="status">{copyStatus}</span>{/if}
        {/if}
        <div class="feedback-actions">
            <Button type="button" disabled={!canSend} onclick={send}>Send</Button>
            <Button type="button" onclick={closeFeedback}>Cancel</Button>
        </div>
    {/if}
</dialog>

<style>
    #feedback-dialog { width: min(480px, 92vw); max-width: 92vw; box-sizing: border-box; padding: 14px; border: none; color: var(--text); }
    #feedback-dialog[open] { display: flex; flex-direction: column; gap: 8px; }
    #feedback-dialog label { font-weight: 700; }
    #feedback-dialog textarea { resize: vertical; min-height: 120px; font: inherit; box-sizing: border-box; background: var(--input-bg); color: var(--text); border: none; box-shadow: inset 0 2px 3px rgba(0,0,0,0.8), inset 0 -1px 0 #454545; padding: 6px 8px; }
    #feedback-dialog input[type="text"] { font: inherit; box-sizing: border-box; }
    #feedback-dialog textarea:focus-visible, #feedback-dialog input[type="text"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .feedback-remaining { align-self: flex-end; font-size: 12px; }
    .feedback-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
    .feedback-error { color: #e05a5a; }
    .feedback-actions { display: flex; gap: 8px; justify-content: flex-end; }
    :global(#feedback-dialog::backdrop) { background: rgba(0, 0, 0, 0.55); }
</style>
