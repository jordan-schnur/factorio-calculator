// Pure helpers for the feedback lambda: request validation and GitHub issue shaping.
const PLAN_PREFIX = "https://factoriocalculator.app/"
const TITLE_MAX = 60
const ZERO_WIDTH_JOINER = "‍"

function isString(value) {
    return typeof value === "string"
}

// Breaks @mentions, #references and github.com links so user text can't ping accounts or cross-link other repos.
function neutralizeReferences(text) {
    return text
        .replaceAll("@", `@${ZERO_WIDTH_JOINER}`)
        .replaceAll("#", `#${ZERO_WIDTH_JOINER}`)
        .replaceAll("github.com", `github${ZERO_WIDTH_JOINER}.com`)
}

export function validate(body) {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "body must be a JSON object" }

    const { message, contact, plan, version, website } = body

    if (!isString(message)) return { ok: false, error: "message is required" }
    const trimmedMessage = message.trim()
    if (trimmedMessage.length < 1 || trimmedMessage.length > 4000) return { ok: false, error: "message must be 1-4000 characters" }

    if (contact !== undefined && (!isString(contact) || contact.length > 200)) return { ok: false, error: "contact must be at most 200 characters" }

    if (plan !== undefined && plan !== "") {
        if (!isString(plan) || plan.length > 6000) return { ok: false, error: "plan must be at most 6000 characters" }
        if (!plan.startsWith(PLAN_PREFIX)) return { ok: false, error: "plan must be a factoriocalculator.app link" }
    }

    if (version !== undefined && (!isString(version) || version.length > 40)) return { ok: false, error: "version must be at most 40 characters" }

    if (website !== undefined && !isString(website)) return { ok: false, error: "website must be a string" }

    return {
        ok: true,
        value: {
            message: trimmedMessage,
            contact: contact || undefined,
            plan: plan || undefined,
            version: version || undefined,
            website: website || undefined,
        },
    }
}

export function issueFor(value) {
    const firstLine = value.message.split(/\r?\n/)[0]
    const chars = Array.from(firstLine)
    const truncated = chars.length > TITLE_MAX ? `${chars.slice(0, TITLE_MAX - 1).join("")}…` : firstLine
    const title = `Feedback: ${neutralizeReferences(truncated)}`

    const planRest = value.plan ? value.plan.slice(PLAN_PREFIX.length) : undefined

    const parts = [neutralizeReferences(value.message)]
    if (planRest !== undefined) parts.push(`**Plan:** ${PLAN_PREFIX}${neutralizeReferences(planRest)}`)
    if (value.version) parts.push(`**Version:** ${neutralizeReferences(value.version)}`)
    if (value.contact) parts.push(`**Contact:** ${neutralizeReferences(value.contact)}`)
    parts.push("_Sent from the site's feedback form._")

    return { title, body: parts.join("\n\n"), labels: ["feedback"] }
}
