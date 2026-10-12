// GitHub's URL length limit for a pre-filled issue form is ~6000 chars.
const PLAN_LIMIT = 6000

export const FEEDBACK_BASE = "https://github.com/jordan-schnur/factorio-calculator/issues/new?template=feedback.yml"

export function feedbackUrl(planUrl, version) {
    let url = FEEDBACK_BASE + "&version=" + encodeURIComponent(version)
    let plan = encodeURIComponent(planUrl)
    if (plan.length > PLAN_LIMIT) return url
    return url + "&plan=" + plan
}

// Set at build time; empty until the AWS endpoint ships, keeping the GitHub link live.
export const FEEDBACK_ENDPOINT = import.meta.env.VITE_FEEDBACK_URL || ""

export const MESSAGE_LIMIT = 4000
export const CONTACT_LIMIT = 200
const VERSION_LIMIT = 40

// Only a plan under this host is the live page, not a test or dev build; the endpoint rejects anything else.
export const PLAN_PREFIX = "https://factoriocalculator.app/"

// The Lambda rejects request bodies over 16 KB; stay under it with room for the rest of the payload.
const BODY_LIMIT = 15000

export function buildFeedbackPayload({ message, contact, planUrl, version, website }) {
    let payload = { message: message.trim().slice(0, MESSAGE_LIMIT), website: website || "" }
    let trimmedContact = (contact || "").trim()
    if (trimmedContact) payload.contact = trimmedContact.slice(0, CONTACT_LIMIT)
    if (version) payload.version = version.slice(0, VERSION_LIMIT)
    if (planUrl && planUrl.startsWith(PLAN_PREFIX) && planUrl.length <= PLAN_LIMIT) {
        let withPlan = { ...payload, plan: planUrl }
        if (new TextEncoder().encode(JSON.stringify(withPlan)).length <= BODY_LIMIT) payload = withPlan
    }
    return payload
}

export async function submitFeedback(payload, endpoint = FEEDBACK_ENDPOINT) {
    let response
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
    } catch {
        return { ok: false }
    }
    if (response.status < 200 || response.status >= 300) return { ok: false }
    let data
    try {
        data = await response.json()
    } catch {
        data = {}
    }
    return { ok: true, number: data.number ?? null, url: data.url }
}
