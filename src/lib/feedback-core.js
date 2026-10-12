// GitHub's URL length limit for a pre-filled issue form is ~6000 chars.
const PLAN_LIMIT = 6000

export const FEEDBACK_BASE = "https://github.com/jordan-schnur/factorio-calculator/issues/new?template=feedback.yml"

export function feedbackUrl(planUrl, version) {
    let url = FEEDBACK_BASE + "&version=" + encodeURIComponent(version)
    let plan = encodeURIComponent(planUrl)
    if (plan.length > PLAN_LIMIT) return url
    return url + "&plan=" + plan
}
