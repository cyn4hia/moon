/**
 * Moon-themed replacement for the native date picker.
 *
 * A glass popover with three views — days, months, years — so a birthday
 * decades back is three clicks away. Day cells mark full (gold dot) and new
 * (hollow dot) moons; the footer shows a live mini-moon with the phase of the
 * hovered or selected night. The bound input becomes readonly display; the
 * authoritative value stays ISO (yyyy-mm-dd) via getValue()/setValue().
 */

import { moonPhase, phaseName, dateFromInput } from '../lib/lunar'
import { MoonRenderer } from '../render/moonRenderer'
import type { MoonTexture } from '../render/moonTexture'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type View = 'days' | 'months' | 'years'

let openPicker: MoonDatePicker | null = null

document.addEventListener('pointerdown', (e) => {
  if (openPicker && !openPicker.owns(e.target as Node)) openPicker.close()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openPicker) openPicker.close(true)
})

export class MoonDatePicker {
  onSelect: (iso: string) => void = () => {}

  private value = '' // ISO or ''
  private view: View = 'days'
  private cursorYear: number
  private cursorMonth: number
  private readonly max: Date
  private pop: HTMLElement
  private titleBtn: HTMLButtonElement
  private prevBtn: HTMLButtonElement
  private nextBtn: HTMLButtonElement
  private body: HTMLElement
  private footName: HTMLElement
  private footDate: HTMLElement
  private clearBtn: HTMLButtonElement
  private mini: MoonRenderer

  constructor(
    private input: HTMLInputElement,
    private container: HTMLElement,
    texture: MoonTexture,
  ) {
    const now = new Date()
    this.max = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)
    this.cursorYear = now.getFullYear()
    this.cursorMonth = now.getMonth()

    input.readOnly = true
    input.placeholder = 'Select a night'
    input.setAttribute('aria-haspopup', 'dialog')

    this.pop = document.createElement('div')
    this.pop.className = 'dp'
    this.pop.hidden = true
    this.pop.setAttribute('role', 'dialog')
    this.pop.setAttribute('aria-label', 'Choose a birth date')
    this.pop.innerHTML = `
      <div class="dp-head">
        <button type="button" class="dp-nav dp-prev" aria-label="Previous">‹</button>
        <button type="button" class="dp-title"></button>
        <button type="button" class="dp-nav dp-next" aria-label="Next">›</button>
      </div>
      <div class="dp-body"></div>
      <div class="dp-foot">
        <canvas class="dp-moon" aria-hidden="true"></canvas>
        <div class="dp-foot-text">
          <span class="dp-foot-name"></span>
          <span class="dp-foot-date"></span>
        </div>
        <button type="button" class="dp-clear" hidden>Clear</button>
      </div>`
    container.appendChild(this.pop)

    this.titleBtn = this.pop.querySelector('.dp-title')!
    this.prevBtn = this.pop.querySelector('.dp-prev')!
    this.nextBtn = this.pop.querySelector('.dp-next')!
    this.body = this.pop.querySelector('.dp-body')!
    this.footName = this.pop.querySelector('.dp-foot-name')!
    this.footDate = this.pop.querySelector('.dp-foot-date')!
    this.clearBtn = this.pop.querySelector('.dp-clear')!
    this.mini = new MoonRenderer(this.pop.querySelector('.dp-moon')!, 72, texture)

    input.addEventListener('click', () => this.toggle())
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        this.toggle(true)
      }
    })
    this.titleBtn.addEventListener('click', () => {
      this.view = this.view === 'days' ? 'months' : 'years'
      this.renderView()
    })
    this.prevBtn.addEventListener('click', () => this.step(-1))
    this.nextBtn.addEventListener('click', () => this.step(1))
    this.clearBtn.addEventListener('click', () => {
      this.setValue('')
      this.close()
      this.onSelect('')
    })

    this.body.addEventListener('mouseover', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.dp-day:not(:disabled)')
      if (btn?.dataset.iso) this.previewNight(btn.dataset.iso)
    })
    this.body.addEventListener('mouseleave', () => this.previewNight(this.value || null))
  }

  owns(node: Node): boolean {
    return this.container.contains(node)
  }

  getValue(): string {
    return this.value
  }

  setValue(iso: string): void {
    const date = iso ? dateFromInput(iso) : null
    this.value = date ? iso : ''
    this.input.value = date ? formatDisplay(date) : ''
    this.clearBtn.hidden = !this.value
    if (date) {
      this.cursorYear = date.getFullYear()
      this.cursorMonth = date.getMonth()
    }
  }

  private toggle(forceOpen = false): void {
    if (!this.pop.hidden && !forceOpen) this.close()
    else this.open()
  }

  private open(): void {
    if (openPicker && openPicker !== this) openPicker.close()
    openPicker = this
    this.view = 'days'
    const sel = this.value ? dateFromInput(this.value) : null
    this.cursorYear = sel ? sel.getFullYear() : this.max.getFullYear()
    this.cursorMonth = sel ? sel.getMonth() : this.max.getMonth()
    this.pop.hidden = false
    requestAnimationFrame(() => this.pop.classList.add('dp-open'))
    this.renderView()
    this.previewNight(this.value || null)
  }

  close(refocus = false): void {
    if (this.pop.hidden) return
    this.pop.classList.remove('dp-open')
    this.pop.hidden = true
    if (openPicker === this) openPicker = null
    if (refocus) this.input.focus()
  }

  private step(dir: number): void {
    if (this.view === 'days') {
      const m = this.cursorMonth + dir
      this.cursorYear += Math.floor(m / 12)
      this.cursorMonth = ((m % 12) + 12) % 12
    } else if (this.view === 'months') {
      this.cursorYear += dir
    } else {
      this.cursorYear += dir * 12
    }
    this.renderView()
  }

  private renderView(): void {
    if (this.view === 'days') this.renderDays()
    else if (this.view === 'months') this.renderMonths()
    else this.renderYears()
  }

  private renderDays(): void {
    this.titleBtn.textContent = `${MONTHS[this.cursorMonth]} ${this.cursorYear}`
    this.prevBtn.disabled = false
    this.nextBtn.disabled =
      new Date(this.cursorYear, this.cursorMonth + 1, 1) > this.max

    const today = new Date()
    const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())
    const first = new Date(this.cursorYear, this.cursorMonth, 1)
    const start = new Date(this.cursorYear, this.cursorMonth, 1 - first.getDay())

    let html = `<div class="dp-weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>`
    html += '<div class="dp-grid dp-grid-days">'
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12)
      const iso = toIso(d.getFullYear(), d.getMonth(), d.getDate())
      const out = d.getMonth() !== this.cursorMonth
      const disabled = d > this.max
      const name = phaseName(moonPhase(d))
      const cls = [
        'dp-day',
        out ? 'dp-out' : '',
        iso === this.value ? 'dp-sel' : '',
        iso === todayIso ? 'dp-today' : '',
        name === 'Full Moon' ? 'dp-fullmoon' : '',
        name === 'New Moon' ? 'dp-newmoon' : '',
      ]
        .filter(Boolean)
        .join(' ')
      html += `<button type="button" class="${cls}" data-iso="${iso}" ${disabled ? 'disabled' : ''}
        aria-label="${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${name}"
        ${iso === this.value ? 'aria-pressed="true"' : ''}>${d.getDate()}</button>`
    }
    html += '</div>'
    this.body.innerHTML = html

    this.body.querySelectorAll<HTMLButtonElement>('.dp-day').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.setValue(btn.dataset.iso!)
        this.close(true)
        this.onSelect(this.value)
      }),
    )
  }

  private renderMonths(): void {
    this.titleBtn.textContent = `${this.cursorYear}`
    this.prevBtn.disabled = false
    this.nextBtn.disabled = this.cursorYear + 1 > this.max.getFullYear()
    const sel = this.value ? dateFromInput(this.value) : null

    this.body.innerHTML = `<div class="dp-grid dp-grid-cells">${MONTHS_SHORT.map((m, i) => {
      const disabled = new Date(this.cursorYear, i, 1) > this.max
      const isSel = sel && sel.getFullYear() === this.cursorYear && sel.getMonth() === i
      return `<button type="button" class="dp-cell ${isSel ? 'dp-sel' : ''}" data-m="${i}" ${
        disabled ? 'disabled' : ''
      }>${m}</button>`
    }).join('')}</div>`

    this.body.querySelectorAll<HTMLButtonElement>('.dp-cell').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.cursorMonth = +btn.dataset.m!
        this.view = 'days'
        this.renderView()
      }),
    )
  }

  private renderYears(): void {
    const start = Math.floor(this.cursorYear / 12) * 12
    this.titleBtn.textContent = `${start} – ${start + 11}`
    this.prevBtn.disabled = false
    this.nextBtn.disabled = start + 12 > this.max.getFullYear()
    const selYear = this.value ? dateFromInput(this.value)?.getFullYear() : null

    this.body.innerHTML = `<div class="dp-grid dp-grid-cells">${Array.from({ length: 12 }, (_, i) => {
      const y = start + i
      const disabled = y > this.max.getFullYear()
      return `<button type="button" class="dp-cell ${y === selYear ? 'dp-sel' : ''}" data-y="${y}" ${
        disabled ? 'disabled' : ''
      }>${y}</button>`
    }).join('')}</div>`

    this.body.querySelectorAll<HTMLButtonElement>('.dp-cell').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.cursorYear = +btn.dataset.y!
        this.view = 'months'
        this.renderView()
      }),
    )
  }

  private previewNight(iso: string | null): void {
    const date = iso ? dateFromInput(iso) : null
    if (!date) {
      this.mini.setPhase(0)
      this.footName.textContent = 'Pick a night'
      this.footDate.textContent = 'every one has a moon'
      return
    }
    const p = moonPhase(date)
    this.mini.setPhase(p)
    this.footName.textContent = phaseName(p)
    this.footDate.textContent = formatDisplay(date)
  }
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDisplay(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`
}
