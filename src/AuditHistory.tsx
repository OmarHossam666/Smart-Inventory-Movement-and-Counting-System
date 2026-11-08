import { useMemo, useState } from "react"
import { IoCloseOutline, IoLogoWhatsapp, IoTimeOutline } from "react-icons/io5"
import type { AuditRecord } from "./models"
import { useDialogDismiss } from "./useDialogDismiss"

export type { AuditRecord } from "./models"

const HistoryIcon = IoTimeOutline
const CloseIcon = IoCloseOutline
const SendIcon = IoLogoWhatsapp

export function AuditHistoryScreen({
  records,
  onClose,
  onOpenReport,
}: {
  records: AuditRecord[]
  onClose: () => void
  onOpenReport: (record: AuditRecord) => void
}) {
  useDialogDismiss(onClose)
  const [filter, setFilter] = useState<"all" | "shortage" | "queued">("all")
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "")
  const visibleRecords = useMemo(() => {
    if (filter === "shortage")
      return records.filter((record) => record.shortage < 0)
    if (filter === "queued")
      return records.filter((record) => record.delivery === "queued")
    return records
  }, [filter, records])
  const selected =
    visibleRecords.find((record) => record.id === selectedId) ??
    visibleRecords[0] ??
    null

  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(timestamp)
  const formatTotals = (
    record: AuditRecord,
    key: "opening" | "incoming" | "outgoing" | "expected" | "actual",
  ) => {
    if (!record.items?.length) {
      const fallback = key === "expected" ? record.book : record.actual
      return `${fallback.toFixed(2)} كجم`
    }
    const totals = record.items.reduce<Record<string, number>>(
      (result, item) => {
        const value = item[key]
        if (value !== null) result[item.unit] = (result[item.unit] ?? 0) + value
        return result
      },
      {},
    )
    return Object.entries(totals)
      .map(([unit, value]) => `${value.toFixed(2)} ${unit}`)
      .join(" · ")
  }

  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="flex h-[calc(100dvh-16px)] max-h-[780px] w-full max-w-[1050px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <HistoryIcon className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
                سجل محفوظ على الجهاز
              </p>
              <h2
                id="history-title"
                className="font-display mt-1 truncate text-[20px] font-bold sm:text-[23px]"
              >
                سجل الجرد والشفتات السابقة
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق سجل الجرد"
            className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
          >
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:grid-cols-[minmax(0,1fr)_340px] md:overflow-hidden md:p-4">
          <div className="flex min-h-0 flex-col">
            <div className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-3 dark:bg-slate-800">
              {[
                ["all", `كل السجلات (${records.length})`],
                [
                  "shortage",
                  `بها عجز (${records.filter((record) => record.shortage < 0).length})`,
                ],
                [
                  "queued",
                  `بانتظار الإرسال (${records.filter((record) => record.delivery === "queued").length})`,
                ],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(value as "all" | "shortage" | "queued")
                  }
                  className={`touch-button min-h-12 rounded-xl text-[12px] font-bold transition ${
                    filter === value
                      ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pl-1">
              {visibleRecords.length === 0 ? (
                <div className="grid h-full min-h-64 place-items-center rounded-2xl border-2 border-dashed border-slate-200 text-center dark:border-slate-700">
                  <div>
                    <HistoryIcon className="mx-auto size-10 text-slate-300" />
                    <p className="mt-3 text-[14px] font-bold text-slate-500">
                      لا توجد سجلات في هذا القسم
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleRecords.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelectedId(record.id)}
                      className={`touch-button w-full rounded-2xl border p-4 text-right transition ${
                        selected?.id === record.id
                          ? "border-indigo-400 bg-indigo-50 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/50"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-[15px] font-bold">
                            {record.shift}
                          </h3>
                          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {formatDate(record.created_at_ms)}
                          </p>
                        </div>
                        <span
                          className={`rounded-xl px-3 py-1.5 text-[10px] font-bold ${
                            record.delivery === "sent"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {record.delivery === "sent"
                            ? "تم فتح واتساب"
                            : "بانتظار الإرسال"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <HistoryMetric
                          label="الأصناف"
                          value={`${record.completed}/${record.total}`}
                        />
                        <HistoryMetric
                          label="حالات العجز"
                          value={`${record.shortageItems.length}`}
                        />
                        <HistoryMetric
                          label="ملاحظات"
                          value={`${record.items?.filter((item) => item.notes).length ?? 0}`}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            {selected ? (
              <div className="flex min-h-full flex-col">
                <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  تفاصيل السجل
                </p>
                <h3 className="font-display mt-1 text-[18px] font-bold">
                  {selected.shift}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {formatDate(selected.created_at_ms)}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <HistoryMetric
                    label="الرصيد المتوقع"
                    value={formatTotals(selected, "expected")}
                  />
                  <HistoryMetric
                    label="الرصيد الفعلي"
                    value={formatTotals(selected, "actual")}
                  />
                  <HistoryMetric
                    label="الوارد"
                    value={formatTotals(selected, "incoming")}
                  />
                  <HistoryMetric
                    label="الصادر"
                    value={formatTotals(selected, "outgoing")}
                    danger={selected.shortage < 0}
                  />
                </div>

                <div className="mt-4">
                  <h4 className="font-display text-[14px] font-bold">
                    فروقات العجز
                  </h4>
                  <div className="mt-2 space-y-2">
                    {selected.shortageItems.length ? (
                      selected.shortageItems.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2.5 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        >
                          <span className="max-w-[190px] truncate text-[11px] font-bold">
                            {item.name}
                          </span>
                          <strong className="text-[12px] font-bold tabular-nums">
                            {item.amount.toFixed(2)} {item.unit ?? "كجم"}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-emerald-50 p-3 text-center text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        لا يوجد عجز
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenReport(selected)}
                  className="touch-button mt-auto flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-[13px] font-bold text-white shadow-lg active:scale-[0.98] dark:bg-emerald-600"
                >
                  <SendIcon className="size-5" />
                  فتح تقرير PDF ومشاركته
                </button>
              </div>
            ) : (
              <div className="grid h-full min-h-64 place-items-center text-center">
                <p className="text-[13px] font-bold text-slate-500">
                  اختر سجلاً لعرض التفاصيل
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}

function HistoryMetric({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-900">
      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <strong
        className={`mt-1 block text-[13px] font-bold tabular-nums ${
          danger ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {value}
      </strong>
    </div>
  )
}
