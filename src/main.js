import { hydrate, mount } from "svelte"
import App from "./App.svelte"
import { initAnalytics } from "./lib/analytics.js"
import { init } from "./lib/init.js"
import { initIntroBg } from "./lib/intro-bg.js"
import "./styles/calc.css"
import "./styles/modules.css"
import "./styles/modules-table.css"
import "./styles/modules-graph.css"
import "./styles/modules-editor.css"
import "./styles/modules-settings.css"
import "./styles/quality.css"

const target = document.getElementById("app")
;(target.firstElementChild ? hydrate : mount)(App, { target })
initAnalytics()
initIntroBg()
addEventListener("load", init, { once: true })
