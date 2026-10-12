<script>
    import BeaconBadge from "./BeaconBadge.svelte"
    import Button from "./Button.svelte"
    import Field from "./Field.svelte"
    import ModuleStrip from "./ModuleStrip.svelte"
    import Seg from "./Seg.svelte"
    import TierPicker from "./TierPicker.svelte"
    import { iconOnto } from "../lib/icon-attach.js"
    import { moduleFor, planFromStrategy, strategyOf, summarySentence, withKind } from "../lib/modules-core.js"
    import { fellBackNames } from "../lib/modules-ui-core.js"
    import { plan } from "../lib/plan.svelte.js"
    import { tierOf } from "../lib/quality-core.js"

    const MAX_BEACONS = 16
    const KINDS = [["none", "None"], ["productivity", "Productivity"], ["speed", "Speed"], ["efficiency", "Efficiency"]]
    const FALLBACKS = [["speed", "Speed"], ["efficiency", "Efficiency"], ["none", "Leave empty"]]
    const BEACONS = [["none", "None"], ["speed", "Speed"], ["efficiency", "Efficiency"]]
    const MODULE_TIERS = [1, 2, 3]

    let layer = $derived(plan.spec.planLayer())
    let s = $derived(strategyOf(layer))
    let iconKind = $derived(s.kind === "none" ? "productivity" : s.kind)
    let fellBack = $derived(s.kind === "productivity" ? fellBackNames(plan.spec, plan.totals) : [])
    let fixed = $derived(s.beacon === "none" || s.beacon === "mixed")
    let shown = $derived(s.beacon === "none" ? 0 : s.beaconCount)
    let linked = $derived([[layer.defaultModule, layer.defaultModuleTier], [layer.secondaryDefaultModule, layer.secondaryDefaultModuleTier]].filter(([module]) => module))

    function apply(strategy) {
        plan.spec.commitModules(() => plan.spec.setPlanLayer(planFromStrategy(strategy, plan.spec.modules.values())))
    }

    function step(delta) {
        apply({ ...s, beaconCount: Math.max(0, Math.min(MAX_BEACONS, s.beaconCount + delta)) })
    }

    function pickBeacon(beacon) {
        apply({ ...s, beacon, beaconCount: beacon !== "none" && s.beaconCount === 0 ? 8 : s.beaconCount })
    }

    function setModuleTier(tier) {
        plan.spec.commitModules(() => plan.spec.setPlanModuleTier(tier.key))
    }

    function setBeaconTier(tier) {
        plan.spec.commitModules(() => plan.spec.setDefaultBeaconTier(tier.key))
    }
</script>

<div class="ms-group ms-strategy">
    <Field label="In every machine"><Seg tag="span" id="ms-kind" items={KINDS} key={k => k[0]} selected={k => k[0] === s.kind} onpick={k => apply(withKind(s, k[0]))} attrs={k => ({ "data-value": k[0] })}>{#snippet children(k)}{k[1]}{/snippet}</Seg></Field>
    <Field label="Tier"><Seg tag="span" id="ms-tier" items={MODULE_TIERS} selected={t => t === s.tier} onpick={t => apply({ ...s, tier: t })} attrs={t => ({ "data-value": String(t) })}>{#snippet children(t)}{@const module = moduleFor(plan.spec.modules.values(), iconKind, t)}{#if module}<img alt="" {@attach iconOnto(module, 20)}>{/if}{` ${t}`}{/snippet}</Seg></Field>
    <Field label="Module quality"><TierPicker id="ms-mtier" tier={tierOf(layer.defaultModuleTier)} label="Module quality" onpick={setModuleTier} /></Field>
    {#if s.kind === "productivity"}
        <Field label="If a recipe can't take productivity"><Seg tag="span" id="ms-fallback" items={FALLBACKS} key={f => f[0]} selected={f => f[0] === s.fallback} onpick={f => apply({ ...s, fallback: f[0] })} attrs={f => ({ "data-value": f[0] })}>{#snippet children(f)}{f[1]}{/snippet}</Seg></Field>
        {#if fellBack.length > 0}<div class="muted ms-fellback">{`In this plan that's: ${fellBack.join(", ")}`}</div>{/if}
    {/if}
    <Field label="Beacons"><Seg tag="span" id="ms-beacon" items={BEACONS} key={b => b[0]} selected={b => b[0] === s.beacon} onpick={b => pickBeacon(b[0])} attrs={b => ({ "data-value": b[0] })}>{#snippet children(b)}{b[1]}{/snippet}</Seg><Button size="sm" class="ms-minus" disabled={fixed || shown <= 0} onclick={() => step(-1)}>−</Button><span class="num ms-count">{shown}</span><Button size="sm" class="ms-plus" disabled={fixed || shown >= MAX_BEACONS} onclick={() => step(1)}>+</Button><span class="muted">around each machine</span></Field>
    <Field label="Beacon quality"><TierPicker id="ms-btier" tier={tierOf(layer.defaultBeaconTier)} label="Beacon quality" onpick={setBeaconTier} /></Field>
    {#if !s.exact}<Field label="From the link"><span class="ms-real"><ModuleStrip modules={linked.map(([module]) => module)} size={20} tiers={linked.map(([, tier]) => tier)} /><BeaconBadge beacon={plan.spec.items.get("beacon")} beaconModules={layer.defaultBeacon} beaconCount={layer.defaultBeaconCount} size={20} tiers={layer.defaultBeaconTiers} beaconTier={layer.defaultBeaconTier} /></span><span class="muted">Picking any button above replaces these.</span></Field>{/if}
    <div class="ms-summary">{summarySentence(layer)}</div>
</div>
