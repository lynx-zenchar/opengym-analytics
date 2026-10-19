export const formatNumber = (value: number, decimals = 0) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)

export const formatWeight = (value: number) => `${formatNumber(value, value % 1 ? 1 : 0)} lb`

export const formatVolume = (value: number) => `${formatNumber(value)} lb`

export const titleCase = (value: string) =>
  value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
