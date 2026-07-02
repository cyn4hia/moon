/**
 * Compatibility model — geometric, not numerological.
 *
 * In an orthographic view of the moon, the projection of any terminator is a
 * meridian ellipse, so the lit part of the disk maps to a simple interval on
 * the axis s = sin(longitude) ∈ [-1, 1], and the fraction of disk area in
 * [s1, s2] is (s2 - s1) / 2.
 *
 *   waxing phase p  → lit interval [cos(2πp),  1]   (lit from the right)
 *   waning phase p  → lit interval [-1, -cos(2πp)]  (lit from the left)
 *
 * Overlay both birth moons on one disk. The score is the fraction of the disk
 * lit by *exactly one* of the two — union minus overlap. Perfectly
 * complementary phases (e.g. waxing gibbous + waning crescent, half a cycle
 * apart) tile the disk into one full moon: 100%. Identical phases fully
 * overlap: 0%.
 */

import { SYNODIC_MONTH } from './lunar'

export interface CompatResult {
  /** headline score, 0–100 */
  score: number
  /** % of the disk lit by at least one of the two */
  coverage: number
  /** % of the disk lit by both (doubled light — beautiful, but redundant) */
  overlap: number
  /** cyclic distance between the two phases, in days (14.77 is a perfect fit) */
  offsetDays: number
  verdict: Verdict
}

export interface Verdict {
  title: string
  line: string
  tier: 'high' | 'mid' | 'low'
}

/** Lit portion of the disk on the s = sin(longitude) axis. */
export function litInterval(p: number): [number, number] {
  const c = Math.cos(2 * Math.PI * p)
  return p < 0.5 ? [c, 1] : [-1, -c]
}

export function computeCompatibility(p1: number, p2: number): CompatResult {
  const [a1, b1] = litInterval(p1)
  const [a2, b2] = litInterval(p2)
  const len1 = Math.max(0, b1 - a1)
  const len2 = Math.max(0, b2 - a2)
  const inter = Math.max(0, Math.min(b1, b2) - Math.max(a1, a2))
  const union = len1 + len2 - inter

  const score = ((union - inter) / 2) * 100
  const coverage = (union / 2) * 100
  const overlap = (inter / 2) * 100

  let d = Math.abs(p1 - p2)
  d = Math.min(d, 1 - d)
  const offsetDays = d * SYNODIC_MONTH

  return { score, coverage, overlap, offsetDays, verdict: verdictFor(score) }
}

function verdictFor(score: number): Verdict {
  if (score >= 92)
    return {
      tier: 'high',
      title: 'A Single Full Moon',
      line: 'Where one of you ends, the other begins — your phases seal into one whole, bright sky.',
    }
  if (score >= 75)
    return {
      tier: 'high',
      title: 'Written in Moonlight',
      line: 'A sliver of shadow here, a touch of doubled light there — but side by side, your night is nearly whole.',
    }
  if (score >= 55)
    return {
      tier: 'mid',
      title: 'Gravitational Pull',
      line: 'Your phases lean toward each other. Plenty of shared light, and just enough dark left to explore.',
    }
  if (score >= 35)
    return {
      tier: 'mid',
      title: 'Half-Lit Sky',
      line: 'You brighten different corners of the same night. What’s missing isn’t gone — it’s still waxing.',
    }
  if (score >= 15)
    return {
      tier: 'low',
      title: 'Close Orbits',
      line: 'Your moons rise wearing nearly the same face. Familiar, kindred — but completion takes contrast.',
    }
  return {
    tier: 'low',
    title: 'Twin Moons',
    line: 'You mirror one another almost exactly. An uncanny kinship — though a full moon is made of two halves, not two reflections.',
  }
}
