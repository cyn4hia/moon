/**
 * The merge stage. Choreography of a reveal:
 *   1. ghost copies of both birth moons fly into the stage and dissolve
 *   2. each person's light sweeps across the shared disk from its own side
 *   3. overlap warms, the ring gauge draws, the score counts up
 *   4. verdict + breakdown chips fade in; high scores get a spark burst
 */

import { computeCompatibility, type CompatResult } from '../lib/compatibility'
import { psiForPhase } from '../lib/lunar'
import { tween, wait, easeOutCubic, easeInOutCubic, prefersReducedMotion } from '../lib/animate'
import { MoonRenderer } from '../render/moonRenderer'
import { burst } from '../render/particles'
import type { MoonTexture } from '../render/moonTexture'
import type { PersonState } from './personPanel'

const RING_RADIUS = 47 // % of the 100-unit viewBox

export class ResultStage {
  private renderer: MoonRenderer
  private section: HTMLElement
  private mergeWrap: HTMLElement
  private particlesCanvas: HTMLCanvasElement
  private ringFg: SVGCircleElement
  private scoreEl: HTMLElement
  private pairEl: HTMLElement
  private verdictTitle: HTMLElement
  private verdictLine: HTMLElement
  private chipsEl: HTMLElement
  private revealToken = 0
  private open = false

  constructor(root: HTMLElement, texture: MoonTexture) {
    this.section = root
    this.mergeWrap = root.querySelector<HTMLElement>('.merge-wrap')!
    const canvas = root.querySelector<HTMLCanvasElement>('.merge-moon')!
    const glow = root.querySelector<HTMLCanvasElement>('.merge-glow')!
    this.particlesCanvas = root.querySelector<HTMLCanvasElement>('.merge-particles')!
    this.particlesCanvas.width = 900
    this.particlesCanvas.height = 900
    this.ringFg = root.querySelector<SVGCircleElement>('.ring-fg')!
    this.scoreEl = root.querySelector<HTMLElement>('.score-number')!
    this.pairEl = root.querySelector<HTMLElement>('.score-pair')!
    this.verdictTitle = root.querySelector<HTMLElement>('.verdict-title')!
    this.verdictLine = root.querySelector<HTMLElement>('.verdict-line')!
    this.chipsEl = root.querySelector<HTMLElement>('.chips')!

    this.renderer = new MoonRenderer(canvas, 640, texture, glow)
    const circumference = 2 * Math.PI * RING_RADIUS
    this.ringFg.style.strokeDasharray = `${circumference}`
    this.ringFg.style.strokeDashoffset = `${circumference}`

    // on desktop the result is a full-screen overlay — closable three ways
    root.querySelector('.result-close')!.addEventListener('click', () => this.hide())
    root.addEventListener('click', (e) => {
      if (e.target === root) this.hide() // backdrop click
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.hide()
    })
  }

  /** Desktop shows the result as a fixed overlay; mobile keeps it in the page flow. */
  private isOverlay(): boolean {
    return window.matchMedia('(min-width: 881px)').matches
  }

  isOpen(): boolean {
    return this.open
  }

  hide(): void {
    this.revealToken++
    this.open = false
    this.section.classList.remove('open', 'settled')
    window.setTimeout(() => {
      if (!this.open) this.section.hidden = true
    }, 450)
  }

  async reveal(a: PersonState, b: PersonState, fromCanvases: [HTMLCanvasElement, HTMLCanvasElement]): Promise<void> {
    const token = ++this.revealToken
    const alive = () => this.revealToken === token
    const reduced = prefersReducedMotion()
    const result = computeCompatibility(a.info.phase, b.info.phase)

    // -- reset stage --
    this.open = true
    this.section.hidden = false
    this.section.classList.remove('settled')
    this.section.dataset.tier = result.verdict.tier
    void this.section.offsetWidth
    this.section.classList.add('open')
    this.renderer.render({ psiA: Math.PI, psiB: null })
    this.scoreEl.textContent = '· · ·'
    this.pairEl.textContent = `${a.name} ✕ ${b.name}`
    this.verdictTitle.textContent = result.verdict.title
    this.verdictLine.textContent = result.verdict.line
    this.buildChips(a, b, result)
    const circumference = 2 * Math.PI * RING_RADIUS
    this.ringFg.style.transition = 'none'
    this.ringFg.style.strokeDashoffset = `${circumference}`

    if (!this.isOverlay()) {
      this.section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    }

    const psiA = psiForPhase(a.info.phase)
    const psiB = psiForPhase(b.info.phase)

    if (reduced) {
      this.renderer.render({ psiA, psiB, overlapTint: 1 })
      this.scoreEl.textContent = formatScore(result.score)
      this.ringFg.style.strokeDashoffset = `${circumference * (1 - result.score / 100)}`
      this.section.classList.add('settled')
      return
    }

    // -- 1. ghost moons fly in --
    await wait(420) // let the scroll settle before measuring
    if (!alive()) return
    this.flyGhosts(fromCanvases)
    await wait(760)
    if (!alive()) return

    // -- 2. light sweeps: each from its own side of the sky --
    const startA = psiA >= 0 ? Math.PI : -Math.PI
    await tween(1000, (t) => {
      if (!alive()) return
      this.renderer.render({ psiA: startA + (psiA - startA) * t, psiB: null })
    }, easeInOutCubic).done
    if (!alive()) return

    const startB = psiB >= 0 ? Math.PI : -Math.PI
    await tween(1000, (t) => {
      if (!alive()) return
      this.renderer.render({
        psiA,
        psiB: startB + (psiB - startB) * t,
        overlapTint: t,
      })
    }, easeInOutCubic).done
    if (!alive()) return

    // -- 3. pulse, ring, count-up --
    this.mergeWrap.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.035)', offset: 0.4 },
        { transform: 'scale(1)' },
      ],
      { duration: 900, easing: 'ease-in-out' },
    )

    this.ringFg.style.transition = 'stroke-dashoffset 1300ms cubic-bezier(0.22, 1, 0.36, 1)'
    void this.ringFg.getBoundingClientRect()
    this.ringFg.style.strokeDashoffset = `${circumference * (1 - result.score / 100)}`

    const countUp = tween(1400, (t) => {
      if (alive()) this.scoreEl.textContent = formatScore(result.score * t)
    }, easeOutCubic)

    if (result.score >= 70) {
      window.setTimeout(() => {
        if (alive()) burst(this.particlesCanvas, result.score >= 90 ? 1.3 : 0.9)
      }, 500)
    }

    await wait(550)
    if (!alive()) return
    this.section.classList.add('settled') // verdict + chips stagger in via CSS

    await countUp.done
    if (alive()) this.scoreEl.textContent = formatScore(result.score)
  }

  /** FLIP-style ghosts: snapshots of the two panel moons converge on the stage. */
  private flyGhosts(from: [HTMLCanvasElement, HTMLCanvasElement]): void {
    const target = this.mergeWrap.getBoundingClientRect()
    from.forEach((src, i) => {
      const rect = src.getBoundingClientRect()
      if (rect.width === 0) return
      const ghost = document.createElement('canvas')
      ghost.width = 128
      ghost.height = 128
      ghost.getContext('2d')!.drawImage(src, 0, 0, 128, 128)
      ghost.className = 'ghost-moon'
      Object.assign(ghost.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
      document.body.appendChild(ghost)
      const dx = target.left + target.width / 2 - (rect.left + rect.width / 2)
      const dy = target.top + target.height / 2 - (rect.top + rect.height / 2)
      const scale = (target.width * 0.9) / rect.width
      ghost
        .animate(
          [
            { transform: 'translate(0, 0) scale(1)', opacity: 0.9 },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
          ],
          {
            duration: 780,
            delay: i * 130,
            easing: 'cubic-bezier(0.55, 0.06, 0.28, 0.99)',
            fill: 'forwards',
          },
        )
        .finished.finally(() => ghost.remove())
    })
  }

  private buildChips(a: PersonState, b: PersonState, r: CompatResult): void {
    const chip = (label: string, value: string, detail: string) => `
      <div class="chip">
        <span class="chip-label">${escapeHtml(label)}</span>
        <span class="chip-value">${escapeHtml(value)}</span>
        <span class="chip-detail">${escapeHtml(detail)}</span>
      </div>`
    this.chipsEl.innerHTML = [
      chip(a.name, a.info.name, `${Math.round(a.info.illumination * 100)}% illuminated at birth`),
      chip(b.name, b.info.name, `${Math.round(b.info.illumination * 100)}% illuminated at birth`),
      chip('Sky coverage', `${r.coverage.toFixed(1)}%`, 'of one full moon, lit between you'),
      chip(
        'Cycle offset',
        `${r.offsetDays.toFixed(1)} days`,
        'apart in the 29.5-day cycle — 14.8 is a perfect fit',
      ),
    ].join('')
  }
}

function formatScore(s: number): string {
  return `${s.toFixed(1)}%`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
