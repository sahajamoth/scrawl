import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { ChartSeries, LayoutChart, LayoutResult } from '../ir/types.js'
import { createLabel } from './labels.js'
import type { RenderStyle } from './styles.js'
import { deriveSeed } from '../layout/seed.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any

const SERIES_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#d97706', '#0891b2', '#ca8a04', '#db2777', '#059669']

interface LegendItem {
  label: string
  color: string
}

interface PieSlice extends LegendItem {
  value: number
  startAngle: number
  endAngle: number
}

interface ChartBox {
  x: number
  y: number
  width: number
  height: number
}

interface TreeNode {
  name: string
  value: number
  color?: string
  children: TreeNode[]
}

interface SankeyNodeLayout {
  id: string
  layer: number
  x: number
  y: number
  width: number
  height: number
  inOffset: number
  outOffset: number
}

interface SankeyLinkLayout {
  from: SankeyNodeLayout
  to: SankeyNodeLayout
  value: number
  color: string
  startY: number
  endY: number
  thickness: number
}

function colorForSeries(series: ChartSeries | undefined, index: number) {
  return series?.color ?? SERIES_COLORS[index % SERIES_COLORS.length]!
}

function scaleX(chart: LayoutChart, value: number) {
  const span = Math.max(chart.maxX - chart.minX, 1)
  return chart.plotX + ((value - chart.minX) / span) * chart.plotWidth
}

function scaleY(chart: LayoutChart, value: number, axis: 'left' | 'right' = 'left') {
  const min = axis === 'right' ? (chart.minY2 ?? chart.minY) : chart.minY
  const max = axis === 'right' ? (chart.maxY2 ?? chart.maxY) : chart.maxY
  const span = Math.max(max - min, 1)
  return chart.plotY + chart.plotHeight - ((value - min) / span) * chart.plotHeight
}

function zeroBaseline(chart: LayoutChart, axis: 'left' | 'right' = 'left') {
  const min = axis === 'right' ? (chart.minY2 ?? chart.minY) : chart.minY
  const max = axis === 'right' ? (chart.maxY2 ?? chart.maxY) : chart.maxY
  if (min <= 0 && max >= 0) return 0
  return min
}

function categoryCenterX(chart: LayoutChart, index: number) {
  return chart.plotX + ((index + 0.5) / Math.max(chart.xTicks.length, 1)) * chart.plotWidth
}

function categoryBandWidth(chart: LayoutChart) {
  return chart.plotWidth / Math.max(chart.xTicks.length, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function text(
  doc: AnyDoc,
  value: string,
  x: number,
  y: number,
  size = 12,
  color = '#475569',
  anchor: 'start' | 'middle' | 'end' = 'start',
) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
  el.setAttribute('x', x.toFixed(1))
  el.setAttribute('y', y.toFixed(1))
  el.setAttribute('font-family', '"Permanent Marker", cursive')
  el.setAttribute('font-size', String(size))
  el.setAttribute('fill', color)
  el.setAttribute('text-anchor', anchor)
  el.textContent = value
  return el as SVGElement
}

function rect(doc: AnyDoc, x: number, y: number, width: number, height: number, fill: string, stroke: string, strokeWidth = 1, radius = 0) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
  el.setAttribute('x', x.toFixed(1))
  el.setAttribute('y', y.toFixed(1))
  el.setAttribute('width', width.toFixed(1))
  el.setAttribute('height', height.toFixed(1))
  el.setAttribute('fill', fill)
  el.setAttribute('stroke', stroke)
  el.setAttribute('stroke-width', String(strokeWidth))
  if (radius > 0) {
    el.setAttribute('rx', radius.toFixed(1))
    el.setAttribute('ry', radius.toFixed(1))
  }
  return el as SVGElement
}

function line(doc: AnyDoc, x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth = 1.2, dasharray?: string) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'line')
  el.setAttribute('x1', x1.toFixed(1))
  el.setAttribute('y1', y1.toFixed(1))
  el.setAttribute('x2', x2.toFixed(1))
  el.setAttribute('y2', y2.toFixed(1))
  el.setAttribute('stroke', stroke)
  el.setAttribute('stroke-width', String(strokeWidth))
  if (dasharray) el.setAttribute('stroke-dasharray', dasharray)
  return el as SVGElement
}

function path(doc: AnyDoc, d: string, stroke: string, strokeWidth = 1.5, fill = 'none', opacity?: number) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  el.setAttribute('stroke', stroke)
  el.setAttribute('stroke-width', String(strokeWidth))
  el.setAttribute('fill', fill)
  if (opacity != null) el.setAttribute('opacity', opacity.toFixed(3))
  return el as SVGElement
}

function circle(doc: AnyDoc, cx: number, cy: number, r: number, fill: string, stroke: string, strokeWidth = 1.2) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'circle')
  el.setAttribute('cx', cx.toFixed(1))
  el.setAttribute('cy', cy.toFixed(1))
  el.setAttribute('r', r.toFixed(1))
  el.setAttribute('fill', fill)
  el.setAttribute('stroke', stroke)
  el.setAttribute('stroke-width', String(strokeWidth))
  return el as SVGElement
}

function polygon(doc: AnyDoc, points: Array<[number, number]>, fill: string, stroke: string, strokeWidth = 1.3, opacity?: number) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  el.setAttribute('points', points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
  el.setAttribute('fill', fill)
  el.setAttribute('stroke', stroke)
  el.setAttribute('stroke-width', String(strokeWidth))
  if (opacity != null) el.setAttribute('opacity', opacity.toFixed(3))
  return el as SVGElement
}

function overlap(a: ChartBox, b: ChartBox) {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y)
}

function maybeLabel(
  doc: AnyDoc,
  layer: SVGElement,
  occupied: ChartBox[],
  label: string,
  x: number,
  y: number,
  mode: 'show' | 'hide' | 'auto',
  anchor: 'start' | 'middle' | 'end' = 'middle',
  color = '#334155',
) {
  if (mode === 'hide') return
  const width = Math.max(18, label.length * 6.5)
  const box: ChartBox = { x: x - width / 2, y: y - 10, width, height: 14 }
  if (mode === 'auto' && occupied.some(item => overlap(item, box))) return
  occupied.push(box)
  layer.appendChild(text(doc, label, x, y, 10, color, anchor))
}

function linePoints(chart: LayoutChart, values: number[], axis: 'left' | 'right' = 'left') {
  const denom = Math.max(values.length - 1, 1)
  return values.map((value, index) => [
    chart.plotX + (index / denom) * chart.plotWidth,
    scaleY(chart, value, axis),
  ] as [number, number])
}

function stepPath(points: Array<[number, number]>) {
  if (points.length === 0) return ''
  let d = `M ${points[0]![0].toFixed(1)} ${points[0]![1].toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const next = points[i]!
    d += ` L ${next[0].toFixed(1)} ${prev[1].toFixed(1)} L ${next[0].toFixed(1)} ${next[1].toFixed(1)}`
  }
  return d
}

function smoothPath(points: Array<[number, number]>) {
  if (points.length < 2) return ''
  let d = `M ${points[0]![0].toFixed(1)} ${points[0]![1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]!
    const next = points[i + 1]!
    const midX = (current[0] + next[0]) / 2
    d += ` C ${midX.toFixed(1)} ${current[1].toFixed(1)}, ${midX.toFixed(1)} ${next[1].toFixed(1)}, ${next[0].toFixed(1)} ${next[1].toFixed(1)}`
  }
  return d
}

function polylinePath(points: Array<[number, number]>, curve: 'linear' | 'smooth' | 'step') {
  if (points.length === 0) return ''
  if (curve === 'smooth') return smoothPath(points)
  if (curve === 'step') return stepPath(points)
  return `M ${points.map(([x, y], index) => `${index === 0 ? '' : 'L '}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')}`
}

function filledAreaPath(points: Array<[number, number]>, baseline: Array<[number, number]>, curve: 'linear' | 'smooth' | 'step') {
  const top = polylinePath(points, curve)
  const bottom = baseline.slice().reverse()
  const tail = bottom.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return `${top} ${tail} Z`
}

function pieSlices(chart: LayoutChart): PieSlice[] {
  const labels = chart.series.length === 1
    ? (chart.categories ?? chart.series[0]?.values?.map((_, index) => String(index + 1)) ?? [])
    : (chart.categories ?? chart.series.map(series => series.name))
  const values = chart.series.length === 1
    ? (chart.series[0]?.values ?? [])
    : chart.series.map(series => series.values?.[0] ?? 0)
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0)
  let angle = -Math.PI / 2

  return values.map((value, index) => {
    const ratio = total > 0 ? Math.max(value, 0) / total : 0
    const nextAngle = angle + ratio * Math.PI * 2
    const slice: PieSlice = {
      label: labels[index] ?? `Slice ${index + 1}`,
      color: colorForSeries(chart.series.length === 1 ? undefined : chart.series[index], index),
      value,
      startAngle: angle,
      endAngle: nextAngle,
    }
    angle = nextAngle
    return slice
  })
}

function chartLegendItems(chart: LayoutChart): LegendItem[] {
  if (chart.kind === 'pie' || chart.kind === 'donut') return pieSlices(chart)
  if (chart.kind === 'heatmap') return []
  if (chart.kind === 'sankey') return []
  if (chart.kind === 'treemap' || chart.kind === 'sunburst') return []
  if (chart.kind === 'gauge') {
    return (chart.thresholds ?? []).map((threshold, index) => ({
      label: threshold.label ?? `Threshold ${index + 1}`,
      color: threshold.color,
    }))
  }
  return chart.series.map((series, index) => ({
    label: series.name,
    color: colorForSeries(series, index),
  }))
}

function renderLegend(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const items = chartLegendItems(chart)
  if ((chart.legend ?? 'right') === 'none' || items.length === 0) return

  const legend = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  legend.setAttribute('class', 'scrawl-chart-legend')
  const position = chart.legend ?? 'right'

  if (position === 'right') {
    items.forEach((item, index) => {
      const y = chart.plotY + 16 + index * 20
      const x = chart.plotX + chart.plotWidth + 24
      legend.appendChild(line(doc, x, y, x + 24, y, item.color, 3))
      legend.appendChild(text(doc, item.label, x + 32, y + 4, 11))
    })
    layer.appendChild(legend)
    return
  }

  const slot = Math.max(Math.floor((chart.plotWidth - 12) / Math.max(items.length, 1)), 120)
  const y = position === 'top' ? chart.plotY - 26 : chart.plotY + chart.plotHeight + 46
  items.forEach((item, index) => {
    const x = chart.plotX + 8 + index * slot
    legend.appendChild(line(doc, x, y, x + 22, y, item.color, 3))
    legend.appendChild(text(doc, item.label, x + 30, y + 4, 11))
  })
  layer.appendChild(legend)
}

function renderAxes(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, style: RenderStyle) {
  const axisFree = chart.kind === 'pie'
    || chart.kind === 'donut'
    || chart.kind === 'treemap'
    || chart.kind === 'sunburst'
    || chart.kind === 'sankey'
    || chart.kind === 'gauge'
    || chart.kind === 'radar'
    || chart.kind === 'radial-bar'
    || chart.kind === 'funnel'
  if (axisFree) return

  if (chart.kind === 'heatmap') {
    layer.appendChild(rect(doc, chart.plotX, chart.plotY, chart.plotWidth, chart.plotHeight, 'none', '#cbd5e1', 1.2))
    chart.yTicks.forEach((tick, index) => {
      const y = chart.plotY + ((index + 0.5) / Math.max(chart.yTicks.length, 1)) * chart.plotHeight
      layer.appendChild(text(doc, tick.label, chart.plotX - 12, y + 4, 11, '#475569', 'end'))
    })
    chart.xTicks.forEach((tick, index) => {
      const x = chart.plotX + ((index + 0.5) / Math.max(chart.xTicks.length, 1)) * chart.plotWidth
      layer.appendChild(text(doc, tick.label, x, chart.plotY + chart.plotHeight + 22, 11, '#475569', 'middle'))
    })
    return
  }

  const gridMode = chart.grid ?? 'y'
  if (gridMode === 'y' || gridMode === 'both') {
    chart.yTicks.forEach(tick => {
      const y = scaleY(chart, tick.value)
      layer.appendChild(line(doc, chart.plotX, y, chart.plotX + chart.plotWidth, y, '#e2e8f0', 1))
    })
  }

  if (gridMode === 'x' || gridMode === 'both') {
    chart.xTicks.forEach((tick, index) => {
      const x = chart.kind === 'bar'
        || chart.kind === 'area'
        || chart.kind === 'line'
        || chart.kind === 'combo'
        || chart.kind === 'waterfall'
        || chart.kind === 'box'
        || chart.kind === 'likert'
        || chart.kind === 'tornado'
        ? categoryCenterX(chart, index)
        : scaleX(chart, tick.value)
      layer.appendChild(line(doc, x, chart.plotY, x, chart.plotY + chart.plotHeight, '#e2e8f0', 1))
    })
  }

  layer.appendChild(line(doc, chart.plotX, chart.plotY, chart.plotX, chart.plotY + chart.plotHeight, '#475569', 1.5))
  layer.appendChild(line(doc, chart.plotX, chart.plotY + chart.plotHeight, chart.plotX + chart.plotWidth, chart.plotY + chart.plotHeight, '#475569', 1.5))

  if ((chart.y2Ticks?.length ?? 0) > 0) {
    const x = chart.plotX + chart.plotWidth
    layer.appendChild(line(doc, x, chart.plotY, x, chart.plotY + chart.plotHeight, '#475569', 1.5))
    chart.y2Ticks?.forEach(tick => {
      const y = scaleY(chart, tick.value, 'right')
      layer.appendChild(text(doc, tick.label, x + 12, y + 4, 11, '#475569', 'start'))
    })
  }

  chart.yTicks.forEach(tick => {
    const y = scaleY(chart, tick.value)
    layer.appendChild(text(doc, tick.label, chart.plotX - 12, y + 4, 11, '#475569', 'end'))
  })

  chart.xTicks.forEach((tick, index) => {
    const x = chart.kind === 'scatter' || chart.kind === 'dot'
      ? scaleX(chart, tick.value)
      : categoryCenterX(chart, index)
    layer.appendChild(text(doc, tick.label, x, chart.plotY + chart.plotHeight + 22, 11, '#475569', 'middle'))
  })

  if (style.strokeWidth[0] > 0 && chart.minY < 0 && chart.maxY > 0) {
    const y = scaleY(chart, 0)
    layer.appendChild(line(doc, chart.plotX, y, chart.plotX + chart.plotWidth, y, '#94a3b8', 1, '4 4'))
  }
}

function renderTitles(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, layout: LayoutResult, style: RenderStyle) {
  if (chart.title) {
    const title = createLabel(doc, chart.title, layout.width / 2, 42, 18, deriveSeed(layout.seed, 'chart-title'), style)
    title.setAttribute('fill', '#1e293b')
    layer.appendChild(title)
  }
  const axisFree = chart.kind === 'pie'
    || chart.kind === 'donut'
    || chart.kind === 'treemap'
    || chart.kind === 'sunburst'
    || chart.kind === 'sankey'
    || chart.kind === 'gauge'
    || chart.kind === 'radar'
    || chart.kind === 'radial-bar'
    || chart.kind === 'funnel'
  if (!axisFree) {
    if (chart.xLabel) layer.appendChild(text(doc, chart.xLabel, chart.plotX + chart.plotWidth / 2, layout.height - 28, 12, '#475569', 'middle'))
    if (chart.yLabel) layer.appendChild(text(doc, chart.yLabel, 28, chart.plotY - 12, 12))
  }
}

function xFromReference(chart: LayoutChart, value: string | number) {
  if (typeof value === 'number') return scaleX(chart, value)
  const index = chart.xTicks.findIndex(tick => tick.label === value)
  return index === -1 ? undefined : categoryCenterX(chart, index)
}

function renderReferences(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  for (const reference of chart.references ?? []) {
    const color = reference.color ?? '#ef4444'
    if (reference.axis === 'x') {
      const x = xFromReference(chart, reference.value)
      if (x == null) continue
      layer.appendChild(line(doc, x, chart.plotY, x, chart.plotY + chart.plotHeight, color, 1.1, '5 4'))
      if (reference.label) layer.appendChild(text(doc, reference.label, x + 4, chart.plotY + 12, 10, color))
    } else {
      if (typeof reference.value !== 'number') continue
      const y = scaleY(chart, reference.value, reference.axis === 'y2' ? 'right' : 'left')
      layer.appendChild(line(doc, chart.plotX, y, chart.plotX + chart.plotWidth, y, color, 1.1, '5 4'))
      if (reference.label) layer.appendChild(text(doc, reference.label, chart.plotX + 8, y - 4, 10, color))
    }
  }
}

function renderAnnotations(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  for (const annotation of chart.annotations ?? []) {
    const x = typeof annotation.x === 'number' ? scaleX(chart, annotation.x) : xFromReference(chart, annotation.x)
    if (x == null) continue
    const y = scaleY(chart, annotation.y)
    layer.appendChild(circle(doc, x, y, 4, annotation.color ?? '#0f172a', annotation.color ?? '#0f172a', 1))
    layer.appendChild(text(doc, annotation.label, x + 8, y - 8, 10, annotation.color ?? '#0f172a'))
  }
}

function seriesLabelMode(chart: LayoutChart, series: ChartSeries) {
  return series.labels ?? chart.labels ?? 'auto'
}

function seriesCurve(chart: LayoutChart, series: ChartSeries) {
  return series.curve ?? chart.curve ?? 'linear'
}

function renderGroupedBars(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[], seriesList: ChartSeries[]) {
  const groups = chart.xTicks.length
  const slot = chart.plotWidth / Math.max(groups, 1)
  const seriesCount = seriesList.length
  const barWidth = Math.min(42, (slot * 0.72) / Math.max(seriesCount, 1))

  seriesList.forEach((series, seriesIndex) => {
    const color = colorForSeries(series, seriesIndex)
    const axis = series.axis === 'right' ? 'right' : 'left'
    const baseY = scaleY(chart, zeroBaseline(chart, axis), axis)
    ;(series.values ?? []).forEach((value, index) => {
      const x = chart.plotX + index * slot + slot * 0.14 + seriesIndex * barWidth
      const y = scaleY(chart, value, axis)
      const top = Math.min(baseY, y)
      const h = Math.abs(baseY - y)
      layer.appendChild(rect(doc, x, top, barWidth, h, `${color}55`, color, 1.2, 3))
      maybeLabel(doc, layer, occupied, formatCompact(value), x + barWidth / 2, top - 6, seriesLabelMode(chart, series))
    })
  })
}

function renderStackedBars(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[], percent = false) {
  const groups = chart.xTicks.length
  const slot = chart.plotWidth / Math.max(groups, 1)
  const barWidth = Math.min(56, slot * 0.56)
  const positive = Array.from({ length: groups }, () => 0)
  const negative = Array.from({ length: groups }, () => 0)

  for (let seriesIndex = 0; seriesIndex < chart.series.length; seriesIndex++) {
    const series = chart.series[seriesIndex]!
    const color = colorForSeries(series, seriesIndex)
    ;(series.values ?? []).forEach((rawValue, index) => {
      const totals = chart.series.reduce((sum, entry) => sum + Math.abs(entry.values?.[index] ?? 0), 0) || 1
      const value = percent ? (rawValue / totals) * 100 : rawValue
      const start = value >= 0 ? positive[index]! : negative[index]!
      const end = start + value
      if (value >= 0) positive[index] = end
      else negative[index] = end

      const x = categoryCenterX(chart, index) - barWidth / 2
      const startY = scaleY(chart, start)
      const endY = scaleY(chart, end)
      const top = Math.min(startY, endY)
      const h = Math.abs(startY - endY)
      layer.appendChild(rect(doc, x, top, barWidth, h, `${color}55`, color, 1.2, 3))
      maybeLabel(doc, layer, occupied, percent ? `${Math.round(value)}%` : formatCompact(rawValue), x + barWidth / 2, top + 12, seriesLabelMode(chart, series), 'middle', '#0f172a')
    })
  }
}

function renderLineFamily(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[], seriesList: ChartSeries[], asArea = false) {
  const count = chart.xTicks.length
  const stacked = chart.stack === 'stacked' || chart.stack === 'percent'
  const lower = Array.from({ length: count }, () => zeroBaseline(chart))

  seriesList.forEach((series, index) => {
    const valuesRaw = series.values ?? []
    const totals = chart.stack === 'percent'
      ? valuesRaw.map((_, itemIndex) => chart.series.reduce((sum, entry) => sum + Math.abs(entry.values?.[itemIndex] ?? 0), 0) || 1)
      : undefined
    const values = chart.stack === 'percent'
      ? valuesRaw.map((value, itemIndex) => (value / (totals?.[itemIndex] ?? 1)) * 100)
      : valuesRaw
    const axis = series.axis === 'right' ? 'right' : 'left'
    const curve = seriesCurve(chart, series)
    const topValues = stacked ? values.map((value, itemIndex) => lower[itemIndex]! + value) : values
    const points = linePoints(chart, topValues, axis)
    if (points.length === 0) return
    const color = colorForSeries(series, index)

    if (asArea) {
      const baselineValues = stacked ? [...lower] : Array.from({ length: values.length }, () => zeroBaseline(chart, axis))
      const baseline = linePoints(chart, baselineValues, axis)
      layer.appendChild(path(doc, filledAreaPath(points, baseline, curve), color, 1.2, `${color}2b`))
    }

    layer.appendChild(path(doc, polylinePath(points, curve), color, 2, 'none'))

    const showPoints = (series.labels ?? chart.points ?? (asArea ? 'hide' : 'show')) !== 'hide'
    if (showPoints) {
      points.forEach((point, pointIndex) => {
        layer.appendChild(circle(doc, point[0], point[1], 4.2, `${color}bb`, color, 1))
        maybeLabel(doc, layer, occupied, formatCompact(valuesRaw[pointIndex] ?? 0), point[0], point[1] - 8, seriesLabelMode(chart, series))
      })
    }

    if (stacked) {
      topValues.forEach((value, itemIndex) => {
        lower[itemIndex] = value
      })
    }
  })
}

function renderScatter(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[], seriesList: ChartSeries[]) {
  seriesList.forEach((series, index) => {
    const color = colorForSeries(series, index)
    ;(series.points ?? []).forEach((point, pointIndex) => {
      const x = scaleX(chart, point[0])
      const y = scaleY(chart, point[1])
      layer.appendChild(circle(doc, x, y, 5, `${color}aa`, color, 1.2))
      maybeLabel(doc, layer, occupied, `${formatCompact(point[0])}, ${formatCompact(point[1])}`, x, y - 8, seriesLabelMode(chart, series))
      if (pointIndex > 200) return
    })
  })
}

function pieSlicePath(cx: number, cy: number, outerRadius: number, startAngle: number, endAngle: number, innerRadius = 0): string {
  const startOuterX = cx + Math.cos(startAngle) * outerRadius
  const startOuterY = cy + Math.sin(startAngle) * outerRadius
  const endOuterX = cx + Math.cos(endAngle) * outerRadius
  const endOuterY = cy + Math.sin(endAngle) * outerRadius
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  if (innerRadius <= 0) {
    return `M ${cx} ${cy} L ${startOuterX} ${startOuterY} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuterX} ${endOuterY} Z`
  }
  const endInnerX = cx + Math.cos(endAngle) * innerRadius
  const endInnerY = cy + Math.sin(endAngle) * innerRadius
  const startInnerX = cx + Math.cos(startAngle) * innerRadius
  const startInnerY = cy + Math.sin(startAngle) * innerRadius
  return `M ${startOuterX} ${startOuterY} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuterX} ${endOuterY} L ${endInnerX} ${endInnerY} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInnerX} ${startInnerY} Z`
}

function renderPieLike(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const slices = pieSlices(chart)
  const outerRadius = Math.min(chart.plotWidth, chart.plotHeight) * 0.42
  const cx = chart.plotX + chart.plotWidth / 2
  const cy = chart.plotY + chart.plotHeight / 2
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0)
  const inner = chart.kind === 'donut' ? outerRadius * (chart.innerRadius ?? 0.56) : 0

  slices.forEach((slice, index) => {
    if (slice.startAngle === slice.endAngle) return
    layer.appendChild(path(doc, pieSlicePath(cx, cy, outerRadius, slice.startAngle, slice.endAngle, inner), slice.color, 1.3, `${slice.color}66`))

    const ratio = total > 0 ? Math.max(slice.value, 0) / total : 0
    if (ratio < 0.06) return
    const angle = (slice.startAngle + slice.endAngle) / 2
    const radius = inner > 0 ? (inner + outerRadius) / 2 : outerRadius * 0.62
    const labelX = cx + Math.cos(angle) * radius
    const labelY = cy + Math.sin(angle) * radius
    layer.appendChild(text(doc, `${Math.round(ratio * 100)}%`, labelX, labelY + 4, 11, '#0f172a', 'middle'))
  })
}

function renderWaterfall(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const values = chart.series[0]?.values ?? []
  const slot = categoryBandWidth(chart)
  const barWidth = Math.min(48, slot * 0.56)
  let running = 0

  values.forEach((value, index) => {
    const next = running + value
    const startY = scaleY(chart, running)
    const endY = scaleY(chart, next)
    const top = Math.min(startY, endY)
    const h = Math.abs(startY - endY)
    const x = categoryCenterX(chart, index) - barWidth / 2
    const color = value >= 0 ? '#16a34a' : '#dc2626'
    layer.appendChild(rect(doc, x, top, barWidth, h, `${color}44`, color, 1.2, 3))
    maybeLabel(doc, layer, occupied, formatCompact(value), x + barWidth / 2, top - 6, chart.labels ?? 'auto')
    if (index < values.length - 1) {
      layer.appendChild(line(doc, x + barWidth, endY, x + slot - barWidth / 2, endY, '#94a3b8', 1, '4 4'))
    }
    running = next
  })
}

function colorScale(value: number, min: number, max: number) {
  const ratio = max === min ? 0.5 : (value - min) / (max - min)
  const clamped = clamp(ratio, 0, 1)
  const start = [239, 68, 68]
  const mid = [248, 250, 252]
  const end = [37, 99, 235]
  const mix = clamped < 0.5
    ? start.map((channel, index) => Math.round(channel + (mid[index]! - channel) * (clamped / 0.5)))
    : mid.map((channel, index) => Math.round(channel + (end[index]! - channel) * ((clamped - 0.5) / 0.5)))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}

function renderHeatmap(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const columns = chart.xTicks.map(tick => tick.label)
  const rows = chart.yTicks.map(tick => tick.label)
  const values = (chart.cells ?? []).map(cell => cell.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const cellWidth = chart.plotWidth / Math.max(columns.length, 1)
  const cellHeight = chart.plotHeight / Math.max(rows.length, 1)

  for (const cell of chart.cells ?? []) {
    const columnIndex = columns.indexOf(cell.column)
    const rowIndex = rows.indexOf(cell.row)
    if (columnIndex === -1 || rowIndex === -1) continue
    const x = chart.plotX + columnIndex * cellWidth
    const y = chart.plotY + rowIndex * cellHeight
    const fill = cell.color ?? colorScale(cell.value, min, max)
    layer.appendChild(rect(doc, x, y, cellWidth, cellHeight, fill, '#ffffff', 1))
    layer.appendChild(text(doc, formatCompact(cell.value), x + cellWidth / 2, y + cellHeight / 2 + 4, 10, '#0f172a', 'middle'))
  }
}

function renderRadar(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const categories = chart.categories ?? []
  const max = Math.max(...chart.series.flatMap(series => series.values ?? []), 1)
  const cx = chart.plotX + chart.plotWidth / 2
  const cy = chart.plotY + chart.plotHeight / 2
  const radius = Math.min(chart.plotWidth, chart.plotHeight) * 0.38

  for (let ring = 1; ring <= 4; ring++) {
    const points = categories.map((_, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(categories.length, 1)) * Math.PI * 2
      const ringRadius = radius * (ring / 4)
      return [cx + Math.cos(angle) * ringRadius, cy + Math.sin(angle) * ringRadius] as [number, number]
    })
    layer.appendChild(polygon(doc, points, 'none', '#cbd5e1', 1))
  }

  categories.forEach((label, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(categories.length, 1)) * Math.PI * 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    layer.appendChild(line(doc, cx, cy, x, y, '#cbd5e1', 1))
    layer.appendChild(text(doc, label, cx + Math.cos(angle) * (radius + 18), cy + Math.sin(angle) * (radius + 18), 10, '#475569', 'middle'))
  })

  chart.series.forEach((series, index) => {
    const color = colorForSeries(series, index)
    const points = (series.values ?? []).map((value, itemIndex) => {
      const angle = -Math.PI / 2 + (itemIndex / Math.max(categories.length, 1)) * Math.PI * 2
      const distance = radius * (value / max)
      return [cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance] as [number, number]
    })
    layer.appendChild(polygon(doc, points, `${color}26`, color, 1.6, 0.9))
    points.forEach((point, pointIndex) => {
      layer.appendChild(circle(doc, point[0], point[1], 4, `${color}aa`, color, 1))
      maybeLabel(doc, layer, occupied, formatCompact(series.values?.[pointIndex] ?? 0), point[0], point[1] - 8, seriesLabelMode(chart, series))
    })
  })
}

function renderRadialBar(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const categories = chart.categories ?? []
  const values = chart.series[0]?.values ?? []
  const max = Math.max(...values, 1)
  const cx = chart.plotX + chart.plotWidth / 2
  const cy = chart.plotY + chart.plotHeight / 2
  const base = Math.min(chart.plotWidth, chart.plotHeight) * 0.18
  const thickness = Math.min(24, (Math.min(chart.plotWidth, chart.plotHeight) * 0.45) / Math.max(values.length, 1))

  values.forEach((value, index) => {
    const inner = base + index * thickness
    const outer = inner + thickness * 0.72
    const angleSpan = (Math.max(value, 0) / max) * Math.PI * 1.8
    const startAngle = Math.PI * 0.6
    const endAngle = startAngle + angleSpan
    const color = colorForSeries(chart.series[0], index)
    layer.appendChild(path(doc, pieSlicePath(cx, cy, outer, startAngle, endAngle, inner), color, 1.2, `${color}55`))
    layer.appendChild(text(doc, categories[index] ?? `Item ${index + 1}`, cx, cy - outer - 6 + index * 12, 10, color, 'middle'))
  })
}

function buildHierarchy(items: LayoutChart['items'] = []) {
  const root: TreeNode = { name: 'root', value: 0, children: [] }
  for (const item of items) {
    let cursor = root
    item.path.forEach((part, index) => {
      let child = cursor.children.find(entry => entry.name === part)
      if (!child) {
        child = { name: part, value: 0, color: item.color, children: [] }
        cursor.children.push(child)
      }
      if (index === item.path.length - 1) {
        child.value += item.value
        if (item.color) child.color = item.color
      }
      cursor = child
    })
  }

  const accumulate = (node: TreeNode): number => {
    if (node.children.length === 0) return node.value
    node.value = node.children.reduce((sum, child) => sum + accumulate(child), 0)
    return node.value
  }
  accumulate(root)
  return root
}

function treemapLeaves(node: TreeNode, x: number, y: number, width: number, height: number, depth = 0): Array<TreeNode & ChartBox & { depth: number }> {
  if (node.children.length === 0) return [{ ...node, x, y, width, height, depth }]
  const total = node.children.reduce((sum, child) => sum + child.value, 0) || 1
  let cursor = depth % 2 === 0 ? x : y
  const out: Array<TreeNode & ChartBox & { depth: number }> = []
  for (const child of node.children) {
    const ratio = child.value / total
    if (depth % 2 === 0) {
      const w = width * ratio
      out.push(...treemapLeaves(child, cursor, y, w, height, depth + 1))
      cursor += w
    } else {
      const h = height * ratio
      out.push(...treemapLeaves(child, x, cursor, width, h, depth + 1))
      cursor += h
    }
  }
  return out
}

function renderTreemap(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const root = buildHierarchy(chart.items)
  const leaves = treemapLeaves(root, chart.plotX, chart.plotY, chart.plotWidth, chart.plotHeight)
  leaves.forEach((leaf, index) => {
    const color = leaf.color ?? SERIES_COLORS[index % SERIES_COLORS.length]!
    layer.appendChild(rect(doc, leaf.x, leaf.y, Math.max(leaf.width, 1), Math.max(leaf.height, 1), `${color}55`, color, 1.1))
    if (leaf.width > 70 && leaf.height > 30) {
      layer.appendChild(text(doc, leaf.name, leaf.x + 8, leaf.y + 18, 10, '#0f172a'))
      layer.appendChild(text(doc, formatCompact(leaf.value), leaf.x + 8, leaf.y + 32, 10, '#334155'))
    }
  })
}

function renderSunburst(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const root = buildHierarchy(chart.items)
  const cx = chart.plotX + chart.plotWidth / 2
  const cy = chart.plotY + chart.plotHeight / 2
  const radius = Math.min(chart.plotWidth, chart.plotHeight) * 0.44

  const renderNode = (node: TreeNode, startAngle: number, endAngle: number, depth: number, maxDepth: number, colorSeed: number) => {
    if (node.children.length === 0) return
    const band = radius / Math.max(maxDepth + 1, 1)
    let cursor = startAngle
    const total = node.children.reduce((sum, child) => sum + child.value, 0) || 1
    node.children.forEach((child, index) => {
      const span = (child.value / total) * (endAngle - startAngle)
      const next = cursor + span
      const inner = depth * band
      const outer = inner + band * 0.92
      const color = child.color ?? SERIES_COLORS[(colorSeed + index) % SERIES_COLORS.length]!
      layer.appendChild(path(doc, pieSlicePath(cx, cy, outer, cursor, next, inner), color, 1.1, `${color}55`))
      if (span > 0.28) {
        const angle = (cursor + next) / 2
        const labelRadius = inner + (outer - inner) / 2
        layer.appendChild(text(doc, child.name, cx + Math.cos(angle) * labelRadius, cy + Math.sin(angle) * labelRadius + 4, 9, '#0f172a', 'middle'))
      }
      renderNode(child, cursor, next, depth + 1, maxDepth, colorSeed + index + 1)
      cursor = next
    })
  }

  const maxDepth = (function depth(node: TreeNode): number {
    if (node.children.length === 0) return 0
    return 1 + Math.max(...node.children.map(child => depth(child)))
  })(root)
  renderNode(root, -Math.PI / 2, Math.PI * 1.5, 0, maxDepth, 0)
}

function renderFunnel(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const categories = chart.categories ?? []
  const values = chart.series[0]?.values ?? []
  const max = Math.max(...values, 1)
  const stepHeight = chart.plotHeight / Math.max(values.length, 1)

  values.forEach((value, index) => {
    const nextValue = values[index + 1] ?? value
    const topWidth = (value / max) * chart.plotWidth * 0.92
    const bottomWidth = (nextValue / max) * chart.plotWidth * 0.92
    const topY = chart.plotY + index * stepHeight
    const bottomY = topY + stepHeight * 0.88
    const cx = chart.plotX + chart.plotWidth / 2
    const color = colorForSeries(undefined, index)
    const points: Array<[number, number]> = [
      [cx - topWidth / 2, topY],
      [cx + topWidth / 2, topY],
      [cx + bottomWidth / 2, bottomY],
      [cx - bottomWidth / 2, bottomY],
    ]
    layer.appendChild(polygon(doc, points, `${color}55`, color, 1.3))
    maybeLabel(doc, layer, occupied, `${categories[index] ?? `Stage ${index + 1}`}: ${formatCompact(value)}`, cx, topY + stepHeight * 0.45, 'show', 'middle', '#0f172a')
  })
}

function layoutSankey(chart: LayoutChart) {
  const flows = chart.flows ?? []
  const ids = Array.from(new Set(flows.flatMap(flow => [flow.from, flow.to])))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  flows.forEach(flow => {
    incoming.set(flow.to, (incoming.get(flow.to) ?? 0) + flow.value)
    outgoing.set(flow.from, (outgoing.get(flow.from) ?? 0) + flow.value)
  })

  const layers = new Map<string, number>()
  ids.forEach(id => {
    if (!flows.some(flow => flow.to === id)) layers.set(id, 0)
  })
  let changed = true
  while (changed) {
    changed = false
    for (const flow of flows) {
      const fromLayer = layers.get(flow.from)
      const toLayer = layers.get(flow.to)
      if (fromLayer != null && (toLayer == null || toLayer < fromLayer + 1)) {
        layers.set(flow.to, fromLayer + 1)
        changed = true
      }
    }
  }
  ids.forEach(id => {
    if (!layers.has(id)) layers.set(id, 0)
  })

  const maxLayer = Math.max(...Array.from(layers.values()), 0)
  const layerGroups = Array.from({ length: maxLayer + 1 }, (_, layer) => ids.filter(id => layers.get(id) === layer))
  const nodeWidth = 18
  const columnGap = maxLayer > 0 ? (chart.plotWidth - nodeWidth) / Math.max(maxLayer, 1) : 0
  const totalFlow = Math.max(flows.reduce((sum, flow) => sum + flow.value, 0), 1)
  const thicknessScale = (chart.plotHeight * 0.72) / totalFlow

  const nodes = new Map<string, SankeyNodeLayout>()
  layerGroups.forEach((group, layer) => {
    const heights = group.map(id => Math.max((Math.max(incoming.get(id) ?? 0, outgoing.get(id) ?? 0) || 1) * thicknessScale, 18))
    const totalHeight = heights.reduce((sum, value) => sum + value, 0)
    const gap = Math.min(28, Math.max(12, (chart.plotHeight - totalHeight) / Math.max(group.length - 1, 1)))
    let cursor = chart.plotY + (chart.plotHeight - (totalHeight + gap * Math.max(group.length - 1, 0))) / 2
    group.forEach((id, index) => {
      nodes.set(id, {
        id,
        layer,
        x: chart.plotX + layer * columnGap,
        y: cursor,
        width: nodeWidth,
        height: heights[index]!,
        inOffset: 0,
        outOffset: 0,
      })
      cursor += heights[index]! + gap
    })
  })

  const links: SankeyLinkLayout[] = flows.map((flow, index) => {
    const from = nodes.get(flow.from)!
    const to = nodes.get(flow.to)!
    const thickness = Math.max(flow.value * thicknessScale, 8)
    const startY = from.y + from.outOffset + thickness / 2
    const endY = to.y + to.inOffset + thickness / 2
    from.outOffset += thickness
    to.inOffset += thickness
    return {
      from,
      to,
      value: flow.value,
      color: flow.color ?? SERIES_COLORS[index % SERIES_COLORS.length]!,
      startY,
      endY,
      thickness,
    }
  })

  return { nodes, links }
}

function renderSankey(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const { nodes, links } = layoutSankey(chart)
  links.forEach(link => {
    const x1 = link.from.x + link.from.width
    const x2 = link.to.x
    const c1 = x1 + (x2 - x1) * 0.38
    const c2 = x1 + (x2 - x1) * 0.62
    const d = `M ${x1.toFixed(1)} ${link.startY.toFixed(1)} C ${c1.toFixed(1)} ${link.startY.toFixed(1)}, ${c2.toFixed(1)} ${link.endY.toFixed(1)}, ${x2.toFixed(1)} ${link.endY.toFixed(1)}`
    const el = path(doc, d, link.color, link.thickness, 'none', 0.38)
    el.setAttribute('stroke-linecap', 'round')
    layer.appendChild(el)
  })
  Array.from(nodes.values()).forEach((node, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length]!
    layer.appendChild(rect(doc, node.x, node.y, node.width, node.height, `${color}77`, color, 1.1, 4))
    layer.appendChild(text(doc, node.id, node.x + node.width + 6, node.y + 14, 10, '#334155'))
  })
}

function renderGauge(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const value = chart.series[0]?.values?.[0] ?? 0
  const min = chart.yMin ?? 0
  const max = chart.yMax ?? 100
  const cx = chart.plotX + chart.plotWidth / 2
  const cy = chart.plotY + chart.plotHeight * 0.82
  const outer = Math.min(chart.plotWidth, chart.plotHeight) * 0.34
  const inner = outer * 0.62
  const thresholds = chart.thresholds && chart.thresholds.length > 0
    ? chart.thresholds
    : [
      { upto: min + (max - min) * 0.6, color: '#16a34a', label: 'Good' },
      { upto: min + (max - min) * 0.85, color: '#f59e0b', label: 'Watch' },
      { upto: max, color: '#dc2626', label: 'Critical' },
    ]

  let startValue = min
  thresholds.forEach(threshold => {
    const startAngle = Math.PI - ((startValue - min) / Math.max(max - min, 1)) * Math.PI
    const endAngle = Math.PI - ((threshold.upto - min) / Math.max(max - min, 1)) * Math.PI
    layer.appendChild(path(doc, pieSlicePath(cx, cy, outer, endAngle, startAngle, inner), threshold.color, 1.1, `${threshold.color}66`))
    startValue = threshold.upto
  })

  const angle = Math.PI - ((clamp(value, min, max) - min) / Math.max(max - min, 1)) * Math.PI
  const needleX = cx + Math.cos(angle) * outer * 0.86
  const needleY = cy + Math.sin(angle) * outer * 0.86
  layer.appendChild(line(doc, cx, cy, needleX, needleY, '#0f172a', 3))
  layer.appendChild(circle(doc, cx, cy, 7, '#0f172a', '#0f172a', 1))
  layer.appendChild(text(doc, formatCompact(value), cx, cy - 16, 22, '#0f172a', 'middle'))
}

function renderLikert(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const categories = chart.categories ?? []
  const slot = chart.plotHeight / Math.max(categories.length, 1)
  const centerX = chart.plotX + chart.plotWidth / 2
  const half = chart.series.length / 2

  categories.forEach((label, rowIndex) => {
    let leftOffset = 0
    let rightOffset = 0
    chart.series.forEach((series, seriesIndex) => {
      const color = colorForSeries(series, seriesIndex)
      const value = series.values?.[rowIndex] ?? 0
      const width = chart.plotWidth * (value / 100)
      const y = chart.plotY + rowIndex * slot + slot * 0.2
      const h = slot * 0.56
      if (seriesIndex < Math.floor(half)) {
        leftOffset += width
        layer.appendChild(rect(doc, centerX - leftOffset, y, width, h, `${color}66`, color, 1.1))
      } else if (chart.series.length % 2 === 1 && seriesIndex === Math.floor(half)) {
        layer.appendChild(rect(doc, centerX - width / 2, y, width, h, `${color}66`, color, 1.1))
      } else {
        layer.appendChild(rect(doc, centerX + rightOffset, y, width, h, `${color}66`, color, 1.1))
        rightOffset += width
      }
      maybeLabel(doc, layer, occupied, `${Math.round(value)}%`, centerX + (seriesIndex < Math.floor(half) ? -leftOffset + width / 2 : rightOffset - width / 2), y + h / 2 + 4, seriesLabelMode(chart, series))
    })
    layer.appendChild(text(doc, label, chart.plotX - 12, chart.plotY + rowIndex * slot + slot * 0.55, 11, '#475569', 'end'))
  })
  layer.appendChild(line(doc, centerX, chart.plotY, centerX, chart.plotY + chart.plotHeight, '#94a3b8', 1, '4 4'))
}

function quartiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const pick = (p: number) => {
    if (sorted.length === 1) return sorted[0]!
    const idx = (sorted.length - 1) * p
    const lower = Math.floor(idx)
    const upper = Math.ceil(idx)
    if (lower === upper) return sorted[lower]!
    const ratio = idx - lower
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * ratio
  }
  return {
    min: sorted[0]!,
    q1: pick(0.25),
    median: pick(0.5),
    q3: pick(0.75),
    max: sorted[sorted.length - 1]!,
  }
}

function renderBoxPlot(doc: AnyDoc, layer: SVGElement, chart: LayoutChart) {
  const slot = categoryBandWidth(chart)
  const boxWidth = Math.min(48, slot * 0.44)
  chart.series.forEach((series, index) => {
    const values = series.values ?? []
    if (values.length === 0) return
    const stats = quartiles(values)
    const x = categoryCenterX(chart, index)
    const color = colorForSeries(series, index)
    const yMin = scaleY(chart, stats.min)
    const yQ1 = scaleY(chart, stats.q1)
    const yMedian = scaleY(chart, stats.median)
    const yQ3 = scaleY(chart, stats.q3)
    const yMax = scaleY(chart, stats.max)
    layer.appendChild(line(doc, x, yMin, x, yQ1, color, 1.1))
    layer.appendChild(line(doc, x, yQ3, x, yMax, color, 1.1))
    layer.appendChild(rect(doc, x - boxWidth / 2, yQ3, boxWidth, yQ1 - yQ3, `${color}33`, color, 1.2))
    layer.appendChild(line(doc, x - boxWidth / 2, yMedian, x + boxWidth / 2, yMedian, '#0f172a', 1.5))
    layer.appendChild(line(doc, x - boxWidth / 4, yMin, x + boxWidth / 4, yMin, color, 1.1))
    layer.appendChild(line(doc, x - boxWidth / 4, yMax, x + boxWidth / 4, yMax, color, 1.1))
  })
}

function renderDotPlot(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const slot = chart.plotHeight / Math.max(chart.series.length, 1)
  chart.series.forEach((series, index) => {
    const y = chart.plotY + index * slot + slot * 0.5
    const color = colorForSeries(series, index)
    layer.appendChild(text(doc, series.name, chart.plotX - 12, y + 4, 11, '#475569', 'end'))
    ;(series.values ?? []).forEach(value => {
      const x = scaleX(chart, value)
      layer.appendChild(circle(doc, x, y, 5, `${color}aa`, color, 1.2))
      maybeLabel(doc, layer, occupied, formatCompact(value), x, y - 8, seriesLabelMode(chart, series))
    })
  })
}

function renderTornado(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const left = chart.series[0]
  const right = chart.series[1]
  if (!left || !right) return
  const categories = chart.categories ?? []
  const slot = chart.plotHeight / Math.max(categories.length, 1)
  const centerX = xFromReference(chart, 0) ?? chart.plotX + chart.plotWidth / 2
  layer.appendChild(line(doc, centerX, chart.plotY, centerX, chart.plotY + chart.plotHeight, '#94a3b8', 1, '4 4'))

  categories.forEach((label, index) => {
    const y = chart.plotY + index * slot + slot * 0.2
    const h = slot * 0.56
    const leftValue = left.values?.[index] ?? 0
    const rightValue = right.values?.[index] ?? 0
    const leftX = scaleX(chart, -leftValue)
    const rightX = scaleX(chart, rightValue)
    layer.appendChild(rect(doc, leftX, y, centerX - leftX, h, `${colorForSeries(left, 0)}55`, colorForSeries(left, 0), 1.1))
    layer.appendChild(rect(doc, centerX, y, rightX - centerX, h, `${colorForSeries(right, 1)}55`, colorForSeries(right, 1), 1.1))
    layer.appendChild(text(doc, label, centerX, y + h / 2 + 4, 10, '#0f172a', 'middle'))
    maybeLabel(doc, layer, occupied, formatCompact(leftValue), leftX + (centerX - leftX) / 2, y + h / 2 + 4, seriesLabelMode(chart, left))
    maybeLabel(doc, layer, occupied, formatCompact(rightValue), centerX + (rightX - centerX) / 2, y + h / 2 + 4, seriesLabelMode(chart, right))
  })
}

function renderCombo(doc: AnyDoc, layer: SVGElement, chart: LayoutChart, occupied: ChartBox[]) {
  const bars = chart.series.filter(series => (series.type ?? 'bar') === 'bar')
  const lines = chart.series.filter(series => series.type === 'line')
  const areas = chart.series.filter(series => series.type === 'area')
  const scatters = chart.series.filter(series => series.type === 'scatter')
  if (chart.stack === 'stacked' || chart.stack === 'percent') renderStackedBars(doc, layer, chart, occupied, chart.stack === 'percent')
  else if (bars.length > 0) renderGroupedBars(doc, layer, chart, occupied, bars)
  if (areas.length > 0) renderLineFamily(doc, layer, chart, occupied, areas, true)
  if (lines.length > 0) renderLineFamily(doc, layer, chart, occupied, lines, false)
  if (scatters.length > 0) renderScatter(doc, layer, chart, occupied, scatters)
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return ''
  if (Math.abs(value) >= 1000) return value.toFixed(0)
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1')
}

export function renderChart(
  doc: AnyDoc,
  svg: SVGSVGElement,
  rc: RoughSVG,
  layout: LayoutResult,
  style: RenderStyle,
) {
  const chart = layout.chart!
  const layer = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  layer.setAttribute('class', 'scrawl-chart')

  layer.appendChild(rc.rectangle(32, 28, layout.width - 64, layout.height - 56, {
    stroke: '#cbd5e1',
    fill: '#ffffff',
    fillStyle: 'solid',
    roughness: style.roughness[0],
    strokeWidth: 1.2,
    seed: deriveSeed(layout.seed, 'chart-frame'),
    disableMultiStroke: !style.multiStroke,
  }) as unknown as SVGElement)

  renderAxes(doc, layer, chart, style)
  renderTitles(doc, layer, chart, layout, style)
  renderReferences(doc, layer, chart)
  renderAnnotations(doc, layer, chart)

  const occupied: ChartBox[] = []

  if (chart.kind === 'bar') {
    if (chart.stack === 'stacked' || chart.stack === 'percent') renderStackedBars(doc, layer, chart, occupied, chart.stack === 'percent')
    else renderGroupedBars(doc, layer, chart, occupied, chart.series)
  } else if (chart.kind === 'line') {
    renderLineFamily(doc, layer, chart, occupied, chart.series, false)
  } else if (chart.kind === 'area') {
    renderLineFamily(doc, layer, chart, occupied, chart.series, true)
  } else if (chart.kind === 'scatter') {
    renderScatter(doc, layer, chart, occupied, chart.series)
  } else if (chart.kind === 'pie' || chart.kind === 'donut') {
    renderPieLike(doc, layer, chart)
  } else if (chart.kind === 'combo') {
    renderCombo(doc, layer, chart, occupied)
  } else if (chart.kind === 'waterfall') {
    renderWaterfall(doc, layer, chart, occupied)
  } else if (chart.kind === 'heatmap') {
    renderHeatmap(doc, layer, chart)
  } else if (chart.kind === 'radar') {
    renderRadar(doc, layer, chart, occupied)
  } else if (chart.kind === 'radial-bar') {
    renderRadialBar(doc, layer, chart)
  } else if (chart.kind === 'treemap') {
    renderTreemap(doc, layer, chart)
  } else if (chart.kind === 'sunburst') {
    renderSunburst(doc, layer, chart)
  } else if (chart.kind === 'funnel') {
    renderFunnel(doc, layer, chart, occupied)
  } else if (chart.kind === 'sankey') {
    renderSankey(doc, layer, chart)
  } else if (chart.kind === 'gauge') {
    renderGauge(doc, layer, chart)
  } else if (chart.kind === 'likert') {
    renderLikert(doc, layer, chart, occupied)
  } else if (chart.kind === 'box') {
    renderBoxPlot(doc, layer, chart)
  } else if (chart.kind === 'dot') {
    renderDotPlot(doc, layer, chart, occupied)
  } else if (chart.kind === 'tornado') {
    renderTornado(doc, layer, chart, occupied)
  }

  renderLegend(doc, layer, chart)
  svg.appendChild(layer)
}
