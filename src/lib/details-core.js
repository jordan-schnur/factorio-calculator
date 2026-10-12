// The maths behind a row's detail and its hover cards: spec, totals and rows in, plain values and strings out, no DOM.
import { isMultiOutput, outputsOf, usedOutputs } from "./byproduct-core.js"
import { recipesFor } from "./machines-core.js"
import { beltWords, destinationLines, flowLines, goesToRatio, needsRatio } from "./ratio-core.js"
import { one, Rational, zero } from "./rational.js"
import { relevantRecipes, sourceOptions } from "./source.js"
import { rateText } from "./table-core.js"
import { buildRows, powerRepr } from "./table.js"

const HUNDRED = Rational.from_float(100)

// The "Goes to" share as a rounded percentage, "<1%" so a real-but-tiny consumer never reads 0%.
export function percentText(share) {
	let percent = share.mul(HUNDRED)
	if (percent.less(one)) {
		return "<1%"
	}
	return percent.toDecimal(0) + "%"
}

export function isTargetItem(spec, item) {
	return spec.buildTargets.some(t => t.item === item)
}

// Item rate one machine running `recipe` moves, of its total `itemRate`; null when the recipe has no machine.
export function perMachine(spec, totals, recipe, itemRate) {
	if (spec.getBuilding(recipe) === null) {
		return null
	}
	let count = spec.getCount(recipe, totals.rates.get(recipe) || zero)
	return count.isZero() ? null : itemRate.div(count)
}

// {supplier, consumer, p, q}: p/q `consumer` machines per machine making `item`; null when a side has none or it is brought in.
export function machineRatio(spec, totals, rows, item, consumer, consumedRate) {
	let row = rows.find(r => r.item === item)
	if (!row || !row.isReal) {
		return null
	}
	let produced = (totals.producers.get(item) || new Map()).get(row.recipe) || row.itemRate
	let perSupplier = perMachine(spec, totals, row.recipe, produced)
	let perConsumer = perMachine(spec, totals, consumer, consumedRate)
	if (perSupplier === null || perConsumer === null || perConsumer.isZero()) {
		return null
	}
	let r = perSupplier.div(perConsumer)
	return {
		supplier: spec.getBuilding(row.recipe).name,
		consumer: spec.getBuilding(consumer).name,
		p: r.p.toJSNumber(),
		q: r.q.toJSNumber(),
	}
}

// {building, recipe, count, total}: `count` of `recipe`'s `total` machines move `share` of its output; null without a machine.
export function machinesOn(spec, totals, recipe, share) {
	let building = spec.getBuilding(recipe)
	if (building === null) {
		return null
	}
	let total = spec.getCount(recipe, totals.rates.get(recipe) || zero)
	if (total.isZero()) {
		return null
	}
	return { building: building.name, recipe: recipe.name, count: total.mul(share).toFloat(), total: total.toFloat() }
}

// The machines making `rate` of `item`, each recipe its share of the item's output; empty when the item is brought in.
export function suppliersOf(spec, totals, rows, item, rate) {
	let row = rows.find(r => r.item === item)
	if (!row || !row.isReal) {
		return []
	}
	let producers = [...(totals.producers.get(item) || new Map())]
	let produced = producers.reduce((sum, [, r]) => sum.add(r), zero)
	if (produced.isZero()) {
		return []
	}
	let share = rate.div(produced)
	return producers.map(([recipe]) => machinesOn(spec, totals, recipe, share)).filter(m => m !== null)
}

// The machines on each side of `rate` of `item` flowing from `from` (null: brought in) into `to`.
export function linkMachines(spec, totals, item, from, to, rate) {
	let made = from === null ? null : (totals.producers.get(item) || new Map()).get(from)
	let used = (totals.consumers.get(item) || new Map()).get(to)
	return {
		supplier: made && !made.isZero() ? machinesOn(spec, totals, from, rate.div(made)) : null,
		consumer: used && !used.isZero() ? machinesOn(spec, totals, to, rate.div(used)) : null,
	}
}

// The real recipes consuming `item` as [recipe, rate] pairs, biggest first.
export function realConsumers(totals, item) {
	return [...(totals.consumers.get(item) || new Map())]
		.filter(([recipe]) => recipe.isReal())
		.sort((a, b) => b[1].toFloat() - a[1].toFloat())
}

// The proportionate links carrying `item` from `recipe` into real recipes, biggest first.
export function outputLinks(totals, recipe, item) {
	return totals.proportionate
		.filter(l => l.from === recipe && l.item === item && l.to.isReal())
		.sort((a, b) => b.rate.toFloat() - a.rate.toFloat())
}

// The lines of a Needs/Goes to rate's hover card: belts, the machines making it, the `consumer` machines using it.
export function flowCardLines(spec, totals, rows, item, consumer, rate) {
	return flowLines({
		belts: spec.getBeltCount(rate).toFloat(),
		beltName: spec.belt.name,
		beltFormat: spec.format.beltFormat,
		fluid: item.phase === "fluid",
		suppliers: suppliersOf(spec, totals, rows, item, rate),
		consumer: machinesOn(spec, totals, consumer, one),
	})
}

// A table row's Need hover card as {total, summary, destinations}; null when none of `item` is made.
export function itemCard(spec, totals, rows, item) {
	let total = totals.items.get(item) || zero
	if (total.isZero()) {
		return null
	}
	let fluid = item.phase === "fluid"
	let summary = flowLines({
		belts: spec.getBeltCount(total).toFloat(),
		beltName: spec.belt.name,
		beltFormat: spec.format.beltFormat,
		fluid,
		suppliers: suppliersOf(spec, totals, rows, item, total),
		consumer: null,
	})
	let flows = realConsumers(totals, item)
		.map(([recipe, rate]) => ({ name: recipe.name, rate, consumer: machinesOn(spec, totals, recipe, one) }))
	let left = flows.reduce((sum, f) => sum.sub(f.rate), total)
	if (isTargetItem(spec, item) && zero.less(left)) {
		flows.push({ name: "What you asked for", rate: left, consumer: null })
	}
	let destinations = flows.map(f => destinationLines({
		name: f.name,
		rate: rateText(spec.format, f.rate),
		percent: percentText(f.rate.div(total)),
		belts: fluid ? null : spec.getBeltCount(f.rate).toFloat(),
		beltName: spec.belt.name,
		beltFormat: spec.format.beltFormat,
		suppliers: suppliersOf(spec, totals, rows, item, f.rate).map(m => ({ building: m.building, count: m.count })),
		consumer: f.consumer ? { building: f.consumer.building, count: f.consumer.count } : null,
	}))
	return { total, summary, destinations }
}

// The {kind, text} badge on a Needs line for an ingredient brought in, mined or piped in; null otherwise.
export function needBadgeOf(rows, item) {
	return rowBadge(rows.find(r => r.item === item))
}

// The {kind, text} badge for a row brought in, mined or piped in; null for a row made here (or no row).
export function rowBadge(row) {
	if (!row) {
		return null
	}
	if (!row.isReal) {
		return { kind: "in", text: "brought in" }
	}
	if (row.isResource) {
		return row.item.phase === "fluid" ? { kind: "pipe", text: "piped in" } : { kind: "mine", text: "mined" }
	}
	return null
}

// The note under a multi-output's leftover `item`: sent out, or nothing here uses it.
export function leftoverText(spec, item, leftover) {
	let rate = rateText(spec.format, leftover)
	return spec.sendOut.has(item.key) ? `${rate} sent out.` : `${rate} nothing here uses: see the fixes above.`
}

// The graph side card's subtitle: `rate` of `item` and the belts (or pipe) it fills.
export function headSubtitle(spec, item, rate) {
	let beltPart = item.phase === "fluid" ? "pipe" : beltWords(spec.getBeltCount(rate).toFloat(), spec.format.beltFormat)
	return `${rateText(spec.format, rate)} · ${beltPart}`
}

// FlowTooltip's props for the hover card on a rate whose on-screen text is `text`.
export function flowCard(spec, totals, rows, item, consumer, rate, text) {
	let lines = flowCardLines(spec, totals, rows, item, consumer, rate)
	return { heading: `${text} ${item.name}`, lines: lines.map(line => ({ text: line })) }
}

function needsModel(spec, totals, rows, row) {
	if (!row) {
		return { empty: "Nothing needed.", lines: [] }
	}
	if (!row.isReal) {
		return { empty: "Made in another build; nothing needed here.", lines: [] }
	}
	if (row.isResource) {
		return { empty: row.item.phase === "fluid" ? "Piped in." : "Mined here.", lines: [] }
	}
	let ingredients = row.recipe.ingredients || []
	let lines = ingredients.map(ing => {
		let amount = ing.amount.mul(row.recipeRate)
		let rate = (totals.consumers.get(ing.item) || new Map()).get(row.recipe) || amount
		let text = rateText(spec.format, amount)
		let ratio = machineRatio(spec, totals, rows, ing.item, row.recipe, rate)
		return {
			icon: ing.item,
			name: ing.item.name,
			badge: needBadgeOf(rows, ing.item),
			text,
			card: flowCard(spec, totals, rows, ing.item, row.recipe, rate, text),
			ratio: ratio ? needsRatio(ratio.supplier, ratio.consumer, ratio.p, ratio.q) : null,
		}
	})
	return { empty: ingredients.length === 0 ? "Nothing needed." : null, lines }
}

function goesToModel(spec, totals, rows, item, isTarget) {
	let totalRate = totals.items.get(item) || zero
	let lines = realConsumers(totals, item).map(([recipe, rate]) => {
		let text = rateText(spec.format, rate)
		let ratio = machineRatio(spec, totals, rows, item, recipe, rate)
		return {
			icon: recipe.products[0].item,
			name: recipe.name,
			share: percentText(totalRate.isZero() ? zero : rate.div(totalRate)),
			text,
			card: flowCard(spec, totals, rows, item, recipe, rate, text),
			ratio: ratio ? goesToRatio(ratio.supplier, ratio.consumer, ratio.p, ratio.q) : null,
		}
	})
	let empty = isTarget ? "This is what you asked for." : "Nothing consumes it."
	return { empty: lines.length === 0 ? empty : null, lines }
}

function makesNote(spec, item, links, leftover) {
	if (!leftover.isZero()) {
		return { class: "left-note", text: leftoverText(spec, item, leftover) }
	}
	if (links.length === 0 && isTargetItem(spec, item)) {
		return { class: "out-to", text: "This is what you asked for." }
	}
	return null
}

function makesModel(spec, totals, rows, row) {
	return outputsOf(totals, row.recipe).map(({ item, rate, leftover }) => {
		let links = outputLinks(totals, row.recipe, item)
		return {
			item,
			text: rateText(spec.format, rate),
			links: links.map(link => {
				let text = rateText(spec.format, link.rate)
				return {
					icon: link.to.products[0].item,
					name: link.to.name,
					share: percentText(rate.isZero() ? zero : link.rate.div(rate)),
					text,
					card: flowCard(spec, totals, rows, item, link.to, link.rate, text),
				}
			}),
			note: makesNote(spec, item, links, leftover),
		}
	})
}

// A multi-output row is keyed by its first product, which the plan may not use: bringing it in brings in what is used.
function segModel(totals, item, row) {
	let supplied = !row.isReal
	let items = [item]
	if (!supplied && isMultiOutput(row.recipe)) {
		let used = usedOutputs(totals, row.recipe)
		if (used.length > 0) {
			items = used
		}
	}
	return { supplied, keys: items.map(i => i.key) }
}

function machineModel(spec, totals, recipe) {
	let capable = spec.capableBuildings(recipe)
	let current = spec.getBuilding(recipe)
	let quality = current && current.takesQuality ? { building: current, tier: spec.machineTier(current) } : null
	if (capable.length < 2) {
		return { recipe, current, quality, slots: [], others: [], pinned: false }
	}
	return {
		recipe,
		current,
		quality,
		slots: capable.map(building => ({ building, sel: building === current, off: spec.excludedBuildings.has(building.key) })),
		others: recipesFor(current, [...totals.rates.keys()]).filter(r => r !== recipe && spec.getBuilding(r) !== current),
		pinned: spec.recipeBuildings.has(recipe.key),
	}
}

function exactLine(spec, row) {
	let exact = spec.getCount(row.recipe, row.recipeRate).toDecimal(2)
	let power = powerRepr(spec.getPowerUsage(row.recipe, row.recipeRate).power)
	return `${exact} machines exactly · ${power}`
}

function sourceModel(spec, totals, item, row, isTarget, isResource) {
	let building = row ? spec.getBuilding(row.recipe) : null
	let fallback = building !== null && spec.isFallbackBuilding(row.recipe)
	return {
		seg: row && !isTarget && !isResource ? segModel(totals, item, row) : null,
		options: relevantRecipes(item).length > 1 ? sourceOptions(item, totals).options : null,
		machine: building !== null ? machineModel(spec, totals, row.recipe) : null,
		exact: building !== null ? exactLine(spec, row) : null,
		fallback: fallback ? `No available machine makes this, so it uses ${building.name.toLowerCase()} (switched off in Settings → Machines).` : null,
	}
}

// Everything a row's detail shows for `item`, looked up fresh from `totals`.
export function detailModel(spec, totals, item) {
	let rows = buildRows(totals)
	let row = rows.find(r => r.item === item) || null
	let isTarget = row ? row.isTarget : isTargetItem(spec, item)
	let isResource = row ? row.isResource : false
	let multi = row !== null && row.isReal && isMultiOutput(row.recipe)
	let building = row && row.isReal ? spec.getBuilding(row.recipe) : null
	return {
		needs: needsModel(spec, totals, rows, row),
		goesTo: multi ? null : goesToModel(spec, totals, rows, item, isTarget),
		makes: multi ? makesModel(spec, totals, rows, row) : null,
		source: sourceModel(spec, totals, item, row, isTarget, isResource),
		band: building !== null && building.moduleSlots > 0 ? { scope: "row", recipe: row.recipe, machine: building, row } : null,
	}
}

// The graph side card's head for the selected item, or null when the card is closed.
export function sideModel(spec, totals) {
	if (!spec || !totals) {
		return null
	}
	let item = spec.view === "graph" && spec.whereItem ? spec.items.get(spec.whereItem) : null
	if (!item || !totals.items.has(item)) {
		return null
	}
	let row = buildRows(totals).find(r => r.item === item)
	if (row && row.isReal && isMultiOutput(row.recipe)) {
		return { item, icon: row.recipe, title: row.recipe.name, sub: `${row.recipe.products.length} outputs, all of them have to be used` }
	}
	return { item, icon: item, title: item.name, sub: headSubtitle(spec, item, totals.items.get(item) || zero) }
}
