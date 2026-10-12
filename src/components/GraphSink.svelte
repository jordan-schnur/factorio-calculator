<script>
    import { iconOf, iconOnto } from "../lib/icon-attach.js"
    import BacksUpMarker from "./BacksUpMarker.svelte"

    let { sink, label } = $props()
</script>

<span class="slot slot-sm" {@attach iconOf(sink.tank, 20, true)}></span><span class="mid"><span class="name">{label}</span><span class="sub">{sink.sub}</span></span><span class="right outs"><span class="out-icons">{#each sink.items as item (item.key)}<img alt="" {@attach iconOnto(item, 14)}>{/each}</span>{#if !sink.out}<BacksUpMarker size={12} />{/if}</span>
