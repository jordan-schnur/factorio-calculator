<script>
    let { variant, size, type = "button", class: extra, children, ...rest } = $props()
</script>

<button {type} class={["btn", variant && `btn-${variant}`, size && `btn-${size}`, extra]} {...rest}>{@render children?.()}</button>
