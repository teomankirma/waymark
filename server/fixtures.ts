import type { Member } from '../shared/members.ts'

// Fictional demo records; never imported by the frontend or automation.
export const members: readonly Member[] = [
  {
    id: 'DEMO-001',
    name: 'Avery Morgan',
    branch: 'Northside',
    memberSince: '2018',
  },
  {
    id: 'DEMO-002',
    name: 'Jordan Ellis',
    branch: 'Downtown',
    memberSince: '2021',
  },
  {
    id: 'DEMO-003',
    name: 'Sam Morgan',
    branch: 'Northside',
    memberSince: '2023',
  },
]
