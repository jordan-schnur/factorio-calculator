// A keydown handler that runs `action` on Enter or Space, for an element with role="button" or "checkbox".
export function onActivate(action) {
    return event => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        action(event)
    }
}
