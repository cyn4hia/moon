/**
 * Procedural lunar albedo map, generated once per page load (seeded, so it is
 * the same moon every visit). The map covers the visible hemisphere in
 * (longitude, latitude) space; the renderer wraps it onto a sphere, which
 * foreshortens craters near the limb for free.
 *
 * Layers: fbm regolith mottling → maria (dark basalt plains, biased to one
 * region like the real near side) → ~230 craters with rims → a few young
 * ray craters with bright ejecta streaks.
 */

import { fbm, mulberry32 } from '../lib/random'

export interface MoonTexture {
  albedo: Float32Array
  size: number
}

export function generateMoonTexture(size = 1024, seed = 20260702): MoonTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const rand = mulberry32(seed)

  // --- base regolith + maria, per pixel ---
  const img = ctx.createImageData(size, size)
  const data = img.data
  const mariaCx = 0.42
  const mariaCy = 0.36
  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      let a = 0.64 + (fbm(u * 3.4, v * 3.4, 5, 11) - 0.5) * 0.34

      // maria: low-frequency noise gated to one broad region
      const m = fbm(u * 1.9 + 13.7, v * 1.9 + 91.3, 4, 47)
      const dx = u - mariaCx
      const dy = v - mariaCy
      const regional = Math.max(0, 1 - Math.hypot(dx, dy) / 0.52)
      const mask = smoothstep(0.5, 0.62, m) * smoothstep(0.05, 0.55, regional)
      a *= 1 - mask * 0.42

      // fine grain
      a += (fbm(u * 14, v * 14, 2, 99) - 0.5) * 0.07
      a = Math.min(1, Math.max(0.08, a))

      const i = (y * size + x) * 4
      const g = a * 255
      data[i] = g
      data[i + 1] = g
      data[i + 2] = g
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // --- craters ---
  const craterCount = 230
  for (let i = 0; i < craterCount; i++) {
    const cx = rand() * size
    const cy = rand() * size
    const r = size * (0.004 + 0.05 * Math.pow(rand(), 2.4))
    const depth = 0.16 + rand() * 0.2
    const rim = 0.08 + rand() * 0.13
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(0,0,0,${depth})`)
    g.addColorStop(0.55, `rgba(0,0,0,${depth * 0.75})`)
    g.addColorStop(0.74, 'rgba(0,0,0,0)')
    g.addColorStop(0.86, `rgba(255,255,255,${rim})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // --- young ray craters (Tycho-style ejecta) ---
  for (let i = 0; i < 3; i++) {
    const cx = size * (0.2 + rand() * 0.6)
    const cy = size * (0.2 + rand() * 0.6)
    const r = size * (0.012 + rand() * 0.01)
    const rays = 9 + Math.floor(rand() * 7)

    ctx.save()
    ctx.filter = 'blur(2px)'
    for (let k = 0; k < rays; k++) {
      const ang = rand() * Math.PI * 2
      const len = r * (3.5 + rand() * 6)
      const grad = ctx.createLinearGradient(
        cx + Math.cos(ang) * r,
        cy + Math.sin(ang) * r,
        cx + Math.cos(ang) * len,
        cy + Math.sin(ang) * len,
      )
      grad.addColorStop(0, `rgba(255,255,255,${0.1 + rand() * 0.08})`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = grad
      ctx.lineWidth = r * (0.2 + rand() * 0.3)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * r * 0.8, cy + Math.sin(ang) * r * 0.8)
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len)
      ctx.stroke()
    }
    ctx.restore()

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6)
    core.addColorStop(0, 'rgba(255,255,255,0.30)')
    core.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    core.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // read back to a single-channel float map
  const out = ctx.getImageData(0, 0, size, size).data
  const albedo = new Float32Array(size * size)
  for (let i = 0; i < albedo.length; i++) albedo[i] = out[i * 4] / 255

  return { albedo, size }
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
