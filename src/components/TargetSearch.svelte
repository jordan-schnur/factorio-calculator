<script>
    import { iconOf } from "../lib/icon-attach.js"
    import { plan } from "../lib/plan.svelte.js"
    import { Rational } from "../lib/rational.js"
    import { addTarget } from "../lib/target.js"
    import { parseQuery, datasetEntries, mergeEntries, isSearchable } from "../lib/search-core.js"
    import { rankMatches } from "../lib/boardcore.js"
    import { companion } from "../lib/hosting.js"

    const RESULT_LIMIT = 8

    let entries = []
    let loaded = false
    let catalogPromise = null
    let value = $state("")
    let visibleRows = $state([])
    let highlighted = $state(-1)

    function fetchCatalog() {
        if (!catalogPromise) {
            catalogPromise = companion().then(live => live ? live.entries : fetch("data/catalog.json")
                .then(resp => resp.ok ? resp.json() : { entries: [] })
                .then(data => (data && data.entries) || [])
                .catch(() => []))
        }
        return catalogPromise
    }

    function datasetItemEntries() {
        const out = []
        for (const item of plan.spec.items.values()) {
            if (isSearchable(item)) {
                out.push({ key: item.key, localized_name: { en: item.name } })
            }
        }
        return out
    }

    async function loadEntries() {
        const catalog = await fetchCatalog()
        entries = mergeEntries(catalog, datasetEntries(datasetItemEntries()))
        if (value.trim()) {
            runSearch(value)
        }
    }

    function ensureLoaded() {
        if (!loaded && plan.spec) {
            loaded = true
            loadEntries()
        }
    }

    function closeResults() {
        visibleRows = []
        highlighted = -1
    }

    function runSearch(text) {
        const { query } = parseQuery(text)
        if (!query) {
            closeResults()
            return
        }
        visibleRows = rankMatches(entries, query, null, RESULT_LIMIT)
        highlighted = visibleRows.length ? 0 : -1
    }

    function pick(entry) {
        const { rate, machines } = parseQuery(value)
        if (machines && rate !== null) {
            addTarget(plan.spec, entry.name, { machines: rate })
        } else {
            const perDisplayUnit = rate === null ? 60 : rate
            addTarget(plan.spec, entry.name, { perSecond: Rational.from_float(perDisplayUnit).div(plan.spec.format.rateFactor) })
        }
        value = ""
        closeResults()
    }

    function onKeydown(event) {
        if (event.key === "ArrowDown") {
            if (visibleRows.length) {
                highlighted = (highlighted + 1) % visibleRows.length
            }
            event.preventDefault()
        } else if (event.key === "ArrowUp") {
            if (visibleRows.length) {
                highlighted = (highlighted - 1 + visibleRows.length) % visibleRows.length
            }
            event.preventDefault()
        } else if (event.key === "Enter") {
            if (highlighted >= 0) {
                pick(visibleRows[highlighted])
            } else if (visibleRows.length === 1) {
                pick(visibleRows[0])
            }
            event.preventDefault()
        } else if (event.key === "Escape") {
            closeResults()
        }
    }

    // mousemove, not mouseenter, so a repaint under a resting pointer keeps the keyboard highlight.
    function onRowMousemove(i) {
        if (highlighted !== i) {
            highlighted = i
        }
    }

    function onRowMousedown(event, entry) {
        event.preventDefault()
        pick(entry)
    }
</script>

<div class="search-wrap">
    <input id="target-search" placeholder="red science 60, gears, blue chip 45" autocomplete="off"
        bind:value onfocus={ensureLoaded} oninput={() => { ensureLoaded(); runSearch(value) }} onkeydown={onKeydown} onblur={() => setTimeout(closeResults, 150)}>
    <div id="target-search-results">
        {#each visibleRows as entry, i (entry.name)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="row" class:hot={i === highlighted} data-item={entry.name}
                onmousemove={() => onRowMousemove(i)} onmousedown={(event) => onRowMousedown(event, entry)}>
                <span class="slot slot-sm" {@attach iconOf(plan.spec?.items.get(entry.name), 20, true)}></span>
                <span class="h">{entry.label}</span>
                {#if entry.matchedAlias}
                    <span class="muted aside">{entry.matchedAlias}</span>
                {/if}
            </div>
        {/each}
    </div>
</div>
