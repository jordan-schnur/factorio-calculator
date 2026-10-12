let open = $state(false)

export const feedback = {
    get open() { return open },
}

export function openFeedback() {
    open = true
}

export function closeFeedback() {
    open = false
}
