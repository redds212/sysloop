import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('granice prywatnych plików', () => {
  const ignore = readFileSync('.gitignore', 'utf8').split(/\r?\n/)
  it.each(['sys files/', 'data/', '.env*', 'tools/importer/.venv/', 'node_modules/', 'dist/'])(
    'wyklucza %s z repozytorium', path => expect(ignore).toContain(path),
  )
  it('przykłady środowiska nie zawierają wartości', () => {
    for (const path of ['.env.example', '.env.import.example']) {
      const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/)
      expect(lines.every(line => /^[A-Z_]+=$/.test(line))).toBe(true)
    }
  })
})
