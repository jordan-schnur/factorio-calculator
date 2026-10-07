<script>
    import FooterBar from "./components/FooterBar.svelte"
    import MakePanel from "./components/MakePanel.svelte"
    import Scratchpad from "./components/Scratchpad.svelte"
    import SettingsDrawer from "./components/SettingsDrawer.svelte"
    import SiteFooter from "./components/SiteFooter.svelte"
    import Topbar from "./components/Topbar.svelte"
    import Views from "./components/Views.svelte"
    import { plan } from "./lib/plan.svelte.js"

    let planned = $derived(plan.spec?.buildTargets.length > 0)
    let view = $derived(plan.spec?.view ?? "table")
    let settingsOpen = $state(false)
</script>

<div id="page">
    <Topbar {planned} {view} onsettings={() => (settingsOpen = true)} />
    <MakePanel intro={!planned} />
    <Views {planned} {view} />
    <FooterBar hidden={!planned} />
    <Scratchpad hidden={!planned} />
    <SettingsDrawer bind:open={settingsOpen} />
    <div id="tooltip_container"></div>
    <SiteFooter />
</div>
