export type Point = [number, number]

export function polylineLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!
    const [x2, y2] = points[i]!
    total += Math.hypot(x2 - x1, y2 - y1)
  }
  return total
}

export function pointAtPolylineDistance(points: Point[], distance: number): Point {
  if (points.length === 0) return [0, 0]
  if (points.length === 1) return points[0]!

  let remaining = Math.max(0, distance)
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]!
    const end = points[i]!
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const segment = Math.hypot(dx, dy)
    if (segment === 0) continue
    if (remaining <= segment) {
      const t = remaining / segment
      return [start[0] + dx * t, start[1] + dy * t]
    }
    remaining -= segment
  }

  return points[points.length - 1]!
}

export function polylineMidpoint(points: Point[]): Point {
  return pointAtPolylineDistance(points, polylineLength(points) / 2)
}
