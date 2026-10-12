<script>
    import { showByproducts } from "../lib/byproducts.svelte.js"
    import { hoverOn } from "../lib/graph.svelte.js"
    import { iconOf, iconOnto } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { selectItem } from "../lib/select.js"
    import { inlineStyle } from "../lib/style-attach.js"
    import BacksUpMarker from "./BacksUpMarker.svelte"
    import BeaconBadge from "./BeaconBadge.svelte"
    import GraphSink from "./GraphSink.svelte"
    import ModuleStrip from "./ModuleStrip.svelte"
    import QualityIcon from "./QualityIcon.svelte"

    let { node, face, focus } = $props()

    let card = $derived(face.card ?? null)
    let sink = $derived(face.sink ?? null)
    let answer = $derived(focus?.answers.get(node.id) ?? null)
    let selected = $derived(node.itemKey !== null && node.itemKey === plan.spec.whereItem)
    let classes = $derived([
        "node",
        node.kind === "input" && "in",
        node.kind === "target" && "tgt",
        selected && "sel",
        card?.hand && "hand",
        card?.modules && "has-mods",
        sink && "sink",
        sink && (sink.out ? "out" : "left"),
        focus?.lit?.nodes.has(node.id) && "lit",
        answer && "answering",
    ])
    let box = $derived({ left: `${node.x}px`, top: `${node.y}px`, width: `${node.w}px`, height: `${node.h}px` })

    function click(event) {
        if (sink) {
            if (!sink.out) showByproducts()
        } else if (!event.defaultPrevented && node.itemKey !== null) {
            selectItem(selected ? null : node.itemKey)
        }
    }
</script>

<div class={classes} data-node={node.id} data-item={node.itemKey} {@attach inlineStyle(box)} {@attach hoverOn({ card: node.id })}><button type="button" class="nbody" onclick={click}>{#if sink}<GraphSink {sink} label={node.label} />{:else}<span class="slot slot-sm" {@attach iconOf(card.icon, 20, true)}></span><span class="mid"><span class="name">{card.title}</span><span class={["sub", "num", answer && "answer"]}>{#if answer}<img alt="" {@attach iconOnto(answer.building, 16)}><span>{answer.words}</span>{:else if card.machine}<QualityIcon thing={card.machine.building} size={16} tier={card.machine.tier} badge={9} />{card.machine.text}{/if}</span>{#if card.modules}<span class="mods"><ModuleStrip modules={card.modules.modules} size={16} tiers={card.modules.moduleTiers} /><BeaconBadge beacon={plan.spec.items.get("beacon")} beaconModules={card.modules.beaconModules} beaconCount={card.modules.beaconCount} size={14} withModules={false} tiers={card.modules.beaconModuleTiers} beaconTier={card.modules.beaconTier} /></span>{/if}</span><span class={["right", card.outputs && "outs"]}>{#if card.outputs}<span class="out-icons">{#each card.outputs as item (item.key)}<img alt="" {@attach iconOnto(item, 14)}>{/each}</span>{#if card.outputCount}<span class="rate num">{card.outputCount}</span>{/if}{:else}<span class="rate num">{card.rate}</span>{/if}{#if card.stalled}<BacksUpMarker size={12} />{/if}</span>{/if}</button></div>
