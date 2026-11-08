import React from "react"
import ReactDOM from "react-dom/client"
import { AppErrorBoundary } from "./AppErrorBoundary"
import { inventoryDataService } from "./data/inventoryDataService"
import "./index.css"

const root = ReactDOM.createRoot(document.getElementById("root")!)

function renderStorageError() {
  root.render(
    <main
      dir="rtl"
      className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-950"
    >
      <section className="w-full max-w-lg rounded-3xl bg-white p-7 text-center shadow-xl">
        <h1 className="font-display text-xl font-bold">
          تعذر فتح قاعدة بيانات الجهاز
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          أغلق النسخ الأخرى من التطبيق ثم أعد المحاولة. لم يتم حذف أي بيانات
          محفوظة.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 min-h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </section>
    </main>,
  )
}

void inventoryDataService
  .initialize()
  .then(async () => {
    const bootstrap = await inventoryDataService.getBootstrap()
    const flushStorage = () => {
      if (document.visibilityState === "hidden") {
        void inventoryDataService.flush().catch(() => undefined)
      }
    }
    document.addEventListener("visibilitychange", flushStorage)
    window.addEventListener("pagehide", () => {
      void inventoryDataService.flush().catch(() => undefined)
    })
    const { default: App } = await import("./App")
    root.render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App initialData={bootstrap} />
        </AppErrorBoundary>
      </React.StrictMode>,
    )
  })
  .catch(renderStorageError)
