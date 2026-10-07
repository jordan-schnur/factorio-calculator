<script>
    let { id, name, value, label, checked = false, onchange } = $props()
</script>

<input {id} type="radio" {name} {value} {checked} {onchange}><label for={id}>{label}</label>
