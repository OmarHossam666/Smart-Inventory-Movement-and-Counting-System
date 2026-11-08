import { useRef, useState } from "react"
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoCloudDownloadOutline,
  IoCloudUploadOutline,
  IoCloseOutline,
  IoDocumentTextOutline,
  IoPhonePortraitOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5"
import {
  INVENTORY_STORAGE_KEYS,
  inventoryDataService,
} from "./data/inventoryDataService"
import type { InventoryBackup } from "./models"
import { useDialogDismiss } from "./useDialogDismiss"

function formatBackupDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "تاريخ غير معروف"
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function DataBackupScreen({ onClose }: { onClose: () => void }) {
  useDialogDismiss(onClose)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<InventoryBackup | null>(
    null,
  )
  const [fileName, setFileName] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [restoring, setRestoring] = useState(false)

  const exportBackup = async () => {
    setError("")
    try {
      const backup = await inventoryDataService.createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const stamp = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `smart-inventory-backup-${stamp}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage("تم تجهيز النسخة وتنزيلها على الجهاز.")
    } catch {
      setError("تعذر إنشاء النسخة. تحقق من مساحة التخزين وحاول مجددًا.")
    }
  }

  const readBackupFile = async (file: File | undefined) => {
    if (!file) return
    setError("")
    setMessage("")
    setPendingBackup(null)
    setFileName(file.name)

    if (file.size > 20 * 1024 * 1024) {
      setError("حجم ملف النسخة أكبر من الحد المسموح 20 ميجابايت.")
      return
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown
      setPendingBackup(inventoryDataService.validateBackup(parsed))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "تعذر قراءة ملف النسخة الاحتياطية.",
      )
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const restoreBackup = async () => {
    if (!pendingBackup || restoring) return
    setRestoring(true)
    setError("")

    try {
      await inventoryDataService.restoreBackup(pendingBackup)
      window.location.reload()
    } catch {
      setRestoring(false)
      setError("تعذرت الاستعادة ولم يتم تغيير البيانات الحالية.")
    }
  }

  const restoredItems = pendingBackup
    ? INVENTORY_STORAGE_KEYS.filter(
        (key) =>
          Object.prototype.hasOwnProperty.call(pendingBackup.data, key) &&
          pendingBackup.data[key] !== null,
      ).length
    : 0

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-title"
      className="ui-surface-enter flex max-h-[calc(100dvh-16px)] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <IoShieldCheckmarkOutline className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              حماية بيانات الجهاز
            </p>
            <h2
              id="backup-title"
              className="font-display truncate text-[18px] font-bold sm:text-[21px]"
            >
              النسخ الاحتياطي والاستعادة
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق النسخ الاحتياطي"
          className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <IoCloseOutline className="size-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl bg-slate-950 p-5 text-white">
            <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <IoCloudDownloadOutline className="size-7" />
            </span>
            <h3 className="font-display mt-4 text-[19px] font-bold">
              تنزيل نسخة هذا الجهاز
            </h3>
            <p className="mt-2 text-[12px] font-medium leading-6 text-slate-300">
              تشمل الأصناف والوحدات ورصيد أول اليوم والوارد والصادر والجرد
              الفعلي والملاحظات والسجل والإعدادات.
            </p>
            <button
              type="button"
              onClick={() => void exportBackup()}
              className="touch-button mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-[13px] font-bold text-white active:scale-[0.98]"
            >
              <IoCloudDownloadOutline className="size-5" />
              تنزيل النسخة الآن
            </button>
          </article>

          <article className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
              <IoCloudUploadOutline className="size-7" />
            </span>
            <h3 className="font-display mt-4 text-[19px] font-bold">
              استعادة نسخة محفوظة
            </h3>
            <p className="mt-2 text-[12px] font-medium leading-6 text-slate-600 dark:text-slate-300">
              اختر ملف JSON سبق تنزيله من النظام. سنفحصه قبل السماح بالاستعادة.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void readBackupFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="touch-button mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-[13px] font-bold text-white active:scale-[0.98]"
            >
              <IoDocumentTextOutline className="size-5" />
              اختيار ملف النسخة
            </button>
          </article>
        </div>

        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <IoAlertCircleOutline className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-[12px] font-bold">احتفظ بالملف في مكان آمن</p>
            <p className="mt-1 text-[11px] font-medium leading-5">
              يحتوي الملف على رقم المالك ورمز PIN دون تشفير. لا ترسله إلى شخص
              غير موثوق.
            </p>
          </div>
        </div>

        {pendingBackup && (
          <div className="ui-surface-enter mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-start gap-3">
              <IoCheckmarkCircleOutline className="size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[15px] font-bold">
                  نسخة صالحة وجاهزة للاستعادة
                </h3>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {fileName}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                    <p className="text-[10px] font-semibold text-slate-500">
                      تاريخ النسخة
                    </p>
                    <p className="mt-1 text-[11px] font-bold">
                      {formatBackupDate(pendingBackup.exportedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                    <p className="text-[10px] font-semibold text-slate-500">
                      مجموعات البيانات
                    </p>
                    <p className="mt-1 text-[15px] font-bold tabular-nums">
                      {restoredItems}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void restoreBackup()}
                disabled={restoring}
                className="touch-button min-h-14 flex-1 rounded-2xl bg-emerald-600 px-4 text-[13px] font-bold text-white disabled:bg-slate-400 active:scale-[0.98]"
              >
                {restoring
                  ? "جاري الاستعادة..."
                  : "تأكيد واستبدال بيانات الجهاز"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingBackup(null)
                  setFileName("")
                }}
                disabled={restoring}
                className="touch-button min-h-14 rounded-2xl bg-white px-5 text-[12px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {(message || error) && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-3 rounded-2xl p-4 text-[12px] font-bold ${
              error
                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            }`}
          >
            {error ? (
              <IoAlertCircleOutline className="size-5 shrink-0" />
            ) : (
              <IoPhonePortraitOutline className="size-5 shrink-0" />
            )}
            {error || message}
          </div>
        )}
      </div>
    </section>
  )
}
