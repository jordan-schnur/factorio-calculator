// calc/analytics.js — Google Analytics with Google Consent Mode on the
// public site only (rules in analytics-core.js). Visitors on a European
// clock get a banner asking first; the About section's "Analytics
// settings" link reopens it so anyone can change their answer.

import { MEASUREMENT_ID, asksConsent, consentDefaults, isTracked, pageLocation, parseChoice } from "./analytics-core.js"

const KEY = "calc.analytics"

function storedChoice() {
    try {
        return parseChoice(localStorage.getItem(KEY))
    } catch (e) {
        return null
    }
}

function storeChoice(choice) {
    try {
        localStorage.setItem(KEY, choice)
    } catch (e) {
        // Private window or blocked storage: the answer holds for this page only.
    }
}

function timeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch (e) {
        return null
    }
}

// gtag.js reads the arguments object itself, not an array.
function gtag() {
    window.dataLayer.push(arguments)
}

function answer(choice) {
    storeChoice(choice)
    gtag("consent", "update", { analytics_storage: choice })
    document.getElementById("consent-banner").hidden = true
}

function showBanner() {
    let banner = document.getElementById("consent-banner")
    if (!banner) {
        banner = document.createElement("div")
        banner.id = "consent-banner"
        banner.className = "frame"
        banner.setAttribute("role", "dialog")
        banner.setAttribute("aria-label", "Analytics consent")
        banner.innerHTML =
            '<span>Can this site count your visit with Google Analytics? It sets cookies; ' +
            'your plans stay in your browser.</span>' +
            '<button class="btn" data-choice="granted">Allow</button>' +
            '<button class="btn" data-choice="denied">No thanks</button>'
        for (let button of banner.querySelectorAll("button")) {
            button.addEventListener("click", () => answer(button.dataset.choice))
        }
        document.body.appendChild(banner)
    }
    banner.hidden = false
}

function start() {
    window.dataLayer = window.dataLayer || []
    for (let defaults of consentDefaults()) {
        gtag("consent", "default", defaults)
    }
    let choice = storedChoice()
    if (choice !== null) {
        gtag("consent", "update", { analytics_storage: choice })
    }
    gtag("js", new Date())
    gtag("config", MEASUREMENT_ID, { page_location: pageLocation(window.location) })

    let script = document.createElement("script")
    script.async = true
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID
    document.head.appendChild(script)

    if (choice === null && asksConsent(timeZone())) {
        showBanner()
    }
    let settings = document.getElementById("analytics-settings")
    settings.hidden = false
    settings.addEventListener("click", showBanner)
}

export function initAnalytics() {
    if (isTracked(window.location.hostname)) start()
}
