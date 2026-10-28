import jsPDF from "jspdf"
import * as XLSX from "xlsx"

/** Fields already returned by settle / settlement history. No extra report API. */
export type RoyaltyReportInput = {
  id: number
  amount_due?: number | null
  amount_paid?: number | null
  currency?: string | null
  period_start?: string | null
  period_end?: string | null
  settled_at?: string | null
  settled_by_name?: string | null
  contract_id?: number | null
  contract_title?: string | null
  project_id?: number | null
  project_title_ar?: string | null
  project_title_en?: string | null
  product_id?: number | null
  product_title_ar?: string | null
  product_title_en?: string | null
  product_isbn?: string | null
}

function formatWhen(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function money(amount: number | null | undefined, currency?: string | null): string {
  const code = currency && currency !== "$" ? currency : "USD"
  return `${Number(amount ?? 0).toFixed(2)} ${code}`
}

function rowPairs(row: RoyaltyReportInput): [string, string][] {
  const book =
    row.product_title_en || row.product_title_ar || (row.product_id ? `Book #${row.product_id}` : "—")
  const project = [row.project_title_ar, row.project_title_en].filter(Boolean).join(" / ") || "—"
  return [
    ["Settlement", `#${row.id}`],
    ["Contract", row.contract_title || (row.contract_id ? `#${row.contract_id}` : "—")],
    ["Project", project],
    ["Book", book],
    ["ISBN", row.product_isbn || "—"],
    ["Period start", formatWhen(row.period_start)],
    ["Period end", formatWhen(row.period_end)],
    ["Amount due", money(row.amount_due, row.currency)],
    ["Amount paid", row.amount_paid == null ? "—" : money(row.amount_paid, row.currency)],
    ["Settled", formatWhen(row.settled_at)],
    ["Settled by", row.settled_by_name || "—"],
  ]
}

function statementElement(row: RoyaltyReportInput): HTMLElement {
  const root = document.createElement("div")
  root.style.width = "720px"
  root.style.background = "#ffffff"
  root.style.color = "#111111"
  root.style.padding = "36px 40px 48px"
  root.style.fontFamily = "Arial, Tahoma, sans-serif"
  root.style.boxSizing = "border-box"

  const pairs = rowPairs(row)
    .map(
      ([label, value]) => `
        <div style="display:flex;justify-content:space-between;gap:24px;padding:6px 0;border-bottom:1px solid #e5e5e5;font-size:14px;">
          <span style="color:#555;">${label}</span>
          <span style="font-weight:600;text-align:right;">${value}</span>
        </div>`,
    )
    .join("")

  root.innerHTML = `
    <div style="text-align:center;">
      <img src="/dararab-logo-1.png" alt="DarArab" style="height:64px;margin:0 auto 8px;" />
      <div style="font-size:13px;font-weight:700;">DarArab for Publishing &amp; Translation</div>
      <div style="font-size:12px;color:#444;margin-top:4px;">Seeb, Muscat, Sultanate of Oman</div>
      <div style="font-size:12px;color:#444;">Tel: +96871523542 · info@dararab.co.uk · dararab.co.uk</div>
    </div>
    <h1 style="margin:22px 0 4px;font-size:20px;text-align:center;">Royalty Settlement</h1>
    <h2 dir="rtl" style="margin:0 0 18px;font-size:18px;text-align:center;font-weight:600;">تسوية الإتاوات</h2>
    <p style="font-size:12px;color:#444;line-height:1.5;">
      This is a provisional royalty settlement summary. Official preamble text will be inserted here when received.
    </p>
    <p dir="rtl" style="font-size:12px;color:#444;line-height:1.6;text-align:right;">
      هذا ملخص تسوية إتاوات مؤقت. سيُستبدل نص الديباجة الرسمي هنا عند استلامه.
    </p>
    <div style="margin-top:16px;">${pairs}</div>
    <div style="display:flex;gap:24px;margin-top:48px;">
      <div style="flex:1;border-top:1px solid #111;padding-top:8px;font-size:13px;">
        Prepared by / أعدّه
      </div>
      <div style="flex:1;border-top:1px solid #111;padding-top:8px;font-size:13px;">
        Approved by / اعتمد
      </div>
    </div>
  `
  return root
}

async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

export async function downloadRoyaltySettlementPdf(row: RoyaltyReportInput): Promise<void> {
  const html2canvas = (await import("html2canvas")).default
  const element = statementElement(row)
  const wrapper = document.createElement("div")
  wrapper.setAttribute("aria-hidden", "true")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-10000px"
  wrapper.style.top = "0"
  wrapper.style.background = "#ffffff"
  wrapper.appendChild(element)
  document.body.appendChild(wrapper)

  try {
    await waitForImages(element)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const width = Math.ceil(element.scrollWidth || 720)
    const height = Math.ceil(element.scrollHeight)
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    })

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 24
    const imageWidth = pageWidth - margin * 2
    const imageHeight = (canvas.height * imageWidth) / canvas.width
    const fittedHeight = Math.min(imageHeight, pageHeight - margin * 2)
    const fittedWidth = fittedHeight === imageHeight ? imageWidth : (canvas.width * fittedHeight) / canvas.height
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, fittedWidth, fittedHeight)
    pdf.save(`royalty-settlement-${row.id}.pdf`)
  } finally {
    document.body.removeChild(wrapper)
  }
}

export function downloadRoyaltySettlementExcel(row: RoyaltyReportInput): void {
  const headers = [
    "Settlement ID",
    "Contract ID",
    "Contract Title",
    "Project (AR)",
    "Project (EN)",
    "Product (AR)",
    "Product (EN)",
    "ISBN",
    "Period Start",
    "Period End",
    "Amount Due",
    "Amount Paid",
    "Currency",
    "Settled At",
    "Settled By",
  ]
  const values = [
    row.id,
    row.contract_id ?? "",
    row.contract_title ?? "",
    row.project_title_ar ?? "",
    row.project_title_en ?? "",
    row.product_title_ar ?? "",
    row.product_title_en ?? "",
    row.product_isbn ?? "",
    formatWhen(row.period_start),
    formatWhen(row.period_end),
    Number(row.amount_due ?? 0),
    row.amount_paid == null ? "" : Number(row.amount_paid),
    row.currency && row.currency !== "$" ? row.currency : "USD",
    formatWhen(row.settled_at),
    row.settled_by_name ?? "",
  ]
  const worksheet = XLSX.utils.aoa_to_sheet([headers, values])
  worksheet["!cols"] = headers.map(() => ({ wch: 20 }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Royalty Settlement")
  XLSX.writeFile(workbook, `royalty-settlement-${row.id}.xlsx`)
}
