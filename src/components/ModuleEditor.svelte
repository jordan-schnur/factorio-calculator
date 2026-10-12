<script>
    import { untrack } from "svelte"
    import MeBeacons from "./MeBeacons.svelte"
    import MeCompare from "./MeCompare.svelte"
    import MeEffects from "./MeEffects.svelte"
    import MeHead from "./MeHead.svelte"
    import MePalette from "./MePalette.svelte"
    import MeScope from "./MeScope.svelte"
    import MeSlots from "./MeSlots.svelte"
    import { currentEntry, currentTarget, rememberTarget, selectedSlot } from "../lib/modules-editor.svelte.js"
    import { plan } from "../lib/plan.svelte.js"

    let { opts } = $props()

    untrack(() => rememberTarget(plan.spec, opts))

    let live = $derived(plan.spec !== null && (opts.scope === "machine" || plan.totals?.rates.has(opts.recipe) === true))
    let target = $derived(live ? currentTarget(plan.spec, opts) : null)
    let entry = $derived(live ? currentEntry(plan.spec, opts, target) : null)
    let disp = $derived(live && opts.scope === "row" ? currentEntry(plan.spec, opts, "row") : entry)
    let sel = $derived(live ? selectedSlot(opts, target) : null)
</script>

<div class="modeditor" data-scope={opts.scope}>{#if live}<MeHead {opts} /><div class="me-body"><div class="me-col"><MeSlots {opts} entry={disp} {target} {sel} /><MeBeacons {opts} {entry} {disp} {target} {sel} /><MePalette {opts} {target} {sel} /></div><div class="me-col"><MeEffects {opts} entry={disp} />{#if opts.scope === "row"}<MeCompare {opts} entry={disp} /><MeScope {opts} {target} {sel} />{/if}</div></div>{/if}</div>
