<script>
    import Button from "./Button.svelte"
</script>

<div class="frame" id="topbar">
    <h1 class="title">Factorio Calculator</h1>
    <span class="muted needs-companion" id="save-line"></span>
    <select id="save-picker" class="needs-companion"></select>
    <span id="save-status" class="muted needs-companion"></span>
    <span id="page-note" class="muted"></span>
    <div class="spacer"></div>
    <div class="seg" id="view-seg" hidden><button data-view="table">Table</button><button data-view="graph">Graph</button></div>
    <Button id="settings-open" title="Settings">Settings</Button>
    <Button variant="green" class="needs-companion" id="board-button" hidden>Add to board</Button>
    <div class="frame needs-companion" id="board-panel" hidden></div>
</div>
