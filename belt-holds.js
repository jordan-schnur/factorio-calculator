// SPDX-License-Identifier: Apache-2.0 · Copyright 2026 Jordan Schnur
// The "Graph lines" Display setting: line chips say what one belt holds.

import { storedFlag } from "./stored-flag.js"

const flag = storedFlag("calc.beltholds", "belt_holds_toggle")

export const beltHoldsOn = flag.on
export const setBeltHolds = flag.set
export const applyBeltHolds = flag.apply
