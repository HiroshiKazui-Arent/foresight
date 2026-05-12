export const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10)
export const fromDateInputValue = (s: string) => new Date(s + 'T00:00:00Z')
