import { useState } from "react"
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoMoonOutline,
  IoPartlySunnyOutline,
  IoRestaurantOutline,
  IoSunnyOutline,
  IoTimeOutline,
} from "react-icons/io5"
import { createEntityId, entityTimestamp, type ShiftInfo } from "./models"
import { useDialogDismiss } from "./useDialogDismiss"

export type { ShiftInfo } from "./models"

const defaultShiftOption = {
  type: "evening" as const,
  label: "شفت المساء",
  detail: "من الظهر حتى الإغلاق",
  icon: IoPartlySunnyOutline,
}

const shiftOptions = [
  {
    type: "morning" as const,
    label: "شفت الصباح",
    detail: "من الافتتاح حتى الظهر",
    icon: IoSunnyOutline,
  },
  defaultShiftOption,
  {
    type: "night" as const,
    label: "شفت الليل",
    detail: "الجرد الليلي والمتأخر",
    icon: IoMoonOutline,
  },
]

const branches = ["فرع المدينة المنورة", "فرع قربان", "فرع العزيزية"]

export function ShiftSetupScreen({
  currentShift,
  completed,
  total,
  onStart,
  onClose,
}: {
  currentShift: ShiftInfo
  completed: number
  total: number
  onStart: (shift: ShiftInfo) => Promise<void>
  onClose: () => void
}) {
  useDialogDismiss(onClose)
  const [shiftType, setShiftType] = useState<ShiftInfo["type"]>(
    currentShift.type,
  )
  const [branch, setBranch] = useState(currentShift.branch)
  const [confirmed, setConfirmed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState("")
  const selectedShift =
    shiftOptions.find((option) => option.type === shiftType) ??
    defaultShiftOption
  const isIncomplete = completed > 0 && completed < total

  const startShift = async () => {
    if (!confirmed || total === 0 || starting) return
    setStarting(true)
    setStartError("")
    const timestamp = entityTimestamp()
    try {
      await onStart({
        id: createEntityId(),
        type: selectedShift.type,
        label: selectedShift.label,
        branch,
        started_at: Date.now(),
        created_at: timestamp,
        updated_at: timestamp,
      })
    } catch {
      setStartError("تعذر حفظ الشفت الجديد. لم يتم تغيير بيانات الجرد الحالية.")
      setStarting(false)
    }
  }

  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(timestamp)

  return (
    <div className="fixed inset-0 z-[69] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-setup-title"
        className="flex h-[calc(100dvh-16px)] max-h-[760px] w-full max-w-[850px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
              <IoTimeOutline className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
                إعداد دورة جرد جديدة
              </p>
              <h2
                id="shift-setup-title"
                className="font-display mt-1 truncate text-[20px] font-bold sm:text-[23px]"
              >
                بدء شفت جرد جديد
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق إعداد الشفت"
            className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
          >
            <IoCloseOutline className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {isIncomplete && (
            <div className="state-panel mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <IoAlertCircleOutline className="mt-0.5 size-6 shrink-0" />
              <div>
                <h3 className="text-[13px] font-bold">
                  الشفت الحالي غير مكتمل
                </h3>
                <p className="mt-1 text-[11px] font-medium leading-6">
                  تم جرد {completed} من {total} صنف. بدء شفت جديد سينقل الرصيد
                  الفعلي إلى رصيد أول اليوم ويصفر حركة الوارد والصادر والجرد
                  الفعلي، دون حذف السجل.
                </p>
              </div>
            </div>
          )}

          <section>
            <h3 className="font-display text-[16px] font-bold">
              اختر فترة الشفت
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {shiftOptions.map(({ type, label, detail, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setShiftType(type)}
                  className={`touch-button min-h-32 rounded-[20px] border-2 p-4 text-right ${
                    shiftType === type
                      ? "border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/10 dark:bg-amber-950/40"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  }`}
                >
                  <Icon
                    className={`size-7 ${
                      shiftType === type
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-slate-400"
                    }`}
                  />
                  <strong className="font-display mt-3 block text-[15px] font-bold">
                    {label}
                  </strong>
                  <span className="mt-1 block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {detail}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="font-display text-[16px] font-bold">اختر الفرع</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {branches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setBranch(item)}
                  className={`touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-[11px] font-bold ${
                    branch === item
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <IoRestaurantOutline className="size-5" />
                  {item}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              أو اكتب اسم فرع مخصص
              <input
                value={branch}
                onChange={(event) => setBranch(event.target.value.slice(0, 60))}
                placeholder="اسم الفرع"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
          </section>

          <section className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  الشفت الحالي
                </p>
                <h3 className="font-display mt-1 text-[14px] font-bold">
                  {currentShift.label} · {currentShift.branch}
                </h3>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  بدأ في {formatDate(currentShift.started_at)}
                </p>
              </div>
              <span className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold shadow-sm dark:bg-slate-900">
                {completed}/{total} صنف
              </span>
            </div>
          </section>

          <button
            type="button"
            role="checkbox"
            aria-checked={confirmed}
            onClick={() => setConfirmed((current) => !current)}
            className={`touch-button mt-4 flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 text-right ${
              confirmed
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-xl ${
                confirmed
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-transparent dark:bg-slate-700"
              }`}
            >
              <IoCheckmarkCircleOutline className="size-5" />
            </span>
            <span className="text-[12px] font-bold">
              أؤكد إقفال حركة اليوم وبدء {selectedShift.label} في {branch}
            </span>
          </button>
        </div>

        <footer className="grid grid-cols-1 gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[1.3fr_0.7fr] sm:gap-3 sm:px-6 sm:py-4 dark:border-slate-700 dark:bg-slate-900">
          {startError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 sm:col-span-2 dark:bg-red-950/50 dark:text-red-300"
            >
              {startError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void startShift()}
            disabled={!confirmed || total === 0 || starting}
            className="touch-button min-h-14 rounded-2xl bg-emerald-600 text-[13px] font-bold text-white shadow-lg shadow-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none active:scale-[0.98] dark:disabled:bg-slate-700"
          >
            {starting ? "جاري حفظ الشفت..." : "بدء الشفت وترحيل الرصيد"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="touch-button min-h-14 rounded-2xl border border-slate-300 bg-white text-[12px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            العودة بدون تغيير
          </button>
        </footer>
      </section>
    </div>
  )
}
