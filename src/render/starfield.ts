/**
 * Ambient background: twinkling stars with gentle mouse parallax and the
 * occasional shooting star. Pauses when the tab is hidden; renders a single
 * static frame under prefers-reduced-motion.
 */

import { mulberry32 } from '../lib/random'
import { prefersReducedMotion } from '../lib/animate'

interface Star {
  x: number
  y: number
  r: number
  base: number
  twinkle: number
  speed: number
  depth: number
  hue: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
}

export function startStarfield(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(777)
  let stars: Star[] = []
  let meteors: Meteor[] = []
  let w = 0
  let h = 0
  let parallaxX = 0
  let parallaxY = 0
  let targetPX = 0
  let targetPY = 0
  let nextMeteor = 6000 + rand() * 8000
  const reduced = prefersReducedMotion()

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.min(340, Math.floor((w * h) / 4200))
    stars = Array.from({ length: count }, () => ({
      x: rand() * w,
      y: rand() * h,
      r: 0.3 + Math.pow(rand(), 2.5) * 1.5,
      base: 0.25 + rand() * 0.6,
      twinkle: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.2,
      depth: 0.3 + rand() * 0.7,
      hue: rand(),
    }))
  }

  const draw = (time: number, dt: number) => {
    ctx.clearRect(0, 0, w, h)
    for (const s of stars) {
      const tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(time * 0.001 * s.speed + s.twinkle)
      const a = s.base * tw
      const x = s.x + parallaxX * s.depth
      const y = s.y + parallaxY * s.depth
      // a handful of stars get a subtle color cast
      const c =
        s.hue > 0.93
          ? `rgba(255,214,170,${a})`
          : s.hue < 0.08
            ? `rgba(170,190,255,${a})`
            : `rgba(226,232,255,${a})`
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x, y, s.r, 0, Math.PI * 2)
      ctx.fill()
      if (s.r > 1.25) {
        // 4-point sparkle on the brightest stars
        ctx.strokeStyle = `rgba(226,232,255,${a * 0.35})`
        ctx.lineWidth = 0.6
        const l = s.r * 3.4
        ctx.beginPath()
        ctx.moveTo(x - l, y)
        ctx.lineTo(x + l, y)
        ctx.moveTo(x, y - l)
        ctx.lineTo(x, y + l)
        ctx.stroke()
      }
    }

    if (!reduced) {
      nextMeteor -= dt
      if (nextMeteor <= 0 && meteors.length < 2) {
        meteors.push({
          x: w * (0.15 + rand() * 0.7),
          y: -20,
          vx: (rand() > 0.5 ? 1 : -1) * (0.18 + rand() * 0.14),
          vy: 0.32 + rand() * 0.2,
          life: 1100 + rand() * 600,
          age: 0,
        })
        nextMeteor = 9000 + rand() * 13000
      }
      meteors = meteors.filter((m) => m.age < m.life)
      for (const m of meteors) {
        m.age += dt
        m.x += m.vx * dt
        m.y += m.vy * dt
        const fade = Math.sin((m.age / m.life) * Math.PI)
        const tail = 90
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tail * 3, m.y - m.vy * tail * 3)
        grad.addColorStop(0, `rgba(240,244,255,${0.8 * fade})`)
        grad.addColorStop(1, 'rgba(240,244,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(m.x - m.vx * tail * 3, m.y - m.vy * tail * 3)
        ctx.stroke()
      }
    }
  }

  resize()
  window.addEventListener('resize', resize)

  if (reduced) {
    draw(0, 0)
    return
  }

  window.addEventListener('pointermove', (e) => {
    targetPX = (e.clientX / w - 0.5) * -14
    targetPY = (e.clientY / h - 0.5) * -10
  })

  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(50, now - last)
    last = now
    if (!document.hidden) {
      parallaxX += (targetPX - parallaxX) * 0.03
      parallaxY += (targetPY - parallaxY) * 0.03
      draw(now, dt)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
