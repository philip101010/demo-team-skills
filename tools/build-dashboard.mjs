// Rebuilds skills/team-board/assets/dashboard.html: the dashboard template with the
// widget's sprite code (hooks/sprites.ts, types stripped) inlined at /*SPRITES*/.
// Run from the repo root: node tools/build-dashboard.mjs   (Node 22.13+)
import { readFileSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const sprites = stripTypeScriptTypes(readFileSync('hooks/sprites.ts', 'utf8'), { mode: 'strip' }).replace(/^export /gm, '')
const page = readFileSync('tools/dashboard.src.html', 'utf8').replace('/*SPRITES*/', () => sprites)
writeFileSync('skills/team-board/assets/dashboard.html', page)
console.log('dashboard.html', page.length, 'bytes')
