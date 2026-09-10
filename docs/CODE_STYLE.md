# Code readability

Readable code is an acceptance requirement. Passing Prettier alone does not guarantee readable grouping: [Prettier preserves existing blank lines](https://prettier.io/docs/rationale.html#empty-lines) rather than deciding where logical sections begin.

## Enforced rules

The flat ESLint configuration applies these error-level, autofixable rules across maintained TypeScript/TSX, JavaScript, and module scripts, including frontend, backend, automation, tests, and configuration:

- [`curly: all`](https://eslint.org/docs/latest/rules/curly): braces on every if/else and loop body, including short guards.
- [`@stylistic/padding-line-between-statements`](https://eslint.style/rules/padding-line-between-statements): blank lines before and after declaration groups and block-like statements (functions, conditionals, loops, try/catch), before return/throw, around type/interface declarations, and after imports. Consecutive variable declarations and consecutive imports may remain together.
- [`@stylistic/lines-between-class-members`](https://eslint.style/rules/lines-between-class-members): blank lines between class members.

Use the maintained ESLint Stylistic plugin rather than deprecated ESLint core spacing rules. Only the two spacing rules are enabled; Prettier retains responsibility for quotes, indentation, wrapping, and semicolons. The stable plugin version supports our ESLint 10 setup.

Generated Convex bindings, build/test output, and imported agent skills are excluded. Owned shadcn component source follows the same rules as other frontend code.

## Example

```ts
function classify(count: number) {
  const missing = count === 0
  const ambiguous = count > 1

  if (missing) {
    return 'missing'
  }

  if (ambiguous) {
    return 'ambiguous'
  }

  return 'unique'
}
```

The rules provide a minimum. Separate additional logical phases with one blank line when a sequence of calls would otherwise become a wall of text. Keep tightly related statements together; do not put a blank line after every line or inside every object. This convention does not replace clear names or focused functions.

## Commands and CI

- `npm run format` applies ESLint fixes, then Prettier.
- `npm run lint:fix` applies ESLint fixes only.
- `npm run lint` and `npm run format:check` validate without editing; both already run in CI and must pass.

The readability regression tests lint deliberately dense examples using the real repository configuration across frontend, backend, automation, scripts, and config paths. They verify that the rules report violations, fixes preserve declaration groups, and Prettier does not undo the fixes. They run with the existing offline tests.
