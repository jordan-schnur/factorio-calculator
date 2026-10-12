// Google Analytics with Consent Mode on the public site only; the rules are analytics-core.js.
import { readStore, writeStore } from "./storage.js"
import { MEASUREMENT_ID, asksConsent, consentDefaults, isTracked, pageLocation, parseChoice } from "./analytics-core.js"

const KEY = "calc.analytics"

let banner = $state(null)
let settingsShown = $state(false)

// banner: null until first asked (no #consent-banner at all), then true while open and false once answered.
export const analytics = {
    get banner() { return banner },
    get settingsShown() { return settingsShown },
}

function timeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return null
    }
}

// gtag.js reads the arguments object itself, not an array.
function gtag() {
    window.dataLayer.push(arguments)
}

export function showBanner() {
    banner = true
}

export function answer(choice) {
    writeStore(KEY, choice)
    gtag("consent", "update", { analytics_storage: choice })
    banner = false
}

function start() {
    window.dataLayer = window.dataLayer || []
    for (const defaults of consentDefaults()) {
        gtag("consent", "default", defaults)
    }
    const choice = parseChoice(readStore(KEY))
    if (choice !== null) {
        gtag("consent", "update", { analytics_storage: choice })
    }
    gtag("js", new Date())
    gtag("config", MEASUREMENT_ID, { page_location: pageLocation(window.location) })

    const script = document.createElement("script")
    script.async = true
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID
    document.head.appendChild(script)

    if (choice === null && asksConsent(timeZone())) {
        showBanner()
    }
    settingsShown = true
}

export function initAnalytics() {
    if (isTracked(window.location.hostname)) start()
}
