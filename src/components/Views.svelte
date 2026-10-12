<script>
    import { on } from "svelte/events"
    import { fitToView } from "../lib/flow.js"
    import { refresh } from "../lib/plan.svelte.js"
    import Button from "./Button.svelte"
    import Byproducts from "./Byproducts.svelte"
    import GraphSide from "./detail/GraphSide.svelte"
    import ItemTable from "./table/ItemTable.svelte"

    let { planned, view } = $props()

    // A selection made anywhere (graph card, table row, close button) redraws everything that reads spec.whereItem.
    $effect(() => on(document, "calc:select", () => refresh()))
</script>

<Byproducts />

<div class="frame" id="table-frame" hidden={!planned || view !== "table"}>
    <ItemTable />
</div>

<div class="frame" id="graph-frame" hidden={!planned || view !== "graph"}>
    <div id="flow-container" class="canvas"><div id="flow-columns"></div><svg id="flow"></svg><div id="flow-nodes"></div></div>
    <Button size="sm" id="flow-fit" onclick={fitToView}>Fit</Button>
    <GraphSide />
</div>
