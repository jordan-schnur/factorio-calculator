import BeaconBadge from "../components/BeaconBadge.svelte"
import HandTag from "../components/HandTag.svelte"
import ModuleStrip from "../components/ModuleStrip.svelte"
import { spec } from "./factory.js"
import { mountNode } from "./legacy-mount.js"

// Legacy builders (itemtable.js, flow.js) draw the strip, beacon badge and SET BY HAND tag through these until they migrate.
export function moduleStrip(modules, size, tiers = []) {
    return mountNode(ModuleStrip, { modules: [...modules], size, tiers: [...tiers] })
}

export function beaconBadge(beaconModules, beaconCount, size, withModules = true, tiers = [], beaconTier = "normal") {
    return mountNode(BeaconBadge, { beacon: spec.items.get("beacon"), beaconModules: [...beaconModules], beaconCount, size, withModules, tiers: [...tiers], beaconTier })
}

export function handTag() {
    return mountNode(HandTag, {})
}
