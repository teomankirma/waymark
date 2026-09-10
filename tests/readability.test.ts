import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESLint } from 'eslint'
import { format, resolveConfig } from 'prettier'

const source = `export function example(flag) {
  const first = 1
  const second = 2
  if (flag) return first
  return second
}
export class Example {
  first() { return 1 }
  second() { return 2 }
}
`
const styleRules = new Set([
  'curly',
  '@stylistic/padding-line-between-statements',
  '@stylistic/lines-between-class-members',
])

for (const filePath of [
  'src/readability-example.tsx',
  'automation/readability-example.ts',
  'convex/readability-example.ts',
  'scripts/readability-example.mjs',
  'readability-example.config.js',
]) {
  test(`readability rules reject dense code and remain stable after formatting: ${filePath}`, async () => {
    const lint = new ESLint()
    const fixer = new ESLint({ fix: true })
    const [result] = await lint.lintText(source, { filePath })

    for (const rule of styleRules) {
      assert.ok(
        result?.messages.some((message) => message.ruleId === rule),
        rule,
      )
    }

    const [fixed] = await fixer.lintText(source, { filePath })
    const config = await resolveConfig(filePath)
    const formatted = await format(fixed?.output ?? source, {
      ...config,
      filepath: filePath,
    })
    const [checked] = await lint.lintText(formatted, { filePath })

    assert.equal(checked?.errorCount, 0)
    assert.equal(checked?.warningCount, 0)
    assert.match(formatted, /const first = 1\n {2}const second = 2\n\n {2}if/)
    assert.match(formatted, /if \(flag\) \{\n {4}return first\n {2}\}/)

    const [again] = await fixer.lintText(formatted, { filePath })

    assert.equal(again?.output ?? formatted, formatted)
  })
}
