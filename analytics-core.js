// calc/analytics-core.js — the rules behind the public site's Google
// Analytics: which host reports, who is asked first, and the Consent Mode
// defaults. analytics.js does the DOM and network work. Pure, so node can
// test it (tests/js/calc_analytics_check.mjs).

// The GA4 web stream for https://factoriocalculator.app/. Empty means
// analytics is off everywhere.
export const MEASUREMENT_ID = "G-J67TQSQFYV"

// Only the public site reports; the companion's local server never does.
export const TRACKED_HOSTS = ["factoriocalculator.app"]

// Where Consent Mode starts analytics denied until the visitor agrees: the
// EEA, the UK and Switzerland. Google geolocates by IP, so this holds even
// for a visitor the banner below never asks.
export const CONSENT_REGIONS = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]

// European clocks whose zone name doesn't start with "Europe/".
const OTHER_EUROPEAN_ZONES = new Set([
    "Atlantic/Reykjavik", "Atlantic/Canary", "Atlantic/Madeira", "Atlantic/Azores",
    "Atlantic/Faroe", "Asia/Nicosia", "Asia/Famagusta", "Africa/Ceuta",
    "Arctic/Longyearbyen",
])

export function isTracked(hostname, id = MEASUREMENT_ID) {
    return id !== "" && TRACKED_HOSTS.includes(hostname)
}

// The page can't see the visitor's IP, so it asks anyone on a European
// clock. Wrong either way is safe: an EU visitor on another clock is never
// asked and stays denied; anyone else asked by mistake just answers.
export function asksConsent(timeZone) {
    if (typeof timeZone !== "string") return false
    return timeZone.startsWith("Europe/") || OTHER_EUROPEAN_ZONES.has(timeZone)
}

// The stored answer, or null when there isn't a valid one.
export function parseChoice(raw) {
    return raw === "granted" || raw === "denied" ? raw : null
}

// gtag("consent", "default", ...) arguments, most specific first. Ads
// storage is denied everywhere: the site runs no ads.
export function consentDefaults() {
    let noAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }
    return [
        { ...noAds, analytics_storage: "denied", region: CONSENT_REGIONS },
        { ...noAds, analytics_storage: "granted" },
    ]
}

// What GA records as the page: no #fragment, which holds the whole plan and
// changes on every edit.
export function pageLocation(location) {
    return location.origin + location.pathname + location.search
}
