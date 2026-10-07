// calc/version.js — the calculator's version, written into every
// `.calc-version` element (each one links to changelog.html). Every release
// to factoriocalculator.app bumps it and adds its entry at the top of
// changelog.html; tests/test_calc_version.py fails when the two disagree.
// Minor for anything new a player can do, patch for fixes only.
export const VERSION = "1.4.5"

if (typeof document !== "undefined") {
    for (let el of document.querySelectorAll(".calc-version")) {
        el.textContent = `v${VERSION}`
    }
}
