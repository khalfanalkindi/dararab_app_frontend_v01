import * as XLSX from "xlsx"

export type InvoiceExcelRow = {
  "Invoice #": string
  "Composite ID": string
  Customer: string
  Contact: string
  Warehouse: string
  Type: string
  "Payment Method": string
  Date: string
  Amount: number
  Paid: number
  Remaining: number
  Status: string
}

export function downloadInvoicesAsExcel(rows: InvoiceExcelRow[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices")
  XLSX.writeFile(workbook, filename)
}
