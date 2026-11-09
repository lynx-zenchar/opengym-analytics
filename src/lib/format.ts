export const formatNumber = (value: number, decimals = 0) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)

export const formatWeight = (value: number) => `${formatNumber(value, value % 1 ? 1 : 0)} lb`

export const formatVolume = (value: number) => `${formatNumber(value)} lb`

export const formatDuration = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60

  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} hr`

  return `${hours} hr ${rest} min`
}

export const titleCase = (value: string) =>
  value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
