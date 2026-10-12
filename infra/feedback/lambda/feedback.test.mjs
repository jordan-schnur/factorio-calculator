import { test } from "node:test"
import assert from "node:assert/strict"
import { validate, issueFor } from "./feedback.mjs"
import { makeHandler, handler } from "./index.mjs"

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

test("validate rejects a plan containing a space", () => {
    const result = validate({ message: "hi", plan: "https://factoriocalculator.app/ owner/repo#1" })
    assert.equal(result.ok, false)
})

test("validate rejects a plan containing a newline", () => {
    const result = validate({ message: "hi", plan: "https://factoriocalculator.app/x\ny" })
    assert.equal(result.ok, false)
})

test("validate rejects a plan containing a > that would close the autolink early", () => {
    const result = validate({ message: "hi", plan: "https://factoriocalculator.app/>owner/repo#1" })
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

test("issueFor does not cut a surrogate pair at the 60 character bound", () => {
    const { title } = issueFor({ message: `${"a".repeat(58)}😀tail` })
    assert.equal(title, `Feedback: ${"a".repeat(58)}😀…`)
})

test("issueFor keeps a short first line untouched", () => {
    const { title } = issueFor({ message: "short message\nsecond line" })
    assert.equal(title, "Feedback: short message")
})

test("issueFor splits the title on a CRLF line ending", () => {
    const { title } = issueFor({ message: "short message\r\nsecond line" })
    assert.equal(title, "Feedback: short message")
})

test("issueFor neutralises @mentions in the message, version and contact", () => {
    const { body, title } = issueFor({
        message: "hey @octocat",
        version: "@1.2.3",
        contact: "@me",
    })
    assert.ok(!body.includes("@o") && body.includes("@‍octocat"))
    assert.ok(body.includes("@‍1.2.3"))
    assert.ok(body.includes("@‍me"))
    assert.ok(title.includes("@‍octocat"))
})

test("issueFor neutralises #references in the message, version and contact", () => {
    const { body, title } = issueFor({
        message: "fixes #123 and owner/repo#456",
        version: "#1",
        contact: "#me",
    })
    assert.ok(body.includes("#‍123") && body.includes("#‍456"))
    assert.ok(body.includes("#‍1"))
    assert.ok(body.includes("#‍me"))
    assert.ok(title.includes("#‍123"))
})

test("issueFor puts the plan in the body byte-for-byte, with a # fragment intact", () => {
    const plan = "https://factoriocalculator.app/calc.html#items=automation-science-pack:r:60"
    const { body } = issueFor({ message: "hi", plan })
    assert.ok(body.includes(`**Plan:** <${plan}>`))
})

test("issueFor neutralises github.com links in the message, version and contact", () => {
    const { body, title } = issueFor({
        message: "see github.com/jordan-schnur/factorio-calculator/issues/1",
        version: "github.com",
        contact: "github.com/me",
    })
    assert.ok(!body.includes("see github.com/") && body.includes("github‍.com"))
    assert.ok(body.includes("**Version:** github‍.com"))
    assert.ok(body.includes("**Contact:** github‍.com/me"))
    assert.ok(title.includes("github‍.com"))
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

function postEvent(body, headers = { "content-type": "application/json" }) {
    return { requestContext: { http: { method: "POST" } }, headers, body: JSON.stringify(body) }
}

function countingSsmStub() {
    let calls = 0
    return {
        stub: {
            getParameter: async () => {
                calls += 1
                return { Parameter: { Value: "test-token" } }
            },
        },
        get calls() {
            return calls
        },
    }
}

const ssmStub = { getParameter: async () => ({ Parameter: { Value: "test-token" } }) }

test("handler returns 405 for a non-POST method", async () => {
    const result = await handler({ requestContext: { http: { method: "GET" } } })
    assert.equal(result.statusCode, 405)
})

test("handler returns 415 when the content-type is not application/json", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, headers: { "content-type": "text/plain" }, body: "{}" })
    assert.equal(result.statusCode, 415)
    assert.deepEqual(JSON.parse(result.body), { error: "content-type must be application/json" })
})

test("handler returns 415 when the content-type header is missing", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, body: "{}" })
    assert.equal(result.statusCode, 415)
})

test("handler accepts a case-insensitive content-type header name and value", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, headers: { "Content-Type": "Application/JSON" }, body: "{not json" })
    assert.equal(result.statusCode, 400)
})

test("handler returns 400 for invalid JSON", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, headers: { "content-type": "application/json" }, body: "{not json" })
    assert.equal(result.statusCode, 400)
})

test("handler returns 400 for a body over 16 KB", async () => {
    const result = await handler({
        requestContext: { http: { method: "POST" } },
        headers: { "content-type": "application/json" },
        body: "a".repeat(16 * 1024 + 1),
    })
    assert.equal(result.statusCode, 400)
})

test("handler returns 400 for a field out of bounds", async () => {
    const result = await handler(postEvent({ message: "" }))
    assert.equal(result.statusCode, 400)
})

test("handler decodes a base64-encoded body", async () => {
    const body = Buffer.from(JSON.stringify({ message: "hi there" }), "utf8").toString("base64")
    const testHandler = makeHandler({ fetch: async () => ({ ok: true, json: async () => ({ number: 7, html_url: "https://x" }) }), ssmClient: ssmStub })
    const result = await testHandler({
        requestContext: { http: { method: "POST" } },
        headers: { "content-type": "application/json" },
        body,
        isBase64Encoded: true,
    })
    assert.equal(result.statusCode, 201)
})

test("handler returns 201 with null fields for the honeypot", async () => {
    let called = false
    const fetchStub = async () => {
        called = true
        return { ok: true, json: async () => ({ number: 1, html_url: "https://x" }) }
    }
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: ssmStub })
    const result = await testHandler(postEvent({ message: "hi", website: "spam" }))
    assert.equal(result.statusCode, 201)
    assert.deepEqual(JSON.parse(result.body), { number: null, url: null })
    assert.equal(called, false)
})

test("handler returns 201 with the issue number and url on success", async () => {
    const fetchStub = async () => ({ ok: true, json: async () => ({ number: 42, html_url: "https://github.com/jordan-schnur/factorio-calculator/issues/42" }) })
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: ssmStub })
    const result = await testHandler(postEvent({ message: "hi there" }))
    assert.equal(result.statusCode, 201)
    assert.deepEqual(JSON.parse(result.body), { number: 42, url: "https://github.com/jordan-schnur/factorio-calculator/issues/42" })
})

test("handler sends the expected URL, auth header, api-version header and body to GitHub", async () => {
    let seenUrl, seenOptions
    const fetchStub = async (url, options) => {
        seenUrl = url
        seenOptions = options
        return { ok: true, json: async () => ({ number: 1, html_url: "https://x" }) }
    }
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: ssmStub })
    await testHandler(postEvent({ message: "hi there", plan: "https://factoriocalculator.app/x", version: "1.0", contact: "me@example.com" }))

    assert.equal(seenUrl, "https://api.github.com/repos/jordan-schnur/factorio-calculator/issues")
    assert.equal(seenOptions.method, "POST")
    assert.equal(seenOptions.headers.Authorization, "Bearer test-token")
    assert.equal(seenOptions.headers["X-GitHub-Api-Version"], "2022-11-28")

    const sentBody = JSON.parse(seenOptions.body)
    assert.equal(sentBody.title, "Feedback: hi there")
    assert.ok(sentBody.body.startsWith("hi there"))
    assert.ok(sentBody.body.includes("**Plan:**"))
    assert.deepEqual(sentBody.labels, ["feedback"])
})

test("handler fetches the SSM token once across two invocations of the same handler", async () => {
    const counter = countingSsmStub()
    const fetchStub = async () => ({ ok: true, json: async () => ({ number: 1, html_url: "https://x" }) })
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: counter.stub })

    await testHandler(postEvent({ message: "first" }))
    await testHandler(postEvent({ message: "second" }))

    assert.equal(counter.calls, 1)
})

test("handler returns 502 when GitHub responds with a failure status", async () => {
    const fetchStub = async () => ({ ok: false, status: 401, json: async () => ({}) })
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: ssmStub })
    const result = await testHandler(postEvent({ message: "hi there" }))
    assert.equal(result.statusCode, 502)
    assert.deepEqual(JSON.parse(result.body), { error: "could not file the issue" })
})

test("handler returns 502 when the GitHub request throws", async () => {
    const fetchStub = async () => {
        throw new Error("network down")
    }
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: ssmStub })
    const result = await testHandler(postEvent({ message: "hi there" }))
    assert.equal(result.statusCode, 502)
})

test("handler returns 502 when fetching the SSM token throws", async () => {
    const failingSsmStub = {
        getParameter: async () => {
            throw new Error("ssm unavailable")
        },
    }
    const fetchStub = async () => ({ ok: true, json: async () => ({ number: 1, html_url: "https://x" }) })
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: failingSsmStub })
    const result = await testHandler(postEvent({ message: "hi there" }))
    assert.equal(result.statusCode, 502)
    assert.deepEqual(JSON.parse(result.body), { error: "could not file the issue" })
})

test("handler returns 502 when parsing the GitHub response body throws", async () => {
    const fetchStub = async () => ({
        ok: true,
        json: async () => {
            throw new Error("bad json")
        },
    })
    const testHandler = makeHandler({ fetch: fetchStub, ssmClient: ssmStub })
    const result = await testHandler(postEvent({ message: "hi there" }))
    assert.equal(result.statusCode, 502)
    assert.deepEqual(JSON.parse(result.body), { error: "could not file the issue" })
})
