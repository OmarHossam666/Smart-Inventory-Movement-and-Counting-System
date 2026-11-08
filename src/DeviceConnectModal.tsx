import { useEffect, useRef, useState } from "react"
import {
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoCloudDoneOutline,
  IoCopyOutline,
  IoFastFoodOutline,
  IoKeyOutline,
  IoLockClosedOutline,
  IoQrCodeOutline,
  IoRefreshOutline,
  IoRadioOutline,
  IoScaleOutline,
  IoShieldCheckmarkOutline,
  IoCameraOutline,
} from "react-icons/io5"
import { LuBeef } from "react-icons/lu"
import type { DeviceRole, RolePins } from "./models"
import { storeAuthService } from "./data/firebase/authService"
import { inventoryDataService } from "./data/inventoryDataService"
import { firebaseInventorySync, type PresenceMap } from "./data/firebaseInventorySync"
import { useDialogDismiss } from "./useDialogDismiss"

export function DeviceConnectModal({
  isOpen,
  onClose,
  currentRole,
  onRoleChange,
  ownerPin,
  rolePins,
  onOpenManageRolePins,
}: {
  isOpen: boolean
  onClose: () => void
  currentRole: DeviceRole
  onRoleChange: (role: DeviceRole) => void
  ownerPin: string
  rolePins: RolePins
  onOpenManageRolePins: () => void
}) {
  useDialogDismiss(onClose)

  const [branchId, setBranchId] = useState(() => storeAuthService.getBranchId())
  const [editingBranch, setEditingBranch] = useState(false)
  const [branchInput, setBranchInput] = useState(branchId)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [switchingTo, setSwitchingTo] = useState<DeviceRole | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState("")
  const [copied, setCopied] = useState(false)
  const [isSavingBranch, setIsSavingBranch] = useState(false)

  // Live Presence States
  const [presence, setPresence] = useState<PresenceMap>(() =>
    firebaseInventorySync.getPresence(),
  )

  useEffect(() => {
    return firebaseInventorySync.subscribePresence((map) => {
      setPresence(map)
    })
  }, [])

  // Live Ping States
  const [pingStatus, setPingStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle")
  const [lastReceivedPing, setLastReceivedPing] = useState<{
    role: string
    time: number
  } | null>(null)

  // Camera Scanner States
  const [showScanner, setShowScanner] = useState(false)
  const [scanError, setScanError] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const current = storeAuthService.getBranchId()
    setBranchId(current)
    setBranchInput(current)

    // Generate pairing QR code
    const pairingPayload = JSON.stringify({
      app: "smart-inventory",
      branch: current,
      store: "smart-inventory-sys",
    })

    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(pairingPayload, {
          width: 200,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        }),
      )
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(""))
  }, [isOpen, branchId])

  // Listen for real-time ping broadcasts from other devices
  useEffect(() => {
    const handlePing = (event: Event) => {
      const customEvent = event as CustomEvent<{
        role: string
        time: number
      }>
      if (customEvent.detail) {
        setLastReceivedPing(customEvent.detail)
      }
    }

    window.addEventListener("smart-inventory-ping-received", handlePing)
    return () => {
      window.removeEventListener("smart-inventory-ping-received", handlePing)
    }
  }, [])

  // Handle Camera scanning for QR Code
  useEffect(() => {
    if (!showScanner) {
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach((track) => track.stop())
        scannerStreamRef.current = null
      }
      return
    }

    let active = true

    const startCamera = async () => {
      try {
        setScanError("")
        if (!navigator.mediaDevices?.getUserMedia) {
          setScanError("الكاميرا غير مدعومة في هذا المتصفح.")
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        scannerStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // Use native BarcodeDetector if available
        const win = window as unknown as {
          BarcodeDetector?: new (options?: { formats: string[] }) => {
            detect: (
              image: HTMLVideoElement,
            ) => Promise<Array<{ rawValue: string }>>
          }
        }

        if (win.BarcodeDetector) {
          const detector = new win.BarcodeDetector({ formats: ["qr_code"] })
          const interval = setInterval(async () => {
            if (!active || !videoRef.current) {
              clearInterval(interval)
              return
            }
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const raw = barcodes[0].rawValue
                clearInterval(interval)
                handleScanResult(raw)
              }
            } catch {
              // frame detection error, continue loop
            }
          }, 300)
        }
      } catch (err) {
        setScanError(
          "تعذر فتح الكاميرا. يرجى التأكد من منح الإذن أو إدخال الرمز يدوياً.",
        )
      }
    }

    void startCamera()

    return () => {
      active = false
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach((track) => track.stop())
        scannerStreamRef.current = null
      }
    }
  }, [showScanner])

  const handleScanResult = async (raw: string) => {
    try {
      let extractedBranch = raw.trim()
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw) as { branch?: string }
        if (parsed.branch) extractedBranch = parsed.branch
      }
      const sanitized = extractedBranch
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, "")
      if (sanitized) {
        setShowScanner(false)
        await inventoryDataService.switchBranch(sanitized)
        setBranchId(sanitized)
        setBranchInput(sanitized)
      }
    } catch {
      setScanError("الرمز غير مطابق لتطبيق Smart Inventory.")
    }
  }

  if (!isOpen) return null

  const handleSaveBranch = async () => {
    const sanitized = branchInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "")
    if (!sanitized) return
    setIsSavingBranch(true)
    try {
      await inventoryDataService.switchBranch(sanitized)
      setBranchId(sanitized)
      setEditingBranch(false)
    } finally {
      setIsSavingBranch(false)
    }
  }

  const handleSelectRole = (role: DeviceRole) => {
    if (role === currentRole) return
    setPinError("")
    setPinInput("")
    setSwitchingTo(role)
  }

  const handleConfirmRoleSwitch = () => {
    if (!switchingTo) return
    const expected = switchingTo === "owner" ? ownerPin : rolePins[switchingTo]

    if (pinInput !== expected) {
      setPinError("رمز PIN غير صحيح لهذا الدور.")
      setPinInput("")
      return
    }

    onRoleChange(switchingTo)
    setSwitchingTo(null)
    setPinInput("")
    setPinError("")
  }

  const handleSendPing = async () => {
    setPingStatus("sending")
    try {
      const ok = await inventoryDataService.sendSyncPing(currentRole)
      if (ok) {
        setPingStatus("sent")
        setTimeout(() => setPingStatus("idle"), 3500)
      } else {
        setPingStatus("failed")
        setTimeout(() => setPingStatus("idle"), 3500)
      }
    } catch {
      setPingStatus("failed")
      setTimeout(() => setPingStatus("idle"), 3500)
    }
  }

  const copyBranchId = () => {
    navigator.clipboard?.writeText(branchId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const roleMeta: Record<
    DeviceRole,
    {
      title: string
      subtitle: string
      desc: string
      icon: typeof LuBeef
    }
  > = {
    butcher: {
      title: "جهاز الملحمة",
      subtitle: "الميزان الذكي واللحوم",
      desc: "متصل بميزان البلوتوث · وزن الذبائح واللحوم وإرسال التحويلات الفورية للمطعم",
      icon: LuBeef,
    },
    restaurant: {
      title: "جهاز المطعم",
      subtitle: "شاشة المطبخ والاستلام",
      desc: "شاشة المطبخ · استلام تحويلات الملحمة فورياً بضغطة واحدة · جرد المطبخ وهدر الوجبات",
      icon: IoFastFoodOutline,
    },
    owner: {
      title: "جهاز المالك",
      subtitle: "الإدارة والرقابة المباشرة",
      desc: "لوحة التحكم المركزية · متابعة حية لجميع الأجهزة والتقارير والأسعار في أي وقت",
      icon: IoShieldCheckmarkOutline,
    },
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-3 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94dvh] w-full max-w-[880px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#111827]"
        dir="rtl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
              <IoCloudDoneOutline className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[20px] font-bold text-slate-900 dark:text-white">
                  مركز ربط الأجهزة السحابية الثلاثة
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    (["butcher", "restaurant", "owner"] as const).filter(
                      (r) => r === currentRole || presence[r]?.online,
                    ).length === 3
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                  }`}
                >
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  {(["butcher", "restaurant", "owner"] as const).filter(
                    (r) => r === currentRole || presence[r]?.online,
                  ).length}{" "}
                  من 3 أجهزة متصلة الآن
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                الملحمة (1) · المطعم (2) · المالك (3) | مزامنة فورية دون تأخير
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-button grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            <IoCloseOutline className="size-6" />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Real-time Ping Alert Banner if received */}
          {lastReceivedPing && (
            <aside className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50/90 p-3.5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 animate-pulse">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-emerald-600 text-white">
                  <IoRadioOutline className="size-4 animate-spin" />
                </span>
                <div>
                  <p className="text-[12px] font-bold">
                    إشارة حية ومباشرة مستلمة الآن!
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    أرسل {roleMeta[lastReceivedPing.role as DeviceRole]?.title || lastReceivedPing.role} إشارة اختبار مزامنة ناجحة منذ لحظات.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {new Date(lastReceivedPing.time).toLocaleTimeString("ar-SA")}
              </span>
            </aside>
          )}

          {/* Active Branch ID Card */}
          <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900/60 dark:bg-teal-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold text-teal-900 dark:text-teal-200">
                  معرّف الفرع المشترك (Cloud Branch ID)
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  تأكد من كتابة أو مسح نفس هذا الاسم في الأجهزة الثلاثة لتبادل البيانات فورياً.
                </p>
              </div>

              {!editingBranch ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    dir="ltr"
                    className="flex items-center gap-2 rounded-xl border border-teal-300 bg-white px-3 py-1.5 font-mono text-[14px] font-bold text-teal-900 shadow-sm dark:border-teal-800 dark:bg-slate-900 dark:text-teal-200"
                  >
                    <span>{branchId}</span>
                    <button
                      type="button"
                      onClick={copyBranchId}
                      title="نسخ معرّف الفرع"
                      className="text-slate-400 hover:text-teal-600"
                    >
                      <IoCopyOutline className="size-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBranchInput(branchId)
                      setEditingBranch(true)
                    }}
                    className="touch-button rounded-xl bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-700"
                  >
                    تغيير الفرع
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScanner(!showScanner)}
                    className="touch-button flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-[11px] font-bold text-teal-800 shadow-sm hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-900 dark:text-teal-200"
                  >
                    <IoCameraOutline className="size-4" />
                    مسح كود الفرع
                  </button>
                  {copied && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      تم النسخ!
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="main_branch"
                    className="rounded-xl border border-teal-300 bg-white px-3 py-1.5 font-mono text-[13px] font-bold text-slate-900 dark:border-teal-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveBranch}
                    disabled={isSavingBranch}
                    className="touch-button rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:bg-slate-400"
                  >
                    {isSavingBranch ? "جاري المزامنة..." : "حفظ وتبديل"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBranch(false)}
                    className="touch-button rounded-xl bg-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            {/* Camera QR Scanner Viewport if active */}
            {showScanner && (
              <div className="mt-4 rounded-2xl border border-dashed border-teal-400 bg-teal-100/40 p-4 text-center dark:border-teal-700 dark:bg-teal-950/40">
                <p className="text-[12px] font-bold text-teal-900 dark:text-teal-200">
                  وجّه الكاميرا نحو رمز QR على شاشة الجهاز الآخر لربط الفرع تلقائياً:
                </p>
                <div className="mx-auto mt-3 size-48 overflow-hidden rounded-xl border-2 border-teal-500 bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    className="size-full object-cover"
                  />
                </div>
                {scanError && (
                  <p className="mt-2 text-[11px] font-bold text-red-600">
                    {scanError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowScanner(false)}
                  className="mt-3 rounded-xl bg-slate-800 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700"
                >
                  إغلاق الكاميرا
                </button>
              </div>
            )}
          </section>

          {/* Interactive 3-Device Ecosystem Grid */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-[16px] font-bold text-slate-900 dark:text-white">
                  توزيع الأجهزة الثلاثة في المنشأة
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  حدد دور هذا الجهاز الفعلي أو قم بالتبديل بين الأدوار:
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenManageRolePins}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <IoKeyOutline className="size-4" />
                تعديل رموز PIN للمواقع
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["butcher", "restaurant", "owner"] as const).map((role) => {
                const meta = roleMeta[role]
                const Icon = meta.icon
                const isCurrent = currentRole === role

                const isOnline = isCurrent || presence[role]?.online

                return (
                  <div
                    key={role}
                    className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                      isCurrent
                        ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/20"
                        : isOnline
                          ? "border-emerald-300/80 bg-emerald-50/20 dark:border-emerald-800/60 dark:bg-emerald-950/10"
                          : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-11 place-items-center rounded-xl ${
                            isCurrent
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                              : isOnline
                                ? "bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          <Icon className="size-5" />
                        </span>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                            <span className="size-2 rounded-full bg-white animate-ping" />
                            هذا الجهاز (متصل)
                          </span>
                        ) : isOnline ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold shadow-sm">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            متصل سحابياً 🟢
                          </span>
                        ) : (
                          <span className="rounded-lg bg-slate-200/70 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            غير متصل ⚪
                          </span>
                        )}
                      </div>

                      <h4 className="font-display mt-3 text-[16px] font-bold text-slate-900 dark:text-white">
                        {meta.title}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {meta.subtitle}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                        {meta.desc}
                      </p>
                    </div>

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleSelectRole(role)}
                        className="touch-button mt-4 min-h-10 w-full rounded-xl bg-slate-900 text-[11px] font-bold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95"
                      >
                        التبديل إلى {meta.title}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* PIN confirmation when switching role */}
          {switchingTo && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <IoLockClosedOutline className="size-5" />
                <h4 className="font-display text-[14px] font-bold">
                  تأكيد التبديل إلى {roleMeta[switchingTo].title}
                </h4>
              </div>
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                أدخل رمز PIN الخاص بـ ({roleMeta[switchingTo].title}) لتأكيد
                اعتماد هذا الدور على هذا الجهاز:
              </p>

              <div className="mt-3 flex items-center gap-2 max-w-[320px]">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                    setPinError("")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmRoleSwitch()
                  }}
                  placeholder="••••"
                  className="min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-center font-mono text-[20px] font-bold tracking-[0.4em] dark:border-amber-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={handleConfirmRoleSwitch}
                  disabled={pinInput.length !== 4}
                  className="touch-button shrink-0 rounded-xl bg-amber-600 px-4 py-2.5 text-[12px] font-bold text-white disabled:bg-slate-300 active:scale-95"
                >
                  تأكيد
                </button>
                <button
                  type="button"
                  onClick={() => setSwitchingTo(null)}
                  className="touch-button shrink-0 rounded-xl bg-slate-200 px-3 py-2.5 text-[12px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  إلغاء
                </button>
              </div>
              {pinError && (
                <p className="mt-2 text-[11px] font-bold text-red-600">
                  {pinError}
                </p>
              )}
            </section>
          )}

          {/* Test Sync Ping Action Card */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
            <div>
              <h4 className="font-display text-[13px] font-bold text-indigo-950 dark:text-indigo-200">
                اختبار الاتصال والمزامنة الفورية بين الأجهزة (Live Ping)
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                اضغط لاختبار الاتصال المباشر؛ ستظهر إشارة خضراء فورية على شاشات الأجهزة الأخرى للتأكد من الاتصال.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendPing}
              disabled={pingStatus === "sending"}
              className={`touch-button flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold shadow-sm transition-all active:scale-95 ${
                pingStatus === "sent"
                  ? "bg-emerald-600 text-white"
                  : pingStatus === "failed"
                    ? "bg-red-600 text-white"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              <IoRadioOutline className={`size-4 ${pingStatus === "sending" ? "animate-spin" : ""}`} />
              <span>
                {pingStatus === "sending"
                  ? "جاري الإرسال..."
                  : pingStatus === "sent"
                    ? "تم استقبال الإشارة بنجاح! ✓"
                    : pingStatus === "failed"
                      ? "فشل الإرسال، تحقق من الإنترنت"
                      : "إرسال إشارة اختبار حية"}
              </span>
            </button>
          </section>

          {/* Quick Step-by-Step Instructions */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[260px]">
                <h4 className="font-display text-[14px] font-bold text-slate-900 dark:text-white">
                  طريقة ربط الأجهزة الثلاثة معاً (دليل التشغيل في دقيقة واحدة)
                </h4>
                <ol className="mt-2.5 space-y-2 text-[11px] leading-6 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      1
                    </span>
                    <span>
                      <strong>جهاز ميزان الملحمة (التابلت 1):</strong> افتح التطبيق واختر{" "}
                      <strong>جهاز الملحمة</strong> وسجل الدخول برمز PIN المعتمد له.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      2
                    </span>
                    <span>
                      <strong>جهاز شاشة المطعم (التابلت 2):</strong> افتح التطبيق واختر{" "}
                      <strong>جهاز المطعم</strong> وسجل الدخول برمز PIN المعتمد له.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      3
                    </span>
                    <span>
                      <strong>جهاز المالك (الهاتف أو الحاسوب 3):</strong> افتح التطبيق واختر{" "}
                      <strong>جهاز المالك</strong> وسجل الدخول برمز PIN المعتمد له.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓
                    </span>
                    <span>
                      تأكد أن جميع الأجهزة مسجلة بنفس معرّف الفرع (
                      <code className="font-bold text-teal-700 dark:text-teal-300 font-mono">
                        {branchId}
                      </code>
                      ). أي تحويل ترسله الملحمة سيظهر على شاشة المطعم فورياً!
                    </span>
                  </li>
                </ol>
              </div>

              {qrCodeUrl && (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                  <img
                    src={qrCodeUrl}
                    alt="رمز استجابة سريعة لربط الفرع"
                    className="size-32 object-contain"
                  />
                  <span className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    رمز QR لربط الأجهزة بالفرع
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            البيانات محمية سحابياً ومحلياً (Offline-First) عبر SQLite المشفر و Firestore.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="touch-button rounded-xl bg-slate-900 px-5 py-2 text-[12px] font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            تم وإغلاق
          </button>
        </footer>
      </section>
    </div>
  )
}
