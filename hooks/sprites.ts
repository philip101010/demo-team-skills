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
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.sleep .bd{animation:breathe 3.4s ease-in-out infinite}@keyframes breathe{50%{transform:translateY(1px)}}
.c-mage.run .la,.c-mage.run .lb,.c-mage.run .bd{animation:none}.c-mage.run{animation:float 1.2s ease-in-out infinite}
.c-mage.run .orb{animation:glow .6s ease-in-out infinite}.c-mage.run .star{animation:blink .5s steps(1) infinite}
.c-mage.run .sp1{animation:fly .9s linear infinite}.c-mage.run .sp2{animation:fly .9s linear infinite -.3s}.c-mage.run .sp3{animation:fly .9s linear infinite -.6s}
.sp1,.sp2,.sp3{opacity:0}.c-mage.run .sp1,.c-mage.run .sp2,.c-mage.run .sp3,.c-cleric.run .sp1,.c-cleric.run .sp2{opacity:1}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.2}}@keyframes glow{50%{opacity:.35;transform:scale(1.5)}}
@keyframes fly{0%{transform:translate(0,3px);opacity:0}30%{opacity:1}100%{transform:translate(3px,-8px);opacity:0}}
.c-paladin.run .it{transform-origin:50% 100%;animation:slash .6s ease-in-out infinite}.c-paladin.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes slash{50%{transform:rotate(-45deg)}}
.c-rogue.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}@keyframes twist{50%{transform:rotate(-35deg)}}
.c-cleric.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}.c-cleric.run .halo{animation:glow 1.2s ease-in-out infinite}
.c-cleric.run .sp1{animation:rise 1.2s linear infinite}.c-cleric.run .sp2{animation:rise 1.2s linear infinite -.6s}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes rise{0%{transform:translateY(4px);opacity:0}40%{opacity:1}100%{transform:translateY(-8px);opacity:0}}
.c-ranger.run .la{animation-duration:.25s}.c-ranger.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-ranger.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-barbarian.run .it{transform-origin:50% 100%;animation:swing .5s ease-in-out infinite}@keyframes swing{50%{transform:rotate(30deg)}}
.c-king.run .it{transform-origin:50% 100%;animation:decree 1.2s ease-in-out infinite}.c-king.run .star{animation:blink .6s steps(1) infinite}
@keyframes decree{50%{transform:rotate(-14deg)}}
.z1,.z2,.z3{opacity:0;animation:zz 3.2s ease-in-out infinite}.z2{animation-delay:1s}.z3{animation-delay:2s}
@keyframes zz{0%{opacity:0;transform:translate(0,4px)}25%{opacity:.9}100%{opacity:0;transform:translate(8px,-12px)}}
.ind{animation:slide 1.4s ease-in-out infinite alternate}@keyframes slide{from{transform:translateX(0)}to{transform:translateX(var(--w))}}
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

// Completion as a small number for the bar: only while working and steps are reported.
export const pctOf = (m: Member): string =>
  m.state === 'working' && typeof m.total === 'number' && m.total > 0 ? `${Math.min(100, Math.round(((m.done ?? 0) / m.total) * 100))}%` : ''

export const timesOf = (m: Member): string => {
  const steps = typeof m.total === 'number' && m.total > 0 ? `${m.done ?? 0}/${m.total}` : ''
  const times =
    m.state === 'working'
      ? [m.elapsedMs !== undefined ? fmtDur(m.elapsedMs) : '', m.etaMs !== undefined ? `~${fmtDur(m.etaMs)} left` : ''].filter(Boolean).join(' · ')
      : ''
  return [steps, times].filter(Boolean).join('  ·  ')
}

// The knight alone, a fixed 44x40: it never scales with the room around it.
export const SPRITE_W = 44
export const SPRITE_H = 40

export const spriteSvg = (m: Member): string => {
  const isAsleep = m.state !== 'working'
  const zs = isAsleep
    ? `<text class="m z1" x="30" y="12" font-size="9">z</text><text class="m z2" x="34" y="9" font-size="11">Z</text><text class="m z3" x="40" y="6" font-size="13">Z</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE_W}" height="${SPRITE_H}" viewBox="0 0 ${SPRITE_W} ${SPRITE_H}" font-family="Segoe UI, system-ui, sans-serif">${CSS}${sprite(m.cls, isAsleep, 3, 3, 1.25)}${zs}</svg>`
}

// The thin progress bar: stretches across whatever width it is given, its height fixed
// by the caller. A known fraction fills; a working task with no steps runs a slider.
export const BAR_H = 4
export const barSvg = (m: Member): string => {
  const isRun = m.state === 'working'
  const color = ACCENT[m.cls]
  const hasSteps = typeof m.total === 'number' && m.total > 0
  const frac = hasSteps ? Math.min(1, (m.done ?? 0) / (m.total ?? 1)) : 0
  const track = `<rect class="track" x="0" y="0" width="100" height="${BAR_H}" opacity="${isRun ? 1 : 0.55}"/>`
  const fill = !isRun
    ? ''
    : hasSteps
      ? `<rect x="0" y="0" width="${Math.max(2, frac * 100).toFixed(1)}" height="${BAR_H}" fill="${color}"/>`
      : `<g class="ind" style="--w:70px"><rect x="0" y="0" width="30" height="${BAR_H}" fill="${color}" opacity=".85"/></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${BAR_H}" preserveAspectRatio="none">${CSS}${track}${fill}</svg>`
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
