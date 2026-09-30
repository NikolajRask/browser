/**
 * macOS shows the menu bar / Dock name from the running .app bundle's
 * Info.plist (CFBundleName), not from app.setName(). In dev we launch the
 * stock Electron.app from node_modules, so patch its display name to Lockin.
 *
 * Idempotent. No-op off macOS. Safe to run on every `npm run dev`.
 */
import { createRequire } from 'module'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { spawnSync } from 'child_process'

const PRODUCT_NAME = 'Lockin'
const KEYS = ['CFBundleName', 'CFBundleDisplayName']

if (process.platform !== 'darwin') {
  process.exit(0)
}

const require = createRequire(import.meta.url)

let electronBin
try {
  electronBin = require('electron')
} catch {
  process.exit(0)
}

if (typeof electronBin !== 'string' || !electronBin) {
  process.exit(0)
}

const plistPath = resolve(dirname(electronBin), '../Info.plist')
if (!existsSync(plistPath)) {
  console.warn(`[brand-dev-electron] No Info.plist at ${plistPath}`)
  process.exit(0)
}

function readKey(key) {
  const result = spawnSync('plutil', ['-extract', key, 'raw', plistPath], {
    encoding: 'utf8'
  })
  if (result.status !== 0) return null
  return (result.stdout || '').trim()
}

function writeKey(key, value) {
  const result = spawnSync(
    'plutil',
    ['-replace', key, '-string', value, plistPath],
    { encoding: 'utf8' }
  )
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `failed to set ${key}`).trim())
  }
}

const stale = KEYS.filter((key) => readKey(key) !== PRODUCT_NAME)
if (stale.length === 0) {
  process.exit(0)
}

// Break hardlinks (e.g. pnpm store) so we only mutate this project's copy.
try {
  const original = readFileSync(plistPath)
  unlinkSync(plistPath)
  writeFileSync(plistPath, original)
} catch (err) {
  console.warn(`[brand-dev-electron] Could not copy Info.plist: ${err.message}`)
  process.exit(0)
}

try {
  for (const key of stale) {
    writeKey(key, PRODUCT_NAME)
  }
} catch (err) {
  console.warn(`[brand-dev-electron] Could not patch Info.plist: ${err.message}`)
  process.exit(0)
}

console.log(`[brand-dev-electron] Dev Electron bundle now identifies as "${PRODUCT_NAME}".`)
