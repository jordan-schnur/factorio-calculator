<script>
    import { mountModuleEditor } from "../../lib/modules-editor.js"

    let { band } = $props()

    // modules-editor.js fills the band; emptying it on teardown drops that legacy DOM.
    function editor(opts) {
        return node => {
            mountModuleEditor(node, opts)
            return () => {
                node.textContent = ""
            }
        }
    }
</script>

<div class="modband" {@attach editor(band)}></div>
