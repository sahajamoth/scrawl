import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { LayoutChart, LayoutResult } from '../ir/types.js'
import { createLabel } from './labels.js'
import type { RenderStyle } from './styles.js'
import { deriveSeed } from '../layout/seed.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any

const SERIES_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#d97706']

function scaleX(chart: LayoutChart, value: number) {
  const span = Math.max(chart.maxX - chart.minX, 1)
  return chart.plotX + ((value - chart.minX) / span) * chart.plotWidth
}

function scaleY(chart: LayoutChart, value: number) {
  const span = Math.max(chart.maxY - chart.minY, 1)
  return chart.plotY + chart.plotHeight - ((value - chart.minY) / span) * chart.plotHeight
}

function text(doc: AnyDoc, value: string, x: number, y: number, size = 12, color = '#475569') {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
  el.setAttribute('x', x.toFixed(1))
  el.setAttribute('y', y.toFixed(1))
  el.setAttribute('font-family', '"Permanent Marker", cursive')
  el.setAttribute('font-size', String(size))
  el.setAttribute('fill', color)
  el.textContent = value
  return el as SVGElement
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

  layer.appendChild(rc.line(chart.plotX, chart.plotY, chart.plotX, chart.plotY + chart.plotHeight, {
    stroke: '#475569',
    roughness: style.roughness[0],
    strokeWidth: 1.5,
    seed: deriveSeed(layout.seed, 'chart-y-axis'),
  }) as unknown as SVGElement)
  layer.appendChild(rc.line(chart.plotX, chart.plotY + chart.plotHeight, chart.plotX + chart.plotWidth, chart.plotY + chart.plotHeight, {
    stroke: '#475569',
    roughness: style.roughness[0],
    strokeWidth: 1.5,
    seed: deriveSeed(layout.seed, 'chart-x-axis'),
  }) as unknown as SVGElement)

  for (let i = 0; i <= 4; i++) {
    const value = chart.minY + ((chart.maxY - chart.minY) * i) / 4
    const y = scaleY(chart, value)
    layer.appendChild(rc.line(chart.plotX, y, chart.plotX + chart.plotWidth, y, {
      stroke: '#e2e8f0',
      roughness: 0.2,
      strokeWidth: 1,
      seed: deriveSeed(layout.seed, `grid-${i}`),
    }) as unknown as SVGElement)
    layer.appendChild(text(doc, value.toFixed(0), chart.plotX - 36, y + 4, 11))
  }

  if (chart.title) {
    const title = createLabel(doc, chart.title, layout.width / 2, 42, 18, deriveSeed(layout.seed, 'chart-title'), style)
    title.setAttribute('fill', '#1e293b')
    layer.appendChild(title)
  }
  if (chart.xLabel) layer.appendChild(text(doc, chart.xLabel, chart.plotX + chart.plotWidth / 2 - 20, layout.height - 28, 12))
  if (chart.yLabel) layer.appendChild(text(doc, chart.yLabel, 28, chart.plotY - 10, 12))

  if (chart.kind === 'bar') {
    const categories = chart.categories ?? chart.series[0]?.values?.map((_, index) => String(index + 1)) ?? []
    const groups = categories.length
    const seriesCount = chart.series.length
    const slot = chart.plotWidth / Math.max(groups, 1)
    const barWidth = Math.min(44, (slot * 0.72) / Math.max(seriesCount, 1))

    chart.series.forEach((series, seriesIndex) => {
      const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]!
      ;(series.values ?? []).forEach((value, index) => {
        const x = chart.plotX + index * slot + slot * 0.14 + seriesIndex * barWidth
        const y = scaleY(chart, value)
        const h = chart.plotY + chart.plotHeight - y
        layer.appendChild(rc.rectangle(x, y, barWidth, h, {
          stroke: color,
          fill: `${color}55`,
          fillStyle: style.fillStyle === 'none' ? 'solid' : style.fillStyle,
          roughness: style.roughness[0],
          strokeWidth: 1.4,
          seed: deriveSeed(layout.seed, `${series.name}-${index}`),
          disableMultiStroke: !style.multiStroke,
        }) as unknown as SVGElement)
      })
    })

    categories.forEach((category, index) => {
      const x = chart.plotX + index * slot + slot / 2
      layer.appendChild(text(doc, category, x - 12, chart.plotY + chart.plotHeight + 22, 11))
    })
  }

  if (chart.kind === 'line') {
    const categories = chart.categories ?? chart.series[0]?.values?.map((_, index) => String(index + 1)) ?? []
    const denom = Math.max(categories.length - 1, 1)
    chart.series.forEach((series, seriesIndex) => {
      const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]!
      const points = (series.values ?? []).map((value, index) => [
        chart.plotX + (index / denom) * chart.plotWidth,
        scaleY(chart, value),
      ] as [number, number])
      layer.appendChild(rc.linearPath(points, {
        stroke: color,
        roughness: style.roughness[0],
        bowing: style.bowing[0],
        strokeWidth: 2,
        seed: deriveSeed(layout.seed, `line-${series.name}`),
      }) as unknown as SVGElement)
      points.forEach((point, index) => {
        layer.appendChild(rc.ellipse(point[0], point[1], 8, 8, {
          stroke: color,
          fill: `${color}88`,
          fillStyle: 'solid',
          roughness: 0.3,
          strokeWidth: 1.1,
          seed: deriveSeed(layout.seed, `line-point-${series.name}-${index}`),
        }) as unknown as SVGElement)
      })
    })
    categories.forEach((category, index) => {
      const x = chart.plotX + (index / denom) * chart.plotWidth
      layer.appendChild(text(doc, category, x - 12, chart.plotY + chart.plotHeight + 22, 11))
    })
  }

  if (chart.kind === 'scatter') {
    chart.series.forEach((series, seriesIndex) => {
      const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]!
      ;(series.points ?? []).forEach((point, index) => {
        const x = scaleX(chart, point[0])
        const y = scaleY(chart, point[1])
        layer.appendChild(rc.ellipse(x, y, 10, 10, {
          stroke: color,
          fill: `${color}88`,
          fillStyle: 'solid',
          roughness: 0.5,
          strokeWidth: 1.2,
          seed: deriveSeed(layout.seed, `scatter-${series.name}-${index}`),
        }) as unknown as SVGElement)
      })
    })
  }

  chart.series.forEach((series, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length]!
    const y = chart.plotY + 14 + index * 18
    layer.appendChild(rc.line(chart.plotX + chart.plotWidth - 150, y, chart.plotX + chart.plotWidth - 126, y, {
      stroke: color,
      roughness: 0.4,
      strokeWidth: 2,
      seed: deriveSeed(layout.seed, `legend-${series.name}`),
    }) as unknown as SVGElement)
    layer.appendChild(text(doc, series.name, chart.plotX + chart.plotWidth - 118, y + 4, 11))
  })

  svg.appendChild(layer)
}
