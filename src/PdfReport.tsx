import { useEffect, useMemo, useState } from "react"
import {
  IoCloseOutline,
  IoCloudDownloadOutline,
  IoLogoWhatsapp,
  IoOpenOutline,
  IoShareSocialOutline,
} from "react-icons/io5"
import type { AuditRecord } from "./AuditHistory"
import { MascotVisual } from "./MascotCompanion"
import logoMark from "./assets/smart-scale-logo.png"
import { baseUnitName } from "./inventoryCatalog"
import {
  blobToBase64,
  createOwnerWhatsAppUrl,
  isNativeAndroid,
  nativePdfBridge,
} from "./features/pdfDelivery"
import { useDialogDismiss } from "./useDialogDismiss"

type PdfState = { status: "loading" } | {
  status: "ready"
  blob: Blob
  url: string
  file: File
  previewUrls: string[]
} | {
  status: "error"
  message: string
}

const categoryOrder = ["اللحوم", "الطيور", "الخضروات", "التوابل", "المشروبات"]

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("تعذر تحميل شعار التطبيق."))
    image.src = source
  })
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    size?: number
    weight?: 500 | 600 | 700 | 800
    color?: string
    align?: CanvasTextAlign
  } = {},
) {
  context.save()
  context.direction = "rtl"
  context.textAlign = options.align ?? "right"
  context.textBaseline = "middle"
  context.fillStyle = options.color ?? "#0f172a"
  context.font = `${options.weight ?? 600} ${options.size ?? 22}px "IBM Plex Sans Arabic", "Arial", sans-serif`
  context.fillText(text, x, y)
  context.restore()
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fillStyle = fill
  context.fill()
}

async function createPdf(record: AuditRecord) {
  const { jsPDF } = await import("jspdf")
  const [, logo] = await Promise.all([
    document.fonts?.ready,
    loadImage(logoMark),
  ])

  const pageWidth = 1240
  const pageHeight = 1754
  const margin = 68
  const contentWidth = pageWidth - margin * 2
  const rowHeight = 62
  const rowsPerPage = 19
  const items = record.items ?? []
  const orderedItems = [...items].sort((first, second) => {
    const firstIndex = categoryOrder.indexOf(first.category ?? "")
    const secondIndex = categoryOrder.indexOf(second.category ?? "")
    return firstIndex - secondIndex
  })
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(orderedItems.length / rowsPerPage)) },
    (_, index) =>
      orderedItems.slice(index * rowsPerPage, (index + 1) * rowsPerPage),
  )
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  })
  const previewUrls: string[] = []

  const totals = items.reduce(
    (summary, item) => {
      const key = item.unit || "وحدة"
      summary[key] ??= { expected: 0, actual: 0, difference: 0 }
      summary[key].expected += item.expected
      summary[key].actual += item.actual ?? 0
      summary[key].difference += item.difference ?? 0
      return summary
    },
    {} as Record<string, {
      expected: number
      actual: number
      difference: number
    }>,
  )
  const formatTotals = (field: "expected" | "difference") =>
    Object.entries(totals)
      .filter(([, values]) => values[field] !== 0)
      .map(([unit, values]) => `${values[field].toFixed(2)} ${unit}`)
      .join(" · ") || "0.00"
  const hasShortage = Object.values(totals).some(
    (values) => values.difference < 0,
  )

  chunks.forEach((pageItems, pageIndex) => {
    const canvas = document.createElement("canvas")
    canvas.width = pageWidth
    canvas.height = pageHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("تعذر تجهيز صفحة التقرير.")

    context.fillStyle = "#f8fafc"
    context.fillRect(0, 0, pageWidth, pageHeight)
    roundedRect(context, margin, 55, contentWidth, 130, 24, "#0f172a")
    roundedRect(context, margin + 18, 76, 78, 78, 18, "#ffffff")
    context.drawImage(logo, margin + 22, 80, 70, 70)
    roundedRect(context, pageWidth - margin - 76, 82, 58, 58, 16, "#10b981")
    drawText(context, "✓", pageWidth - margin - 47, 112, {
      size: 34,
      color: "#ffffff",
      align: "center",
      weight: 800,
    })
    drawText(
      context,
      "تقرير حركة وجرد المخزون اليومي",
      pageWidth - margin - 100,
      101,
      {
        size: 36,
        color: "#ffffff",
        weight: 800,
      },
    )
    drawText(context, record.shift, pageWidth - margin - 100, 145, {
      size: 20,
      color: "#94a3b8",
      weight: 600,
    })
    drawText(
      context,
      new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(record.created_at_ms),
      margin + 112,
      145,
      { size: 17, color: "#cbd5e1", align: "left", weight: 500 },
    )

    let tableTop = 230
    if (pageIndex === 0) {
      const cards = [
        {
          label: "اكتمال الجرد",
          value: `${record.completed} / ${record.total}`,
          color: "#4f46e5",
        },
        {
          label: "الرصيد المتوقع",
          value: formatTotals("expected"),
          color: "#0284c7",
        },
        {
          label: "صافي الفرق",
          value: formatTotals("difference"),
          color: hasShortage ? "#dc2626" : "#059669",
        },
      ]
      const cardGap = 18
      const cardWidth = (contentWidth - cardGap * 2) / 3
      cards.forEach((card, index) => {
        const x = margin + index * (cardWidth + cardGap)
        roundedRect(context, x, 215, cardWidth, 112, 18, "#ffffff")
        context.fillStyle = card.color
        context.fillRect(x, 215, 7, 112)
        drawText(context, card.label, x + cardWidth - 20, 247, {
          size: 17,
          color: "#64748b",
        })
        drawText(context, card.value, x + cardWidth - 20, 290, {
          size: 21,
          color: card.color,
          weight: 800,
        })
      })
      tableTop = 365
    }

    roundedRect(context, margin, tableTop, contentWidth, 52, 14, "#e2e8f0")
    const columns = [
      { label: "الصنف", x: pageWidth - margin - 18, align: "right" as const },
      { label: "أول اليوم", x: 795, align: "center" as const },
      { label: "وارد", x: 665, align: "center" as const },
      { label: "صادر", x: 550, align: "center" as const },
      { label: "متوقع", x: 425, align: "center" as const },
      { label: "فعلي", x: 300, align: "center" as const },
      { label: "الفرق", x: 150, align: "center" as const },
    ]
    columns.forEach((column) =>
      drawText(context, column.label, column.x, tableTop + 27, {
        size: 17,
        color: "#334155",
        align: column.align,
        weight: 800,
      }),
    )

    pageItems.forEach((item, index) => {
      const y = tableTop + 62 + index * rowHeight
      roundedRect(
        context,
        margin,
        y,
        contentWidth,
        rowHeight - 7,
        11,
        index % 2 === 0 ? "#ffffff" : "#f1f5f9",
      )
      const differenceColor =
        item.difference === null
          ? "#94a3b8"
          : item.difference < 0
            ? "#dc2626"
            : item.difference > 0
              ? "#059669"
              : "#334155"
      drawText(context, item.name, pageWidth - margin - 18, y + 21, {
        size: 18,
        weight: 700,
      })
      drawText(
        context,
        `${item.category ?? "المخزون"} · ${item.unit}${
          item.notes ? ` · ${item.notes.slice(0, 30)}` : ""
        }`,
        pageWidth - margin - 18,
        y + 43,
        { size: 12, color: "#64748b", weight: 500 },
      )
      const values = [
        item.opening.toFixed(2),
        item.incoming.toFixed(2),
        item.outgoing.toFixed(2),
        item.expected.toFixed(2),
        item.actual === null ? "—" : item.actual.toFixed(2),
        item.difference === null ? "—" : item.difference.toFixed(2),
      ]
      ;[795, 665, 550, 425, 300, 150].forEach((x, valueIndex) =>
        drawText(context, values[valueIndex] ?? "—", x, y + 29, {
          size: 17,
          align: "center",
          color: valueIndex === 5 ? differenceColor : "#0f172a",
          weight: valueIndex === 5 ? 800 : 600,
        }),
      )
    })

    drawText(
      context,
      `صفحة ${pageIndex + 1} من ${chunks.length}`,
      pageWidth / 2,
      pageHeight - 45,
      { size: 15, color: "#64748b", align: "center", weight: 500 },
    )
    drawText(
      context,
      `رقم التقرير: ${record.id}`,
      pageWidth - margin,
      pageHeight - 45,
      {
        size: 13,
        color: "#94a3b8",
        weight: 500,
      },
    )

    const pageImage = canvas.toDataURL("image/jpeg", 0.9)
    previewUrls.push(pageImage)
    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(pageImage, "JPEG", 0, 0, 210, 297, undefined, "FAST")
  })

  const consumption = record.composite_consumption ?? []
  const consumptionChunks = Array.from(
    { length: Math.ceil(consumption.length / 18) },
    (_, index) => consumption.slice(index * 18, (index + 1) * 18),
  )
  consumptionChunks.forEach((entries, chunkIndex) => {
    const canvas = document.createElement("canvas")
    canvas.width = pageWidth
    canvas.height = pageHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("تعذر تجهيز صفحة استهلاك المكونات.")
    context.fillStyle = "#fff7ed"
    context.fillRect(0, 0, pageWidth, pageHeight)
    roundedRect(context, margin, 55, contentWidth, 126, 24, "#7c2d12")
    drawText(
      context,
      "Ingredient consumption from composite products",
      pageWidth - margin - 28,
      98,
      { size: 30, color: "#ffffff", weight: 800 },
    )
    drawText(
      context,
      "استهلاك المكونات من المنتجات المركبة",
      pageWidth - margin - 28,
      142,
      { size: 24, color: "#fed7aa", weight: 700 },
    )
    entries.forEach((entry, index) => {
      const y = 225 + index * 72
      roundedRect(
        context,
        margin,
        y,
        contentWidth,
        60,
        13,
        entry.negative_stock ? "#fef2f2" : "#ffffff",
      )
      drawText(
        context,
        `${entry.composite_name} ← ${entry.component_name}`,
        pageWidth - margin - 22,
        y + 22,
        { size: 18, weight: 700 },
      )
      drawText(
        context,
        `${entry.quantity.toFixed(3)} ${baseUnitName(entry.unit)}${
          entry.negative_stock ? " · تنبيه: رصيد سالب" : ""
        }`,
        pageWidth - margin - 22,
        y + 44,
        {
          size: 14,
          color: entry.negative_stock ? "#dc2626" : "#64748b",
          weight: entry.negative_stock ? 800 : 600,
        },
      )
    })
    drawText(
      context,
      `صفحة المكونات ${chunkIndex + 1} من ${consumptionChunks.length}`,
      pageWidth / 2,
      pageHeight - 45,
      { size: 15, color: "#9a3412", align: "center", weight: 600 },
    )
    const pageImage = canvas.toDataURL("image/jpeg", 0.9)
    previewUrls.push(pageImage)
    pdf.addPage()
    pdf.addImage(pageImage, "JPEG", 0, 0, 210, 297, undefined, "FAST")
  })

  return { blob: pdf.output("blob"), previewUrls }
}

export function PdfReportScreen({
  record,
  whatsappPhone,
  onClose,
  onDelivered,
}: {
  record: AuditRecord
  whatsappPhone: string
  onClose: () => void
  onDelivered: () => void
}) {
  useDialogDismiss(onClose)
  const [pdfState, setPdfState] = useState<PdfState>({ status: "loading" })
  const [message, setMessage] = useState("")
  const [shared, setShared] = useState(false)
  const nativeAndroid = isNativeAndroid()
  const fileName = useMemo(
    () =>
      `inventory-report-${new Date(record.created_at_ms).toISOString().slice(0, 10)}.pdf`,
    [record.created_at_ms],
  )

  useEffect(() => {
    let active = true
    let createdUrl = ""
    void createPdf(record)
      .then(({ blob, previewUrls }) => {
        if (!active) return
        createdUrl = URL.createObjectURL(blob)
        setPdfState({
          status: "ready",
          blob,
          url: createdUrl,
          file: new File([blob], fileName, { type: "application/pdf" }),
          previewUrls,
        })
      })
      .catch(() => {
        if (active)
          setPdfState({
            status: "error",
            message: "تعذر إنشاء ملف PDF. أعد المحاولة من شاشة المراجعة.",
          })
      })
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [fileName, record])

  const openPdf = async () => {
    if (pdfState.status !== "ready") return
    setMessage("")
    try {
      if (nativeAndroid) {
        await nativePdfBridge.openPdf({
          base64: await blobToBase64(pdfState.blob),
          fileName,
        })
        setMessage("تم فتح التقرير في تطبيق PDF المثبت على الجهاز.")
        return
      }
      const link = document.createElement("a")
      link.href = pdfState.url
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر فتح PDF. استخدم زر التنزيل بدلاً منه.",
      )
    }
  }

  const downloadPdf = async () => {
    if (pdfState.status !== "ready") return
    setMessage("")
    try {
      if (nativeAndroid) {
        await nativePdfBridge.savePdf({
          base64: await blobToBase64(pdfState.blob),
          fileName,
        })
        setMessage("تم حفظ ملف PDF في مجلد التنزيلات داخل SmartInventory.")
        return
      }
      const link = document.createElement("a")
      link.href = pdfState.url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      setMessage("بدأ تنزيل ملف PDF على الجهاز.")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر تنزيل ملف PDF على هذا الجهاز.",
      )
    }
  }

  const sharePdfFile = async () => {
    if (pdfState.status !== "ready") return
    const shareData = {
      title: "تقرير حركة وجرد المخزون",
      text: `${record.shift}\nتقرير الجرد مرفق بصيغة PDF`,
      files: [pdfState.file],
    }
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        onDelivered()
        setShared(true)
        setMessage("تم تسليم ملف PDF لتطبيق المشاركة الذي اخترته.")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setMessage("تعذرت مشاركة الملف. يمكنك تنزيله وإرفاقه في واتساب.")
      }
      return
    }
    await downloadPdf()
    setMessage("هذا المتصفح لا يدعم مشاركة الملفات مباشرة. تم تنزيل PDF.")
  }

  const sendToOwner = async () => {
    if (pdfState.status !== "ready") return
    setMessage("")
    const text = `${record.shift}\nتقرير حركة وجرد المخزون بصيغة PDF`
    try {
      if (nativeAndroid) {
        await nativePdfBridge.sharePdfToWhatsApp({
          base64: await blobToBase64(pdfState.blob),
          fileName,
          phone: whatsappPhone,
          text,
        })
        onDelivered()
        setShared(true)
        setMessage(
          "تم إرفاق ملف PDF في واتساب. اختر محادثة المالك ثم أرسل التقرير.",
        )
        return
      }
      const shareData = {
        title: "تقرير حركة وجرد المخزون",
        text,
        files: [pdfState.file],
      }
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
        onDelivered()
        setShared(true)
        setMessage(
          "تم تسليم ملف PDF للوحة المشاركة. اختر واتساب ثم محادثة المالك.",
        )
        return
      }
      await downloadPdf()
      window.location.assign(createOwnerWhatsAppUrl(whatsappPhone, text))
      setMessage(
        "تم تنزيل PDF وفتح محادثة المالك. أرفق الملف المنزل لأن هذا المتصفح لا يدعم مشاركة الملفات.",
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر فتح واتساب أو إرفاق ملف PDF.",
      )
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/90 p-2 backdrop-blur-md sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-report-title"
        className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3 pl-16 text-white sm:px-5 sm:pl-16">
          <div className="flex min-w-0 items-center gap-3">
            <MascotVisual
              state={shared ? "whatsapp" : "idle"}
              alt={
                shared
                  ? "المعلم ميزان يؤكد تسليم التقرير للمشاركة"
                  : "المعلم ميزان يجهز تقرير PDF"
              }
              className="size-16 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-emerald-400">
                جاهز للمراجعة والمشاركة
              </p>
              <h2
                id="pdf-report-title"
                className="font-display truncate text-[18px] font-bold"
              >
                تقرير الجرد بصيغة PDF
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {pdfState.status === "ready" && (
              <>
                <button
                  type="button"
                  onClick={() => void openPdf()}
                  className="touch-button grid size-11 place-items-center rounded-xl bg-slate-800 text-slate-200"
                  aria-label="فتح PDF في نافذة جديدة"
                >
                  <IoOpenOutline className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => void downloadPdf()}
                  className="touch-button flex min-h-11 items-center gap-2 rounded-xl bg-slate-800 px-3 text-[11px] font-bold text-slate-200"
                >
                  <IoCloudDownloadOutline className="size-5" />
                  تنزيل
                </button>
                {!nativeAndroid && (
                  <button
                    type="button"
                    onClick={() => void sharePdfFile()}
                    className="touch-button flex min-h-11 items-center gap-2 rounded-xl bg-slate-800 px-3 text-[11px] font-bold text-slate-200"
                  >
                    <IoShareSocialOutline className="size-5" />
                    مشاركة الملف
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void sendToOwner()}
                  className="touch-button flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[11px] font-bold text-white"
                >
                  <IoLogoWhatsapp className="size-5" />
                  {nativeAndroid ? "إرسال PDF للمالك" : "واتساب المالك"}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-button absolute left-3 top-3 z-10 grid size-11 place-items-center rounded-xl border border-slate-600 bg-slate-800 text-slate-200 shadow-lg"
            aria-label="إغلاق معاينة PDF"
          >
            <IoCloseOutline className="size-6" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-800 p-2 sm:p-3">
          {pdfState.status === "loading" ? (
            <div className="grid h-full place-items-center text-center text-white">
              <div>
                <span className="mx-auto block size-12 animate-spin rounded-full border-4 border-slate-600 border-t-emerald-400" />
                <p className="mt-4 text-[13px] font-bold">
                  جاري إنشاء صفحات PDF...
                </p>
              </div>
            </div>
          ) : pdfState.status === "error" ? (
            <div className="grid h-full place-items-center text-center text-red-300">
              <p className="text-[13px] font-bold">{pdfState.message}</p>
            </div>
          ) : (
            <div
              className="mx-auto flex w-full max-w-[900px] flex-col gap-3"
              aria-label="معاينة صفحات تقرير الجرد PDF"
            >
              {pdfState.previewUrls.map((previewUrl, index) => (
                <img
                  key={index}
                  src={previewUrl}
                  alt={`صفحة ${index + 1} من تقرير الجرد`}
                  className="h-auto w-full rounded-xl bg-white shadow-xl"
                />
              ))}
            </div>
          )}
        </div>
        {message && (
          <p className="border-t border-slate-700 bg-slate-900 px-4 py-2 text-center text-[11px] font-bold text-amber-300">
            {message}
          </p>
        )}
      </section>
    </div>
  )
}
