<script>
    import Button from "./Button.svelte"

    let { intro } = $props()

    const EXAMPLES = [
        { item: "automation-science-pack", rate: 60, label: "Red science 60/min" },
        { item: "military-science-pack", rate: 60, label: "Military science 60/min" },
        { item: "chemical-science-pack", rate: 30, label: "Blue science 30/min" },
    ]

    const GUIDE = [
        {
            title: "Production ratios, worked out",
            text: "Ask for 60 red science a minute and the calculator counts the assemblers, furnaces and drills behind it, the belts each line fills and the iron and copper ore it eats. Click any row for its exact ratios: how many machines feed how many of the next, and what one full belt keeps running.",
        },
        {
            title: "Space Age and 2.0 recipes",
            text: "Plan on Nauvis, Vulcanus, Fulgora, Gleba or Aquilo with the machines each planet can build. Add modules and beacons, set machine quality, and see leftover byproducts such as heavy oil along with the fixes that use them up.",
        },
        {
            title: "Table or flow graph",
            text: "The table groups every item by what to build here, bring in or mine. The graph draws the same plan as production lines with belt counts. The address bar holds the whole plan, so copying it shares it.",
        },
    ]
</script>

<div class={["frame", { intro }]} id="make-panel">
    <h2 class="title" id="intro-title">What do you want to make?</h2>
    <div class="make-row"><span class="title">Make</span>
        <div class="search-wrap"><input id="target-search" placeholder="red science 60, gears, blue chip 45" autocomplete="off"><div id="target-search-results"></div></div>
    </div>
    <span class="muted" id="make-hint">Nicknames work. A trailing number is the rate per minute, or a machine count with "machines": blue chip 7 machines. Enter adds it.</span>
    <ul id="targets"><li id="plusButton" hidden></li></ul>
    <div id="target-notes" class="muted" hidden></div>
    <div id="intro-extras">
        <div class="examples">
            {#each EXAMPLES as { item, rate, label }}
                <Button class="example-target" data-item={item} data-rate={rate}>{label}</Button>
            {/each}
        </div>
        <a id="restore-last" hidden>Restore the last factory</a>
        <p class="muted about">A production calculator for Factorio 2.0 and Space Age: pick an item and a rate and
            it works out every machine, belt and raw input, as a table or a flow graph.</p>
        <div class="guide">
            {#each GUIDE as { title, text }}
                <section>
                    <h3>{title}</h3>
                    <p>{text}</p>
                </section>
            {/each}
        </div>
    </div>
</div>
