import QualityBadge from "../components/QualityBadge.svelte"
import { mountNode } from "./legacy-mount.js"

// ModulesBar.svelte and RowMachines.svelte draw a quality badge beside a legacy-owned icon through this.
export function qualityBadge(tierKey, size = 12) {
    return mountNode(QualityBadge, { tier: tierKey, size })
}
