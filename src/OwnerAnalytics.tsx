import { useMemo, useState } from "react"
import {
  IoAlertCircleOutline,
  IoAnalyticsOutline,
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoScaleOutline,
  IoTimeOutline,
  IoTrendingDownOutline,
} from "react-icons/io5"
import type { AuditRecord } from "./AuditHistory"
import { useDialogDismiss } from "./useDialogDismiss"

type Range = 7 | 30 | "all"

export function OwnerAnalyticsScreen({
  records,
  onClose,
  onOpenHistory,
}: {
  records: AuditRecord[]
  onClose: () => void
  onOpenHistory: () => void
}) {
  useDialogDismiss(onClose)
  const [range, setRange] = useState<Range>(30)
  const filtered = useMemo(() => {
    if (range === "all") return records
    const threshold = Date.now() - range * 24 * 60 * 60 * 1000
    return records.filter((record) => record.created_at_ms >= threshold)
  }, [range, records])

  const analytics = useMemo(() => {
    const totalShortage = filtered.reduce(
      (sum, record) => sum + record.shortage,
      0,
    )
    const completionAverage = filtered.length
      ? filtered.reduce(
          (sum, record) =>
            sum + (record.total ? record.completed / record.total : 0),
          0,
        ) / filtered.length
      : 0
    const shortageMap = new Map<string, {
      name: string
      unit: string
      count: number
      amount: number
    }>()
    filtered.forEach((record) => {
      record.shortageItems.forEach((item) => {
        const unit = item.unit ?? "كجم"
        const key = `${item.name}::${unit}`
        const current = shortageMap.get(key) ?? {
          name: item.name,
          unit,
          count: 0,
          amount: 0,
        }
        shortageMap.set(key, {
          name: item.name,
          unit,
          count: current.count + 1,
          amount: current.amount + item.amount,
        })
      })
    })
    const recurring = [...shortageMap.entries()]
      .map(([, values]) => values)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 6)
    return {
      totalShortage,
      completionAverage,
      recurring,
      sent: filtered.filter((record) => record.delivery === "sent").length,
    }
  }, [filtered])

  const trendRecords = [...filtered].sort(
    (a, b) => a.created_at_ms - b.created_at_ms,
  )
  const maximumWeight = Math.max(
    1,
    ...trendRecords.map((record) => record.total),
  )
  const maximumShortage = Math.max(
    0.01,
    ...analytics.recurring.map((item) => Math.abs(item.amount)),
  )

  const formatShortDate = (timestamp: number) =>
    new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      day: "numeric",
      month: "short",
    }).format(timestamp)
  const formatTotals = (key: "expected" | "actual") => {
    const totals = filtered
      .flatMap((record) => record.items ?? [])
      .reduce<Record<string, number>>((result, item) => {
        const value = item[key]
        if (value !== null) result[item.unit] = (result[item.unit] ?? 0) + value
        return result
      }, {})
    const value = Object.entries(totals)
      .map(([unit, total]) => `${total.toFixed(1)} ${unit}`)
      .join(" · ")
    return value || "لا توجد تفاصيل"
  }

  return (
    <div className="fixed inset-0 z-[68] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-title"
        className="flex h-[calc(100dvh-16px)] max-h-[800px] w-full max-w-[1120px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <IoAnalyticsOutline className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
                مؤشرات تشغيلية من سجل الجرد
              </p>
              <h2
                id="analytics-title"
                className="font-display mt-1 truncate text-[20px] font-bold sm:text-[23px]"
              >
                لوحة تحليلات المالك
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                [7, "7 أيام"],
                [30, "30 يوم"],
                ["all", "الكل"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value as Range)}
                  className={`touch-button min-h-10 rounded-lg px-3 text-[11px] font-bold ${
                    range === value
                      ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق التحليلات"
              className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            >
              <IoCloseOutline className="size-5" />
            </button>
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 text-center">
            <div className="max-w-[440px]">
              <span className="mx-auto grid size-20 place-items-center rounded-[24px] bg-slate-100 text-slate-400 dark:bg-slate-800">
                <IoAnalyticsOutline className="size-10" />
              </span>
              <h3 className="font-display mt-4 text-[20px] font-bold">
                لا توجد بيانات كافية لهذه الفترة
              </h3>
              <p className="mt-2 text-[13px] font-medium leading-7 text-slate-500 dark:text-slate-400">
                تظهر المؤشرات بعد اعتماد أول تقرير جرد. يمكنك مراجعة السجلات
                السابقة أو اختيار فترة زمنية أطول.
              </p>
              <button
                type="button"
                onClick={onOpenHistory}
                className="touch-button mt-5 min-h-14 rounded-2xl bg-slate-950 px-7 text-[13px] font-bold text-white active:scale-[0.98] dark:bg-emerald-600"
              >
                فتح سجل الجرد
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AnalyticsCard
                icon={IoTimeOutline}
                label="عدد الشفتات"
                value={`${filtered.length}`}
                detail={`${analytics.sent} تقرير تم إرساله`}
                tone="indigo"
              />
              <AnalyticsCard
                icon={IoScaleOutline}
                label="إجمالي الرصيد الفعلي"
                value={formatTotals("actual")}
                detail={`المتوقع: ${formatTotals("expected")}`}
                tone="slate"
              />
              <AnalyticsCard
                icon={IoTrendingDownOutline}
                label="حالات العجز"
                value={`${filtered.reduce((sum, record) => sum + record.shortageItems.length, 0)}`}
                detail="فروقات سالبة تحتاج مراجعة"
                tone={analytics.totalShortage < 0 ? "red" : "green"}
              />
              <AnalyticsCard
                icon={IoCheckmarkCircleOutline}
                label="متوسط اكتمال الجرد"
                value={`${Math.round(analytics.completionAverage * 100)}%`}
                detail="نسبة الأصناف الموزونة"
                tone="green"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
              <section className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-[17px] font-bold">
                      اكتمال الجرد عبر الشفتات
                    </h3>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      مقارنة إجمالي الأصناف بما تم جرده
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <i className="size-2.5 rounded-full bg-slate-400" />
                      الأصناف
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <i className="size-2.5 rounded-full bg-emerald-500" />
                      المكتمل
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex min-h-[230px] items-end gap-3 overflow-x-auto pb-2">
                  {trendRecords.slice(-12).map((record) => (
                    <div
                      key={record.id}
                      className="flex min-w-[48px] flex-1 flex-col items-center"
                    >
                      <div className="flex h-[180px] items-end gap-1">
                        <span
                          className="analytics-bar w-3 rounded-t-md bg-slate-300 dark:bg-slate-600"
                          style={{
                            height: `${Math.max(6, (record.total / maximumWeight) * 100)}%`,
                          }}
                        />
                        <span
                          className="analytics-bar w-3 rounded-t-md bg-emerald-500"
                          style={{
                            height: `${Math.max(6, (record.completed / maximumWeight) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="mt-2 whitespace-nowrap text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                        {formatShortDate(record.created_at_ms)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-[17px] font-bold">
                      العجز المتكرر
                    </h3>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      الأصناف الأكثر تأثيراً
                    </p>
                  </div>
                  <IoAlertCircleOutline className="size-6 text-red-500" />
                </div>
                <div className="mt-4 space-y-3">
                  {analytics.recurring.length ? (
                    analytics.recurring.map((item) => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[11px] font-bold">
                            {item.name}
                          </span>
                          <strong className="shrink-0 text-[11px] font-bold tabular-nums text-red-600 dark:text-red-400">
                            {item.amount.toFixed(2)} {item.unit}
                          </strong>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-red-100 dark:bg-red-950">
                          <div
                            className="analytics-bar h-full rounded-full bg-red-500"
                            style={{
                              width: `${Math.max(8, (Math.abs(item.amount) / maximumShortage) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[9px] font-medium text-slate-400">
                          تكرر في {item.count} شفت
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-emerald-50 p-5 text-center text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <IoCheckmarkCircleOutline className="mx-auto size-8" />
                      <p className="mt-2 text-[11px] font-bold">
                        لا يوجد عجز متكرر في هذه الفترة
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function AnalyticsCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof IoAnalyticsOutline
  label: string
  value: string
  detail: string
  tone: "indigo" | "slate" | "red" | "green"
}) {
  const tones = {
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  }
  return (
    <article className={`state-panel rounded-[20px] border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold">{label}</span>
        <Icon className="size-6 opacity-80" />
      </div>
      <strong className="mt-3 block text-[24px] font-bold tabular-nums">
        {value}
      </strong>
      <p className="mt-1 text-[10px] font-semibold opacity-75">{detail}</p>
    </article>
  )
}
