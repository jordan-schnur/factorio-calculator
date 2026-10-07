<script>
    import Button from "./Button.svelte"

    let { hidden } = $props()
</script>

<details id="scratchpad-frame" {hidden}><summary>Scratch pad</summary>
    <div style="display: flex; flex-direction: column; gap: 6px;">
        <div id="scratch-history"></div>
        <input class="num" id="scratch-input" placeholder="2 * 450 / 60" autocomplete="off">
        <div class="num" id="scratch-result" style="font-size: 22px; text-align: right;">=</div>
        <div class="muted" style="font-size: 13px;"><span class="key">Enter</span> keeps the line &middot; <span class="key">&uarr;</span> recalls &middot; <b>ans</b> is the last result &middot; units like kW, MW, /min pass through.</div>
        <Button size="sm" id="scratch-clear">clear</Button>
    </div>
</details>
