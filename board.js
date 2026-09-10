// "Add to board" button and panel (C4: #board-button toggles #board-panel).
// Reads the current calc fragment directly (boardcore.js's
// parseCalcTargets), independent of `spec`/solver state, so it works
// regardless of what the rest of the page is doing.
//
// boardcore.js is loaded lazily (dynamic import, inside the open-click
// handler) rather than imported at module scope: this module is in
// init.js's boot graph with no surrounding try/catch, so a static import
// failing here would abort the whole calculator.

// Fragments longer than this are rejected client-side rather than posted
// (matches board.MAX_PLAN_LEN on the server, which would reject them anyway
// -- this just avoids a round trip and gives an inline reason).
const MAX_PLAN_LEN = 4000

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

let catalogPromise = null
function fetchCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/catalog")
      .then((resp) => (resp.ok ? resp.json() : { entries: [] }))
      .catch(() => ({ entries: [] }))
  }
  return catalogPromise
}

function labelMap(catalog) {
  const map = new Map()
  for (const entry of (catalog && catalog.entries) || []) {
    if (entry && entry.name) map.set(entry.name, entry.label || entry.name)
  }
  return (item) => map.get(item) || item
}

// Undo calc/fragment.js's zip= compression (raw-deflate + base64), the same
// way calc/fragment.js's own loadSettings does, before handing the fragment
// to parseCalcTargets -- by the time a user clicks the button the page has
// usually already zipped its own hash.
function decodeZipHash(hash) {
  if (!hash) return hash
  const h = hash[0] === "#" ? hash.slice(1) : hash
  // Not URLSearchParams: the zip value is raw base64 (unescaped "+" and "="
  // are part of the payload), and form-decoding would corrupt it.
  let zip = null
  for (const pair of h.split("&")) {
    const i = pair.indexOf("=")
    if (i !== -1 && pair.slice(0, i) === "zip") {
      zip = pair.slice(i + 1)
      break
    }
  }
  if (!zip || typeof pako === "undefined") return hash
  try {
    const raw = atob(zip)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    const inflated = pako.inflateRaw(bytes, { to: "string" })
    return "#" + inflated
  } catch (err) {
    console.warn("board: could not decompress the zipped fragment", err)
    return hash
  }
}

function clearPanel(panel) {
  while (panel.firstChild) panel.removeChild(panel.firstChild)
}

function renderNote(panel, text) {
  clearPanel(panel)
  const deep = document.createElement("div")
  deep.className = "deep muted"
  deep.id = "board-note"
  deep.textContent = text
  panel.appendChild(deep)
}

function renderForm(panel, allTargets, rateTargets, labelFor, cardTitle, COLUMNS) {
  clearPanel(panel)

  const deep = document.createElement("div")
  deep.className = "deep"
  deep.style.display = "flex"
  deep.style.flexDirection = "column"
  deep.style.gap = "6px"

  const titleInput = document.createElement("input")
  titleInput.type = "text"
  titleInput.id = "board-title-input"
  titleInput.value = cardTitle(allTargets, labelFor)
  deep.appendChild(titleInput)

  const columnSelect = document.createElement("select")
  columnSelect.id = "board-column-select"
  for (const col of COLUMNS) {
    const option = document.createElement("option")
    option.value = col
    option.textContent = capitalize(col)
    columnSelect.appendChild(option)
  }
  columnSelect.value = "backlog"
  deep.appendChild(columnSelect)

  const checksBox = document.createElement("div")
  checksBox.id = "board-checks"
  for (const target of rateTargets) {
    const row = document.createElement("div")
    row.className = "row"

    const check = document.createElement("span")
    check.className = "check board-check"
    check.dataset.checked = "1"
    check.dataset.item = target.item
    check.dataset.value = String(target.value)
    check.textContent = "✓"
    check.addEventListener("click", () => {
      const on = check.dataset.checked !== "1"
      check.dataset.checked = on ? "1" : "0"
      check.textContent = on ? "✓" : ""
    })
    row.appendChild(check)

    const label = document.createElement("span")
    label.textContent = `${target.value}/min ${labelFor(target.item)}`
    row.appendChild(label)

    checksBox.appendChild(row)
  }
  deep.appendChild(checksBox)

  const actions = document.createElement("div")
  actions.className = "row"

  const addBtn = document.createElement("span")
  addBtn.className = "btn btn-green"
  addBtn.id = "board-add-btn"
  addBtn.textContent = "Add"
  actions.appendChild(addBtn)

  const cancelBtn = document.createElement("span")
  cancelBtn.className = "btn"
  cancelBtn.id = "board-cancel-btn"
  cancelBtn.textContent = "Cancel"
  actions.appendChild(cancelBtn)

  deep.appendChild(actions)

  const result = document.createElement("div")
  result.id = "board-result"
  deep.appendChild(result)

  panel.appendChild(deep)

  cancelBtn.addEventListener("click", () => {
    panel.hidden = true
  })
  addBtn.addEventListener("click", () => {
    onAddClick(checksBox, titleInput, columnSelect, result)
  })
}

function onAddClick(checksBox, titleInput, columnSelect, result) {
  const checks = Array.from(checksBox.querySelectorAll(".board-check"))
  const checked = checks.filter((c) => c.dataset.checked === "1")
  if (checked.length === 0) {
    result.textContent = "Check at least one target first."
    return
  }

  const goals = checked.map((c) => ({
    type: "rate",
    item: c.dataset.item,
    target: Number(c.dataset.value),
  }))
  const icon = checked[0].dataset.item
  const column = columnSelect.value
  const title = titleInput.value
  const plan = location.hash

  if (plan.length > MAX_PLAN_LEN) {
    result.textContent =
      "This plan is too long to attach (over 4,000 characters); shrink the factory " +
      "or add the card by hand."
    return
  }

  result.textContent = "Adding…"

  fetch("/api/board/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, column, icon, goals, plan }),
  })
    .then(async (resp) => {
      let payload = null
      try {
        payload = await resp.json()
      } catch (_err) {
        payload = null
      }
      if (!resp.ok) {
        result.textContent = (payload && payload.error) || "Could not add the card."
        return
      }
      clearPanel(result)
      result.appendChild(document.createTextNode("Added to " + capitalize(column) + " — "))
      const link = document.createElement("a")
      link.href = "/board/board.html"
      link.target = "_blank"
      link.rel = "noopener"
      link.textContent = "open board"
      result.appendChild(link)
    })
    .catch(() => {
      result.textContent = "Could not reach the board server."
    })
}

async function onOpenClick(panel) {
  let boardcore
  try {
    boardcore = await import("/board/boardcore.js")
  } catch (err) {
    renderNote(panel, "Could not load the board module.")
    console.error("board button failed", err)
    return
  }
  const { parseCalcTargets, cardTitle, COLUMNS } = boardcore

  const decoded = decodeZipHash(location.hash)
  const targets = parseCalcTargets(decoded)
  const rateTargets = targets.filter((t) => t.mode === "r")

  if (rateTargets.length === 0) {
    renderNote(panel, "Set at least one rate target first.")
    return
  }

  renderNote(panel, "Loading…")
  const catalog = await fetchCatalog()
  const labelFor = labelMap(catalog)
  renderForm(panel, targets, rateTargets, labelFor, cardTitle, COLUMNS)
}

export function initBoard() {
  try {
    const button = document.getElementById("board-button")
    const panel = document.getElementById("board-panel")
    if (!button || !panel) return

    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden
      if (panel.hidden) return
      onOpenClick(panel).catch((err) => console.error("board button failed", err))
    })
  } catch (err) {
    console.error("board button failed", err)
  }
}
