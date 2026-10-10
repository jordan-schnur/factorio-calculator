<script>
    import FooterBar from "./components/FooterBar.svelte"
    import MakePanel from "./components/MakePanel.svelte"
    import Scratchpad from "./components/Scratchpad.svelte"
    import SettingsDrawer from "./components/SettingsDrawer.svelte"
    import SiteFooter from "./components/SiteFooter.svelte"
    import Topbar from "./components/Topbar.svelte"
    import Views from "./components/Views.svelte"
    import { plan } from "./lib/plan.svelte.js"

    let planned = $derived(plan.planned)
    let view = $derived(plan.spec?.view ?? "table")
</script>

<div id="page">
    <Topbar {planned} {view} />
    <MakePanel intro={!planned} />
    <Views {planned} {view} />
    <FooterBar hidden={!planned} />
    <Scratchpad hidden={!planned} />
    <SettingsDrawer />
    <div id="tooltip_container"></div>
    <SiteFooter />
</div>
