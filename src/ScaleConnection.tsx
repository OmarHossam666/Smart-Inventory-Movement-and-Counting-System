import { useState } from "react"
import {
  IoBatteryHalfOutline,
  IoBluetoothOutline,
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoRefreshOutline,
  IoScaleOutline,
  IoWarningOutline,
  IoWifiOutline,
} from "react-icons/io5"
import { bleScaleClient } from "./features/bleScale"
import { useDialogDismiss } from "./useDialogDismiss"

export type ScaleStatus = "connected" | "disconnected" | "searching" | "unsupported" | "error"

export function ScaleConnectionScreen({
  status,
  deviceName,
  weight,
  lastReadAt,
  onStatusChange,
  onDeviceChange,
  onWeightChange,
  onClose,
}: {
  status: ScaleStatus
  deviceName: string
  weight: number
  lastReadAt: number
  onStatusChange: (status: ScaleStatus) => void
  onDeviceChange: (name: string) => void
  onWeightChange: (weight: number) => void
  onClose: () => void
}) {
  useDialogDismiss(onClose)
  const [message, setMessage] = useState("")
  const [rssi, setRssi] = useState<number | null>(null)

  const searchForScale = async () => {
    onStatusChange("searching")
    setMessage("")
    try {
      const device = await bleScaleClient.connect(
        (reading) => {
          onWeightChange(reading.kilograms)
        },
        () => {
          onStatusChange("disconnected")
        },
      )
      onDeviceChange(device.name)
      setRssi(device.rssi)
      onStatusChange("connected")
      setMessage(
        "تم الاتصال والاشتراك في القراءة المباشرة وفق معيار Bluetooth Weight Scale.",
      )
      navigator.vibrate?.(40)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : ""
      if (
        (error instanceof DOMException && error.name === "NotFoundError") ||
        errorMessage.includes("cancel") ||
        errorMessage.includes("cancelled")
      ) {
        onStatusChange("disconnected")
        setMessage("تم إلغاء البحث دون تغيير الميزان الحالي.")
        return
      }
      const unsupported =
        errorMessage.includes("unsupported") ||
        errorMessage.includes("not available")
      onStatusChange(unsupported ? "unsupported" : "error")
      setMessage(
        unsupported
          ? "Bluetooth Low Energy غير مدعوم في هذا المتصفح. استخدم Chrome أو تطبيق Android."
          : error instanceof Error
            ? error.message
            : "تعذر الاتصال بالميزان. تأكد من تشغيله وقربه من الجهاز.",
      )
    }
  }

  const refreshReading = async () => {
    if (status !== "connected") return
    try {
      const reading = await bleScaleClient.refresh()
      onWeightChange(reading.kilograms)
      setMessage("تم تحديث القراءة مباشرة من خاصية الوزن.")
      navigator.vibrate?.(25)
    } catch {
      setMessage(
        "هذا الميزان يرسل الوزن تلقائياً ولا يدعم القراءة اليدوية. انتظر تغيّر القراءة.",
      )
    }
  }

  const disconnectScale = async () => {
    try {
      await bleScaleClient.disconnect()
    } finally {
      onStatusChange("disconnected")
      onWeightChange(0)
      setRssi(null)
      setMessage("تم فصل الميزان بأمان.")
    }
  }

  const openBluetoothSettings = async () => {
    try {
      await bleScaleClient.openBluetoothSettings()
    } catch {
      setMessage(
        "افتح إعدادات Bluetooth من شريط النظام؛ فتح الإعدادات مباشرة غير متاح في المتصفح.",
      )
    }
  }

  const statusMeta = {
    connected: {
      label: "متصل وجاهز",
      color:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    disconnected: {
      label: "غير متصل",
      color:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
    searching: {
      label: "جاري البحث",
      color:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    },
    unsupported: {
      label: "غير مدعوم",
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    error: {
      label: "خطأ في الاتصال",
      color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    },
  }[status]

  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(timestamp)

  return (
    <div className="fixed inset-0 z-[69] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="scale-title"
        className="flex h-[calc(100dvh-16px)] max-h-[730px] w-full max-w-[880px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
              <IoBluetoothOutline className="size-7" />
              {status === "connected" && (
                <i className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-sky-600 dark:text-sky-400">
                الأجهزة والاتصال
              </p>
              <h2
                id="scale-title"
                className="font-display mt-1 truncate text-[20px] font-bold sm:text-[23px]"
              >
                إعداد ميزان Bluetooth
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === "searching"}
            aria-label="إغلاق إعداد الميزان"
            className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 disabled:opacity-40 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
          >
            <IoCloseOutline className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 sm:p-5 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col">
            <section className="rounded-[22px] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IoScaleOutline className="size-5 text-emerald-400" />
                  <span className="text-[12px] font-bold text-slate-400">
                    القراءة المباشرة
                  </span>
                </div>
                <span
                  className={`rounded-xl px-3 py-1.5 text-[10px] font-bold ${statusMeta.color}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              <strong className="mt-7 block text-center text-[48px] font-bold leading-none tabular-nums text-emerald-400">
                {status === "connected" ? weight.toFixed(2) : "— —"}{" "}
                <span className="text-[15px] text-slate-300">كجم</span>
              </strong>
              <p className="mt-4 text-center text-[10px] font-medium text-slate-500">
                آخر تحديث: {formatTime(lastReadAt)}
              </p>
            </section>

            {message && (
              <div
                className={`state-panel mt-3 flex items-start gap-3 rounded-2xl border p-3 ${
                  status === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    : status === "unsupported"
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                }`}
              >
                {status === "error" || status === "unsupported" ? (
                  <IoWarningOutline className="mt-0.5 size-5 shrink-0" />
                ) : (
                  <IoCheckmarkCircleOutline className="mt-0.5 size-5 shrink-0" />
                )}
                <p className="text-[11px] font-bold leading-6">{message}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void refreshReading()}
                disabled={status !== "connected"}
                className="touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[12px] font-bold text-white shadow-lg shadow-emerald-600/20 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none active:scale-[0.98] dark:disabled:bg-slate-700"
              >
                <IoRefreshOutline className="size-5" />
                تحديث القراءة الآن
              </button>
              <button
                type="button"
                onClick={() => void openBluetoothSettings()}
                className="touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-[12px] font-bold text-slate-700 disabled:opacity-40 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <IoBluetoothOutline className="size-5" />
                إعدادات Bluetooth
              </button>
            </div>
          </div>

          <aside className="flex flex-col gap-3">
            <section className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                الجهاز المختار
              </p>
              <h3 className="font-display mt-2 text-[16px] font-bold">
                {deviceName || "لم يتم اختيار ميزان"}
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <DiagnosticMetric
                  icon={IoWifiOutline}
                  label="الإشارة"
                  value={
                    rssi === null
                      ? "غير متاحة"
                      : rssi >= -60
                        ? "قوية"
                        : rssi >= -75
                          ? "متوسطة"
                          : "ضعيفة"
                  }
                />
                <DiagnosticMetric
                  icon={IoBatteryHalfOutline}
                  label="البطارية"
                  value="غير متاح"
                />
              </div>
            </section>

            <button
              type="button"
              onClick={() => void searchForScale()}
              disabled={status === "searching"}
              className="touch-button flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-[12px] font-bold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-60 active:scale-[0.98]"
            >
              {status === "searching" ? (
                <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <IoBluetoothOutline className="size-5" />
              )}
              {status === "searching"
                ? "جاري البحث عن الأجهزة..."
                : "البحث عن ميزان قريب"}
            </button>

            {status === "connected" && (
              <button
                type="button"
                onClick={() => void disconnectScale()}
                className="touch-button mt-auto min-h-12 rounded-2xl border border-red-200 bg-red-50 text-[11px] font-bold text-red-600 active:scale-[0.98] dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                فصل الميزان
              </button>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}

function DiagnosticMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IoWifiOutline
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
      <Icon className="size-5 text-sky-500" />
      <p className="mt-2 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <strong className="mt-1 block text-[12px] font-bold">{value}</strong>
    </div>
  )
}
