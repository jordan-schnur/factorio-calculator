<script>
    import { plan } from "../../lib/plan.svelte.js"
    import { tierOf } from "../../lib/quality-core.js"
    import TierPicker from "../TierPicker.svelte"

    let { building, tier } = $props()

    function pick(picked) {
        plan.spec.saveState.overrides.add("quality")
        plan.spec.commitModules(() => plan.spec.setMachineQuality(building.key, picked.key))
    }
</script>

<div class="machine-quality"><TierPicker tier={tierOf(tier)} label="{building.name} quality" onpick={pick} /><span class="muted">Every {building.name.toLowerCase()} in this build</span></div>
