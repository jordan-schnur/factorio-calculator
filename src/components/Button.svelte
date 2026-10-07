<script>
    let { variant, size, class: extra, children, ...rest } = $props()
</script>

<button class={["btn", variant && `btn-${variant}`, size && `btn-${size}`, extra]} {...rest}>{@render children?.()}</button>
