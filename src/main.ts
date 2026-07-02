import './styles/main.css'
import { wait } from './lib/animate'
import { generateMoonTexture } from './render/moonTexture'
import { MoonRenderer } from './render/moonRenderer'
import { startStarfield } from './render/starfield'
import { PersonPanel, type PersonState } from './ui/personPanel'
import { ResultStage } from './ui/resultStage'

const texture = generateMoonTexture(1024)

startStarfield(document.querySelector<HTMLCanvasElement>('#stars')!)

// --- decorative 8-phase strip in the hero, with markers for each person ---
const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
]
const strip = document.querySelector<HTMLElement>('#phase-strip')!
const stripItems: HTMLElement[] = PHASE_NAMES.map((name, i) => {
  const item = document.createElement('div')
  item.className = 'strip-item'
  item.title = name
  const canvas = document.createElement('canvas')
  item.appendChild(canvas)
  const marks = document.createElement('span')
  marks.className = 'strip-marks'
  marks.innerHTML = '<i class="mark-a"></i><i class="mark-b"></i>'
  item.appendChild(marks)
  strip.appendChild(item)
  new MoonRenderer(canvas, 72, texture).setPhase(i / 8)
  return item
})

function markStrip(cls: 'is-a' | 'is-b', phase: number | null): void {
  stripItems.forEach((el) => el.classList.remove(cls))
  if (phase !== null) stripItems[Math.round(phase * 8) % 8].classList.add(cls)
}

// --- panels, CTA, result stage ---
const duet = document.querySelector<HTMLElement>('#duet')!
const revealBtn = document.querySelector<HTMLButtonElement>('#reveal')!
const ctaHint = document.querySelector<HTMLElement>('#cta-hint')!
const stage = new ResultStage(document.querySelector<HTMLElement>('#result')!, texture)

let revealed = false

function onPanelChange(which: 'a' | 'b', state: PersonState | null): void {
  markStrip(which === 'a' ? 'is-a' : 'is-b', state?.info.phase ?? null)
  const a = panelA.getState()
  const b = panelB.getState()
  const ready = !!(a && b)
  duet.classList.toggle('linked', ready)
  revealBtn.disabled = !ready
  if (stage.isOpen()) {
    stage.hide()
    revealed = false
  }
  revealBtn.querySelector('.cta-text')!.textContent = 'Reveal compatibility'
  ctaHint.textContent = ready
    ? 'The moon is listening'
    : 'Enter both birthdays to consult the moon'
}

const panelA = new PersonPanel(
  document.querySelector<HTMLElement>('[data-panel="a"]')!,
  texture,
  'First moon',
  (s) => onPanelChange('a', s),
)
const panelB = new PersonPanel(
  document.querySelector<HTMLElement>('[data-panel="b"]')!,
  texture,
  'Second moon',
  (s) => onPanelChange('b', s),
)

function reveal(): void {
  const a = panelA.getState()
  const b = panelB.getState()
  if (!a || !b) return
  revealed = true
  revealBtn.querySelector('.cta-text')!.textContent = 'Consult the moon again'

  // shareable URL
  const params = new URLSearchParams()
  params.set('a', panelA.getDateValue())
  params.set('b', panelB.getDateValue())
  if (panelA.getNameValue()) params.set('an', panelA.getNameValue())
  if (panelB.getNameValue()) params.set('bn', panelB.getNameValue())
  history.replaceState(null, '', `?${params.toString()}`)

  void stage.reveal(a, b, [panelA.moonCanvas, panelB.moonCanvas])
}

revealBtn.addEventListener('click', reveal)

// --- reveal the page only once styles, fonts, and the moons are in ---
// (the inline guard in index.html keeps everything hidden until body.ready)
const FONT_CHECKS = [
  '340 40px Fraunces',
  'italic 380 30px Fraunces',
  '330 16px Outfit',
  '500 12px Outfit',
]
const fontsReady = Promise.all(FONT_CHECKS.map((f) => document.fonts.load(f)))
  .then(() => document.fonts.ready)
  .then(() => undefined)

Promise.race([fontsReady, wait(2500)]).then(() => {
  document.body.classList.add('ready')

  // restore from a shared URL, once the page is visible
  const q = new URLSearchParams(location.search)
  const qa = q.get('a')
  const qb = q.get('b')
  if (qa && qb) {
    if (q.get('an')) panelA.setName(q.get('an')!)
    if (q.get('bn')) panelB.setName(q.get('bn')!)
    panelA.setDate(qa)
    panelB.setDate(qb)
    if (panelA.getState() && panelB.getState()) {
      window.setTimeout(() => {
        if (!revealed) reveal()
      }, 1100)
    }
  }
})
