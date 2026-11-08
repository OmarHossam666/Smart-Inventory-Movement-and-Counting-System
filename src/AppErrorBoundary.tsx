import { Component, type ErrorInfo, type ReactNode } from "react"
import { IoRefreshOutline, IoWarningOutline } from "react-icons/io5"

type Props = { children: ReactNode }
type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Smart inventory UI failed safely", error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches

    return (
      <main
        dir="rtl"
        className={`${
          isDark ? "dark" : ""
        } grid min-h-screen place-items-center bg-slate-100 p-5 dark:bg-slate-950`}
      >
        <section className="w-full max-w-[560px] rounded-[26px] border border-red-200 bg-white p-7 text-slate-950 shadow-2xl dark:border-red-900 dark:bg-slate-900 dark:text-white">
          <span className="grid size-16 place-items-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
            <IoWarningOutline className="size-8" />
          </span>
          <h1 className="font-display mt-5 text-[24px] font-bold">
            حدث خطأ غير متوقع
          </h1>
          <p className="mt-2 text-[14px] font-medium leading-7 text-slate-600 dark:text-slate-300">
            بيانات الجرد المحفوظة لم تُحذف. أعد تحميل التطبيق لاستعادة آخر حالة
            محفوظة على هذا الجهاز.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="touch-button mt-6 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-[14px] font-bold text-white active:scale-[0.98] dark:bg-emerald-600"
          >
            <IoRefreshOutline className="size-5" />
            إعادة تحميل التطبيق
          </button>
          <details className="mt-4 rounded-xl bg-slate-100 p-3 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <summary className="cursor-pointer font-bold">تفاصيل تقنية</summary>
            <p dir="ltr" className="mt-2 break-all font-mono">
              {this.state.error.message}
            </p>
          </details>
        </section>
      </main>
    )
  }
}
