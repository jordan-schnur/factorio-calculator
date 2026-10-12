// Lambda Function URL handler: validates feedback, then files it as a GitHub issue.
import { validate, issueFor } from "./feedback.mjs"

const TOKEN_PARAMETER = "/factorio-calculator/feedback/github-token"
const MAX_BODY_BYTES = 16 * 1024
const REPO = "jordan-schnur/factorio-calculator"

// Imported lazily so local tooling never needs @aws-sdk/client-ssm, which ships only in the Lambda runtime.
async function defaultSsmClient() {
    const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm")
    const client = new SSMClient({})
    return { getParameter: ({ Name, WithDecryption }) => client.send(new GetParameterCommand({ Name, WithDecryption })) }
}

function json(statusCode, body) {
    return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
}

function headerValue(event, name) {
    const entry = Object.entries(event?.headers ?? {}).find(([key]) => key.toLowerCase() === name)
    return entry?.[1] ?? ""
}

// nodejs20.x passes `callback` as the handler's third argument, so deps go through a factory instead.
export function makeHandler(deps = {}) {
    const fetchImpl = deps.fetch ?? fetch
    let cachedToken

    async function getToken() {
        if (cachedToken) return cachedToken
        const client = deps.ssmClient ?? (await defaultSsmClient())
        const result = await client.getParameter({ Name: TOKEN_PARAMETER, WithDecryption: true })
        cachedToken = result.Parameter.Value
        return cachedToken
    }

    return async function handler(event) {
        const method = event?.requestContext?.http?.method
        if (method !== "POST") return json(405, { error: "method not allowed" })

        if (!headerValue(event, "content-type").toLowerCase().startsWith("application/json")) {
            return json(415, { error: "content-type must be application/json" })
        }

        const rawBody = event?.body ?? ""
        const bodyText = event?.isBase64Encoded ? Buffer.from(rawBody, "base64").toString("utf8") : rawBody
        if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) return json(400, { error: "body too large" })

        let parsed
        try {
            parsed = JSON.parse(bodyText)
        } catch {
            return json(400, { error: "invalid JSON" })
        }

        const result = validate(parsed)
        if (!result.ok) return json(400, { error: result.error })
        const { value } = result

        if (value.website) return json(201, { number: null, url: null })

        const { title, body, labels } = issueFor(value)

        try {
            const token = await getToken()
            const response = await fetchImpl(`https://api.github.com/repos/${REPO}/issues`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "factorio-calculator-feedback",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ title, body, labels }),
            })

            if (!response.ok) {
                console.error(`GitHub issue creation failed with status ${response.status}`)
                return json(502, { error: "could not file the issue" })
            }

            const issue = await response.json()
            return json(201, { number: issue.number, url: issue.html_url })
        } catch (error) {
            console.error("filing the GitHub issue failed", error.message)
            return json(502, { error: "could not file the issue" })
        }
    }
}

export const handler = makeHandler()
