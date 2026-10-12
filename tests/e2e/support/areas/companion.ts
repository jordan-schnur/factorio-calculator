import type { Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// The shipped catalog, answered as the companion's own GET /api/catalog would.
const CATALOG = readFileSync(join(__dirname, "..", "..", "..", "..", "public", "data", "catalog.json"), "utf8")

export const SAVES = ["autosave1", "my-base"]

export function savePayload(name: string) {
    return {
        saves: SAVES.map(save => ({ name: save })),
        save: { name, version: "2.0.77", mtime: Math.floor(Date.now() / 1000) },
        belt: "transport-belt",
        buildings: {},
        mining_productivity: 0,
        planet: "nauvis",
        disabled_recipes: [],
    }
}

export interface CompanionStub {
    specRequests: string[]
    cardBodies: unknown[]
}

export interface CompanionOptions {
    specStatus?: number
    boardStatus?: number
    boardBody?: object
    // One payload per spec request, by request index; falls back to savePayload() past the end.
    specPayloads?: object[]
}

// Puts a fake companion server behind the page: the catalog probe, C5 save settings and the board's card POST.
export async function stubCompanion(page: Page, { specStatus = 200, boardStatus = 200, boardBody = { ok: true }, specPayloads = [] }: CompanionOptions = {}): Promise<CompanionStub> {
    let stub: CompanionStub = { specRequests: [], cardBodies: [] }
    await page.route(url => url.pathname === "/api/catalog", route => route.fulfill({ contentType: "application/json", body: CATALOG }))
    await page.route(url => url.pathname === "/api/calc/spec", route => {
        let save = new URL(route.request().url()).searchParams.get("save") ?? ""
        let index = stub.specRequests.length
        stub.specRequests.push(save)
        if (specStatus !== 200) return route.fulfill({ status: specStatus, body: "" })
        return route.fulfill({ json: specPayloads[index] ?? savePayload(save || "my-base") })
    })
    await page.route(url => url.pathname === "/api/board/cards", route => {
        stub.cardBodies.push(route.request().postDataJSON())
        return route.fulfill({ status: boardStatus, json: boardBody })
    })
    return stub
}
