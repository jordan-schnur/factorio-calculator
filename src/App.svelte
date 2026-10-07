<script>
    import FooterBar from "./components/FooterBar.svelte"
    import MakePanel from "./components/MakePanel.svelte"
    import Scratchpad from "./components/Scratchpad.svelte"
    import SettingsDrawer from "./components/SettingsDrawer.svelte"
    import SiteFooter from "./components/SiteFooter.svelte"
    import Topbar from "./components/Topbar.svelte"
    import Views from "./components/Views.svelte"
</script>

<div id="page">
    <Topbar />
    <MakePanel />
    <Views />
    <FooterBar />
    <Scratchpad />
    <SettingsDrawer />
    <div id="tooltip_container"></div>
    <SiteFooter />
</div>
