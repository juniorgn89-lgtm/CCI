export interface ExportColumn<T> {
  header: string
  accessor: (row: T) => string | number
}

const formatCsvValue = (value: string | number): string => {
  if (typeof value === 'number') {
    // Use comma as decimal separator for pt-BR Excel compatibility
    return String(value).replace('.', ',')
  }

  const str = String(value)

  // Escape fields that contain comma, semicolon, quotes, or newlines
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

const exportToCsv = <T,>(filename: string, data: T[], columns: ExportColumn<T>[]): void => {
  if (data.length === 0) return

  const separator = ';'

  // Header row
  const headerRow = columns.map((col) => formatCsvValue(col.header)).join(separator)

  // Data rows
  const dataRows = data.map((row) =>
    columns.map((col) => formatCsvValue(col.accessor(row))).join(separator)
  )

  const csvContent = [headerRow, ...dataRows].join('\r\n')

  // UTF-8 BOM for Excel compatibility with accented characters
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default exportToCsv
