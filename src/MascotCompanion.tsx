import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  IoChatbubbleEllipsesOutline,
  IoChevronDownOutline,
  IoMoveOutline,
} from "react-icons/io5"
import idleMascot from "./assets/mascot/idle.svg"
import listeningMascot from "./assets/mascot/listening.svg"
import matchedMascot from "./assets/mascot/matched.svg"
import shortageMascot from "./assets/mascot/shortage.svg"
import whatsappMascot from "./assets/mascot/whatsapp.svg"
import { inventoryDataService } from "./data/inventoryDataService"
import type { MascotPreferences } from "./models"

export type MascotState = "idle" | "listening" | "matched" | "shortage" | "whatsapp"

const EDGE_PADDING = 12

function getMascotSize() {
  return window.innerWidth < 640 ? 112 : 142
}

function readSafeArea() {
  const styles = getComputedStyle(document.documentElement)
  const value = (name: string) =>
    Number.parseFloat(styles.getPropertyValue(name)) || 0
  return {
    top: value("--mascot-safe-top"),
    right: value("--mascot-safe-right"),
    bottom: value("--mascot-safe-bottom"),
    left: value("--mascot-safe-left"),
  }
}

const mascotAssets: Record<MascotState, string> = {
  idle: idleMascot,
  listening: listeningMascot,
  matched: matchedMascot,
  shortage: shortageMascot,
  whatsapp: whatsappMascot,
}

const mascotMeta: Record<MascotState, {
  label: string
  tone: string
  ring: string
}> = {
  idle: {
    label: "المعلم ميزان مستعد",
    tone: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-400/40",
  },
  listening: {
    label: "المعلم ميزان يستمع",
    tone: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-400/50",
  },
  matched: {
    label: "الكمية مطابقة",
    tone: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-400/60",
  },
  shortage: {
    label: "يوجد فرق يحتاج مراجعة",
    tone: "text-red-700 dark:text-red-300",
    ring: "ring-red-400/60",
  },
  whatsapp: {
    label: "تقرير PDF جاهز",
    tone: "text-green-700 dark:text-green-300",
    ring: "ring-green-400/60",
  },
}

const defaultPreferences: MascotPreferences = {
  xRatio: 0.02,
  yRatio: 0.68,
  minimized: false,
}

export function MascotVisual({
  state,
  className = "",
  alt = "",
  style,
}: {
  state: MascotState
  className?: string
  alt?: string
  style?: CSSProperties
}) {
  return (
    <img
      src={mascotAssets[state]}
      alt={alt}
      draggable={false}
      style={style}
      className={`select-none object-contain ${className}`}
    />
  )
}

export function MascotCompanion({
  state,
  message,
}: {
  state: MascotState
  message: string
}) {
  const initialPreferences = useRef(defaultPreferences)
  const initialSize = useRef(getMascotSize())
  const initialSafeArea = useRef(readSafeArea())
  const safeAreaRef = useRef(initialSafeArea.current)
  const [position, setPosition] = useState(() => ({
    x:
      initialSafeArea.current.left +
      EDGE_PADDING +
      initialPreferences.current.xRatio *
        Math.max(
          0,
          window.innerWidth -
            initialSize.current -
            initialSafeArea.current.left -
            initialSafeArea.current.right -
            EDGE_PADDING * 2,
        ),
    y:
      initialSafeArea.current.top +
      EDGE_PADDING +
      initialPreferences.current.yRatio *
        Math.max(
          0,
          window.innerHeight -
            initialSize.current -
            initialSafeArea.current.top -
            initialSafeArea.current.bottom -
            EDGE_PADDING * 2,
        ),
  }))
  const [minimized, setMinimized] = useState(
    initialPreferences.current.minimized,
  )
  const [bubbleOpen, setBubbleOpen] = useState(!minimized)
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth)
  const shellRef = useRef<HTMLElement>(null)
  const positionRef = useRef(position)
  const animationFrameRef = useRef<number | null>(null)
  const drag = useRef({
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  })
  const autoCloseTimer = useRef<number | null>(null)
  const visualSize = minimized ? 64 : viewportWidth < 640 ? 112 : 142
  const meta = mascotMeta[state]

  const clampPosition = (x: number, y: number, size = visualSize) => {
    const safeArea = safeAreaRef.current
    return {
      x: Math.min(
        window.innerWidth - size - safeArea.right - EDGE_PADDING,
        Math.max(safeArea.left + EDGE_PADDING, x),
      ),
      y: Math.min(
        window.innerHeight - size - safeArea.bottom - EDGE_PADDING,
        Math.max(safeArea.top + EDGE_PADDING, y),
      ),
    }
  }

  const renderPosition = (next: { x: number; y: number }, immediate = false) => {
    positionRef.current = next
    const updateTransform = () => {
      animationFrameRef.current = null
      if (shellRef.current) {
        const current = positionRef.current
        shellRef.current.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`
      }
    }
    if (immediate) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      updateTransform()
    } else if (animationFrameRef.current === null) {
      animationFrameRef.current = window.requestAnimationFrame(updateTransform)
    }
  }

  const persistPreferences = (
    nextPosition = position,
    nextMinimized = minimized,
    nextVisualSize = visualSize,
  ) => {
    const safeArea = readSafeArea()
    const maxX = Math.max(
      1,
      window.innerWidth -
        nextVisualSize -
        safeArea.left -
        safeArea.right -
        EDGE_PADDING * 2,
    )
    const maxY = Math.max(
      1,
      window.innerHeight -
        nextVisualSize -
        safeArea.top -
        safeArea.bottom -
        EDGE_PADDING * 2,
    )
    void inventoryDataService.setMascotPreferences({
      xRatio: (nextPosition.x - safeArea.left - EDGE_PADDING) / maxX,
      yRatio: (nextPosition.y - safeArea.top - EDGE_PADDING) / maxY,
      minimized: nextMinimized,
    })
  }

  useEffect(() => {
    void inventoryDataService.getMascotPreferences().then((preferences) => {
      if (!preferences) return
      const safeArea = readSafeArea()
      const size = preferences.minimized ? 64 : getMascotSize()
      const next = {
        x:
          safeArea.left +
          EDGE_PADDING +
          preferences.xRatio *
            Math.max(
              0,
              window.innerWidth -
                size -
                safeArea.left -
                safeArea.right -
                EDGE_PADDING * 2,
            ),
        y:
          safeArea.top +
          EDGE_PADDING +
          preferences.yRatio *
            Math.max(
              0,
              window.innerHeight -
                size -
                safeArea.top -
                safeArea.bottom -
                EDGE_PADDING * 2,
            ),
      }
      setMinimized(preferences.minimized)
      setBubbleOpen(!preferences.minimized)
      setPosition(next)
      renderPosition(next, true)
    })
  }, [])

  useEffect(() => {
    if (minimized) return
    setBubbleOpen(true)
    if (autoCloseTimer.current) window.clearTimeout(autoCloseTimer.current)
    autoCloseTimer.current = window.setTimeout(
      () => {
        setBubbleOpen(false)
      },
      state === "shortage" ? 8000 : 5600,
    )
    return () => {
      if (autoCloseTimer.current) window.clearTimeout(autoCloseTimer.current)
    }
  }, [message, minimized, state])

  useEffect(() => {
    const handleResize = () => {
      safeAreaRef.current = readSafeArea()
      setViewportWidth(window.innerWidth)
      setPosition((current) => {
        const next = clampPosition(current.x, current.y)
        renderPosition(next, true)
        return next
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  })

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    },
    [],
  )

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - positionRef.current.x,
      offsetY: event.clientY - positionRef.current.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (shellRef.current) shellRef.current.style.transition = "none"
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current.pointerId !== event.pointerId) return
    const next = clampPosition(
      event.clientX - drag.current.offsetX,
      event.clientY - drag.current.offsetY,
    )
    if (
      Math.hypot(
        event.clientX - drag.current.startX,
        event.clientY - drag.current.startY,
      ) > 5
    ) {
      drag.current.moved = true
    }
    renderPosition(next)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drag.current.pointerId = -1
    renderPosition(positionRef.current, true)
    if (shellRef.current) shellRef.current.style.transition = ""
    setPosition(positionRef.current)
    persistPreferences(positionRef.current)
    if (!drag.current.moved) setBubbleOpen((current) => !current)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current.pointerId !== event.pointerId) return
    drag.current.pointerId = -1
    renderPosition(positionRef.current, true)
    if (shellRef.current) shellRef.current.style.transition = ""
    setPosition(positionRef.current)
    persistPreferences(positionRef.current)
  }

  const setCompact = (nextMinimized: boolean) => {
    setMinimized(nextMinimized)
    setBubbleOpen(!nextMinimized)
    const next = clampPosition(
      position.x,
      position.y,
      nextMinimized ? 64 : getMascotSize(),
    )
    setPosition(next)
    renderPosition(next, true)
    persistPreferences(
      next,
      nextMinimized,
      nextMinimized ? 64 : getMascotSize(),
    )
  }

  const bubbleOnRight = position.x < viewportWidth / 2

  return (
    <aside
      ref={shellRef}
      dir="rtl"
      aria-live="polite"
      className="mascot-shell fixed left-0 top-0 z-[45]"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      {bubbleOpen && !minimized && (
        <div
          className={`mascot-bubble absolute top-2 w-[min(280px,calc(100vw-180px))] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_55px_rgba(15,23,42,0.2)] dark:border-slate-700 dark:bg-slate-900 ${
            bubbleOnRight ? "left-[128px]" : "right-[128px]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-[10px] font-bold ${meta.tone}`}>
                {meta.label}
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-600 dark:text-slate-300">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBubbleOpen(false)}
              aria-label="إغلاق رسالة المعلم ميزان"
              className="touch-button grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
            >
              <IoChevronDownOutline className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] font-semibold text-slate-400 dark:border-slate-800">
            <span className="flex items-center gap-1">
              <IoMoveOutline className="size-3.5" />
              اسحب الشخصية لنقلها
            </span>
            <button
              type="button"
              onClick={() => setCompact(true)}
              className="touch-button rounded-lg px-2 py-1 text-indigo-600 dark:text-indigo-300"
            >
              تصغير
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label={`${meta.label}. اسحب لنقل الشخصية أو اضغط لعرض الرسالة`}
        className={`mascot-companion mascot-drag-handle touch-button relative grid place-items-center overflow-visible rounded-full bg-white shadow-[0_14px_42px_rgba(15,23,42,0.2)] ring-2 dark:bg-slate-900 ${meta.ring} ${
          minimized ? "size-16" : ""
        }`}
        style={
          minimized
            ? { touchAction: "none" }
            : {
                width: visualSize,
                height: visualSize,
                touchAction: "none",
              }
        }
      >
        <MascotVisual
          state={state}
          className={minimized ? "size-[74px]" : ""}
          alt=""
          style={
            minimized
              ? undefined
              : { width: visualSize + 13, height: visualSize + 13 }
          }
        />
        {minimized && (
          <span className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-indigo-600 text-white shadow-lg">
            <IoChatbubbleEllipsesOutline className="size-4" />
          </span>
        )}
      </button>

      {minimized && (
        <button
          type="button"
          onClick={() => setCompact(false)}
          className="touch-button absolute -bottom-2 left-1/2 min-h-7 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 px-2 text-[8px] font-bold text-white shadow-lg dark:bg-emerald-600"
        >
          تكبير
        </button>
      )}
    </aside>
  )
}
