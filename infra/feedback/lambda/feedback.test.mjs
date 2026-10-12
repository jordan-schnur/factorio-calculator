import { test } from "node:test"
import assert from "node:assert/strict"
import { validate, issueFor } from "./feedback.mjs"
import { handler } from "./index.mjs"

test("validate rejects a missing message", () => {
    const result = validate({})
    assert.equal(result.ok, false)
})

test("validate rejects an empty message after trim", () => {
    const result = validate({ message: "   " })
    assert.equal(result.ok, false)
})

test("validate rejects a message over 4000 characters", () => {
    const result = validate({ message: "a".repeat(4001) })
    assert.equal(result.ok, false)
})

test("validate accepts a message at the 4000 character bound", () => {
    const result = validate({ message: "a".repeat(4000) })
    assert.equal(result.ok, true)
})

test("validate rejects contact over 200 characters", () => {
    const result = validate({ message: "hi", contact: "a".repeat(201) })
    assert.equal(result.ok, false)
})

test("validate accepts contact at the 200 character bound", () => {
    const result = validate({ message: "hi", contact: "a".repeat(200) })
    assert.equal(result.ok, true)
})

test("validate rejects a plan without the factoriocalculator.app prefix", () => {
    const result = validate({ message: "hi", plan: "https://example.com/plan" })
    assert.equal(result.ok, false)
})

test("validate accepts an empty plan", () => {
    const result = validate({ message: "hi", plan: "" })
    assert.equal(result.ok, true)
})

test("validate accepts a plan with the required prefix", () => {
    const result = validate({ message: "hi", plan: "https://factoriocalculator.app/#abc" })
    assert.equal(result.ok, true)
})

test("validate rejects a plan over 6000 characters", () => {
    const longPlan = `https://factoriocalculator.app/${"a".repeat(6000)}`
    const result = validate({ message: "hi", plan: longPlan })
    assert.equal(result.ok, false)
})

test("validate rejects a version over 40 characters", () => {
    const result = validate({ message: "hi", version: "a".repeat(41) })
    assert.equal(result.ok, false)
})

test("validate passes the website field through for the honeypot check", () => {
    const result = validate({ message: "hi", website: "http://spam.example" })
    assert.equal(result.ok, true)
    assert.equal(result.value.website, "http://spam.example")
})

test("issueFor truncates a long first line to 60 characters with an ellipsis", () => {
    const { title } = issueFor({ message: "a".repeat(100) })
    assert.equal(title, `Feedback: ${"a".repeat(59)}…`)
})

test("issueFor keeps a short first line untouched", () => {
    const { title } = issueFor({ message: "short message\nsecond line" })
    assert.equal(title, "Feedback: short message")
})

test("issueFor neutralises @mentions in the message, plan, version and contact", () => {
    const { body, title } = issueFor({
        message: "hey @octocat",
        plan: "https://factoriocalculator.app/@spec",
        version: "@1.2.3",
        contact: "@me",
    })
    assert.ok(!body.includes("@o") && body.includes("@‍octocat"))
    assert.ok(body.includes("@‍spec"))
    assert.ok(body.includes("@‍1.2.3"))
    assert.ok(body.includes("@‍me"))
    assert.ok(title.includes("@‍octocat"))
})

test("issueFor orders the body as message, plan, version, contact, footer", () => {
    const { body } = issueFor({ message: "hello", plan: "https://factoriocalculator.app/x", version: "1.0", contact: "me@example.com" })
    const planIndex = body.indexOf("**Plan:**")
    const versionIndex = body.indexOf("**Version:**")
    const contactIndex = body.indexOf("**Contact:**")
    const footerIndex = body.indexOf("_Sent from the site's feedback form._")
    assert.ok(body.startsWith("hello"))
    assert.ok(planIndex < versionIndex)
    assert.ok(versionIndex < contactIndex)
    assert.ok(contactIndex < footerIndex)
})

test("issueFor always sets the feedback label", () => {
    const { labels } = issueFor({ message: "hi" })
    assert.deepEqual(labels, ["feedback"])
})

function postEvent(body) {
    return { requestContext: { http: { method: "POST" } }, body: JSON.stringify(body) }
}

const ssmStub = { getParameter: async () => ({ Parameter: { Value: "test-token" } }) }

test("handler returns 405 for a non-POST method", async () => {
    const result = await handler({ requestContext: { http: { method: "GET" } } })
    assert.equal(result.statusCode, 405)
})

test("handler returns 400 for invalid JSON", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, body: "{not json" })
    assert.equal(result.statusCode, 400)
})

test("handler returns 400 for a body over 16 KB", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, body: "a".repeat(16 * 1024 + 1) })
    assert.equal(result.statusCode, 400)
})

test("handler returns 400 for a field out of bounds", async () => {
    const result = await handler(postEvent({ message: "" }))
    assert.equal(result.statusCode, 400)
})

test("handler returns 201 with null fields for the honeypot", async () => {
    let called = false
    const fetchStub = async () => {
        called = true
        return { ok: true, json: async () => ({ number: 1, html_url: "https://x" }) }
    }
    const result = await handler(postEvent({ message: "hi", website: "spam" }), {}, { fetch: fetchStub, ssmClient: ssmStub })
    assert.equal(result.statusCode, 201)
    assert.deepEqual(JSON.parse(result.body), { number: null, url: null })
    assert.equal(called, false)
})

test("handler returns 201 with the issue number and url on success", async () => {
    const fetchStub = async () => ({ ok: true, json: async () => ({ number: 42, html_url: "https://github.com/jordan-schnur/factorio-calculator/issues/42" }) })
    const result = await handler(postEvent({ message: "hi there" }), {}, { fetch: fetchStub, ssmClient: ssmStub })
    assert.equal(result.statusCode, 201)
    assert.deepEqual(JSON.parse(result.body), { number: 42, url: "https://github.com/jordan-schnur/factorio-calculator/issues/42" })
})

test("handler returns 502 when GitHub responds with a failure status", async () => {
    const fetchStub = async () => ({ ok: false, status: 401, json: async () => ({}) })
    const result = await handler(postEvent({ message: "hi there" }), {}, { fetch: fetchStub, ssmClient: ssmStub })
    assert.equal(result.statusCode, 502)
    assert.deepEqual(JSON.parse(result.body), { error: "could not file the issue" })
})

test("handler returns 502 when the GitHub request throws", async () => {
    const fetchStub = async () => {
        throw new Error("network down")
    }
    const result = await handler(postEvent({ message: "hi there" }), {}, { fetch: fetchStub, ssmClient: ssmStub })
    assert.equal(result.statusCode, 502)
})
