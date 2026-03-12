import { DataTable } from './DataTable'
import type { DataTableColumn } from './DataTable'

export { DataTable }
export type { DataTableColumn }

// Backward compatibility for existing page imports.
export const FinanceTable = DataTable
export type FinanceTableColumn = DataTableColumn
