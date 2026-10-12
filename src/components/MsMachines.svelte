<script>
    import Button from "./Button.svelte"
    import ModuleEditor from "./ModuleEditor.svelte"
    import ModuleStrip from "./ModuleStrip.svelte"
    import QualityBadge from "./QualityBadge.svelte"
    import { iconOf } from "../lib/icon-attach.js"
    import { machineRows } from "../lib/modules-ui-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { isNormal } from "../lib/quality-core.js"

    let openMachine = $state(null)
    let rows = $derived(machineRows(plan.spec, plan.totals))

    function toggle(key) {
        openMachine = openMachine === key ? null : key
    }

    function usePlan(key) {
        plan.spec.commitModules(() => plan.spec.setMachineModules(key, null))
    }
</script>

<div class="ms-group ms-machines"><div class="ms-head">By machine</div>{#if rows.length === 0}<div class="muted">No machine in this plan takes modules.</div>{/if}{#each rows as row (row.machine.key)}<div class="ms-row" data-machine={row.machine.key}><span class={["slot sm", { qwrap: !isNormal(row.tier) }]} {@attach iconOf(row.machine, 24, true)}><QualityBadge tier={row.tier} size={12} /></span><span class="ms-text"><span class="ms-name">{row.machine.name}</span><span class="muted">{` ${row.machine.moduleSlots} slot${row.machine.moduleSlots === 1 ? "" : "s"}`}</span></span><ModuleStrip modules={row.modules} size={20} tiers={row.tiers} />{#if row.beacons > 0}<span class="muted">{`+ ${row.beacons} beacon${row.beacons === 1 ? "" : "s"}`}</span>{/if}{#if row.hand.length > 0}<span class="muted ms-hand">{`${row.hand.length} recipe${row.hand.length === 1 ? "" : "s"} set by hand: ${row.hand.join(", ")}`}</span>{/if}<span class="ms-actions"><Button size="sm" class="ms-change" onclick={() => toggle(row.machine.key)}>{openMachine === row.machine.key ? "Close" : "Change"}</Button>{#if row.own}<Button size="sm" class="ms-useplan" onclick={() => usePlan(row.machine.key)}>Use plan</Button>{/if}</span></div>{#if openMachine === row.machine.key}<div class="ms-editor"><ModuleEditor opts={{ scope: "machine", machine: row.machine }} /></div>{/if}{/each}</div>
