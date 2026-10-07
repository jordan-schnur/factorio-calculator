import { render } from "svelte/server"
import App from "./App.svelte"

export const renderApp = () => render(App).body
