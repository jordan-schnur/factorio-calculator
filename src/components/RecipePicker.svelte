<script>
    import { cssVars } from "../lib/css-vars.js"
    import { iconOf } from "../lib/icon-attach.js"

    let { recipes, recipe, onpick } = $props()

    const uid = $props.id()
    let open = $state(false)
    let spacer = $state({})
    let dropdown = $state()

    function toggle() {
        if (!open) {
            const label = dropdown.querySelector("input:checked + label")
            const style = label && getComputedStyle(label)
            spacer = style ? { "--spacer-w": style.width, "--spacer-h": style.height } : {}
        }
        open = !open
    }

    function choose(next) {
        toggle()
        onpick(next)
    }
</script>

<span>{#if recipes.length > 1}<div class={["dropdownWrapper", { open }]}><!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions --><div class="clicker" onclick={toggle}></div><!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions --><div class="dropdown recipePicker" bind:this={dropdown} onclick={toggle}>{#each recipes as r (r.key)}<div><input id="{uid}-{r.key}" name="{uid}-recipe" type="radio" checked={r === recipe} onchange={() => choose(r)}><label for="{uid}-{r.key}" {@attach iconOf(r, 20)}></label></div>{/each}</div><div class="spacer" {@attach cssVars(spacer)}></div></div>{/if}</span>

<style>
    .spacer { width: var(--spacer-w); height: var(--spacer-h); }
</style>
