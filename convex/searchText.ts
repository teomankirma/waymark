// One normalized token lets users omit spaces, punctuation, and letter case.
export function normalizeSearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

// Convex prefix-matches the final search token. Indexing each suffix provides
// contains matching without scanning the member table. At most 128 suffixes.
export function memberSearchText(member: { id: string; name: string }) {
  const tokens = new Set<string>()

  for (const value of [member.id, member.name]) {
    const characters = Array.from(normalizeSearch(value)).slice(0, 64)

    for (let i = 0; i < characters.length; i++) {
      tokens.add(characters.slice(i).join(''))
    }
  }

  return [...tokens].join(' ')
}
