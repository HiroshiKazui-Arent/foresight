export function redistributeWeights(n: number): number[] {
  if (n === 0) return []
  const base = Math.floor(100 / n)
  const remainder = 100 - base * n
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? base + remainder : base))
}
