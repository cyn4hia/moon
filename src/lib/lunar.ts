/**
 * Lunar phase math.
 *
 * Phase is expressed as a fraction of the synodic cycle:
 *   0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
 * Computed from a reference new moon (2000-01-06 18:14 UTC, JD 2451550.1),
 * accurate to within a few hours over ordinary lifespans — plenty for this.
 */

export const SYNODIC_MONTH = 29.530588853

const EPOCH_NEW_MOON_JD = 2451550.1

export interface PhaseInfo {
  /** fraction of cycle, [0, 1) */
  phase: number
  /** illuminated fraction of the disk, [0, 1] */
  illumination: number
  /** days since new moon */
  age: number
  name: string
  waxing: boolean
}

function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5
}

export function moonPhase(date: Date): number {
  let p = ((julianDay(date) - EPOCH_NEW_MOON_JD) / SYNODIC_MONTH) % 1
  if (p < 0) p += 1
  return p
}

export function illuminationOf(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2
}

export function phaseName(p: number): string {
  const near = (target: number, tol = 0.017) => {
    const d = Math.abs(p - target)
    return Math.min(d, 1 - d) < tol
  }
  if (near(0)) return 'New Moon'
  if (near(0.25)) return 'First Quarter'
  if (near(0.5)) return 'Full Moon'
  if (near(0.75)) return 'Last Quarter'
  if (p < 0.25) return 'Waxing Crescent'
  if (p < 0.5) return 'Waxing Gibbous'
  if (p < 0.75) return 'Waning Gibbous'
  return 'Waning Crescent'
}

/** Parse an <input type="date"> value at local noon (a stable point in the day). */
export function dateFromInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

export function phaseInfoForDate(date: Date): PhaseInfo {
  const phase = moonPhase(date)
  return {
    phase,
    illumination: illuminationOf(phase),
    age: phase * SYNODIC_MONTH,
    name: phaseName(phase),
    waxing: phase < 0.5,
  }
}

/**
 * Light direction longitude ψ for a phase, in the renderer's frame:
 * ψ = 0 lights the whole visible disk (full moon), ψ = ±π lights none (new),
 * ψ = +π/2 lights the right half (first quarter, northern-hemisphere view).
 */
export function psiForPhase(p: number): number {
  return Math.PI - 2 * Math.PI * p
}
