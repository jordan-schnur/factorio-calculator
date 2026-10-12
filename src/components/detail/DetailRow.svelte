<script>
    import { iconOf } from "../../lib/icon-attach.js"
    import Badge from "../Badge.svelte"
    import FlowNum from "./FlowNum.svelte"

    let { icon, name, badge = null, share = null, text, card = null, class: extra = null } = $props()
</script>

<div class={["drow", extra]}><span class="slot xs" {@attach iconOf(icon, 18, true)}></span><span class="grow">{name}</span>{#if badge}<Badge kind={badge.kind} text={badge.text} />{:else if share}<span class="share num">{share}</span>{/if}<FlowNum {text} {card} /></div>
