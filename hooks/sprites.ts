// Pixel Clawd knights for the demo team roster.
// Sprite construction (24x18 crab on a 30x28 grid, stamped from ASCII rows) and the
// idea of one costume per class come from savvy-progress by johnnyvizz (MIT,
// github.com/johnnyvizz/claude-kit); the classes, sleep state and layout are new.
import type { Cls, Member } from '../types'

const CLAY = '#D97757'
const INK = '#1F1E1D'

export const ACCENT: Record<Cls, string> = {
  mage: '#7B5BD6',
  paladin: '#C9473E',
  rogue: '#5C6B8A',
  cleric: '#D9A92A',
  ranger: '#4C8C4A',
  barbarian: '#B5651D',
  king: '#E0A800',
}

const CLASS_OF: Record<string, Cls> = {
  lancelot: 'paladin',
  gawain: 'paladin',
  bedivere: 'paladin',
  galahad: 'cleric',
  kei: 'ranger',
  tristan: 'ranger',
  percival: 'rogue',
  bors: 'rogue',
  lamorak: 'rogue',
  merlin: 'mage',
  palamedes: 'mage',
  gareth: 'barbarian',
  ector: 'barbarian',
  arthur: 'king',
}

const CLASSES = Object.keys(ACCENT)

export const classOf = (name: string, explicit?: string): Cls => {
  if (explicit && CLASSES.includes(explicit)) return explicit as Cls
  const first = name.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')[0] ?? ''
  return CLASS_OF[first] ?? 'paladin'
}

type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

const crabBody = (f: Fill, isAsleep: boolean, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  if (isAsleep) {
    f(9, 13, 3, 1, INK)
    f(18, 13, 3, 1, INK)
  } else {
    f(9, 12, 2, 2, INK)
    f(19, 12, 2, 2, INK)
  }
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

const COSTUMES: Record<Cls, (f: Fill, t: string, isAsleep: boolean) => void> = {
  // Archmage: starred wizard hat; the staff orb pulses and sparks fly while casting.
  mage: (f, t, z) => {
    crabBody(f, z)
    stamp(f, 6, 2, ['.......pppp.......', '......pppppp......', '.....pppppppp.....', '....pppppppppp....', '...pppppppppppp...', '.pppppppppppppppp.'], { p: '#6B4FBB' })
    f(6, 8, 18, 1, '#4B3590'); f(6, 9, 18, 1, t)
    f(14, 4, 2, 2, '#F5C542', 'star')
    f(27, 4, 1, 12, '#7A4A26'); f(26, 1, 3, 3, t, 'orb'); f(25, 2, 1, 1, '#fff', 'star')
    f(29, 0, 1, 1, '#fff', 'sp1'); f(24, 0, 1, 1, '#E8DBFF', 'sp2'); f(29, 5, 1, 1, '#E8DBFF', 'sp3')
  },
  // Paladin: plumed helm, sword and shield; the blade slashes.
  paladin: (f, t, z) => {
    crabBody(f, z, -4, 'it')
    stamp(f, 6, 2, ['.......rrrrr......', '....ssssssssss....', '...ssssssssssss...', '..ssssssssssssss..', '..ssssssssssssss..', '..dddddddddddddd..'], { r: '#C0392B', s: '#B8BDC7', d: '#6B7280' })
    f(6, 9, 18, 1, t)
    f(25, 1, 2, 8, '#E6E8EE', 'it'); f(24, 9, 4, 1, '#F5C542', 'it'); f(25, 1, 1, 1, '#fff', 'gl')
    f(0, 11, 4, 8, t); f(1, 12, 2, 6, '#F4F3EE')
  },
  // Rogue: dark hood; the dagger twirls.
  rogue: (f, t, z) => {
    crabBody(f, z)
    stamp(f, 6, 4, ['.....gggggggg.....', '...gggggggggggg...', '..gggggggggggggg..', '..gggggggggggggg..', '..dddddddddddddd..'], { g: '#3B3F54', d: '#262938' })
    f(6, 9, 18, 1, t)
    stamp(f, 0, 8, ['..s.', '..s.', '.sss', '..h.', '..h.'], { s: '#C9CCD2', h: '#7A4A26' }, 'it')
  },
  // Cleric: white cowl and halo; the holy mace tilts and healing sparks rise.
  cleric: (f, t, z) => {
    crabBody(f, z, -4, 'pan')
    f(10, 0, 10, 1, '#F5C542', 'halo')
    stamp(f, 6, 2, ['.....wwwwwwww.....', '...wwwwwwwwwwww...', '..wwwwwwwwwwwwww..', '..wwwwwwwwwwwwww..', 'wwwwwwwwwwwwwwwwww', '.bbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbb.'], { w: '#F4F3EE', b: t })
    f(26, 6, 1, 9, '#7A4A26', 'pan'); f(24, 3, 5, 4, '#F5C542', 'pan')
    f(1, 6, 1, 3, '#7BD88F', 'sp1'); f(0, 7, 3, 1, '#7BD88F', 'sp1'); f(29, 8, 1, 3, '#7BD88F', 'sp2'); f(28, 9, 3, 1, '#7BD88F', 'sp2')
  },
  // Ranger: green hood with a feather; runs at double pace, the bow flutters.
  ranger: (f, t, z) => {
    crabBody(f, z, -4)
    stamp(f, 6, 5, ['....gggggggggg....', '..gggggggggggggg..', '.gggggggggggggggg.', '.gggggggggggggggg.', '.dddddddddddddddd.'], { g: '#4C8C4A', d: '#2F5E2E' })
    stamp(f, 20, 1, ['.f', 'ff', 'ff', 'f.'], { f: t })
    stamp(f, 25, 0, ['.bb', 'b..', 'b..', 'b..', 'b..', 'b..', 'b..', 'b..', 'b..', '.bb'], { b: '#7A4A26' }, 'flag')
    f(25, 1, 1, 8, '#F8F6F1', 'flag')
  },
  // Barbarian: horned helm; the axe swings.
  barbarian: (f, t, z) => {
    crabBody(f, z)
    stamp(f, 5, 3, ['w..................w', 'ww................ww', '.ww...ssssssss...ww.', '...ssssssssssssss...', '...ssssssssssssss...', '.gggggggggggggggggg.'], { w: '#F4F3EE', s: '#8E929A', g: t })
    f(27, 6, 1, 9, '#7A4A26', 'it'); f(25, 5, 4, 3, '#C9CCD2', 'it')
  },
  // King: golden crown and ermine collar; the scepter glints.
  king: (f, t, z) => {
    crabBody(f, z, -4, 'it')
    stamp(f, 8, 3, ['y...y...y...y', 'yy.yyy.yyy.yy', 'yyyyyyyyyyyyy', 'yyyyyyyyyyyyy'], { y: '#F5C542' })
    f(11, 5, 1, 1, '#C0392B'); f(14, 5, 1, 1, '#2E86DE'); f(17, 5, 1, 1, '#C0392B')
    f(7, 9, 16, 1, '#F4F3EE'); f(7, 18, 16, 3, '#8E2F3B')
    f(27, 3, 1, 12, '#7A4A26', 'it'); f(26, 0, 3, 3, t, 'it'); f(27, 1, 1, 1, '#fff', 'star')
  },
}

// Pure CSS, run by the compositor. `run` = working, `sleep` = idle.
const CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#4d4d49}.m{fill:#8a8a86}.track{fill:#e7e6e2}.warn{fill:#c0392b}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#b4b4b0}.m{fill:#7d7d79}.track{fill:#333331}.warn{fill:#ff7a6b}}
g{transform-box:fill-box}
.run .la{animation:st .5s steps(1) infinite var(--ph,0s)}.run .lb{animation:st .5s steps(1) infinite calc(-.25s + var(--ph,0s))}
.run .bd{animation:bob .5s steps(1) infinite calc(-.125s + var(--ph,0s))}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.sleep .bd{animation:breathe 3.4s ease-in-out infinite var(--ph,0s)}@keyframes breathe{50%{transform:translateY(1px)}}
.c-mage.run .la,.c-mage.run .lb,.c-mage.run .bd{animation:none}.c-mage.run{animation:float 1.2s ease-in-out infinite var(--ph,0s)}
.c-mage.run .orb{animation:glow .6s ease-in-out infinite var(--ph,0s)}.c-mage.run .star{animation:blink .5s steps(1) infinite var(--ph,0s)}
.c-mage.run .sp1{animation:fly .9s linear infinite var(--ph,0s)}.c-mage.run .sp2{animation:fly .9s linear infinite calc(-.3s + var(--ph,0s))}.c-mage.run .sp3{animation:fly .9s linear infinite calc(-.6s + var(--ph,0s))}
.sp1,.sp2,.sp3{opacity:0}.c-mage.run .sp1,.c-mage.run .sp2,.c-mage.run .sp3,.c-cleric.run .sp1,.c-cleric.run .sp2{opacity:1}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.2}}@keyframes glow{50%{opacity:.35;transform:scale(1.5)}}
@keyframes fly{0%{transform:translate(0,3px);opacity:0}30%{opacity:1}100%{transform:translate(3px,-8px);opacity:0}}
.c-paladin.run .it{transform-origin:50% 100%;animation:slash .6s ease-in-out infinite var(--ph,0s)}.c-paladin.run .gl{animation:blink 1s steps(1) infinite calc(-.5s + var(--ph,0s))}
@keyframes slash{50%{transform:rotate(-45deg)}}
.c-rogue.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite var(--ph,0s)}@keyframes twist{50%{transform:rotate(-35deg)}}
.c-cleric.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite var(--ph,0s)}.c-cleric.run .halo{animation:glow 1.2s ease-in-out infinite var(--ph,0s)}
.c-cleric.run .sp1{animation:rise 1.2s linear infinite var(--ph,0s)}.c-cleric.run .sp2{animation:rise 1.2s linear infinite calc(-.6s + var(--ph,0s))}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes rise{0%{transform:translateY(4px);opacity:0}40%{opacity:1}100%{transform:translateY(-8px);opacity:0}}
.c-ranger.run .la{animation-duration:.25s}.c-ranger.run .lb{animation-duration:.25s;animation-delay:calc(-.125s + var(--ph,0s))}
.c-ranger.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite var(--ph,0s)}@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-barbarian.run .it{transform-origin:50% 100%;animation:swing .5s ease-in-out infinite var(--ph,0s)}@keyframes swing{50%{transform:rotate(30deg)}}
.c-king.run .it{transform-origin:50% 100%;animation:decree 1.2s ease-in-out infinite var(--ph,0s)}.c-king.run .star{animation:blink .6s steps(1) infinite var(--ph,0s)}
@keyframes decree{50%{transform:rotate(-14deg)}}
.z1,.z2,.z3{opacity:0;animation:zz 3.2s ease-in-out infinite var(--ph,0s)}.z2{animation-delay:calc(1s + var(--ph,0s))}.z3{animation-delay:calc(2s + var(--ph,0s))}
@keyframes zz{0%{opacity:0;transform:translate(0,4px)}25%{opacity:.9}100%{opacity:0;transform:translate(8px,-12px)}}
.ind{animation:slide 1.4s ease-in-out infinite alternate var(--ph,0s)}@keyframes slide{from{transform:translateX(0)}to{transform:translateX(var(--w))}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`

const sprite = (cls: Cls, isAsleep: boolean, x: number, y: number, scale: number): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, k = 'bd') => {
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  COSTUMES[cls](f, ACCENT[cls], isAsleep)
  const group = (k: string) => `<g class="${k}">${(groups.get(k) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  const state = isAsleep ? 'sleep' : 'run'
  return `<g transform="translate(${x},${y}) scale(${scale})" shape-rendering="crispEdges" opacity="${isAsleep ? 0.62 : 1}"><g class="c-${cls} ${state}">${body}${group('la')}${group('lb')}</g></g>`
}

// A fixed phase per member, so the knights do not all move in step.
const phaseOf = (m: Member): string => {
  let h = 0
  for (const ch of m.id) h = (h * 31 + ch.charCodeAt(0)) % 4000
  return `-${(h / 1000).toFixed(2)}s`
}

const cssFor = (m: Member): string => CSS.split('var(--ph,0s)').join(phaseOf(m))

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fit = (s: string, n: number): string => (s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : s)

export const fmtDur = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 10) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export const statusOf = (m: Member): string => (m.state === 'working' ? 'working' : m.isBlocked ? '! blocked' : 'idling')

// Completion as a small number for the bar: while working or blocked, and steps are reported.
export const pctOf = (m: Member): string =>
  (m.state === 'working' || m.isBlocked) && typeof m.total === 'number' && m.total > 0 ? `${Math.min(100, Math.round(((m.done ?? 0) / m.total) * 100))}%` : ''

export const timesOf = (m: Member): string => {
  const steps = typeof m.total === 'number' && m.total > 0 ? `${m.done ?? 0}/${m.total}` : ''
  const times =
    m.state === 'working'
      ? [m.elapsedMs !== undefined ? fmtDur(m.elapsedMs) : '', m.etaMs !== undefined ? `~${fmtDur(m.etaMs)} left` : ''].filter(Boolean).join(' · ')
      : ''
  return [steps, times].filter(Boolean).join('  ·  ')
}

// Time in progress and time to complete, shown on their own, only while working.
export const elapsedOf = (m: Member): string => (m.state === 'working' && m.elapsedMs !== undefined ? fmtDur(m.elapsedMs) : '')
export const etaOf = (m: Member): string => (m.state === 'working' && m.etaMs !== undefined ? `~${fmtDur(m.etaMs)} left` : '')

// The step in progress, or the blocker (shown in red by the caller).
export const stepOf = (m: Member): string => (m.isBlocked ? `Blocked: ${m.note ?? m.task ?? ''}`.trimEnd() : (m.note ?? ''))

export const WARN = '#c0392b'

// The knight alone, a fixed size on screen: it never scales with the room around it.
// It is drawn on a 44x40 grid and shown at about one and a half times that.
export const SPRITE_W = 68
export const SPRITE_H = 62
const GRID_W = 44
const GRID_H = 40

export const spriteSvg = (m: Member, w: number = SPRITE_W, h: number = SPRITE_H): string => {
  const isAsleep = m.state !== 'working'
  const zs = isAsleep
    ? `<text class="m z1" x="30" y="12" font-size="9">z</text><text class="m z2" x="34" y="9" font-size="11">Z</text><text class="m z3" x="40" y="6" font-size="13">Z</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${GRID_W} ${GRID_H}" font-family="Segoe UI, system-ui, sans-serif">${cssFor(m)}${sprite(m.cls, isAsleep, 3, 3, 1.25)}${zs}</svg>`
}

// The thin progress bar: stretches across whatever width it is given, its height fixed
// by the caller. A known fraction fills; a working task with no steps runs a slider.
export const BAR_H = 6
export const barSvg = (m: Member): string => {
  const isRun = m.state === 'working'
  const color = ACCENT[m.cls]
  const hasSteps = typeof m.total === 'number' && m.total > 0
  const frac = hasSteps ? Math.min(1, (m.done ?? 0) / (m.total ?? 1)) : 0
  const live = isRun || m.isBlocked
  const track = `<rect class="track" x="0" y="0" width="100" height="${BAR_H}" opacity="${live ? 1 : 0.55}"/>`
  const fill = !live
    ? ''
    : hasSteps
      ? `<rect x="0" y="0" width="${Math.max(2, frac * 100).toFixed(1)}" height="${BAR_H}" fill="${m.isBlocked ? WARN : color}"/>`
      : `<g class="ind" style="--w:70px"><rect x="0" y="0" width="30" height="${BAR_H}" fill="${color}" opacity=".85"/></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${BAR_H}" preserveAspectRatio="none">${cssFor(m)}${track}${fill}</svg>`
}

// The whole card as one drawing: border, knight, name, bar and four rows of text, laid out in pixels
// (the pane's own text rows are taller than a card wants). Long text is cut by hand, there being no
// way to measure it here. Empty values are a dash, so the card never changes shape.
export const CARD_W = 264
export const CARD_H = 94
const CARD_GAP = 10
// The dashboard's own palette (olive and bone, square corners), drawn over the same card.
const RETRO_CSS = `<style>.cb{stroke:#4A5236;stroke-width:2}.t{fill:#E4E0C6}.s{fill:#C5C2A6}.m{fill:#9AA086}.track{fill:#323A28}.warn{fill:#FF7A6B}@media (prefers-color-scheme: light){.cb{stroke:#B9A88B}.t{fill:#2A1620}.s{fill:#5C4A52}.m{fill:#7A6A5C}.track{fill:#E0D4B5}.warn{fill:#B3261E}}</style>`
const DASH = '—'
const CARD_CSS = `<style>.cb{fill:none;stroke:#d9d8d3}.hl{font-weight:600}@media (prefers-color-scheme: dark){.cb{stroke:#3d3d3a}}</style>`

export const cardSvg = (m: Member, isRetro = false): string => {
  const isRun = m.state === 'working'
  const isAsleep = !isRun
  const color = ACCENT[m.cls]
  const x0 = 92
  const x1 = CARD_W - 12
  const barW = x1 - x0
  const hasSteps = typeof m.total === 'number' && m.total > 0
  const frac = hasSteps ? Math.min(1, (m.done ?? 0) / (m.total ?? 1)) : 0
  const live = isRun || m.isBlocked
  const zs = isAsleep
    ? `<text class="m z1" x="30" y="12" font-size="9">z</text><text class="m z2" x="34" y="9" font-size="11">Z</text><text class="m z3" x="40" y="6" font-size="13">Z</text>`
    : ''
  const fill = !live
    ? ''
    : hasSteps
      ? `<rect x="${x0}" y="28" width="${Math.max(3, frac * barW).toFixed(1)}" height="6" fill="${m.isBlocked ? WARN : color}" clip-path="url(#bar)"/>`
      : `<g clip-path="url(#bar)"><g class="ind" style="--w:${Math.round(barW * 0.7)}px"><rect x="${x0}" y="28" width="${Math.round(barW * 0.3)}" height="6" fill="${color}" opacity=".85"/></g></g>`
  const text = (cls: string, x: number, y: number, s: string, anchor = 'start'): string =>
    `<text class="${cls}" x="${x}" y="${y}" font-size="12" text-anchor="${anchor}">${esc(s)}</text>`
  const task = m.task ?? (isRun ? 'working…' : DASH)
  const step = stepOf(m) || DASH
  const badge = m.isBlocked ? `<circle cx="78" cy="16" r="8" fill="${WARN}"/><text x="78" y="20" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">!</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H + CARD_GAP}" viewBox="0 0 ${CARD_W} ${CARD_H + CARD_GAP}" font-family="Anthropic Sans, Inter, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif">${cssFor(m)}${CARD_CSS}${isRetro ? RETRO_CSS : ''}
<defs><clipPath id="bar"><rect x="${x0}" y="28" width="${barW}" height="6" rx="${isRetro ? 0 : 3}"/></clipPath></defs>
<rect class="cb" x="${isRetro ? 1 : 0.5}" y="${isRetro ? 1 : 0.5}" width="${CARD_W - (isRetro ? 2 : 1)}" height="${CARD_H - (isRetro ? 2 : 1)}" rx="${isRetro ? 0 : 12}"/>
<svg x="12" y="16" width="${SPRITE_W}" height="${SPRITE_H}" viewBox="0 0 ${GRID_W} ${GRID_H}">${sprite(m.cls, isAsleep, 3, 3, 1.25)}${zs}</svg>${badge}
<rect class="track" x="${x0}" y="28" width="${barW}" height="6" rx="${isRetro ? 0 : 3}" opacity="${live ? 1 : 0.55}"/>${fill}
${text('t hl', x0, 22, fit(m.name, 18))}${text('s', x1, 22, pctOf(m) || DASH, 'end')}
${text('s', x0, 51, elapsedOf(m) || DASH)}${text('s', x1, 51, etaOf(m) || DASH, 'end')}
${text(isRun ? 't' : 'm', x0, 66, fit(task, 26))}
${text(m.isBlocked ? 'warn' : 's', x0, 81, fit(step, 26))}
</svg>`
}

// The same tile as a page fragment, for the pop-out window (CSS in the page does the layout).
export const tileHtml = (m: Member): string => {
  const isRun = m.state === 'working'
  const task = m.task ?? (isRun ? 'working…' : 'no task')
  const status = statusOf(m)
  return `<div class="tile"><div class="spr">${spriteSvg(m)}</div><div class="body">
<div class="r"><b>${esc(fit(m.name, 24))}</b><span class="st ${isRun ? 'on' : m.isBlocked ? 'bad' : ''}">${esc(status)}</span></div>
<div class="task ${isRun ? '' : 'dim'}">${esc(task) || '&nbsp;'}</div>
<div class="bar">${barSvg(m)}</div>
<div class="r sub"><span class="note">${esc(m.note ?? '') || '&nbsp;'}</span><span>${esc(timesOf(m))}</span></div></div></div>`
}
