import BeaconBadge from "../components/BeaconBadge.svelte"
import ModuleStrip from "../components/ModuleStrip.svelte"
import { spec } from "./factory.js"
import { mountNode } from "./legacy-mount.js"

// RowModules.svelte draws the strip and beacon badge through these, which mount a component onto a legacy-owned node.
export function moduleStrip(modules, size, tiers = []) {
    return mountNode(ModuleStrip, { modules: [...modules], size, tiers: [...tiers] })
}

export function beaconBadge(beaconModules, beaconCount, size, withModules = true, tiers = [], beaconTier = "normal") {
    return mountNode(BeaconBadge, { beacon: spec.items.get("beacon"), beaconModules: [...beaconModules], beaconCount, size, withModules, tiers: [...tiers], beaconTier })
}
