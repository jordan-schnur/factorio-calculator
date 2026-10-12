<script module>
    import { tierOf } from "../lib/colorblind-core.js"
    import { iconOnto } from "../lib/icon-attach.js"

    export { iconWord }
</script>

<script>
    let { rows } = $props()
</script>

{#snippet iconWord(thing, size)}<img alt="" {@attach iconOnto(thing, size)}>{#if tierOf(thing.key)}<span class="tier-word">{tierOf(thing.key)}</span>{/if}{/snippet}
{#snippet icon(thing)}<img alt="" {@attach iconOnto(thing, 18)}>{/snippet}

{#each rows as row (row)}{#if row.kind === "rate"}<div class="chip-row">{@render iconWord(row.item, 18)}<span>{row.rate}</span><span class="sep">|</span>{#if row.via}{@render iconWord(row.via, 18)}{/if}<span>{row.amount}</span></div>{:else if row.kind === "ratio"}<div class="chip-row machines">{@render icon(row.from)}<span>{row.fromCount}</span><span>→</span>{@render icon(row.to)}<span>{row.toCount}</span><span class="sep">|</span><span>{row.ratio}</span></div>{:else if row.kind === "words"}<div class="chip-row machines">{@render icon(row.building)}<span>{row.words}</span></div>{:else if row.kind === "belt"}<div class="chip-row machines">{@render iconWord(row.belt, 18)}<span>1 belt:</span>{#if row.from}{@render icon(row.from.building)}<span>{row.from.count}</span>{/if}{#if row.from && row.to}<span>→</span>{/if}{#if row.to}{@render icon(row.to.building)}<span>{row.to.count}</span>{/if}</div>{:else if row.kind === "holdsHead"}<div class="chip-row holds">{@render iconWord(row.belt, 18)}<span>{row.words}</span></div>{:else}<div class="chip-row machines holds">{@render icon(row.building)}<span>{row.lead}</span><span class="holds-count">{row.count}</span><span>{row.words}</span>{#if row.exact}<span class="holds-exact">{` ${row.exact}`}</span>{/if}</div>{/if}{/each}
