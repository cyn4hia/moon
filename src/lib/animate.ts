/** Tiny rAF tween utility. Each call returns a handle that can be cancelled. */

export type Easing = (t: number) => number

export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export const easeOutQuint: Easing = (t) => 1 - Math.pow(1 - t, 5)

export interface TweenHandle {
  done: Promise<void>
  cancel: () => void
}

export function tween(
  duration: number,
  onUpdate: (t: number) => void,
  ease: Easing = easeInOutCubic,
): TweenHandle {
  let raf = 0
  let cancelled = false
  const done = new Promise<void>((resolve) => {
    const start = performance.now()
    const frame = (now: number) => {
      if (cancelled) return resolve()
      const t = Math.min(1, (now - start) / duration)
      onUpdate(ease(t))
      if (t < 1) raf = requestAnimationFrame(frame)
      else resolve()
    }
    raf = requestAnimationFrame(frame)
  })
  return {
    done,
    cancel: () => {
      cancelled = true
      cancelAnimationFrame(raf)
    },
  }
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
