/**
 * Per-pixel moon shader on a 2D canvas.
 *
 * Each disk pixel is treated as a point on a sphere (normal = (nx, ny, nz)).
 * Sunlight direction sits in the equatorial plane at longitude ψ
 * (ψ = 0 → full moon, ±π → new). Brightness uses a Lommel-Seeliger-style
 * term — the reason a real full moon looks flat and bright to the limb while
 * a quarter moon looks carved — plus a soft terminator band and faint bluish
 * earthshine on the night side.
 *
 * Supports two simultaneous lights (for the merge stage): the disk shows the
 * max of both, and pixels lit by both can be tinted warm to reveal overlap.
 */

import { psiForPhase } from '../lib/lunar'
import { tween, easeInOutCubic, type TweenHandle } from '../lib/animate'
import type { MoonTexture } from './moonTexture'

export interface RenderLights {
  psiA: number
  psiB: number | null
  overlapTint?: number // 0..1
}

export class MoonRenderer {
  private ctx: CanvasRenderingContext2D
  private glow: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; size: number } | null =
    null
  private img: ImageData
  private count = 0
  private px!: Int32Array // byte offset into ImageData
  private nx!: Float32Array
  private nz!: Float32Array
  private alb!: Float32Array

  private phase = 0
  private anim: TweenHandle | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private size: number,
    texture: MoonTexture,
    glowCanvas?: HTMLCanvasElement,
  ) {
    canvas.width = size
    canvas.height = size
    this.ctx = canvas.getContext('2d')!
    this.img = this.ctx.createImageData(size, size)
    if (glowCanvas) {
      const gs = 160
      glowCanvas.width = gs
      glowCanvas.height = gs
      this.glow = { canvas: glowCanvas, ctx: glowCanvas.getContext('2d')!, size: gs }
    }
    this.buildGeometry(texture)
  }

  private buildGeometry(texture: MoonTexture): void {
    const S = this.size
    const R = S / 2
    const rad = R - 1.5
    const cap = S * S
    const px = new Int32Array(cap)
    const nx = new Float32Array(cap)
    const nz = new Float32Array(cap)
    const alb = new Float32Array(cap)
    const data = this.img.data
    const ts = texture.size
    let n = 0

    for (let y = 0; y < S; y++) {
      const ny = (y + 0.5 - R) / rad
      for (let x = 0; x < S; x++) {
        const vx = (x + 0.5 - R) / rad
        const d = Math.hypot(vx, ny)
        if (d >= 1) continue
        const z = Math.sqrt(Math.max(0, 1 - vx * vx - ny * ny))
        const lon = Math.atan2(vx, z) // [-π/2, π/2]
        const lat = Math.asin(Math.max(-1, Math.min(1, ny)))
        const tx = Math.min(ts - 1, Math.max(0, Math.floor((lon / Math.PI + 0.5) * ts)))
        const ty = Math.min(ts - 1, Math.max(0, Math.floor((lat / Math.PI + 0.5) * ts)))

        const j = (y * S + x) * 4
        px[n] = j
        nx[n] = vx
        nz[n] = z
        alb[n] = texture.albedo[ty * ts + tx]
        data[j + 3] = Math.min(1, (1 - d) * rad) * 255 // edge anti-aliasing, set once
        n++
      }
    }
    this.count = n
    this.px = px
    this.nx = nx
    this.nz = nz
    this.alb = alb
  }

  render(lights: RenderLights): void {
    const { px, nx, nz, alb, count } = this
    const data = this.img.data
    const s0 = Math.sin(lights.psiA)
    const c0 = Math.cos(lights.psiA)
    const two = lights.psiB !== null
    const s1 = two ? Math.sin(lights.psiB!) : 0
    const c1 = two ? Math.cos(lights.psiB!) : 0
    const tint = lights.overlapTint ?? 0

    for (let k = 0; k < count; k++) {
      const x = nx[k]
      const z = nz[k]
      const a = alb[k]

      const f0 = litFactor(x * s0 + z * c0, z)
      let F = f0
      let ov = 0
      if (two) {
        const f1 = litFactor(x * s1 + z * c1, z)
        if (f1 > F) F = f1
        ov = f0 < f1 ? f0 : f1
      }

      // day side: warm off-white scaled by albedo; night side: faint blue earthshine
      const dkR = 24 * a + 6
      const dkG = 28 * a + 9
      const dkB = 44 * a + 17
      let r = dkR + (253 * a - dkR) * F
      let g = dkG + (250 * a - dkG) * F
      let b = dkB + (242 * a - dkB) * F
      if (tint > 0 && ov > 0.02) {
        const t = ov * tint
        r += t * 55
        g += t * 26
        b += t * 2
      }

      const j = px[k]
      data[j] = r
      data[j + 1] = g
      data[j + 2] = b
    }

    this.ctx.putImageData(this.img, 0, 0)
    this.updateGlow()
  }

  private updateGlow(): void {
    if (!this.glow) return
    const { ctx, size } = this.glow
    ctx.clearRect(0, 0, size, size)
    ctx.filter = 'blur(7px)'
    ctx.globalAlpha = 0.9
    ctx.drawImage(this.canvas, size * 0.09, size * 0.09, size * 0.82, size * 0.82)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
  }

  getPhase(): number {
    return this.phase
  }

  setPhase(p: number): void {
    this.anim?.cancel()
    this.phase = p
    this.render({ psiA: psiForPhase(p), psiB: null })
  }

  /** Sweep the terminator from the current phase to a new one. */
  animateToPhase(p: number, duration = 1100): Promise<void> {
    this.anim?.cancel()
    const from = this.phase
    // travel forward through the cycle (the terminator's natural direction)
    let delta = p - from
    if (delta < 0) delta += 1
    if (delta > 0.5 && Math.abs(p - from) < 0.5) delta = p - from // short hop backwards is fine
    this.anim = tween(
      duration,
      (t) => {
        this.phase = (from + delta * t + 1) % 1
        this.render({ psiA: psiForPhase(this.phase), psiB: null })
      },
      easeInOutCubic,
    )
    return this.anim.done
  }
}

/**
 * Brightness of a surface point: μ0 = N·L, μ = N·V (= z).
 * Lommel-Seeliger term (flat full moon, bright limbs) gated by a soft
 * terminator so the day/night line has a twilight band instead of a hard cut.
 */
function litFactor(mu0: number, z: number): number {
  if (mu0 <= -0.02) return 0
  const m = mu0 > 0 ? mu0 : 0
  const ls = Math.min(1, (2.05 * m) / (m + z + 0.02))
  // smoothstep(-0.02, 0.07, mu0)
  const t = Math.min(1, Math.max(0, (mu0 + 0.02) / 0.09))
  return ls * t * t * (3 - 2 * t)
}
