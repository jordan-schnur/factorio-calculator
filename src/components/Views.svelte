<script>
    import Button from "./Button.svelte"
    import Byproducts from "./Byproducts.svelte"

    let { planned, view } = $props()
</script>

<Byproducts />

<div class="frame" id="table-frame" hidden={!planned || view !== "table"}>
    <div id="item-table"></div>
</div>

<div class="frame" id="graph-frame" hidden={!planned || view !== "graph"}>
    <div id="flow-container" class="canvas"><div id="flow-columns"></div><svg id="flow"></svg><div id="flow-nodes"></div></div>
    <Button size="sm" id="flow-fit">Fit</Button>
    <div class="frame" id="graph-side" hidden></div>
</div>
