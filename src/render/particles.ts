/** One-shot celebration burst: gold and silver sparks ringing the merged moon. */

export function burst(canvas: HTMLCanvasElement, intensity = 1): void {
  const ctx = canvas.getContext('2d')!
  const S = canvas.width
  const cx = S / 2
  const cy = S / 2
  const count = Math.floor(70 * intensity)

  interface P {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    age: number
    size: number
    gold: boolean
  }
  const parts: P[] = Array.from({ length: count }, () => {
    const ang = Math.random() * Math.PI * 2
    const rad = S * 0.3
    const speed = (0.03 + Math.random() * 0.09) * S * 0.002
    return {
      x: cx + Math.cos(ang) * rad,
      y: cy + Math.sin(ang) * rad,
      vx: Math.cos(ang) * speed * (0.6 + Math.random()),
      vy: Math.sin(ang) * speed * (0.6 + Math.random()) - S * 0.00004,
      life: 900 + Math.random() * 900,
      age: 0,
      size: (0.8 + Math.random() * 1.8) * (S / 480),
      gold: Math.random() > 0.45,
    }
  })

  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(50, now - last)
    last = now
    ctx.clearRect(0, 0, S, S)
    let alive = false
    for (const p of parts) {
      p.age += dt
      if (p.age >= p.life) continue
      alive = true
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.998
      p.vy = p.vy * 0.998 + 0.000012 * S * dt * 0.01
      const t = p.age / p.life
      const a = Math.sin(Math.PI * Math.min(1, t)) * (0.55 + 0.45 * Math.sin(p.age * 0.02))
      ctx.fillStyle = p.gold
        ? `rgba(232,196,124,${Math.max(0, a)})`
        : `rgba(222,228,255,${Math.max(0, a)})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    if (alive) requestAnimationFrame(loop)
    else ctx.clearRect(0, 0, S, S)
  }
  requestAnimationFrame(loop)
}
