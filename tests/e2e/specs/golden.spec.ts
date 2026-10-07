import { test, expect } from "../support/fixtures"
import type { Calculator } from "../support/calculator"

// Golden master: a corpus of plans across every dataset and the settings
// that change the numbers. For each, everything the page works out (the
// table, the footer, the graph's cards and the fragment it writes) is
// locked into a JSON snapshot under tests/e2e/__snapshots__/golden.spec.ts/.
// A port that keeps every snapshot identical computes and presents the
// same plans. When a change is intended, review the JSON diff and refresh
// with `npm run test:update -- golden`.

interface Plan {
    name: string
    fragment: string
}

const VANILLA = "data=2-0-55&"
const LEGACY = "data=1-1-110&"
const EXPENSIVE = "data=1-1-110x&"

const CORPUS: Plan[] = [
    // Space Age (the default dataset), Nauvis
    { name: "sa-red-science", fragment: "items=automation-science-pack:r:60" },
    { name: "sa-green-science", fragment: "items=logistic-science-pack:r:60" },
    { name: "sa-military-science", fragment: "items=military-science-pack:r:60&ignore=steel-plate" },
    { name: "sa-blue-science", fragment: "items=chemical-science-pack:r:30" },
    { name: "sa-purple-science", fragment: "items=production-science-pack:r:30" },
    { name: "sa-yellow-science", fragment: "items=utility-science-pack:r:30" },
    { name: "sa-all-nauvis-science", fragment: "items=automation-science-pack:r:60,logistic-science-pack:r:60,chemical-science-pack:r:60,military-science-pack:r:60,production-science-pack:r:60,utility-science-pack:r:60" },
    { name: "sa-rocket-part", fragment: "items=rocket-part:r:10" },
    { name: "sa-plastic", fragment: "items=plastic-bar:r:120" },
    { name: "sa-processing-unit", fragment: "items=processing-unit:r:10" },
    { name: "sa-low-density", fragment: "items=low-density-structure:r:30" },
    { name: "sa-rocket-fuel", fragment: "items=rocket-fuel:r:30" },
    { name: "sa-uranium-fuel-cell", fragment: "items=uranium-fuel-cell:r:10" },
    { name: "sa-flying-robot-frame", fragment: "items=flying-robot-frame:r:20" },
    { name: "sa-machine-count-target", fragment: "items=advanced-circuit:f:4" },
    { name: "sa-fractional-rate", fragment: "items=electronic-circuit:r:7.5,copper-cable:r:0.333333" },
    // Space Age, other planets
    { name: "sa-vulcanus-metallurgic", fragment: "items=metallurgic-science-pack:r:60&planet=vulcanus" },
    { name: "sa-fulgora-electromagnetic", fragment: "items=electromagnetic-science-pack:r:60&planet=fulgora" },
    { name: "sa-gleba-agricultural", fragment: "items=agricultural-science-pack:r:60&planet=gleba" },
    { name: "sa-aquilo-cryogenic", fragment: "items=cryogenic-science-pack:r:60&planet=aquilo" },
    { name: "sa-space-science", fragment: "items=space-science-pack:r:60&planet=space-platform" },
    { name: "sa-multi-planet-quantum", fragment: "items=quantum-processor:r:10&planet=nauvis,vulcanus,fulgora,gleba,aquilo" },
    { name: "sa-dataset-2-0-55", fragment: "data=space-age-2-0-55&items=chemical-science-pack:r:30" },
    // Settings that change the numbers or how they read
    { name: "set-rate-per-second", fragment: "rate=s&items=automation-science-pack:r:1" },
    { name: "set-rate-per-hour", fragment: "rate=h&items=automation-science-pack:r:3600" },
    { name: "set-precision", fragment: "rp=3&cp=2&items=chemical-science-pack:r:45" },
    { name: "set-rationals", fragment: "vf=r&items=chemical-science-pack:r:45" },
    { name: "set-decimal-belts", fragment: "bf=d&items=automation-science-pack:r:1200" },
    { name: "set-mining-prod", fragment: "mprod=50&items=automation-science-pack:r:60" },
    { name: "set-buildings", fragment: "buildings=assembling-machine-3,steel-furnace&items=chemical-science-pack:r:60" },
    { name: "set-belt-fuel", fragment: "belt=express-transport-belt&fuel=solid-fuel&buildings=stone-furnace&items=automation-science-pack:r:600" },
    { name: "set-ignore", fragment: "items=chemical-science-pack:r:30&ignore=advanced-circuit,engine-unit" },
    { name: "set-disable-advanced-oil", fragment: "items=plastic-bar:r:120&disable=advanced-oil-processing" },
    { name: "set-modules-plan", fragment: "dm=p3&dm2=s3&db=s3:s3&dbc=8&items=chemical-science-pack:r:60" },
    { name: "set-machine-quality", fragment: "mq=assembling-machine-1:legendary,electric-furnace:rare&items=automation-science-pack:r:60" },
    { name: "set-module-quality", fragment: "dm=p3@legendary&items=processing-unit:r:10" },
    { name: "set-companion-link", fragment: "data=space-age-2-0-77&items=electronic-circuit:r:60,copper-cable:r:7.5&belt=express-transport-belt&buildings=assembling-machine-2,steel-furnace&dm=s3&disable=iron-plate,copper-plate" },
    // Vanilla 2.0
    { name: "v2-blue-science", fragment: VANILLA + "items=chemical-science-pack:r:30" },
    { name: "v2-space-science", fragment: VANILLA + "items=space-science-pack:r:60" },
    { name: "v2-nuclear-fuel", fragment: VANILLA + "items=nuclear-fuel:r:1" },
    { name: "v2-oil-cracking-off", fragment: VANILLA + "items=plastic-bar:r:60&disable=heavy-oil-cracking,light-oil-cracking" },
    // Vanilla 1.1 (legacy solver), normal and expensive
    { name: "v1-blue-science", fragment: LEGACY + "items=chemical-science-pack:r:30" },
    { name: "v1-rocket-part", fragment: LEGACY + "items=rocket-part:r:1" },
    { name: "v1-kirk-legacy-keys", fragment: LEGACY + "use_3=1&furnace=steel-furnace&p=basic&k=1&items=uranium-235:r:1,plastic-bar:r:60" },
    { name: "v1x-expensive-blue-science", fragment: EXPENSIVE + "items=chemical-science-pack:r:30" },
]

async function capture(calc: Calculator) {
    let rows = await calc.tableRows()
    let footer = await calc.footer()
    let title = await calc.page.title()
    let fragment = await calc.canonicalHash()
    await calc.switchView("graph")
    let nodes = await calc.graphNodes()
    return { title, fragment, footer, rows, nodes }
}

for (let plan of CORPUS) {
    test(`golden: ${plan.name}`, async ({ calc, page }) => {
        await calc.open(plan.fragment)
        let tableHash = await calc.hash()
        let got = await capture(calc)
        expect(got.rows.length, "the plan has rows").toBeGreaterThan(0)
        expect(JSON.stringify(got, null, 2)).toMatchSnapshot(`${plan.name}.json`)

        // The link the page wrote is the plan: opened fresh (a real boot,
        // not a hashchange), it draws the same table and writes the same
        // fragment back.
        await page.goto("about:blank")
        await calc.open(tableHash.slice(1))
        expect(await calc.tableRows()).toEqual(got.rows)
        expect(await calc.canonicalHash()).toEqual(got.fragment)
    })
}
