<script>
    import Button from "./Button.svelte"
    import Field from "./Field.svelte"
    import { fromSave } from "../lib/fromsave-core.js"
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { pickSave } from "../lib/savesettings.js"

    let view = $derived(plan.spec ? fromSave(plan.spec) : null)

    function setFollow(on) {
        plan.spec.saveState.follow = on
        plan.spec.setHash()
        plan.spec.display()
    }

    function followKey(event) {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        setFollow(!plan.spec.saveState.follow)
    }

    function reread() {
        pickSave(plan.spec.saveState.save ?? "")
    }
</script>

{#if view}
    <Field label="Save" narrow><span class="save-name">{view.saveLabel}</span></Field>
    <Field label="Follow" narrow><span class="check follow" role="button" tabindex="0" onclick={() => setFollow(!plan.spec.saveState.follow)} onkeydown={followKey}>{view.follow ? "✓" : ""}</span><span>Re-read the newest save every few minutes</span></Field>
    {#if !view.fetched}<div class="muted none">No save read yet.</div>{:else}<div class="sec">What it set</div>{#each view.sets as row (row.label)}<Field label={row.label} narrow>{#if row.thing}<span class="slot slot-sm" {@attach iconOf(row.thing, 20, true)}></span><span>{row.thing.name}</span>{:else}<span class="muted">unknown</span>{/if}{#if row.extra}<span class="muted extra">{row.extra}</span>{/if}</Field>{/each}<Field label="Planet" narrow><span>{view.planet}</span></Field><Field label="Recipes" narrow><span>{view.recipes}</span></Field><Field label="Quality" narrow><span>{view.quality}</span></Field>{/if}
    <div class="kv actions"><Button size="sm" onclick={reread}>Re-read now</Button><Button size="sm" onclick={() => setFollow(false)}>Stop following</Button><span class="muted note">Overrides on the right win over these.</span></div>
{/if}

<style>
    .save-name { background: #1c1c1c; padding: 4px 10px; font-weight: 600; flex: 1; }
    .follow { cursor: pointer; }
    .none { padding: 6px 2px; }
    .extra { margin-left: auto; font-size: 13px; }
    .actions { padding-top: 8px; gap: 8px; }
    .note { font-size: 13px; }
</style>
