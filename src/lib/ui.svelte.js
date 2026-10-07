let settingsOpen = $state(false)

export const ui = {
    get settingsOpen() { return settingsOpen },
}

export function openSettings() {
    settingsOpen = true
}

export function closeSettings() {
    settingsOpen = false
}
