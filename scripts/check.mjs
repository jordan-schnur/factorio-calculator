// Runs every gate even when an earlier one fails, so CI shows all of them at once.
import { spawnSync } from "node:child_process"

const GATES = [["ESLint", "npx eslint ."], ["svelte-check", "npx svelte-check --threshold warning"], ["Hard rules", "node scripts/check-rules.mjs"]]

const failed = GATES.filter(([name, command]) => {
    console.log(`\n── ${name}: ${command}`)
    return spawnSync(command, { shell: true, stdio: "inherit" }).status !== 0
})
console.log(failed.length ? `\n✘ Failed: ${failed.map(([name]) => name).join(", ")}` : "\n✓ All checks passed")
process.exit(failed.length ? 1 : 0)
