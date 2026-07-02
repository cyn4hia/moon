/**
 * One side of the duet: a live moon, a name field, a birth-date field, and a
 * phase readout. Owns its renderer; reports phase changes upward.
 */

import { dateFromInput, phaseInfoForDate, type PhaseInfo } from '../lib/lunar'
import { MoonRenderer } from '../render/moonRenderer'
import type { MoonTexture } from '../render/moonTexture'
import { MoonDatePicker } from './datePicker'

export interface PersonState {
  name: string
  date: Date
  info: PhaseInfo
}

export class PersonPanel {
  readonly moonCanvas: HTMLCanvasElement
  private renderer: MoonRenderer
  private nameInput: HTMLInputElement
  private picker: MoonDatePicker
  private phaseNameEl: HTMLElement
  private phaseMetaEl: HTMLElement
  private state: PersonState | null = null

  constructor(
    private root: HTMLElement,
    texture: MoonTexture,
    private fallbackName: string,
    private onChange: (state: PersonState | null) => void,
  ) {
    this.moonCanvas = root.querySelector<HTMLCanvasElement>('.moon')!
    const glow = root.querySelector<HTMLCanvasElement>('.moon-glow')!
    this.nameInput = root.querySelector<HTMLInputElement>('.name-input')!
    this.phaseNameEl = root.querySelector<HTMLElement>('.phase-name')!
    this.phaseMetaEl = root.querySelector<HTMLElement>('.phase-meta')!

    this.renderer = new MoonRenderer(this.moonCanvas, 512, texture, glow)
    this.renderer.setPhase(0) // resting state: dark new moon with earthshine

    this.picker = new MoonDatePicker(
      root.querySelector<HTMLInputElement>('.date-input')!,
      root.querySelector<HTMLElement>('.date-field')!,
      texture,
    )
    this.picker.onSelect = () => this.handleDate()
    this.nameInput.addEventListener('input', () => {
      if (this.state) {
        this.state = { ...this.state, name: this.displayName() }
        this.onChange(this.state)
      }
    })
  }

  private displayName(): string {
    return this.nameInput.value.trim() || this.fallbackName
  }

  private handleDate(): void {
    const date = dateFromInput(this.picker.getValue())
    if (!date) {
      this.state = null
      this.root.classList.remove('has-date')
      this.setReadout('Awaiting a birthday', 'the moon holds its breath')
      this.renderer.animateToPhase(0, 900)
      this.onChange(null)
      return
    }

    const info = phaseInfoForDate(date)
    this.state = { name: this.displayName(), date, info }
    this.root.classList.add('has-date')
    this.renderer.animateToPhase(info.phase, 1300)
    this.setReadout(
      info.name,
      `${Math.round(info.illumination * 100)}% illuminated · day ${info.age.toFixed(1)} of the cycle`,
    )
    this.onChange(this.state)
  }

  private setReadout(name: string, meta: string): void {
    // retrigger the fade-up animation
    const readout = this.root.querySelector<HTMLElement>('.phase-readout')!
    readout.classList.remove('swap')
    void readout.offsetWidth
    this.phaseNameEl.textContent = name
    this.phaseMetaEl.textContent = meta
    readout.classList.add('swap')
  }

  getState(): PersonState | null {
    return this.state
  }

  setDate(value: string): void {
    this.picker.setValue(value)
    this.handleDate()
  }

  setName(value: string): void {
    this.nameInput.value = value
    if (this.state) {
      this.state = { ...this.state, name: this.displayName() }
      this.onChange(this.state)
    }
  }

  getNameValue(): string {
    return this.nameInput.value.trim()
  }

  getDateValue(): string {
    return this.picker.getValue()
  }
}
