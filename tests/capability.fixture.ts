import { capabilitySchema } from '../automation/contracts/capability.ts'
import type {
  Action,
  Checkpoint,
  Target,
} from '../automation/contracts/actions.ts'

const literal = (value: string) => ({ kind: 'literal' as const, value })
const memberId = { kind: 'input' as const, name: 'memberId' }
const role = (role: 'button' | 'link' | 'heading', name: string): Target => ({
  description: name,
  frames: [],
  locator: { by: 'role', role, name: literal(name) },
})
const memberField: Target = {
  description: 'Member search input',
  frames: [],
  locator: { by: 'label', text: literal('Member ID') },
}
const identity: Target = {
  description: 'Profile member ID',
  frames: [],
  locator: {
    by: 'css',
    selector: '[aria-label="Member profile"] dd:first-of-type',
    reason: 'Legacy definition list has no individual field label',
  },
}
const accountField = (label: string): Target => ({
  description: label,
  frames: ['iframe[title="Account details"]'],
  locator: { by: 'label', text: literal(label) },
})
const identityCheck: Checkpoint = {
  kind: 'text_equals',
  target: identity,
  expected: memberId,
}
const visible = (target: Target): Checkpoint => ({ kind: 'visible', target })
const step = (
  id: string,
  action: Action,
  before: Checkpoint[],
  after: Checkpoint[],
) => ({
  id,
  action,
  before,
  after,
  timeoutMs: 5000,
  risk:
    action.kind === 'read' || action.kind === 'assert'
      ? ('read' as const)
      : ('interaction' as const),
})

/** Handwritten contract fixture, not an executable demo or discovery evidence. */
export function balanceCapability() {
  return capabilitySchema.parse({
    schemaVersion: 1,
    id: 'savings-balance',
    revision: 1,
    description: 'Look up a fictional member and extract their savings balance',
    provenance: 'handwritten-development',
    inputs: { memberId: { type: 'text', maxLength: 64 } },
    outputs: { balance: { type: 'decimal' }, currency: { type: 'currency' } },
    preconditions: [visible(role('heading', 'Member search'))],
    steps: [
      step(
        'fill-member',
        { kind: 'fill', target: memberField, value: memberId },
        [visible(memberField)],
        [],
      ),
      step(
        'search',
        { kind: 'click', target: role('button', 'Search') },
        [visible(role('button', 'Search'))],
        [],
      ),
      step(
        'open-member',
        {
          kind: 'click',
          target: {
            description: 'Matching member result',
            frames: [],
            locator: { by: 'role', role: 'link', name: memberId },
          },
        },
        [],
        [identityCheck],
      ),
      step(
        'open-savings',
        { kind: 'click', target: role('link', 'Savings') },
        [identityCheck],
        [visible(accountField('Balance'))],
      ),
      step(
        'read-balance',
        { kind: 'read', target: accountField('Balance'), output: 'balance' },
        [identityCheck],
        [],
      ),
      step(
        'read-currency',
        { kind: 'read', target: accountField('Currency'), output: 'currency' },
        [identityCheck],
        [],
      ),
    ],
    success: [identityCheck, visible(accountField('Balance'))],
    businessOutcomes: [
      {
        code: 'member_not_found',
        when: [
          visible({
            description: 'Empty search result',
            frames: [],
            locator: { by: 'text', text: literal('No members found') },
          }),
        ],
      },
    ],
  })
}
