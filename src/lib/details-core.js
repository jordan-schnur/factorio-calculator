// The maths behind a row's detail and its hover cards: spec, totals and rows in, plain values and strings out, no DOM.
import { beltWords, destinationLines, flowLines } from "./ratio-core.js"
import { one, Rational, zero } from "./rational.js"
import { rateText } from "./table-core.js"

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
	let row = rows.find(r => r.item === item)
	if (!row) {
		return null
	}
	if (!row.isReal) {
		return { kind: "in", text: "brought in" }
	}
	if (row.isResource) {
		return item.phase === "fluid" ? { kind: "pipe", text: "piped in" } : { kind: "mine", text: "mined" }
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
