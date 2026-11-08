import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import {
  IoArrowUndoOutline,
  IoAnalyticsOutline,
  IoBackspaceOutline,
  IoBluetoothOutline,
  IoCalendarClearOutline,
  IoCheckmarkCircleOutline,
  IoCloseOutline,
  IoCloudOfflineOutline,
  IoContrastOutline,
  IoCubeOutline,
  IoCopyOutline,
  IoFastFoodOutline,
  IoGridOutline,
  IoImagesOutline,
  IoLockClosedOutline,
  IoLogoWhatsapp,
  IoMicOutline,
  IoMoonOutline,
  IoRefreshOutline,
  IoScaleOutline,
  IoSearchOutline,
  IoShareSocialOutline,
  IoSettingsOutline,
  IoCloudUploadOutline,
  IoFolderOpenOutline,
  IoSunnyOutline,
  IoTimeOutline,
  IoWarningOutline,
} from "react-icons/io5"
import { GiHotSpices } from "react-icons/gi"
import { LuBeef, LuDrumstick } from "react-icons/lu"
import {
  MascotCompanion,
  MascotVisual,
  type MascotState,
} from "./MascotCompanion"
import type { ScaleStatus } from "./ScaleConnection"
import logoMark from "./assets/smart-scale-logo.png"
import { storeAuthService } from "./data/firebase/authService"
import {
  firebaseInventorySync,
  type PresenceMap,
} from "./data/firebaseInventorySync"
import {
  inventoryDataService,
  type InventoryBootstrap,
} from "./data/inventoryDataService"
import {
  CATEGORY_IDS,
  baseUnitName,
  defaultItemImage,
  emptyMovement,
  expectedBalance,
  inventoryUnitName,
  seedItems,
  unitName,
} from "./inventoryCatalog"
import {
  createEntityId,
  entityTimestamp,
  type AuditRecord,
  type BaseUnit,
  type Category,
  type DeviceRole,
  type InventoryFlow,
  type InventoryLocation,
  type InventoryUnit,
  type Item,
  type ItemConfig,
  type RecipeComponent,
  type RolePins,
  type ShiftInfo,
  type StockMovement,
  type Transfer,
  type TransferLine,
} from "./models"
import {
  baseToStoredQuantity,
  componentCost,
  defaultBaseUnit,
  storedToBaseQuantity,
  validateRecipe,
} from "./features/compositeInventory"
import {
  isNativeSpeechPlatform,
  NativeSpeechError,
  parseSpokenInventoryQuantity,
  recognizeArabicNative,
  stopNativeSpeechRecognition,
} from "./features/speechRecognition"
import { getInventoryStatus } from "./features/inventoryStatus"
import {
  createProductImportPlan,
  normalizeArabicText,
  parseProductImportRows,
  type ProductImportPlanRow,
} from "./features/productImport"

const AuditHistoryScreen = lazy(() =>
  import("./AuditHistory").then((module) => ({
    default: module.AuditHistoryScreen,
  })),
)

const OwnerAnalyticsScreen = lazy(() =>
  import("./OwnerAnalytics").then((module) => ({
    default: module.OwnerAnalyticsScreen,
  })),
)

const ScaleConnectionScreen = lazy(() =>
  import("./ScaleConnection").then((module) => ({
    default: module.ScaleConnectionScreen,
  })),
)

const ShiftSetupScreen = lazy(() =>
  import("./ShiftSetup").then((module) => ({
    default: module.ShiftSetupScreen,
  })),
)

const DataBackupScreen = lazy(() =>
  import("./DataBackup").then((module) => ({
    default: module.DataBackupScreen,
  })),
)

const PdfReportScreen = lazy(() =>
  import("./PdfReport").then((module) => ({
    default: module.PdfReportScreen,
  })),
)

const DeviceConnectModal = lazy(() =>
  import("./DeviceConnectModal").then((module) => ({
    default: module.DeviceConnectModal,
  })),
)

type ProductConfig = Record<string, ItemConfig>

type MascotContext = {
  state: MascotState
  message: string
}

type TransferRequestLine = {
  item_id: string
  quantity_sent: number
}

type ProductImportIssue = {
  rowNumber: number
  message: string
}

type AutoDeductView = {
  movementId: string
  itemId: string
  name: string
  quantity: number
  unit: BaseUnit
  negativeStock: boolean
}

type SpeechAlternative = {
  transcript: string
  confidence: number
}

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    length: number
    [index: number]: SpeechAlternative
  }>
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const ScaleIcon = IoScaleOutline
const CalendarIcon = IoCalendarClearOutline
const CheckIcon = IoCheckmarkCircleOutline
const RotateIcon = IoRefreshOutline
const SendIcon = IoLogoWhatsapp
const MicIcon = IoMicOutline
const MoonIcon = IoMoonOutline
const SunIcon = IoSunnyOutline
const UndoIcon = IoArrowUndoOutline
const CloseIcon = IoCloseOutline
const AlertIcon = IoWarningOutline
const LockIcon = IoLockClosedOutline
const BackspaceIcon = IoBackspaceOutline
const CopyIcon = IoCopyOutline
const ShareIcon = IoShareSocialOutline
const OfflineIcon = IoCloudOfflineOutline
const MeatIcon = LuBeef
const ChickenIcon = LuDrumstick
const BurgerIcon = IoFastFoodOutline
const SpicesIcon = GiHotSpices
const GridIcon = IoGridOutline
const HistoryIcon = IoTimeOutline
const BluetoothIcon = IoBluetoothOutline
const SystemThemeIcon = IoContrastOutline
const ProductManagementIcon = IoCubeOutline
const OwnerSettingsIcon = IoSettingsOutline
const AnalyticsIcon = IoAnalyticsOutline
const ImageLibraryIcon = IoImagesOutline
const UploadImageIcon = IoCloudUploadOutline
const DataBackupIcon = IoFolderOpenOutline
const SearchIcon = IoSearchOutline

function persistStorageValue(key: string, value: string) {
  void inventoryDataService.setRawValue(key, value).catch((error) => {
    window.dispatchEvent(
      new CustomEvent("smart-inventory-storage-error", { detail: error }),
    )
  })
}

function removeStorageValue(key: string) {
  void inventoryDataService.removeRawValue(key).catch((error) => {
    window.dispatchEvent(
      new CustomEvent("smart-inventory-storage-error", { detail: error }),
    )
  })
}

const providedProductImages = Array.from(
  new Set(seedItems.map((item) => item.image_url)),
).slice(0, 12)

const emptyProduct: Item = {
  id: "00000000-0000-4000-8000-000000000000",
  active: false,
  is_composite: false,
  category_id: CATEGORY_IDS.meat,
  name_ar: "لا توجد أصناف في الكتالوج",
  name_en: "",
  unit: "kg",
  unit_label: "كجم",
  package_size: 1,
  opening_quantity: 0,
  minimum_stock_alert: 0,
  cost_per_unit: 0,
  shrinkage_percent: 0,
  initial_quantity: null,
  image_url: logoMark,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
}

const categoryIcons = {
  meat: MeatIcon,
  poultry: ChickenIcon,
  vegetables: BurgerIcon,
  spices: SpicesIcon,
  beverages: ScaleIcon,
}

function compressProductImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("الملف المختار ليس صورة"))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("حجم الصورة أكبر من 10 ميجابايت"))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error("تعذر معالجة الصورة"))
      image.onload = () => {
        const maximum = 560
        const scale = Math.min(1, maximum / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext("2d")
        if (!context) {
          reject(new Error("تعذر تجهيز الصورة"))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.72))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  if (image.dataset.fallbackApplied === "true") return
  image.dataset.fallbackApplied = "true"
  image.src = logoMark
  image.classList.add("object-contain", "bg-slate-950")
}

export default function App({
  initialData,
}: {
  initialData: InventoryBootstrap
}) {
  const [categoryCatalog, setCategoryCatalog] = useState<Category[]>(
    initialData.categories,
  )
  const [deviceRole, setDeviceRoleState] = useState<DeviceRole | null>(
    initialData.deviceRole,
  )
  const [ownerSessionUnlocked, setOwnerSessionUnlocked] = useState(false)
  const initialLocation: InventoryLocation =
    initialData.deviceRole === "butcher" ? "butcher" : "restaurant"
  const [activeLocation, setActiveLocation] =
    useState<InventoryLocation>(initialLocation)
  const [locationWeights, setLocationWeights] = useState(
    initialData.locationWeights,
  )
  const [transfers, setTransfers] = useState<Transfer[]>(initialData.transfers)
  const [transferLines, setTransferLines] = useState<TransferLine[]>(
    initialData.transferLines,
  )
  const [transferScreen, setTransferScreen] =
    useState<"closed" | "send" | "incoming" | "owner">("closed")
  const [wasteOpen, setWasteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(
    initialData.items[0]?.id ?? emptyProduct.id,
  )
  const [activeCategory, setActiveCategory] = useState(0)
  const [weights, setWeights] = useState<Record<string, number | null>>(
    initialData.locationWeights[initialLocation],
  )
  const [stockMovements, setInventoryFlows] =
    useState<Record<string, InventoryFlow>>(initialData.movements)
  const [recipeComponents, setRecipeComponents] = useState<RecipeComponent[]>(
    initialData.recipeComponents,
  )
  const [stockLedger, setStockLedger] = useState<StockMovement[]>(
    initialData.stockLedger,
  )
  const [compositeWarning, setCompositeWarning] = useState("")
  const [productCatalog, setProductCatalog] = useState<Item[]>(
    initialData.items,
  )
  const [productConfig, setProductConfig] = useState<ProductConfig>(
    initialData.config,
  )
  const [draftConfig, setDraftConfig] = useState<ProductConfig>(
    initialData.config,
  )
  const [themePreference, setThemePreference] =
    useState<"light" | "dark" | "system">(initialData.theme)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  )
  const isDark =
    themePreference === "dark" || (themePreference === "system" && systemDark)
  const [voiceStage, setVoiceStage] =
    useState<"closed" | "requesting" | "listening" | "processing" | "parsed" | "unsupported" | "error">(
      "closed",
    )
  const [voiceMode, setVoiceMode] = useState<"replace" | "add">("replace")
  const [voiceTargetId, setVoiceTargetId] = useState(
    initialData.items[0]?.id ?? emptyProduct.id,
  )
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const [parsedVoiceWeight, setParsedVoiceWeight] = useState<number | null>(
    null,
  )
  const [voiceError, setVoiceError] = useState("")
  const [voicePermissionBlocked, setVoicePermissionBlocked] = useState(false)
  const [manualVoiceWeight, setManualVoiceWeight] = useState("")
  const [auditScreen, setAuditScreen] =
    useState<"closed" | "incomplete" | "review">("closed")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>(
    initialData.auditHistory,
  )
  const [dispatchScreen, setDispatchScreen] = useState(
    Boolean(initialData.pendingReportText),
  )
  const [dispatchReportText, setDispatchReportText] = useState(
    initialData.pendingReportText,
  )
  const [pdfRecord, setPdfRecord] = useState<AuditRecord | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [scaleScreenOpen, setScaleScreenOpen] = useState(false)
  const [deviceConnectOpen, setDeviceConnectOpen] = useState(false)
  const [scaleStatus, setScaleStatus] = useState<ScaleStatus>("disconnected")
  const [scaleWeight, setScaleWeight] = useState(0)
  const [scaleLastReadAt, setScaleLastReadAt] = useState(Date.now())
  const [scaleDeviceName, setScaleDeviceName] = useState(initialData.scaleName)
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo>(initialData.shift)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [qrFailed, setQrFailed] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [ownerScreen, setOwnerScreen] =
    useState<"closed" | "pin" | "config" | "phone" | "products" | "changePin" | "rolePins" | "analytics" | "shiftSetup" | "backup">(
      "closed",
    )
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState(false)
  const [ownerPin, setOwnerPin] = useState(initialData.ownerPin)
  const [ownerPhone, setOwnerPhone] = useState(initialData.ownerPhone)
  const [rolePins, setRolePins] = useState<RolePins>(initialData.rolePins)
  const [draftPhone, setDraftPhone] = useState("")
  const [resetConfirm, setResetConfirm] = useState(false)
  const [weightFlash, setWeightFlash] = useState(false)
  const [livePingAlert, setLivePingAlert] = useState<{
    role: string
    time: number
  } | null>(null)
  const [isPingPulsing, setIsPingPulsing] = useState(false)
  const [presenceMap, setPresenceMap] = useState<PresenceMap>(() =>
    firebaseInventorySync.getPresence(),
  )

  useEffect(() => {
    return firebaseInventorySync.subscribePresence((p) => {
      setPresenceMap(p)
    })
  }, [])

  useEffect(() => {
    const handlePing = (event: Event) => {
      const customEvent = event as CustomEvent<{
        role: string
        time: number
      }>
      if (customEvent.detail) {
        setLivePingAlert(customEvent.detail)
        setIsPingPulsing(true)
        navigator.vibrate?.([100, 50, 100])
        setTimeout(() => setIsPingPulsing(false), 8000)
        setTimeout(() => setLivePingAlert(null), 7000)
      }
    }
    window.addEventListener("smart-inventory-ping-received", handlePing)
    return () => {
      window.removeEventListener("smart-inventory-ping-received", handlePing)
    }
  }, [])

  const onlineDevicesCount = useMemo(() => {
    const roles: DeviceRole[] = ["butcher", "restaurant", "owner"]
    return roles.filter(
      (r) => r === deviceRole || presenceMap[r]?.online,
    ).length
  }, [deviceRole, presenceMap])

  const [mascotEvent, setMascotEvent] = useState<{
    state: MascotState
    message: string
    id: number
  } | null>(null)
  const [lastAction, setLastAction] = useState<{
    id: string
    previous: number | null
    label: string
  } | null>(null)
  const lastTapAt = useRef(0)
  const voiceTimers = useRef<number[]>([])
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null)
  const voiceRequestId = useRef(0)
  const voiceModeRef = useRef<"replace" | "add">("replace")
  const voiceTargetRef = useRef(initialData.items[0]?.id ?? emptyProduct.id)
  const parsedVoiceWeightRef = useRef<number | null>(null)
  const cloudRefreshRunning = useRef(false)

  useEffect(() => {
    const applyFreshBootstrap = async () => {
      const next = await inventoryDataService.getBootstrap()
      setCategoryCatalog(next.categories)
      setProductCatalog(next.items)
      setProductConfig(next.config)
      setInventoryFlows(next.movements)
      setRecipeComponents(next.recipeComponents)
      setStockLedger(next.stockLedger)
      setLocationWeights(next.locationWeights)
      setWeights(next.locationWeights[activeLocation])
      setTransfers(next.transfers)
      setTransferLines(next.transferLines)
      setAuditHistory(next.auditHistory)
      setShiftInfo(next.shift)
      setRolePins(next.rolePins)
      setOwnerPin(next.ownerPin)
      setOwnerPhone(next.ownerPhone)
    }

    const refreshCloudData = async () => {
      if (
        cloudRefreshRunning.current ||
        !navigator.onLine ||
        document.visibilityState === "hidden"
      ) {
        return
      }
      cloudRefreshRunning.current = true
      try {
        const changed = await inventoryDataService.refreshFromCloud()
        if (!changed) return
        await applyFreshBootstrap()
      } finally {
        cloudRefreshRunning.current = false
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCloudData()
    }
    window.addEventListener("online", refreshCloudData)
    window.addEventListener(
      "smart-inventory-data-refreshed",
      applyFreshBootstrap,
    )
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      window.removeEventListener("online", refreshCloudData)
      window.removeEventListener(
        "smart-inventory-data-refreshed",
        applyFreshBootstrap,
      )
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [activeLocation])

  const categories = useMemo(
    () => [
      ...categoryCatalog.map((category) => ({
        id: category.id,
        label: category.name_ar,
        icon: categoryIcons[category.icon_key],
        value: category.id,
        color: category.color,
        slug: category.slug,
      })),
      {
        id: "all",
        label: "الكل",
        icon: GridIcon,
        value: "all",
        color: "slate" as const,
        slug: "all" as const,
      },
    ],
    [categoryCatalog],
  )

  const configuredProducts = useMemo(
    () =>
      productCatalog
        .filter((product) => product.active !== false)
        .filter(
          (product) =>
            deviceRole !== "butcher" || product.is_composite === false,
        )
        .map((product) => {
          const movement =
            stockMovements[product.id] ??
            emptyMovement(product.opening_quantity, product.id)
          return {
            ...product,
            opening_quantity: expectedBalance(movement),
            shrinkage_percent:
              productConfig[product.id]?.shrinkage_percent ??
              product.shrinkage_percent,
            minimum_stock_alert:
              productConfig[product.id]?.minimum_stock_alert ??
              product.minimum_stock_alert,
            cost_per_unit:
              productConfig[product.id]?.cost_per_unit ?? product.cost_per_unit,
          }
        }),
    [deviceRole, productCatalog, productConfig, stockMovements],
  )
  const selected = useMemo(() => {
    const category = categories[activeCategory]?.value ?? "all"
    const selectedProduct = configuredProducts.find(
      (product) => product.id === selectedId,
    )
    if (
      selectedProduct &&
      (category === "all" || selectedProduct.category_id === category)
    ) {
      return selectedProduct
    }
    return (
      configuredProducts.find(
        (product) => category === "all" || product.category_id === category,
      ) ?? emptyProduct
    )
  }, [activeCategory, categories, configuredProducts, selectedId])
  const selectedIsRecipeComponent =
    !selected.is_composite &&
    recipeComponents.some(
      (component) => component.component_item_id === selected.id,
    )
  const quickCountPresets: Array<[string, string, number]> =
    selected.unit === "kg"
      ? [
        ["+10", "كجم", 10],
        ["+5", "كجم", 5],
        ["+1", "كجم", 1],
        ["+500", "جرام", 0.5],
        ["+250", "جرام", 0.25],
        ["+100", "جرام", 0.1],
      ]
      : selected.unit === "g"
        ? [
          ["+1000", "جرام", 1000],
          ["+500", "جرام", 500],
          ["+250", "جرام", 250],
          ["+100", "جرام", 100],
          ["+50", "جرام", 50],
          ["+10", "جرام", 10],
        ]
        : selected.unit === "ml"
          ? [
            ["+1000", "مل", 1000],
            ["+500", "مل", 500],
            ["+250", "مل", 250],
            ["+100", "مل", 100],
            ["+50", "مل", 50],
            ["+10", "مل", 10],
          ]
          : [
            ["+20", unitName(selected), 20],
            ["+10", unitName(selected), 10],
            ["+5", unitName(selected), 5],
            ["+3", unitName(selected), 3],
            ["+2", unitName(selected), 2],
            ["+1", unitName(selected), 1],
          ]
  const countCorrection =
    selected.unit === "kg"
      ? { amount: -0.1, label: "-100 جرام" }
      : selected.unit === "g"
        ? { amount: -10, label: "-10 جرام" }
        : selected.unit === "ml"
          ? { amount: -10, label: "-10 مل" }
          : { amount: -1, label: `-1 ${unitName(selected)}` }
  const selectedMovement =
    stockMovements[selected.id] ??
    emptyMovement(selected.opening_quantity, selected.id)
  const voiceTarget = useMemo(
    () =>
      configuredProducts.find((product) => product.id === voiceTargetId) ??
      configuredProducts[0] ??
      emptyProduct,
    [configuredProducts, voiceTargetId],
  )
  const visibleProducts = useMemo(() => {
    const category = categories[activeCategory]?.value ?? "all"
    return configuredProducts.filter((product) => {
      return category === "all" || product.category_id === category
    })
  }, [activeCategory, categories, configuredProducts])
  const compositeDeductionsByItem = useMemo(() => {
    const result: Record<string, AutoDeductView[]> = {}
    configuredProducts
      .filter((item) => item.is_composite)
      .forEach((item) => {
        const parent = [...stockLedger]
          .reverse()
          .find(
            (movement) =>
              movement.type === "count" &&
              movement.item_id === item.id &&
              movement.reference_id ===
              `current-count:${activeLocation}:${item.id}`,
          )
        if (!parent) {
          result[item.id] = []
          return
        }
        result[item.id] = stockLedger
          .filter(
            (movement) =>
              movement.type === "auto_deduct" &&
              movement.parent_movement_id === parent.id,
          )
          .map((movement) => ({
            movementId: movement.id,
            itemId: movement.item_id,
            name:
              productCatalog.find((entry) => entry.id === movement.item_id)
                ?.name_ar ?? "مكون",
            quantity: Math.abs(movement.quantity),
            unit: movement.unit,
            negativeStock: (weights[movement.item_id] ?? 0) < 0,
          }))
      })
    return result
  }, [activeLocation, configuredProducts, productCatalog, stockLedger, weights])
  const auditData = useMemo(() => {
    const rows = configuredProducts.map((product) => ({
      product,
      weight: weights[product.id] ?? null,
      status: getInventoryStatus(product, weights[product.id] ?? null),
    }))
    return {
      matched: rows.filter((row) => row.status.tone === "matched"),
      tolerance: rows.filter((row) => row.status.tone === "tolerance"),
      shortage: rows.filter((row) => row.status.tone === "shortage"),
      pending: rows.filter((row) => row.status.tone === "pending"),
    }
  }, [configuredProducts, weights])
  const summaryData = useMemo(() => {
    return configuredProducts.reduce(
      (summary, product) => {
        const weight = weights[product.id] ?? null
        const allowance =
          product.opening_quantity * (product.shrinkage_percent / 100)
        const minimum = product.opening_quantity - allowance
        summary.book += product.opening_quantity
        summary.allowance += allowance
        if (weight !== null) {
          summary.completed += 1
          summary.actual += weight
          summary.shortage += Math.min(0, weight - minimum)
        }
        return summary
      },
      { book: 0, actual: 0, allowance: 0, shortage: 0, completed: 0 },
    )
  }, [configuredProducts, weights])
  const quantitySummary = useMemo(
    () =>
      configuredProducts.reduce(
        (summary, product) => {
          const unit = product.unit
          const movement =
            stockMovements[product.id] ??
            emptyMovement(product.opening_quantity, product.id)
          const actual = weights[product.id] ?? null
          summary[unit].opening += movement.opening
          summary[unit].incoming += movement.incoming
          summary[unit].outgoing += movement.outgoing
          summary[unit].expected += product.opening_quantity
          if (actual !== null) {
            summary[unit].actual += actual
            summary[unit].difference += actual - product.opening_quantity
          }
          return summary
        },
        Object.fromEntries(
          (["g", "kg", "ml", "pack", "jar", "piece"] as InventoryUnit[]).map(
            (unit) => [
              unit,
              {
                opening: 0,
                incoming: 0,
                outgoing: 0,
                expected: 0,
                actual: 0,
                difference: 0,
              },
            ],
          ),
        ) as Record<InventoryUnit, {
          opening: number
          incoming: number
          outgoing: number
          expected: number
          actual: number
          difference: number
        }>,
      ),
    [configuredProducts, stockMovements, weights],
  )
  const formatQuantitySummary = (
    field: "opening" | "incoming" | "outgoing" | "expected" | "actual" | "difference",
  ) =>
    (["kg", "g", "piece", "pack", "jar"] as InventoryUnit[])
      .filter((unit) => Math.abs(quantitySummary[unit][field]) > 0.0001)
      .map(
        (unit) =>
          `${quantitySummary[unit][field].toFixed(unit === "kg" ? 1 : 0)} ${inventoryUnitName(unit)}`,
      )
      .join(" · ") || "0"
  const progressPercent = Math.round(
    configuredProducts.length === 0
      ? 0
      : (summaryData.completed / configuredProducts.length) * 100,
  )
  const selectedStatus = getInventoryStatus(
    selected,
    weights[selected.id] ?? null,
  )
  const mascotContext: MascotContext = (() => {
    if (mascotEvent) return mascotEvent
    if (storageWarning) {
      return {
        state: "shortage",
        message:
          "الحفظ غير متاح حالياً. حرّر مساحة على الجهاز قبل تسجيل بيانات جديدة.",
      }
    }
    if (
      voiceStage === "requesting" ||
      voiceStage === "listening" ||
      voiceStage === "processing"
    ) {
      return {
        state: "listening",
        message:
          voiceStage === "requesting"
            ? "أجهّز الميكروفون الآن. وافق على إذن الوصول لنبدأ."
            : voiceStage === "listening"
              ? "أنا أسمعك. قل الكمية والوحدة بوضوح."
              : "أراجع العبارة وأحوّلها إلى كمية مناسبة للصنف.",
      }
    }
    if (voiceStage === "parsed") {
      return {
        state: "matched",
        message: "فهمت الكمية. راجعها ثم اضغط اعتماد لتسجيلها.",
      }
    }
    if (voiceStage === "error" || voiceStage === "unsupported") {
      return {
        state: "idle",
        message:
          "تعذر الإدخال الصوتي، لكن يمكنك متابعة تسجيل الكمية يدوياً بأمان.",
      }
    }
    if (configuredProducts.length === 0) {
      return {
        state: "idle",
        message:
          "لا توجد أصناف نشطة حالياً. يمكن للمالك إضافة الأصناف أو استعادتها من إدارة الكتالوج.",
      }
    }
    if (auditScreen !== "closed" && auditData.shortage.length > 0) {
      return {
        state: "shortage",
        message: `وجدت ${auditData.shortage.length} ${auditData.shortage.length === 1 ? "صنفاً يحتاج" : "أصناف تحتاج"
          } مراجعة بعد احتساب الهدر المسموح.`,
      }
    }
    if (pdfRecord) {
      return {
        state: "idle",
        message:
          "تم إنشاء التقرير. راجع البيانات ثم استخدم المشاركة لإرساله فعلياً.",
      }
    }
    if (selectedStatus.tone === "shortage") {
      return {
        state: "shortage",
        message:
          "الكمية أقل من الحد المتوقع بعد الهدر المسموح. راجع القراءة قبل المتابعة.",
      }
    }
    if (selectedStatus.tone === "matched") {
      return {
        state: "matched",
        message: "الله ينور عليك! الكمية ضمن نطاق المطابقة والهدر المسموح.",
      }
    }
    if (progressPercent === 100 && configuredProducts.length > 0) {
      return {
        state: auditData.shortage.length > 0 ? "shortage" : "matched",
        message:
          auditData.shortage.length > 0
            ? `اكتمل الجرد، لكن ${auditData.shortage.length} من الأصناف يحتاج مراجعة.`
            : "اكتمل الجرد وكل الكميات ضمن النطاق المقبول.",
      }
    }
    if (scaleScreenOpen) {
      return {
        state: "idle",
        message:
          "سأنتظر قراءة حقيقية من ميزان Bluetooth المتوافق قبل اعتماد أي كمية.",
      }
    }
    return {
      state: "idle",
      message:
        configuredProducts.length === 0
          ? "أضف صنفاً واحداً على الأقل، وبعدها أرافقك في كل خطوة."
          : `سجل كمية ${selected.name_ar} يدوياً أو بالصوت أو من الميزان المتوافق.`,
    }
  })()
  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(Date.now()),
    [],
  )
  const reportText = useMemo(() => {
    const categoryLines = categoryCatalog.flatMap((category) => {
      const categoryProducts = configuredProducts.filter(
        (product) => product.category_id === category.id,
      )
      if (!categoryProducts.length) return []
      return [
        `\n*${category.label_ar}*`,
        ...categoryProducts.map((product) => {
          const movement =
            stockMovements[product.id] ??
            emptyMovement(product.opening_quantity, product.id)
          const actual = weights[product.id] ?? null
          const difference =
            actual === null
              ? null
              : Number((actual - product.opening_quantity).toFixed(3))
          const unit = unitName(product)
          const note = movement.notes ? ` · ${movement.notes}` : ""
          return [
            `• ${product.name_ar}${product.name_en ? ` (${product.name_en})` : ""
            }`,
            `أول: ${movement.opening.toFixed(2)}`,
            `وارد: ${movement.incoming.toFixed(2)}`,
            `صادر: ${movement.outgoing.toFixed(2)}`,
            `متوقع: ${expectedBalance(movement).toFixed(2)}`,
            `فعلي: ${actual === null ? "—" : actual.toFixed(2)}`,
            `فرق: ${difference === null ? "—" : difference.toFixed(2)
            } ${unit}${note}`,
          ].join(" | ")
        }),
      ]
    })
    const consumptionLines = configuredProducts.flatMap((product) => {
      const deductions = compositeDeductionsByItem[product.id] ?? []
      if (!product.is_composite || !deductions.length) return []
      return [
        `\n*استهلاك مكونات ${product.name_ar}*`,
        ...deductions.map(
          (deduction) =>
            `• ${deduction.name}: ${deduction.quantity} ${baseUnitName(deduction.unit)}${deduction.negativeStock ? " · تنبيه رصيد سالب" : ""
            }`,
        ),
      ]
    })
    return [
      "*تقرير حركة وجرد المخزون اليومي*",
      `التاريخ: ${currentDateLabel} | ${shiftInfo.label}`,
      `الفرع: ${shiftInfo.branch}`,
      "────────────────────",
      `إجمالي الأصناف المجرودة: ${summaryData.completed} / ${configuredProducts.length} صنف`,
      `حركة المخزون: ${formatQuantitySummary("opening")} أول اليوم`,
      ...categoryLines,
      ...(consumptionLines.length
        ? ["\n*استهلاك المكونات من المنتجات المركبة*", ...consumptionLines]
        : []),
    ].join("\n")
  }, [
    configuredProducts,
    categoryCatalog,
    compositeDeductionsByItem,
    currentDateLabel,
    quantitySummary,
    shiftInfo,
    stockMovements,
    summaryData,
    weights,
  ])
  const effectiveReportText = dispatchReportText || reportText
  const whatsappUrl = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(effectiveReportText)}`

  const changeCategory = (index: number) => {
    const category = categories[index]
    if (!category) return
    setActiveCategory(index)
    const firstProduct =
      category.value === "all"
        ? configuredProducts[0]
        : configuredProducts.find(
          (product) => product.category_id === category.value,
        )
    if (firstProduct) setSelectedId(firstProduct.id)
  }

  const updateSelectedMovement = (
    field: keyof Pick<InventoryFlow, "opening" | "incoming" | "outgoing">,
    value: number,
  ) => {
    if (!configuredProducts.some((product) => product.id === selected.id))
      return
    const current =
      stockMovements[selected.id] ??
      emptyMovement(selected.opening_quantity, selected.id)
    const next = {
      ...stockMovements,
      [selected.id]: {
        ...current,
        [field]: Math.max(0, Number(value.toFixed(3))),
        updated_at: entityTimestamp(),
      },
    }
    setInventoryFlows(next)
    persistStorageValue("smart-inventory-movements", JSON.stringify(next))
    navigator.vibrate?.(20)
  }

  const updateSelectedNotes = (notes: string) => {
    if (!configuredProducts.some((product) => product.id === selected.id))
      return
    const current =
      stockMovements[selected.id] ??
      emptyMovement(selected.opening_quantity, selected.id)
    const next = {
      ...stockMovements,
      [selected.id]: {
        ...current,
        notes: notes.slice(0, 180),
        updated_at: entityTimestamp(),
      },
    }
    setInventoryFlows(next)
    persistStorageValue("smart-inventory-movements", JSON.stringify(next))
  }

  const applyProductCount = async (
    targetId: string,
    value: number | null,
    actionLabel: string,
    rememberAction = true,
  ) => {
    const now = Date.now()
    if (now - lastTapAt.current < 180) return
    lastTapAt.current = now
    const target = configuredProducts.find((item) => item.id === targetId)
    if (!target) return
    const previous = weights[targetId] ?? null
    try {
      const result = await inventoryDataService.setCount(
        targetId,
        value === null ? null : Math.max(0, value),
        actionLabel,
        activeLocation,
      )
      setWeights(result.weights)
      setLocationWeights(result.locationWeights)
      setStockLedger(result.ledger)
      if (rememberAction) {
        setLastAction({ id: targetId, previous, label: actionLabel })
      }
      const negativeNames = result.negativeComponentIds
        .map((id) => productCatalog.find((item) => item.id === id)?.name_ar)
        .filter(Boolean)
      setCompositeWarning(
        negativeNames.length
          ? `تنبيه: سيصبح رصيد ${negativeNames.join("، ")} سالباً. تم الحفظ مع إظهار التنبيه في التقرير.`
          : "",
      )
    } catch (error) {
      setCompositeWarning(
        error instanceof Error ? error.message : "تعذر حفظ الكمية.",
      )
      return
    }
    const nextStatus = getInventoryStatus(
      target,
      value === null ? null : Math.max(0, value),
    )
    if (nextStatus.tone === "shortage") {
      setMascotEvent({
        state: "shortage",
        message:
          "انتبه يا غالي، القراءة تسجل عجزاً بعد الهدر المسموح. تأكد من الصنف والميزان.",
        id: now,
      })
    } else if (nextStatus.tone === "matched") {
      setMascotEvent({
        state: "matched",
        message: "تم تسجيل الكمية، وهي ضمن نطاق المطابقة والهدر المسموح.",
        id: now,
      })
    } else {
      setMascotEvent({
        state: "idle",
        message: "تم تسجيل الكمية. راجع الزيادة الظاهرة قبل اعتماد الجرد.",
        id: now,
      })
    }
    navigator.vibrate?.(35)
    setWeightFlash(true)
    window.setTimeout(() => setWeightFlash(false), 180)
  }

  const setProductWeight = (value: number, actionLabel: string) => {
    void applyProductCount(selected.id, value, actionLabel)
  }

  const chooseDeviceRole = async (role: DeviceRole) => {
    await inventoryDataService.setDeviceRole(role)
    setDeviceRoleState(role)
    setOwnerSessionUnlocked(true)
    const location = role === "butcher" ? "butcher" : "restaurant"
    setActiveLocation(location)
    setWeights(locationWeights[location])
  }

  const changeOwnerLocation = (location: InventoryLocation) => {
    setActiveLocation(location)
    setWeights(locationWeights[location])
    setSelectedId(emptyProduct.id)
  }

  const sendTransferToRestaurant = async (lines: TransferRequestLine[]) => {
    const result = await inventoryDataService.createTransfer(lines)
    setTransfers(result.transfers)
    setTransferLines(result.transferLines)
    setLocationWeights(result.locationWeights)
    setStockLedger(result.ledger)
    if (activeLocation === "butcher") {
      setWeights(result.locationWeights.butcher)
    }
  }

  const receiveButcherTransfer = async (
    transferId: string,
    received: Record<string, number>,
  ) => {
    const result = await inventoryDataService.receiveTransfer(
      transferId,
      received,
    )
    setTransfers(result.transfers)
    setTransferLines(result.transferLines)
    setLocationWeights(result.locationWeights)
    setStockLedger(result.ledger)
    if (activeLocation === "restaurant") {
      setWeights(result.locationWeights.restaurant)
    }
  }

  const cancelSentTransfer = async (transferId: string, reason: string) => {
    const result = await inventoryDataService.cancelTransfer(transferId, reason)
    setTransfers(result.transfers)
    setLocationWeights(result.locationWeights)
    setStockLedger(result.ledger)
    if (activeLocation === "butcher") {
      setWeights(result.locationWeights.butcher)
    }
  }

  const recordSelectedWaste = async (quantity: number, note: string) => {
    const result = await inventoryDataService.recordWaste(
      selected.id,
      storedToBaseQuantity(quantity, selected),
      activeLocation,
      note,
    )
    setLocationWeights(result.locationWeights)
    setWeights(result.locationWeights[activeLocation])
    setStockLedger(result.ledger)
    setWasteOpen(false)
  }

  const addWeight = (amount: number, label: string) => {
    setProductWeight(
      Number(((weights[selected.id] ?? 0) + amount).toFixed(2)),
      label,
    )
  }

  const undoLast = () => {
    if (!lastAction) return
    void applyProductCount(
      lastAction.id,
      lastAction.previous,
      `تراجع: ${lastAction.label}`,
      false,
    )
    setSelectedId(lastAction.id)
    setLastAction(null)
    navigator.vibrate?.(25)
  }

  const captureScaleWeight = () => {
    if (
      scaleStatus !== "connected" ||
      scaleWeight <= 0 ||
      selected.unit !== "kg"
    ) {
      setScaleScreenOpen(true)
      return
    }
    setProductWeight(scaleWeight, "سحب وزن الميزان")
  }

  const clearVoiceTimers = () => {
    voiceRequestId.current += 1
    voiceTimers.current.forEach((timer) => window.clearTimeout(timer))
    voiceTimers.current = []
    const recognition = speechRecognition.current
    speechRecognition.current = null
    recognition?.abort()
  }

  const closeVoiceCapture = () => {
    clearVoiceTimers()
    void stopNativeSpeechRecognition()
    setVoiceStage("closed")
  }

  const commitVoiceWeight = () => {
    clearVoiceTimers()
    const targetId = voiceTargetRef.current
    const targetProduct = configuredProducts.find(
      (product) => product.id === targetId,
    )!
    const previous = weights[targetId] ?? null
    const parsedWeight = parsedVoiceWeightRef.current
    if (parsedWeight === null) return
    const nextWeight =
      voiceModeRef.current === "add"
        ? Number(((previous ?? 0) + parsedWeight).toFixed(2))
        : parsedWeight
    const actionLabel =
      voiceModeRef.current === "add"
        ? `إضافة صوتية ${parsedWeight.toFixed(2)} ${unitName(targetProduct)}`
        : `إدخال صوتي ${parsedWeight.toFixed(2)} ${unitName(targetProduct)}`
    void applyProductCount(targetId, nextWeight, actionLabel)
    setSelectedId(targetId)
    const categoryIndex = categories.findIndex(
      (category) => category.value === targetProduct.category_id,
    )
    if (categoryIndex >= 0) setActiveCategory(categoryIndex)
    setVoiceStage("closed")
    setWeightFlash(true)
    window.setTimeout(() => setWeightFlash(false), 220)
    navigator.vibrate?.(45)
  }

  const processVoiceTranscripts = (transcripts: string[]) => {
    setVoiceStage("processing")
    const targetUnit =
      configuredProducts.find(
        (product) => product.id === voiceTargetRef.current,
      )?.unit ?? "kg"
    const parsedAlternative = transcripts
      .map((transcript) => ({
        transcript: transcript.trim(),
        weight: parseSpokenInventoryQuantity(transcript, targetUnit),
      }))
      .find((alternative) => alternative.weight !== null)
    const fallbackTranscript = transcripts[0]?.trim() ?? ""

    voiceTimers.current.push(
      window.setTimeout(() => {
        if (parsedAlternative && parsedAlternative.weight !== null) {
          setVoiceTranscript(parsedAlternative.transcript)
          setParsedVoiceWeight(parsedAlternative.weight)
          parsedVoiceWeightRef.current = parsedAlternative.weight
          setVoiceStage("parsed")
          voiceTimers.current.push(window.setTimeout(commitVoiceWeight, 4200))
        } else {
          setVoiceTranscript(fallbackTranscript)
          setVoiceError("لم نتمكن من استخراج كمية واضحة من العبارة.")
          setVoiceStage("error")
          navigator.vibrate?.([60, 40, 60])
        }
      }, 420),
    )
  }

  const runVoiceCapture = async () => {
    clearVoiceTimers()
    const requestId = voiceRequestId.current
    setVoiceTranscript("")
    setParsedVoiceWeight(null)
    parsedVoiceWeightRef.current = null
    setVoiceError("")
    setVoicePermissionBlocked(false)
    setManualVoiceWeight("")

    if (isNativeSpeechPlatform()) {
      await stopNativeSpeechRecognition()
      if (voiceRequestId.current !== requestId) return
      setVoiceStage("requesting")
      voiceTimers.current.push(
        window.setTimeout(() => {
          if (voiceRequestId.current === requestId) {
            setVoiceStage("listening")
          }
        }, 350),
      )
      try {
        const transcripts = await recognizeArabicNative()
        if (voiceRequestId.current !== requestId) return
        processVoiceTranscripts(transcripts)
      } catch (error) {
        if (voiceRequestId.current !== requestId) return
        if (error instanceof NativeSpeechError && error.code === "cancelled") {
          setVoiceStage("closed")
          return
        }
        const permissionDenied =
          error instanceof NativeSpeechError &&
          error.code === "permission-denied"
        setVoicePermissionBlocked(permissionDenied)
        setVoiceError(
          error instanceof Error ? error.message : "تعذر تشغيل التعرف الصوتي.",
        )
        setVoiceStage(
          error instanceof NativeSpeechError && error.code === "unavailable"
            ? "unsupported"
            : "error",
        )
        navigator.vibrate?.([60, 40, 60])
      }
      return
    }

    const speechWindow = window as SpeechWindow
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceStage("unsupported")
      navigator.vibrate?.([50, 30, 50])
      return
    }

    setVoiceStage("requesting")
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })
        stream.getTracks().forEach((track) => track.stop())
        if (voiceRequestId.current !== requestId) return
      } catch (error) {
        if (voiceRequestId.current !== requestId) return
        const errorName = error instanceof DOMException ? error.name : ""
        const isPermissionError =
          errorName === "NotAllowedError" || errorName === "SecurityError"
        setVoicePermissionBlocked(isPermissionError)
        setVoiceError(
          isPermissionError
            ? window.self !== window.top
              ? "المعاينة المضمّنة تمنع طلب الميكروفون. افتح التطبيق في نافذة مستقلة ثم اسمح بالوصول."
              : "تم حظر الميكروفون. اضغط رمز القفل بجانب عنوان الموقع وغيّر إذن الميكروفون إلى سماح."
            : "تعذر الوصول إلى الميكروفون. تأكد من عدم استخدامه في تطبيق آخر.",
        )
        setVoiceStage("error")
        navigator.vibrate?.([60, 40, 60])
        return
      }
    } else if (!window.isSecureContext) {
      setVoicePermissionBlocked(true)
      setVoiceError(
        "يحتاج الميكروفون إلى اتصال HTTPS آمن. افتح النسخة المنشورة من التطبيق.",
      )
      setVoiceStage("error")
      return
    }

    const recognition = new Recognition()
    recognition.lang = "ar-SA"
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 4
    speechRecognition.current = recognition
    let receivedResult = false

    recognition.onresult = (event) => {
      receivedResult = true
      processVoiceTranscripts(
        Array.from(event.results[0] ?? []).map(
          (alternative) => alternative.transcript,
        ),
      )
    }
    recognition.onerror = (event) => {
      if (speechRecognition.current !== recognition) return
      speechRecognition.current = null
      if (event.error === "aborted") return
      const isPermissionError =
        event.error === "not-allowed" || event.error === "service-not-allowed"
      setVoicePermissionBlocked(isPermissionError)
      setVoiceError(
        isPermissionError
          ? window.self !== window.top
            ? "المعاينة المضمّنة تمنع تشغيل الميكروفون. افتح التطبيق في نافذة مستقلة."
            : "تم حظر الميكروفون. اسمح به من رمز القفل بجانب عنوان الموقع."
          : event.error === "no-speech"
            ? "لم نسمع وزنًا واضحًا. اقترب من الجهاز وحاول مرة أخرى."
            : "تعذر تشغيل التعرف الصوتي على هذا الجهاز.",
      )
      setVoiceStage("error")
      navigator.vibrate?.([60, 40, 60])
    }
    recognition.onend = () => {
      if (speechRecognition.current !== recognition) return
      speechRecognition.current = null
      if (!receivedResult) {
        setVoiceError("انتهى الاستماع دون التقاط وزن. حاول التحدث بوضوح.")
        setVoiceStage("error")
      }
    }

    setVoiceStage("listening")
    navigator.vibrate?.(40)
    try {
      recognition.start()
    } catch {
      speechRecognition.current = null
      setVoiceError("تعذر بدء الميكروفون. أغلق أي تطبيق يستخدمه ثم حاول مجددًا.")
      setVoiceStage("error")
    }
  }

  const startVoiceCapture = () => {
    voiceTargetRef.current = selected.id
    setVoiceTargetId(selected.id)
    setVoiceMode("replace")
    voiceModeRef.current = "replace"
    void runVoiceCapture()
  }

  const changeVoiceMode = (mode: "replace" | "add") => {
    setVoiceMode(mode)
    voiceModeRef.current = mode
  }

  const enterManualVoiceDigit = (digit: string) => {
    navigator.vibrate?.(12)
    setManualVoiceWeight((current) => {
      if (digit === ".") {
        if (current.includes(".")) return current
        return current ? `${current}.` : "0."
      }
      if (current === "0") return digit
      const [whole = "", fraction] = current.split(".")
      if (fraction !== undefined && fraction.length >= 3) return current
      if (fraction === undefined && whole.length >= 3) return current
      return `${current}${digit}`
    })
  }

  const commitManualVoiceWeight = () => {
    const parsedWeight = Number(manualVoiceWeight)
    if (
      !manualVoiceWeight ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0 ||
      parsedWeight > (voiceTarget.unit === "piece" ? 9999 : 500)
    ) {
      setVoiceError(
        voiceTarget.unit === "piece"
          ? "أدخل عدداً صحيحاً أكبر من صفر."
          : "أدخل وزناً صحيحاً أكبر من صفر ولا يتجاوز 500 كجم.",
      )
      navigator.vibrate?.([60, 40, 60])
      return
    }

    clearVoiceTimers()
    const targetId = voiceTargetRef.current
    void applyProductCount(
      targetId,
      Number(parsedWeight.toFixed(3)),
      `إدخال يدوي ${parsedWeight.toFixed(2)} ${unitName(voiceTarget)}`,
    )
    setSelectedId(targetId)
    setVoiceStage("closed")
    setWeightFlash(true)
    window.setTimeout(() => setWeightFlash(false), 220)
    navigator.vibrate?.(45)
  }

  useEffect(
    () => () => {
      voiceTimers.current.forEach((timer) => window.clearTimeout(timer))
      speechRecognition.current?.abort()
      void stopNativeSpeechRecognition()
    },
    [],
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleStorageError = () => setStorageWarning(true)
    window.addEventListener("smart-inventory-storage-error", handleStorageError)
    return () =>
      window.removeEventListener(
        "smart-inventory-storage-error",
        handleStorageError,
      )
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches)
    setSystemDark(media.matches)
    media.addEventListener?.("change", handleChange)
    return () => media.removeEventListener?.("change", handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    document.documentElement.style.colorScheme = isDark ? "dark" : "light"
    return () => {
      document.documentElement.classList.remove("dark")
      document.documentElement.style.colorScheme = ""
    }
  }, [isDark])

  useEffect(() => {
    if (!mascotEvent) return
    const timer = window.setTimeout(
      () => setMascotEvent(null),
      mascotEvent.state === "shortage" ? 8000 : 5600,
    )
    return () => window.clearTimeout(timer)
  }, [mascotEvent])

  useEffect(() => {
    if (!dispatchScreen) return
    let active = true
    setQrFailed(false)
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(whatsappUrl, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0F172A", light: "#FFFFFF" },
        }),
      )
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch(() => {
        if (active) {
          setQrDataUrl("")
          setQrFailed(true)
        }
      })
    return () => {
      active = false
    }
  }, [dispatchScreen, whatsappUrl])

  const openAuditScreen = () => {
    setAuditScreen(auditData.pending.length > 0 ? "incomplete" : "review")
    navigator.vibrate?.(30)
  }

  const cycleTheme = () => {
    const next =
      themePreference === "system"
        ? "light"
        : themePreference === "light"
          ? "dark"
          : "system"
    setThemePreference(next)
    persistStorageValue("smart-inventory-theme", next)
  }

  const focusProduct = (product: Item) => {
    const categoryIndex = categories.findIndex(
      (category) => category.value === product.category_id,
    )
    if (categoryIndex >= 0) setActiveCategory(categoryIndex)
    setSelectedId(product.id)
    setAuditScreen("closed")
    window.setTimeout(() => setWeightFlash(true), 80)
    window.setTimeout(() => setWeightFlash(false), 500)
  }

  const sendReport = () => {
    const createdAt = Date.now()
    const timestamp = new Date(createdAt).toISOString()
    const record: AuditRecord = {
      id: createEntityId(),
      created_at: timestamp,
      updated_at: timestamp,
      created_at_ms: createdAt,
      shift: `${shiftInfo.label} · ${shiftInfo.branch} · ${activeLocation === "butcher" ? "الملحمة" : "المطعم"
        }`,
      completed: summaryData.completed,
      total: configuredProducts.length,
      book: summaryData.book,
      actual: summaryData.actual,
      allowance: summaryData.allowance,
      shortage: summaryData.shortage,
      delivery: "queued",
      reportText,
      shortageItems: auditData.shortage.map(({ product, weight }) => {
        return {
          item_id: product.id,
          name: product.name_ar,
          amount: (weight ?? 0) - product.opening_quantity,
          unit: unitName(product),
        }
      }),
      items: configuredProducts.map((product) => {
        const movement =
          stockMovements[product.id] ??
          emptyMovement(product.opening_quantity, product.id)
        const actual = weights[product.id] ?? null
        return {
          item_id: product.id,
          name: product.name_ar,
          category_id: product.category_id,
          category:
            categoryCatalog.find(
              (category) => category.id === product.category_id,
            )?.name_ar ?? "المخزون",
          unit: unitName(product),
          opening: movement.opening,
          incoming: movement.incoming,
          outgoing: movement.outgoing,
          expected: product.opening_quantity,
          actual,
          difference:
            actual === null ? null : actual - product.opening_quantity,
          notes: movement.notes,
        }
      }),
      composite_consumption: configuredProducts.flatMap((product) => {
        if (!product.is_composite) return []
        const parent = [...stockLedger]
          .reverse()
          .find(
            (movement) =>
              movement.type === "count" &&
              movement.item_id === product.id &&
              movement.reference_id ===
              `current-count:${activeLocation}:${product.id}`,
          )
        if (!parent) return []
        return stockLedger
          .filter(
            (movement) =>
              movement.type === "auto_deduct" &&
              movement.parent_movement_id === parent.id,
          )
          .map((movement) => ({
            parent_movement_id: parent.id,
            composite_item_id: product.id,
            composite_name: product.name_ar,
            component_item_id: movement.item_id,
            component_name:
              productCatalog.find((item) => item.id === movement.item_id)
                ?.name_ar ?? "مكون",
            quantity: Math.abs(movement.quantity),
            unit: movement.unit,
            negative_stock: (weights[movement.item_id] ?? 0) < 0,
          }))
      }),
    }
    const nextHistory = [record, ...auditHistory].slice(0, 100)
    setAuditHistory(nextHistory)
    persistStorageValue(
      "smart-inventory-audit-history",
      JSON.stringify(nextHistory),
    )
    setAuditScreen("closed")
    setPdfRecord(record)
  }

  const openCombinedLocationsReport = () => {
    const createdAt = Date.now()
    const timestamp = new Date(createdAt).toISOString()
    const locations: InventoryLocation[] = ["butcher", "restaurant"]
    const items = locations.flatMap((location) =>
      productCatalog
        .filter(
          (product) =>
            product.active !== false &&
            (location === "restaurant" || !product.is_composite),
        )
        .map((product) => {
          const actual = locationWeights[location][product.id] ?? null
          return {
            item_id: product.id,
            name: `${product.name_ar} · ${location === "butcher" ? "الملحمة" : "المطعم"
              }`,
            category_id: product.category_id,
            category: `${categoryCatalog.find(
              (category) => category.id === product.category_id,
            )?.name_ar ?? "المخزون"
              } · ${location === "butcher" ? "الملحمة" : "المطعم"}`,
            unit: unitName(product),
            opening: product.opening_quantity,
            incoming: 0,
            outgoing: 0,
            expected: product.opening_quantity,
            actual,
            difference:
              actual === null ? null : actual - product.opening_quantity,
            notes: "",
          }
        }),
    )
    const actualTotal = items.reduce((sum, item) => sum + (item.actual ?? 0), 0)
    const expectedTotal = items.reduce((sum, item) => sum + item.expected, 0)
    const reportLines = [
      "*تقرير المخزون الموحد*",
      `التاريخ: ${currentDateLabel}`,
      "",
      ...locations.flatMap((location) => [
        `*${location === "butcher" ? "مخزون الملحمة" : "مخزون المطعم"}*`,
        ...items
          .filter((item) =>
            item.name.endsWith(location === "butcher" ? "الملحمة" : "المطعم"),
          )
          .map((item) => `• ${item.name}: ${item.actual ?? "—"} ${item.unit}`),
      ]),
      "",
      `التحويلات: ${transfers.length}`,
      `فروقات الاستلام: ${transfers.filter((transfer) => transfer.status === "Discrepancy").length
      }`,
    ]
    const record: AuditRecord = {
      id: createEntityId(),
      created_at: timestamp,
      updated_at: timestamp,
      created_at_ms: createdAt,
      shift: "تقرير المالك · الملحمة والمطعم",
      completed: items.filter((item) => item.actual !== null).length,
      total: items.length,
      book: expectedTotal,
      actual: actualTotal,
      allowance: 0,
      shortage: items.reduce(
        (sum, item) => sum + Math.min(0, item.difference ?? 0),
        0,
      ),
      delivery: "queued",
      reportText: reportLines.join("\n"),
      shortageItems: items
        .filter((item) => (item.difference ?? 0) < 0)
        .map((item) => ({
          item_id: item.item_id,
          name: item.name,
          amount: item.difference ?? 0,
          unit: item.unit,
        })),
      items,
    }
    setPdfRecord(record)
  }

  const markPdfDelivered = (recordId: string) => {
    const nextHistory = auditHistory.map((record) =>
      record.id === recordId
        ? { ...record, delivery: "sent" as const }
        : record,
    )
    setAuditHistory(nextHistory)
    persistStorageValue(
      "smart-inventory-audit-history",
      JSON.stringify(nextHistory),
    )
    setMascotEvent({
      state: "whatsapp",
      message: "تم تسليم التقرير لتطبيق المشاركة بنجاح. يعطيكم ألف عافية.",
      id: Date.now(),
    })
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(effectiveReportText)
      setReportCopied(true)
      window.setTimeout(() => setReportCopied(false), 2200)
    } catch {
      const element = document.createElement("textarea")
      element.value = effectiveReportText
      document.body.appendChild(element)
      element.select()
      document.execCommand("copy")
      element.remove()
      setReportCopied(true)
    }
  }

  const shareReport = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "تقرير الجرد اليومي",
          text: effectiveReportText,
        })
        markReportDelivered()
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        await copyReport()
      }
      return
    }
    await copyReport()
  }

  const markReportDelivered = () => {
    const nextHistory = auditHistory.map((record) =>
      record.reportText === effectiveReportText
        ? { ...record, delivery: "sent" as const }
        : record,
    )
    setAuditHistory(nextHistory)
    persistStorageValue(
      "smart-inventory-audit-history",
      JSON.stringify(nextHistory),
    )
    setMascotEvent({
      state: "whatsapp",
      message: "تم فتح التقرير في واتساب وتسليمه لمسار المشاركة بنجاح.",
      id: Date.now(),
    })
  }

  const openOwnerPin = () => {
    setPin("")
    setPinError(false)
    setOwnerScreen("pin")
    navigator.vibrate?.(25)
  }

  const enterPinDigit = (digit: string) => {
    if (pin.length >= 4) return
    const nextPin = `${pin}${digit}`
    setPin(nextPin)
    setPinError(false)
    navigator.vibrate?.(20)
    if (nextPin.length === 4) {
      window.setTimeout(() => {
        if (nextPin === ownerPin) {
          setDraftConfig(structuredClone(productConfig))
          setResetConfirm(false)
          setOwnerScreen("config")
          setPin("")
        } else {
          setPinError(true)
          setPin("")
          navigator.vibrate?.([60, 40, 60])
        }
      }, 180)
    }
  }

  const updateDraftConfig = (
    id: string,
    field: "opening_quantity" | "shrinkage_percent",
    delta: number,
  ) => {
    setDraftConfig((current) => {
      const product = configuredProducts.find((entry) => entry.id === id)
      const item = current[id] ?? {
        opening_quantity: product?.opening_quantity ?? 0,
        shrinkage_percent: product?.shrinkage_percent ?? 0,
        minimum_stock_alert: product?.minimum_stock_alert ?? 0,
        cost_per_unit: product?.cost_per_unit ?? 0,
      }
      const maximum = field === "opening_quantity" ? 100000 : 20
      const nextValue = Math.min(
        maximum,
        Math.max(0, Number((item[field] + delta).toFixed(2))),
      )
      return { ...current, [id]: { ...item, [field]: nextValue } }
    })
    navigator.vibrate?.(20)
  }

  const saveOwnerConfig = () => {
    setProductConfig(draftConfig)
    persistStorageValue("smart-inventory-config", JSON.stringify(draftConfig))
    setOwnerScreen("closed")
    navigator.vibrate?.(35)
  }

  const openPhoneEditor = () => {
    setDraftPhone(ownerPhone.replace(/\D/g, ""))
    setOwnerScreen("phone")
  }

  const saveOwnerPhone = () => {
    if (draftPhone.length < 10) return
    setOwnerPhone(draftPhone)
    persistStorageValue("smart-inventory-owner-phone", draftPhone)
    setOwnerScreen("config")
  }

  const saveOwnerPin = (nextPin: string) => {
    setOwnerPin(nextPin)
    persistStorageValue("smart-inventory-owner-pin", nextPin)
    setOwnerScreen("config")
    navigator.vibrate?.(40)
  }

  const saveRolePins = async (nextPins: RolePins) => {
    const saved = await inventoryDataService.setRolePins(nextPins)
    setRolePins(saved)
    setOwnerScreen("config")
    navigator.vibrate?.(40)
  }

  const openProductManager = () => {
    setProductConfig(draftConfig)
    persistStorageValue("smart-inventory-config", JSON.stringify(draftConfig))
    setOwnerScreen("products")
  }

  const persistInventoryBundle = async (
    catalog: Item[],
    config: ProductConfig,
    nextWeights: Record<string, number | null>,
    movements: Record<string, InventoryFlow>,
    recipes?: RecipeComponent[],
  ) => {
    const nextLocationWeights = {
      ...locationWeights,
      [activeLocation]: nextWeights,
    }
    try {
      await inventoryDataService.replaceRawValues({
        "smart-inventory-products": JSON.stringify(catalog),
        "smart-inventory-config": JSON.stringify(config),
        "smart-inventory-weights": JSON.stringify(nextWeights),
        "smart-inventory-movements": JSON.stringify(movements),
        "smart-inventory-location-weights": JSON.stringify(nextLocationWeights),
        ...(recipes
          ? { "smart-inventory-recipe-components": JSON.stringify(recipes) }
          : {}),
      })
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("smart-inventory-storage-error", { detail: error }),
      )
      throw error
    }
  }

  const saveCatalogProduct = async (
    product: Item,
    components: RecipeComponent[],
  ) => {
    const normalized = {
      ...product,
      active: product.active !== false,
      updated_at: entityTimestamp(),
    }
    const exists = productCatalog.some((item) => item.id === product.id)
    const nextCatalog = exists
      ? productCatalog.map((item) =>
        item.id === product.id ? normalized : item,
      )
      : [...productCatalog, normalized]
    const nextConfig = {
      ...productConfig,
      [product.id]: {
        opening_quantity: product.opening_quantity,
        shrinkage_percent: product.shrinkage_percent,
        minimum_stock_alert: product.minimum_stock_alert,
        cost_per_unit: product.cost_per_unit,
      },
    }
    let nextWeights = weights
    let nextMovements = stockMovements
    if (!exists) {
      nextWeights = { ...weights, [product.id]: null }
      nextMovements = {
        ...stockMovements,
        [product.id]: emptyMovement(product.opening_quantity, product.id),
      }
    }
    const nextRecipes = [
      ...recipeComponents.filter(
        (component) => component.composite_item_id !== product.id,
      ),
      ...(normalized.is_composite ? components : []),
    ]

    await persistInventoryBundle(
      nextCatalog,
      nextConfig,
      nextWeights,
      nextMovements,
      nextRecipes,
    )
    setProductCatalog(nextCatalog)
    setProductConfig(nextConfig)
    setDraftConfig(nextConfig)
    setWeights(nextWeights)
    setLocationWeights((current) => ({
      ...current,
      [activeLocation]: nextWeights,
    }))
    setInventoryFlows(nextMovements)
    setRecipeComponents(nextRecipes)

    if (!exists) {
      if (configuredProducts.length === 0) {
        setSelectedId(product.id)
        const categoryIndex = categories.findIndex(
          (category) => category.value === product.category_id,
        )
        if (categoryIndex >= 0) setActiveCategory(categoryIndex)
      }
    }
    navigator.vibrate?.(35)
  }

  const importCatalogProducts = async (plan: ProductImportPlanRow[]) => {
    const nextCatalog = [...productCatalog]
    const nextConfig = { ...productConfig }
    const nextWeights = { ...weights }
    const nextMovements = { ...stockMovements }

    plan.forEach((row) => {
      const existingIndex =
        row.existingId === null
          ? -1
          : nextCatalog.findIndex((product) => product.id === row.existingId)
      const existing =
        existingIndex >= 0 ? nextCatalog[existingIndex] : undefined
      const id = existing?.id ?? createEntityId()
      const movement =
        nextMovements[id] ??
        emptyMovement(existing?.opening_quantity ?? row.opening ?? 0, id)
      const nextMovement: InventoryFlow = {
        ...movement,
        opening: row.opening ?? movement.opening,
        incoming: row.incoming ?? movement.incoming,
        outgoing: row.outgoing ?? movement.outgoing,
        notes: row.notes ?? movement.notes,
        updated_at: entityTimestamp(),
      }
      const timestamp = entityTimestamp()
      const category =
        categoryCatalog.find((entry) => entry.id === row.category_id) ??
        categoryCatalog[0]
      const isComposite = existing?.is_composite ?? false
      const nextProduct: Item = {
        id,
        active: true,
        is_composite: isComposite,
        category_id: row.category_id,
        name_ar: existing?.name_ar ?? row.name_ar,
        name_en: row.name_en || existing?.name_en || "",
        unit: isComposite ? "piece" : row.unit,
        unit_label: isComposite ? "حبة" : row.unit_label,
        package_size: isComposite ? 1 : row.package_size,
        opening_quantity: expectedBalance(nextMovement),
        minimum_stock_alert:
          row.minimum_stock_alert ?? existing?.minimum_stock_alert ?? 0,
        cost_per_unit: row.cost_per_unit ?? existing?.cost_per_unit ?? 0,
        shrinkage_percent:
          nextConfig[id]?.shrinkage_percent ?? existing?.shrinkage_percent ?? 0,
        initial_quantity: row.actual,
        image_url:
          existing?.image_url ??
          (category ? defaultItemImage(category) : logoMark),
        created_at: existing?.created_at ?? timestamp,
        updated_at: timestamp,
      }

      if (existingIndex >= 0) nextCatalog[existingIndex] = nextProduct
      else nextCatalog.push(nextProduct)
      nextMovements[id] = nextMovement
      nextWeights[id] =
        row.actual ??
        (Object.prototype.hasOwnProperty.call(nextWeights, id)
          ? (nextWeights[id] ?? null)
          : null)
      nextConfig[id] = {
        opening_quantity: nextProduct.opening_quantity,
        shrinkage_percent: nextProduct.shrinkage_percent,
        minimum_stock_alert: nextProduct.minimum_stock_alert,
        cost_per_unit: nextProduct.cost_per_unit,
      }
    })

    await inventoryDataService.replaceRawValues({
      "smart-inventory-products": JSON.stringify(nextCatalog),
      "smart-inventory-config": JSON.stringify(nextConfig),
      "smart-inventory-weights": JSON.stringify(nextWeights),
      "smart-inventory-movements": JSON.stringify(nextMovements),
      "smart-inventory-location-weights": JSON.stringify({
        ...locationWeights,
        [activeLocation]: nextWeights,
      }),
    })

    setProductCatalog(nextCatalog)
    setProductConfig(nextConfig)
    setDraftConfig(nextConfig)
    setWeights(nextWeights)
    setLocationWeights((current) => ({
      ...current,
      [activeLocation]: nextWeights,
    }))
    setInventoryFlows(nextMovements)
    if (!configuredProducts.length && nextCatalog[0]) {
      setSelectedId(nextCatalog[0].id)
      setActiveCategory(0)
    }
    navigator.vibrate?.([40, 30, 60])
  }

  const toggleCatalogProduct = (id: string) => {
    const currentProduct = productCatalog.find((product) => product.id === id)
    const nextCatalog = productCatalog.map((product) =>
      product.id === id
        ? {
          ...product,
          active: product.active === false,
          updated_at: entityTimestamp(),
        }
        : product,
    )
    setProductCatalog(nextCatalog)
    persistStorageValue("smart-inventory-products", JSON.stringify(nextCatalog))
    if (currentProduct?.active === false) {
      setSelectedId(id)
      const categoryIndex = categories.findIndex(
        (category) => category.value === currentProduct.category_id,
      )
      if (categoryIndex >= 0) setActiveCategory(categoryIndex)
    }
    if (
      selectedId === id &&
      nextCatalog.find((product) => product.id === id)?.active === false
    ) {
      const nextActive = nextCatalog.find((product) => product.active !== false)
      if (nextActive) setSelectedId(nextActive.id)
    }
  }

  const deleteCatalogProduct = async (id: string) => {
    try {
      const result = await inventoryDataService.removeItemRelations(id)
      const nextCatalog = result.items
      setProductCatalog(nextCatalog)
      setRecipeComponents(result.recipes)
      setStockLedger(result.ledger)
      setLocationWeights(result.locationWeights)
      setWeights(result.locationWeights[activeLocation])
      setInventoryFlows(result.movements)
      setProductConfig(result.config)
      setDraftConfig(result.config)
      if (selectedId === id) {
        const nextActive = nextCatalog.find(
          (product) => product.active !== false,
        )
        setSelectedId(nextActive?.id ?? emptyProduct.id)
      }
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("smart-inventory-storage-error", { detail: error }),
      )
      throw error
    }
    navigator.vibrate?.(45)
  }

  const archiveAllCatalogProducts = async () => {
    const nextCatalog = productCatalog.map((product) => ({
      ...product,
      active: false,
    }))
    await inventoryDataService.setRawValue(
      "smart-inventory-products",
      JSON.stringify(nextCatalog),
    )
    setProductCatalog(nextCatalog)
    setSelectedId(emptyProduct.id)
    navigator.vibrate?.([50, 30, 50])
  }

  const deleteAllCatalogProducts = async () => {
    await inventoryDataService.clearInventoryData()
    setProductCatalog([])
    setProductConfig({})
    setDraftConfig({})
    setWeights({})
    setInventoryFlows({})
    setRecipeComponents([])
    setStockLedger([])
    setLocationWeights({ butcher: {}, restaurant: {} })
    setTransfers([])
    setTransferLines([])
    setAuditHistory([])
    setDispatchReportText("")
    setDispatchScreen(false)
    setSelectedId(emptyProduct.id)
    setLastAction(null)
    navigator.vibrate?.([70, 40, 70])
  }

  const returnToOwnerConfig = () => {
    setDraftConfig(structuredClone(productConfig))
    setOwnerScreen("config")
  }

  const startNewShift = async (nextShift: ShiftInfo) => {
    const nextMovements = Object.fromEntries(
      configuredProducts.map((product) => [
        product.id,
        emptyMovement(
          weights[product.id] ?? product.opening_quantity,
          product.id,
        ),
      ]),
    )
    const nextWeights = Object.fromEntries(
      configuredProducts.map((product) => [product.id, null]),
    )
    const nextLocationWeights = {
      ...locationWeights,
      [activeLocation]: nextWeights,
    }
    const nextLedger = stockLedger.filter(
      (movement) => movement.location !== activeLocation,
    )
    try {
      await inventoryDataService.replaceRawValues({
        "smart-inventory-movements": JSON.stringify(nextMovements),
        "smart-inventory-weights": JSON.stringify(nextWeights),
        "smart-inventory-location-weights": JSON.stringify(nextLocationWeights),
        "smart-inventory-stock-ledger": JSON.stringify(nextLedger),
        "smart-inventory-current-shift": JSON.stringify(nextShift),
      })
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("smart-inventory-storage-error", { detail: error }),
      )
      throw error
    }
    setInventoryFlows(nextMovements)
    setWeights(nextWeights)
    setLocationWeights(nextLocationWeights)
    setStockLedger(nextLedger)
    if (configuredProducts[0]) setSelectedId(configuredProducts[0].id)
    setActiveCategory(0)
    setShiftInfo(nextShift)
    setResetConfirm(false)
    setOwnerScreen("closed")
    setLastAction(null)
    navigator.vibrate?.(50)
  }

  if (deviceRole === null) {
    return (
      <RoleSetup
        ownerPin={ownerPin}
        rolePins={rolePins}
        onChoose={(role) => void chooseDeviceRole(role)}
      />
    )
  }

  if (!ownerSessionUnlocked) {
    return (
      <>
        <OwnerSessionGate
          role={deviceRole}
          accessPin={deviceRole === "owner" ? ownerPin : rolePins[deviceRole]}
          onUnlock={() => setOwnerSessionUnlocked(true)}
          onOpenDeviceConnect={() => setDeviceConnectOpen(true)}
          branchId={storeAuthService.getBranchId()}
        />
        {deviceConnectOpen && (
          <Suspense fallback={null}>
            <DeviceConnectModal
              isOpen={deviceConnectOpen}
              onClose={() => setDeviceConnectOpen(false)}
              currentRole={deviceRole}
              onRoleChange={(role) => {
                void chooseDeviceRole(role)
                setDeviceConnectOpen(false)
              }}
              ownerPin={ownerPin}
              rolePins={rolePins}
              onOpenManageRolePins={() => {
                setDeviceConnectOpen(false)
                setOwnerScreen("rolePins")
              }}
            />
          </Suspense>
        )}
      </>
    )
  }

  return (
    <main
      dir="rtl"
      className={`${isDark ? "dark" : ""
        } min-h-screen bg-[#f1f5f9] text-slate-950 transition-colors dark:bg-[#0b0f19] dark:text-slate-50`}
    >
      {livePingAlert && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 top-3 z-[120] mx-auto flex max-w-[640px] items-center justify-between gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-600 p-3.5 text-white shadow-2xl animate-bounce"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 text-[20px]">
              🟢
            </span>
            <div>
              <p className="text-[13px] font-bold">
                إشارة اختبار حية ومباشرة مستلمة من:{" "}
                {livePingAlert.role === "butcher"
                  ? "جهاز الملحمة"
                  : livePingAlert.role === "restaurant"
                    ? "جهاز المطعم"
                    : "جهاز المالك"}
                !
              </p>
              <p className="text-[11px] text-emerald-100">
                الأجهزة الثلاثة متصلة سحابياً بنجاح والمزامنة الفورية تعمل بكفاءة ✓
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLivePingAlert(null)}
            className="touch-button shrink-0 rounded-xl bg-black/20 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-black/30"
          >
            إغلاق
          </button>
        </aside>
      )}

      {deviceRole === "restaurant" &&
        transfers.some((t) => t.status === "Sent") && (
          <aside
            role="status"
            aria-live="assertive"
            className="fixed inset-x-3 top-3 z-[115] mx-auto flex max-w-[640px] items-center justify-between gap-3 rounded-2xl border-2 border-indigo-400 bg-indigo-600 p-3.5 text-white shadow-2xl animate-pulse"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 text-[20px]">
                🥩
              </span>
              <div>
                <p className="text-[13px] font-bold">
                  تحويل لحوم وارد من الملحمة! (
                  {transfers.filter((t) => t.status === "Sent").length} تحويل
                  بانتظار الاستلام)
                </p>
                <p className="text-[11px] text-indigo-100">
                  اضغط لتأكيد الاستلام وإضافته مباشرة إلى مخزون المطعم ✓
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTransferScreen("incoming")}
              className="touch-button shrink-0 rounded-xl bg-white px-4 py-2 text-[12px] font-bold text-indigo-700 shadow-md hover:bg-indigo-50"
            >
              استلام الآن
            </button>
          </aside>
        )}

      {storageWarning && (
        <div
          role="alert"
          className="fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-[720px] items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900 shadow-xl dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex items-center gap-3">
            <AlertIcon className="size-6 shrink-0" />
            <p className="text-[12px] font-bold leading-6">
              مساحة الحفظ على الجهاز ممتلئة أو غير متاحة. حرّر مساحة قبل متابعة
              التعديلات أو رفع الصور.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStorageWarning(false)}
            aria-label="إغلاق التنبيه"
            className="touch-button grid size-10 shrink-0 place-items-center rounded-xl bg-white/70 dark:bg-slate-900"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
      )}
      <MascotCompanion
        state={mascotContext.state}
        message={mascotContext.message}
      />
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col p-2 sm:p-3 min-[900px]:h-screen min-[900px]:max-h-[940px] min-[900px]:overflow-hidden xl:p-4">
        <header className="ui-surface-enter grid shrink-0 grid-cols-1 items-center gap-2 rounded-[20px] border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_32px_rgba(15,23,42,0.06)] min-[900px]:min-h-[68px] min-[900px]:grid-cols-[minmax(190px,0.9fr)_minmax(270px,350px)_minmax(300px,1.1fr)] min-[900px]:gap-2 min-[1180px]:gap-3 min-[1180px]:px-4 min-[1180px]:py-0 dark:border-slate-700 dark:bg-[#111827]">
          <section className="flex min-w-0 items-center gap-3">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-950 shadow-sm">
              <img
                onError={handleImageError}
                src={logoMark}
                alt="شعار ميزان الجرد الذكي"
                className="size-[54px] object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display truncate text-[21px] font-extrabold tracking-tight">
                نظام حركة وجرد المخزون
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {shiftInfo.label}
                </span>
                <span className="truncate text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                  {shiftInfo.branch}
                </span>
              </div>
            </div>
          </section>

          <section className="mx-auto flex h-[48px] w-full max-w-[350px] items-stretch gap-1.5 rounded-2xl bg-slate-950 p-1 text-white ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setScaleScreenOpen(true)}
              aria-label="فتح إعدادات ميزان Bluetooth"
              className="touch-button flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-right hover:bg-slate-900"
            >
              <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-slate-800 text-sky-400">
                <BluetoothIcon className="size-4" />
                <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                  {scaleStatus === "connected" && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  )}
                  <span
                    className={`relative inline-flex size-2.5 rounded-full border-2 border-slate-950 ${scaleStatus === "connected"
                      ? "bg-emerald-400"
                      : scaleStatus === "searching"
                        ? "animate-pulse bg-indigo-400"
                        : "bg-slate-500"
                      }`}
                  />
                </span>
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-400">
                  {scaleStatus === "connected"
                    ? scaleDeviceName
                    : scaleStatus === "searching"
                      ? "جاري البحث عن ميزان"
                      : "توصيل ميزان Bluetooth"}
                </p>
                <p className="text-[21px] font-bold leading-none tabular-nums text-emerald-400">
                  {scaleStatus === "connected" ? scaleWeight.toFixed(2) : "— —"}{" "}
                  <span className="text-[11px] text-slate-300">كجم</span>
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={captureScaleWeight}
              disabled={
                configuredProducts.length === 0 ||
                scaleStatus !== "connected" ||
                selected.unit !== "kg"
              }
              title={
                selected.unit !== "kg"
                  ? "الميزان متاح للأصناف المقاسة بالكيلوجرام فقط"
                  : "سحب القراءة الحالية"
              }
              className="touch-button flex min-w-[112px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2.5 text-[12px] font-bold text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none active:scale-[0.97]"
            >
              <ScaleIcon className="size-4" />
              سحب القراءة
            </button>
          </section>

          <section className="flex min-w-0 items-center justify-end gap-1.5 border-r border-slate-200 pr-2 min-[1180px]:gap-2 min-[1180px]:pr-3 dark:border-slate-700">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                <CalendarIcon className="size-4" />
                {currentDateLabel}
              </div>
              <div className="mt-1.5 flex items-end justify-between gap-2">
                <p className="text-[14px] font-bold">
                  تم جرد{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {summaryData.completed}
                  </span>{" "}
                  من {configuredProducts.length} صنف
                </p>
                <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label="فتح سجل الجرد والشفتات"
              title="سجل الجرد والشفتات"
              className="touch-button relative grid size-12 shrink-0 place-items-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400 active:scale-95 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
            >
              <HistoryIcon className="size-6" />
              {auditHistory.length > 0 && (
                <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                  {Math.min(auditHistory.length, 99)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={openOwnerPin}
              aria-label="فتح إعدادات المالك"
              className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <LockIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={
                themePreference === "system"
                  ? "الوضع حسب إعداد الجهاز، اضغط لاختيار الوضع النهاري"
                  : themePreference === "light"
                    ? "الوضع النهاري، اضغط لاختيار الوضع الليلي"
                    : "الوضع الليلي، اضغط لاتباع إعداد الجهاز"
              }
              title={
                themePreference === "system"
                  ? "مظهر الجهاز"
                  : themePreference === "light"
                    ? "الوضع النهاري"
                    : "الوضع الليلي"
              }
              className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:text-emerald-600 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-amber-300"
            >
              {themePreference === "system" ? (
                <SystemThemeIcon className="size-6" />
              ) : isDark ? (
                <SunIcon className="size-6" />
              ) : (
                <MoonIcon className="size-6" />
              )}
            </button>
          </section>
        </header>

        <section className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-[#111827]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-bold text-white">
              {deviceRole === "owner"
                ? "المالك"
                : deviceRole === "butcher"
                  ? "الملحمة"
                  : "المطعم"}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              مخزون {activeLocation === "butcher" ? "الملحمة" : "المطعم"}
            </span>
            <button
              type="button"
              onClick={() => setDeviceConnectOpen(true)}
              title="عرض حالة اتصال الأجهزة الثلاثة وتغيير دور الجهاز أو اختبار المزامنة"
              className={`touch-button flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all active:scale-95 ${isPingPulsing
                ? "border-emerald-500 bg-emerald-500 text-white ring-4 ring-emerald-300 dark:ring-emerald-700 animate-pulse"
                : onlineDevicesCount === 3
                  ? "border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/70 dark:text-teal-200"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200"
                }`}
            >
              <span className="relative flex size-2.5">
                <span
                  className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${isPingPulsing || onlineDevicesCount === 3
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                    }`}
                />
                <span
                  className={`relative inline-flex size-2.5 rounded-full ${isPingPulsing || onlineDevicesCount === 3
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                    }`}
                />
              </span>
              <span>
                {isPingPulsing
                  ? "🟢 إشارة حية مستلمة!"
                  : `مركز الأجهزة (${onlineDevicesCount}/3 متصل)`}
                {" · "}
                {storeAuthService.getBranchId()}
              </span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {deviceRole === "owner" && (
              <>
                {(["butcher", "restaurant"] as const).map((location) => (
                  <button
                    key={location}
                    type="button"
                    onClick={() => changeOwnerLocation(location)}
                    className={`touch-button min-h-10 rounded-xl px-3 text-[10px] font-bold ${activeLocation === location
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    {location === "butcher" ? "الملحمة" : "المطعم"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTransferScreen("owner")}
                  className="touch-button min-h-10 rounded-xl bg-slate-950 px-4 text-[10px] font-bold text-white dark:bg-emerald-600"
                >
                  لوحة النظام الموحدة
                </button>
              </>
            )}
            {deviceRole === "butcher" && (
              <button
                type="button"
                onClick={() => setTransferScreen("send")}
                className="touch-button min-h-10 rounded-xl bg-emerald-600 px-4 text-[11px] font-bold text-white"
              >
                إرسال إلى المطعم
              </button>
            )}
            {deviceRole === "restaurant" && (
              <button
                type="button"
                onClick={() => setTransferScreen("incoming")}
                className="touch-button relative min-h-10 rounded-xl bg-indigo-600 px-4 text-[11px] font-bold text-white"
              >
                الوارد من الملحمة
                {transfers.some((transfer) => transfer.status === "Sent") && (
                  <span className="absolute -left-1 -top-1 size-3 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
            )}
          </div>
        </section>

        <div className="mt-2 grid gap-2 sm:mt-3 sm:gap-3 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="ui-surface-enter flex flex-col rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_8px_32px_rgba(15,23,42,0.05)] min-[900px]:min-h-0 dark:border-slate-700 dark:bg-[#111827]">
            <div className="shrink-0">
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                role="tablist"
                aria-label="تصنيف المنتجات"
              >
                {categories.map(({ label, icon: Icon }, index) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === index}
                    onClick={() => changeCategory(index)}
                    className={`touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-2 text-[13px] font-bold transition ${activeCategory === index
                      ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/15 dark:border-emerald-400 dark:bg-emerald-950"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500"
                      }`}
                  >
                    <Icon
                      className={`size-5 ${activeCategory === index
                        ? "text-emerald-400"
                        : "text-slate-400"
                        }`}
                    />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inventory-product-scroll mt-3 grid grid-cols-1 gap-3 pl-1 sm:grid-cols-2 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto min-[1100px]:grid-cols-3">
              {visibleProducts.length === 0 ? (
                <div className="col-span-full grid min-h-[320px] place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="max-w-[330px] p-6">
                    <MascotVisual
                      state="idle"
                      alt="المعلم ميزان ينتظر إضافة صنف"
                      className="mx-auto size-32"
                    />
                    <h2 className="font-display mt-3 text-[20px] font-bold">
                      {categories[activeCategory]?.slug === "spices"
                        ? "قسم التوابل جاهز لأول صنف"
                        : "لا توجد أصناف نشطة"}
                    </h2>
                    <p className="mt-2 text-[13px] font-medium leading-6 text-slate-500 dark:text-slate-400">
                      {categories[activeCategory]?.slug === "spices"
                        ? "لا توجد توابل بعد. يمكن للمالك إضافة اسم التابل ووحدته وكمية الافتتاح من إدارة الأصناف."
                        : "يمكن للمالك استعادة الأصناف المؤرشفة أو إضافة منتجات جديدة من إدارة الكتالوج."}
                    </p>
                    <button
                      type="button"
                      onClick={openOwnerPin}
                      className="touch-button mt-4 min-h-14 rounded-2xl bg-slate-950 px-6 text-[13px] font-bold text-white active:scale-[0.98] dark:bg-emerald-600"
                    >
                      فتح إعدادات المالك
                    </button>
                  </div>
                </div>
              ) : (
                visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    movement={
                      stockMovements[product.id] ??
                      emptyMovement(product.opening_quantity, product.id)
                    }
                    weight={weights[product.id] ?? null}
                    autoDeductions={compositeDeductionsByItem[product.id] ?? []}
                    selected={selected.id === product.id}
                    onSelect={() => setSelectedId(product.id)}
                  />
                ))
              )}
            </div>
          </section>

          <aside className="inventory-entry-panel ui-surface-enter relative flex min-h-[540px] flex-col rounded-[20px] border border-slate-200 bg-white p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_8px_32px_rgba(15,23,42,0.05)] min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:pb-4 dark:border-slate-700 dark:bg-[#111827]">
            {configuredProducts.length === 0 && (
              <div className="absolute inset-0 z-40 grid place-items-center bg-white/95 p-6 text-center backdrop-blur-sm dark:bg-[#111827]/95">
                <div>
                  <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <GridIcon className="size-7" />
                  </span>
                  <h2 className="font-display mt-3 text-[18px] font-bold">
                    لوحة الإدخال متوقفة
                  </h2>
                  <p className="mt-2 text-[12px] font-medium leading-6 text-slate-500 dark:text-slate-400">
                    أضف أو استعد صنفاً واحداً على الأقل لبدء الجرد.
                  </p>
                </div>
              </div>
            )}
            {voiceStage !== "closed" && (
              <section
                className="absolute inset-0 z-30 flex flex-col bg-white/96 p-4 backdrop-blur-xl dark:bg-[#111827]/96"
                aria-label="إدخال الكمية بالصوت"
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img
                      onError={handleImageError}
                      src={voiceTarget.image_url}
                      alt=""
                      className="size-11 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        إدخال الكمية صوتياً
                      </p>
                      <h2 className="font-display truncate text-[15px] font-bold">
                        {voiceTarget.name_ar}
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeVoiceCapture}
                    aria-label="إغلاق الإدخال الصوتي"
                    className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <CloseIcon className="size-5" />
                  </button>
                </div>

                <div
                  className={`flex flex-1 flex-col items-center ${voiceStage === "error" || voiceStage === "unsupported"
                    ? "justify-start pt-3"
                    : "justify-center"
                    }`}
                >
                  <div
                    className={`relative grid place-items-center ${voiceStage === "error" || voiceStage === "unsupported"
                      ? "size-20"
                      : "size-44"
                      }`}
                  >
                    <div className="absolute inset-5 rounded-full bg-indigo-500/15 blur-2xl" />
                    <MascotVisual
                      state={
                        voiceStage === "parsed"
                          ? "matched"
                          : voiceStage === "error" ||
                            voiceStage === "unsupported"
                            ? "idle"
                            : "listening"
                      }
                      alt={
                        voiceStage === "parsed"
                          ? "المعلم ميزان يؤكد فهم الكمية"
                          : "المعلم ميزان يستمع للكمية"
                      }
                      className={`relative ${voiceStage === "error" || voiceStage === "unsupported"
                        ? "size-24"
                        : "size-48"
                        }`}
                    />
                  </div>

                  <h3
                    className={`font-display text-center font-bold ${voiceStage === "error" || voiceStage === "unsupported"
                      ? "mt-1 text-[17px]"
                      : "mt-2 text-[22px]"
                      }`}
                  >
                    {voiceStage === "requesting" && "اسمح باستخدام الميكروفون"}
                    {voiceStage === "listening" &&
                      (voiceTarget.unit === "piece"
                        ? "تحدث بالعدد الآن"
                        : "تحدث بالوزن الآن")}
                    {voiceStage === "processing" && "جاري تحويل الصوت إلى كمية"}
                    {voiceStage === "parsed" && "تم فهم الكمية بنجاح"}
                    {voiceStage === "unsupported" &&
                      "الصوت غير متاح على هذا الجهاز"}
                    {voiceStage === "error" && "تعذر استخدام الإدخال الصوتي"}
                  </h3>
                  <p className="mt-1 max-w-[320px] text-center text-[12px] font-medium leading-5 text-slate-500 dark:text-slate-400">
                    {voiceStage === "requesting"
                      ? "وافق على طلب الإذن الذي سيظهر في المتصفح..."
                      : voiceStage === "listening"
                        ? voiceTarget.unit === "piece"
                          ? 'قل مثلاً: "ثمانية عشر حبة"'
                          : 'قل مثلاً: "ثمانية عشر كيلو ونصف"'
                        : voiceStage === "processing"
                          ? "نحلل العبارة ونحوّلها إلى كيلوجرامات..."
                          : voiceStage === "parsed"
                            ? `سمعنا: «${voiceTranscript}»`
                            : voiceStage === "unsupported"
                              ? "استخدم Chrome على جهاز Android، أو ارجع لأزرار الإدخال اليدوي."
                              : voiceError}
                  </p>

                  {voiceStage === "error" || voiceStage === "unsupported" ? (
                    <div className="mt-3 w-full">
                      <div
                        className="flex min-h-14 items-center justify-between rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 dark:border-indigo-800 dark:bg-indigo-950/50"
                        aria-label="الكمية المدخلة يدوياً"
                      >
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          أدخل{" "}
                          {voiceTarget.unit === "piece" ? "العدد" : "الوزن"}{" "}
                          مباشرة
                        </span>
                        <strong className="text-[29px] font-bold leading-none tabular-nums text-slate-950 dark:text-white">
                          {manualVoiceWeight || "0.00"}{" "}
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {unitName(voiceTarget)}
                          </span>
                        </strong>
                      </div>
                      <div
                        className="mt-2 grid grid-cols-3 gap-1.5"
                        aria-label="لوحة إدخال الكمية"
                      >
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
                          (digit) => (
                            <button
                              key={digit}
                              type="button"
                              onClick={() => enterManualVoiceDigit(digit)}
                              className="touch-button min-h-10 rounded-xl border border-slate-200 bg-slate-50 text-[18px] font-bold text-slate-900 shadow-sm active:bg-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:active:bg-indigo-950"
                            >
                              {digit}
                            </button>
                          ),
                        )}
                        <button
                          type="button"
                          onClick={() => enterManualVoiceDigit(".")}
                          aria-label="فاصلة عشرية"
                          className="touch-button min-h-10 rounded-xl border border-slate-200 bg-slate-50 text-[20px] font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          .
                        </button>
                        <button
                          type="button"
                          onClick={() => enterManualVoiceDigit("0")}
                          className="touch-button min-h-10 rounded-xl border border-slate-200 bg-slate-50 text-[18px] font-bold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setManualVoiceWeight((current) =>
                              current.slice(0, -1),
                            )
                          }
                          aria-label="حذف الرقم الأخير"
                          className="touch-button grid min-h-10 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                        >
                          <BackspaceIcon className="size-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`mt-4 w-full rounded-2xl border px-4 py-3 text-center transition ${voiceStage === "parsed"
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60"
                        : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                        }`}
                    >
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        الكمية المستخرجة من الصوت
                      </p>
                      <strong
                        className={`mt-1 block text-[40px] font-bold leading-none tabular-nums ${voiceStage === "parsed"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-300 dark:text-slate-600"
                          }`}
                      >
                        {voiceStage === "parsed" && parsedVoiceWeight !== null
                          ? parsedVoiceWeight.toFixed(2)
                          : "— —"}{" "}
                        <span className="text-[14px] text-slate-500">
                          {unitName(voiceTarget)}
                        </span>
                      </strong>
                    </div>
                  )}

                  {voiceStage === "parsed" && (
                    <div className="mt-3 grid w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => changeVoiceMode("replace")}
                        className={`touch-button min-h-11 rounded-xl text-[12px] font-bold transition ${voiceMode === "replace"
                          ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                          : "text-slate-500 dark:text-slate-400"
                          }`}
                      >
                        استبدال الكمية الحالية
                      </button>
                      <button
                        type="button"
                        onClick={() => changeVoiceMode("add")}
                        className={`touch-button min-h-11 rounded-xl text-[12px] font-bold transition ${voiceMode === "add"
                          ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                          : "text-slate-500 dark:text-slate-400"
                          }`}
                      >
                        إضافة على الكمية
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-[1.35fr_0.8fr] gap-2">
                  {voiceStage === "parsed" ? (
                    <>
                      <button
                        type="button"
                        onClick={commitVoiceWeight}
                        className="touch-button relative min-h-16 overflow-hidden rounded-2xl bg-emerald-600 px-3 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                      >
                        <span className="voice-countdown absolute inset-x-0 bottom-0 h-1.5 origin-right bg-emerald-300" />
                        <span className="relative flex items-center justify-center gap-2">
                          <CheckIcon className="size-5" />
                          تأكيد الكمية {parsedVoiceWeight?.toFixed(2)}{" "}
                          {unitName(voiceTarget)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={runVoiceCapture}
                        className="touch-button flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-[13px] font-bold text-slate-700 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RotateIcon className="size-4" />
                        إعادة النطق
                      </button>
                    </>
                  ) : voiceStage === "error" || voiceStage === "unsupported" ? (
                    <>
                      <button
                        type="button"
                        onClick={commitManualVoiceWeight}
                        disabled={!manualVoiceWeight}
                        className="touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-40"
                      >
                        <CheckIcon className="size-5" />
                        حفظ الكمية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            voicePermissionBlocked &&
                            window.self !== window.top
                          ) {
                            window.open(
                              window.location.href,
                              "_blank",
                              "noopener,noreferrer",
                            )
                            return
                          }
                          void runVoiceCapture()
                        }}
                        className="touch-button flex min-h-14 items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white text-[11px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RotateIcon className="size-4" />
                        {voicePermissionBlocked && window.self !== window.top
                          ? "فتح مستقلاً"
                          : "طلب الإذن"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={closeVoiceCapture}
                      className="touch-button col-span-2 min-h-14 rounded-2xl border border-slate-300 bg-white text-[13px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    >
                      إلغاء والعودة للإدخال اليدوي
                    </button>
                  )}
                </div>
              </section>
            )}

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-2.5 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-950/60 dark:ring-emerald-800">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  onError={handleImageError}
                  src={selected.image_url}
                  alt=""
                  className="size-12 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    يتم إدخال الكمية لهذا الصنف
                  </p>
                  <h2 className="font-display mt-0.5 truncate text-[15px] font-bold">
                    {selected.name_ar}
                  </h2>
                </div>
              </div>
              <CheckIcon className="size-5 shrink-0 text-emerald-600" />
            </div>

            <section className="mt-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-2 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                    حركة الصنف اليوم
                  </p>
                  <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                    أول اليوم + الوارد − الصادر = المتوقع
                  </p>
                </div>
                <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                  وحدة الجرد: {unitName(selected)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {([
                  ["opening", "أول اليوم"],
                  ["incoming", "الوارد"],
                  ["outgoing", "الصادر"],
                ] as const).map(([field, label]) => (
                  <div
                    key={field}
                    className="rounded-xl border border-slate-200 bg-white p-1.5 text-center dark:border-slate-700 dark:bg-slate-800"
                  >
                    <p className="text-[9px] font-bold text-slate-500">
                      {label}
                    </p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={selected.unit === "piece" ? "1" : "0.1"}
                      value={selectedMovement[field]}
                      onChange={(event) =>
                        updateSelectedMovement(
                          field,
                          Number(event.target.value) || 0,
                        )
                      }
                      aria-label={label}
                      className="mt-0.5 block h-7 w-full rounded-md bg-transparent text-center text-[15px] font-bold tabular-nums outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950"
                    />
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedMovement(
                            field,
                            selectedMovement[field] - 1,
                          )
                        }
                        className="touch-button min-h-8 rounded-lg bg-slate-100 text-[16px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedMovement(
                            field,
                            selectedMovement[field] + 1,
                          )
                        }
                        className="touch-button min-h-8 rounded-lg bg-indigo-100 text-[16px] font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="mt-1.5 block">
                <span className="sr-only">ملاحظات الصنف</span>
                <input
                  value={selectedMovement.notes}
                  onChange={(event) => updateSelectedNotes(event.target.value)}
                  placeholder="ملاحظات الصنف (اختياري)"
                  className="min-h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </section>

            {selectedIsRecipeComponent && (
              <div className="mt-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-[10px] font-bold leading-5 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
                هذا الصنف يدخل في وصفة مركبة، لكن يظل صنفاً مستقلاً: يمكنك جرده أو
                تسجيل الهدر والاستهلاك اليدوي له في أي وقت، وتُضاف خصومات الوصفة
                تلقائياً عند تسجيل المنتج المركب.
              </div>
            )}

            <div
              className={`my-2.5 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-2.5 text-white ring-1 ring-white/10 transition ${weightFlash
                ? "ui-number-pop scale-[1.015] ring-2 ring-emerald-400"
                : ""
                }`}
            >
              <span className="text-[12px] font-semibold text-slate-400">
                الرصيد الفعلي
              </span>
              <strong className="text-[31px] font-bold leading-none tabular-nums text-emerald-400">
                {(weights[selected.id] ?? 0).toFixed(2)}{" "}
                <span className="text-[12px] text-slate-300">
                  {unitName(selected)}
                </span>
              </strong>
            </div>

            {selected.is_composite && weights[selected.id] != null && (
              <details className="mb-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/30">
                <summary className="cursor-pointer text-[11px] font-bold text-orange-800 dark:text-orange-200">
                  المكونات المخصومة تلقائياً
                </summary>
                <div className="mt-2 space-y-1.5">
                  {(compositeDeductionsByItem[selected.id] ?? []).map(
                    (deduction) => (
                      <div
                        key={deduction.movementId}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[10px] dark:bg-slate-900"
                      >
                        <span className="font-bold">{deduction.name}</span>
                        <span
                          className={
                            deduction.negativeStock
                              ? "font-bold text-red-600"
                              : "font-semibold text-slate-500"
                          }
                        >
                          −{deduction.quantity} {baseUnitName(deduction.unit)}
                          {deduction.negativeStock ? " · رصيد سالب" : ""}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void applyProductCount(
                      selected.id,
                      null,
                      "حذف إدخال المنتج المركب",
                    )
                  }
                  className="touch-button mt-2 min-h-10 w-full rounded-xl border border-red-200 bg-white text-[10px] font-bold text-red-600 dark:border-red-900 dark:bg-red-950"
                >
                  حذف الإدخال وعكس الخصومات
                </button>
              </details>
            )}

            {compositeWarning && (
              <div
                role="alert"
                className="mb-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-bold leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                {compositeWarning}
              </div>
            )}

            <button
              type="button"
              onClick={startVoiceCapture}
              className="touch-button relative flex min-h-14 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-indigo-600 px-4 text-[14px] font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400 active:scale-[0.98]"
            >
              <span className="relative grid size-9 place-items-center rounded-full bg-white/15">
                <MicIcon className="size-5" />
              </span>
              <span className="relative">
                اضغط وتحدث {selected.unit === "piece" ? "بالعدد" : "بالوزن"}
              </span>
            </button>

            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {quickCountPresets.map(([value, unit, amount]) => (
                <button
                  key={`${value}${unit}`}
                  type="button"
                  onClick={() => addWeight(Number(amount), `${value} ${unit}`)}
                  className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[19px] font-bold text-slate-950 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-emerald-500 dark:hover:bg-emerald-950"
                >
                  {value}{" "}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {unit}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  addWeight(
                    countCorrection.amount,
                    `تصحيح ${countCorrection.label}`,
                  )
                }
                className="touch-button flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-[12px] font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.97] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <UndoIcon className="size-4" />
                {countCorrection.label} · تصحيح
              </button>
              <button
                type="button"
                onClick={() => setProductWeight(0, "تصفير الصنف")}
                className="touch-button flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 active:scale-[0.97] dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                <RotateIcon className="size-4" />
                تصفير الصنف
              </button>
              <button
                type="button"
                onClick={() => setWasteOpen(true)}
                className="touch-button flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-[12px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-35 active:scale-[0.97] dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
              >
                <AlertIcon className="size-4" />
                تسجيل هدر
              </button>
            </div>

            {lastAction && (
              <button
                type="button"
                onClick={undoLast}
                className="touch-button mt-2 flex min-h-10 items-center justify-between rounded-xl bg-slate-100 px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                <span>آخر إجراء: {lastAction.label}</span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <UndoIcon className="size-4" />
                  تراجع
                </span>
              </button>
            )}

            <section className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[14px] font-bold">
                  ملخص الجرد اليومي
                </h2>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300">
                  محفوظ تلقائياً
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <SummaryMetric
                  label="رصيد أول اليوم"
                  value={formatQuantitySummary("opening")}
                  unit=""
                />
                <SummaryMetric
                  label="إجمالي الوارد"
                  value={formatQuantitySummary("incoming")}
                  unit=""
                />
                <SummaryMetric
                  label="إجمالي الصادر"
                  value={formatQuantitySummary("outgoing")}
                  unit=""
                />
                <SummaryMetric
                  label="الرصيد المتوقع"
                  value={formatQuantitySummary("expected")}
                  unit=""
                />
                <SummaryMetric
                  label="صافي الفرق"
                  value={formatQuantitySummary("difference")}
                  unit=""
                  danger={
                    quantitySummary.kg.difference < 0 ||
                    quantitySummary.piece.difference < 0
                  }
                />
              </div>
            </section>

            <button
              type="button"
              onClick={openAuditScreen}
              className="touch-button z-10 mt-3 flex min-h-14 w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#16a34a] px-4 text-[14px] font-bold text-white shadow-[0_10px_30px_rgba(22,163,74,0.38)] hover:bg-[#15803d] active:scale-[0.98] min-[900px]:sticky min-[900px]:bottom-0"
            >
              <SendIcon className="size-5" />
              اعتماد الجرد ومعاينة تقرير PDF
            </button>
          </aside>
        </div>
      </div>

      {dispatchScreen && (
        <DispatchFallbackScreen
          isOnline={isOnline}
          qrDataUrl={qrDataUrl}
          qrFailed={qrFailed}
          reportText={effectiveReportText}
          reportCopied={reportCopied}
          onOpenWhatsApp={() => {
            removeStorageValue("smart-inventory-pending-report")
            markReportDelivered()
            window.open(whatsappUrl, "_blank", "noopener,noreferrer")
          }}
          onCopy={() => void copyReport()}
          onShare={() => void shareReport()}
          onClose={() => setDispatchScreen(false)}
        />
      )}

      {pdfRecord && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/90 text-white">
              <div className="text-center">
                <span className="mx-auto block size-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
                <p className="mt-3 text-[12px] font-bold">
                  جاري تحميل محرّك PDF...
                </p>
              </div>
            </div>
          }
        >
          <PdfReportScreen
            record={pdfRecord}
            whatsappPhone={ownerPhone}
            onClose={() => setPdfRecord(null)}
            onDelivered={() => markPdfDelivered(pdfRecord.id)}
          />
        </Suspense>
      )}

      {scaleScreenOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[69] grid place-items-center bg-slate-950/70 backdrop-blur-sm">
              <div className="rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
                <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />
                <p className="mt-3 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                  جاري تحميل إعدادات الميزان...
                </p>
              </div>
            </div>
          }
        >
          <ScaleConnectionScreen
            status={scaleStatus}
            deviceName={scaleDeviceName}
            weight={scaleWeight}
            lastReadAt={scaleLastReadAt}
            onStatusChange={setScaleStatus}
            onDeviceChange={(name) => {
              setScaleDeviceName(name)
              persistStorageValue("smart-inventory-scale-name", name)
            }}
            onWeightChange={(weight) => {
              setScaleWeight(weight)
              setScaleLastReadAt(Date.now())
            }}
            onClose={() => setScaleScreenOpen(false)}
          />
        </Suspense>
      )}

      {deviceConnectOpen && (
        <Suspense fallback={null}>
          <DeviceConnectModal
            isOpen={deviceConnectOpen}
            onClose={() => setDeviceConnectOpen(false)}
            currentRole={deviceRole}
            onRoleChange={(role) => void chooseDeviceRole(role)}
            ownerPin={ownerPin}
            rolePins={rolePins}
            onOpenManageRolePins={() => {
              setDeviceConnectOpen(false)
              setOwnerScreen("rolePins")
            }}
          />
        </Suspense>
      )}

      {historyOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-950/70 backdrop-blur-sm">
              <div className="rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
                <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
                <p className="mt-3 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                  جاري تحميل سجل الجرد...
                </p>
              </div>
            </div>
          }
        >
          <AuditHistoryScreen
            records={auditHistory}
            onClose={() => setHistoryOpen(false)}
            onOpenReport={(record) => {
              setHistoryOpen(false)
              setPdfRecord(record)
            }}
          />
        </Suspense>
      )}

      {transferScreen !== "closed" && (
        <div className="fixed inset-0 z-[68] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
          <TransferCenter
            mode={transferScreen}
            items={productCatalog}
            categories={categoryCatalog}
            transfers={transfers}
            transferLines={transferLines}
            locationWeights={locationWeights}
            ledger={stockLedger}
            onSend={sendTransferToRestaurant}
            onReceive={receiveButcherTransfer}
            onCancel={cancelSentTransfer}
            onCombinedReport={openCombinedLocationsReport}
            onClose={() => setTransferScreen("closed")}
          />
        </div>
      )}

      {wasteOpen && (
        <div className="fixed inset-0 z-[69] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <WasteDialog
            item={selected}
            onSave={recordSelectedWaste}
            onClose={() => setWasteOpen(false)}
          />
        </div>
      )}

      {ownerScreen !== "closed" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
          {ownerScreen === "pin" ? (
            <OwnerPinGate
              pin={pin}
              error={pinError}
              isDefaultPin={ownerPin === "0000"}
              onDigit={enterPinDigit}
              onDelete={() => {
                setPin((current) => current.slice(0, -1))
                setPinError(false)
              }}
              onClose={() => setOwnerScreen("closed")}
            />
          ) : ownerScreen === "phone" ? (
            <PhoneKeypad
              phone={draftPhone}
              onDigit={(digit) =>
                setDraftPhone((current) =>
                  current.length < 13 ? `${current}${digit}` : current,
                )
              }
              onDelete={() => setDraftPhone((current) => current.slice(0, -1))}
              onSave={saveOwnerPhone}
              onBack={() => setOwnerScreen("config")}
            />
          ) : ownerScreen === "products" ? (
            <ProductManager
              products={productCatalog.map((product) => ({
                ...product,
                opening_quantity:
                  productConfig[product.id]?.opening_quantity ??
                  product.opening_quantity,
                shrinkage_percent:
                  productConfig[product.id]?.shrinkage_percent ??
                  product.shrinkage_percent,
                minimum_stock_alert:
                  productConfig[product.id]?.minimum_stock_alert ??
                  product.minimum_stock_alert,
                cost_per_unit:
                  productConfig[product.id]?.cost_per_unit ??
                  product.cost_per_unit,
              }))}
              categories={categoryCatalog}
              weights={weights}
              movements={stockMovements}
              recipeComponents={recipeComponents}
              onSave={saveCatalogProduct}
              onToggleActive={toggleCatalogProduct}
              onDelete={deleteCatalogProduct}
              onArchiveAll={archiveAllCatalogProducts}
              onDeleteAll={deleteAllCatalogProducts}
              onImport={importCatalogProducts}
              onBack={returnToOwnerConfig}
            />
          ) : ownerScreen === "changePin" ? (
            <ChangeOwnerPin
              currentPin={ownerPin}
              onSave={saveOwnerPin}
              onBack={() => setOwnerScreen("config")}
            />
          ) : ownerScreen === "rolePins" ? (
            <RolePinsEditor
              rolePins={rolePins}
              onSave={saveRolePins}
              onBack={() => setOwnerScreen("config")}
            />
          ) : ownerScreen === "analytics" ? (
            <Suspense
              fallback={
                <div className="rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
                  <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
                  <p className="mt-3 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                    جاري تحميل تحليلات المالك...
                  </p>
                </div>
              }
            >
              <OwnerAnalyticsScreen
                records={auditHistory}
                onClose={() => setOwnerScreen("config")}
                onOpenHistory={() => {
                  setOwnerScreen("closed")
                  setHistoryOpen(true)
                }}
              />
            </Suspense>
          ) : ownerScreen === "shiftSetup" ? (
            <Suspense
              fallback={
                <div className="rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
                  <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500" />
                  <p className="mt-3 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                    جاري تجهيز الشفت الجديد...
                  </p>
                </div>
              }
            >
              <ShiftSetupScreen
                currentShift={shiftInfo}
                completed={summaryData.completed}
                total={configuredProducts.length}
                onStart={startNewShift}
                onClose={() => setOwnerScreen("config")}
              />
            </Suspense>
          ) : ownerScreen === "backup" ? (
            <Suspense
              fallback={
                <div className="rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
                  <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                  <p className="mt-3 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                    جاري تجهيز إدارة البيانات...
                  </p>
                </div>
              }
            >
              <DataBackupScreen onClose={() => setOwnerScreen("config")} />
            </Suspense>
          ) : (
            <OwnerConfigurator
              products={configuredProducts}
              draftConfig={draftConfig}
              ownerPhone={ownerPhone}
              deviceRole={deviceRole}
              resetConfirm={resetConfirm}
              onAdjust={updateDraftConfig}
              onEditPhone={openPhoneEditor}
              onChangePin={() => setOwnerScreen("changePin")}
              onManageRolePins={() => setOwnerScreen("rolePins")}
              onManageProducts={openProductManager}
              onOpenAnalytics={() => setOwnerScreen("analytics")}
              onOpenBackup={() => setOwnerScreen("backup")}
              onOpenDeviceConnect={() => {
                setOwnerScreen("closed")
                setDeviceConnectOpen(true)
              }}
              onRoleChange={(role) => {
                void chooseDeviceRole(role)
                setOwnerScreen("closed")
              }}
              onResetRequest={() => setResetConfirm(true)}
              onResetCancel={() => setResetConfirm(false)}
              onResetConfirm={() => {
                setResetConfirm(false)
                setOwnerScreen("shiftSetup")
              }}
              onSave={saveOwnerConfig}
              onClose={() => setOwnerScreen("closed")}
            />
          )}
        </div>
      )}

      {auditScreen !== "closed" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-5 backdrop-blur-sm">
          {auditScreen === "incomplete" ? (
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="incomplete-title"
              className="flex max-h-[calc(100dvh-40px)] w-full max-w-[610px] flex-col overflow-hidden rounded-[24px] border border-amber-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)] dark:border-amber-900 dark:bg-[#111827]"
            >
              <div className="shrink-0 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <MascotVisual
                    state="idle"
                    alt="المعلم ميزان يراجع اكتمال الجرد"
                    className="size-20 shrink-0"
                  />
                  <div>
                    <p className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
                      فحص اكتمال الجرد
                    </p>
                    <h2
                      id="incomplete-title"
                      className="font-display mt-1 text-[24px] font-extrabold"
                    >
                      يوجد {auditData.pending.length} صنف لم يتم جرده بعد
                    </h2>
                    <p className="mt-1.5 text-[14px] font-medium leading-6 text-slate-500 dark:text-slate-400">
                      ننصح بوزن الأصناف المتبقية قبل اعتماد التقرير لتجنب إرسال
                      بيانات ناقصة للمالك.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditScreen("closed")}
                  aria-label="إغلاق"
                  className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>

              <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pl-1">
                {auditData.pending.map(({ product }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        onError={handleImageError}
                        src={product.image_url}
                        alt=""
                        className="size-12 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <h3 className="font-display truncate text-[15px] font-bold">
                          {product.name_ar}
                        </h3>
                        <p className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          بانتظار إدخال الكمية
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => focusProduct(product)}
                      className="touch-button min-h-11 shrink-0 rounded-xl bg-slate-950 px-4 text-[12px] font-bold text-white active:scale-[0.97] dark:bg-emerald-600"
                    >
                      وزن الصنف الآن
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-[1.35fr_1fr] sm:gap-3">
                <button
                  type="button"
                  onClick={() =>
                    auditData.pending[0] &&
                    focusProduct(auditData.pending[0].product)
                  }
                  className="touch-button min-h-16 rounded-2xl bg-amber-500 px-4 text-[14px] font-bold text-white shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                >
                  عرض الأصناف الناقصة الآن
                </button>
                <button
                  type="button"
                  onClick={() => setAuditScreen("review")}
                  className="touch-button min-h-16 rounded-2xl border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  متابعة مراجعة التقرير الحالي
                </button>
              </div>
            </section>
          ) : (
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-title"
              className="flex max-h-[calc(100dvh-16px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.38)] dark:border-slate-700 dark:bg-[#111827]"
            >
              <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <MascotVisual
                    state={
                      auditData.shortage.length > 0 ? "shortage" : "matched"
                    }
                    alt={
                      auditData.shortage.length > 0
                        ? "المعلم ميزان ينبه إلى عجز في الجرد"
                        : "المعلم ميزان يؤكد سلامة الجرد"
                    }
                    className="size-20 shrink-0"
                  />
                  <div>
                    <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                      المراجعة النهائية قبل الإرسال
                    </p>
                    <h2
                      id="audit-title"
                      className="font-display mt-1 text-[23px] font-extrabold"
                    >
                      مراجعة الجرد النهائي للمالك
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditScreen("closed")}
                  aria-label="إغلاق المراجعة"
                  className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <CloseIcon className="size-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {auditData.pending.length > 0 && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/50">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <AlertIcon className="size-5" />
                      <span className="text-[13px] font-bold">
                        التقرير الحالي يحتوي على {auditData.pending.length} صنف
                        غير موزون
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuditScreen("incomplete")}
                      className="touch-button min-h-10 rounded-xl bg-amber-100 px-3 text-[11px] font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                    >
                      مراجعة النواقص
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                  <AuditCountCard
                    label="الأصناف المطابقة"
                    count={auditData.matched.length}
                    tone="green"
                  />
                  <AuditCountCard
                    label="بها زيادة"
                    count={auditData.tolerance.length}
                    tone="amber"
                  />
                  <AuditCountCard
                    label="بها عجز"
                    count={auditData.shortage.length}
                    tone="red"
                  />
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-[17px] font-bold">
                        الأصناف التي تحتاج انتباهك
                      </h3>
                      <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                        الفرق = الرصيد الفعلي − الرصيد المتوقع
                      </p>
                    </div>
                    <span className="rounded-full bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                      {auditData.shortage.length} صنف
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {auditData.shortage.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-950/50">
                        <CheckIcon className="mx-auto size-7 text-emerald-600" />
                        <p className="mt-2 text-[14px] font-bold text-emerald-800 dark:text-emerald-200">
                          لا يوجد عجز في الأصناف المجرودة
                        </p>
                      </div>
                    ) : (
                      auditData.shortage.map(({ product, weight }) => {
                        const allowance =
                          product.opening_quantity *
                          (product.shrinkage_percent / 100)
                        const shortage =
                          (weight ?? 0) - (product.opening_quantity - allowance)
                        return (
                          <div
                            key={product.id}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                onError={handleImageError}
                                src={product.image_url}
                                alt=""
                                className="size-14 rounded-xl object-cover"
                              />
                              <div className="min-w-0">
                                <h4 className="font-display truncate text-[15px] font-bold">
                                  {product.name_ar}
                                </h4>
                                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  المتوقع {product.opening_quantity.toFixed(2)}{" "}
                                  · الفعلي {(weight ?? 0).toFixed(2)}{" "}
                                  {unitName(product)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <strong className="text-[19px] font-bold tabular-nums text-red-600 dark:text-red-400">
                                {shortage.toFixed(2)} {unitName(product)}
                              </strong>
                              <button
                                type="button"
                                onClick={() => focusProduct(product)}
                                className="touch-button min-h-11 rounded-xl border border-red-200 bg-white px-3 text-[11px] font-bold text-red-700 active:scale-[0.97] dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                              >
                                إعادة وزن الصنف
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              <footer className="grid grid-cols-1 gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[1.5fr_0.8fr] sm:gap-3 sm:px-6 sm:py-4 dark:border-slate-700 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={sendReport}
                  className="touch-button flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-4 text-[14px] font-bold text-white shadow-lg shadow-green-600/20 active:scale-[0.98]"
                >
                  <SendIcon className="size-5" />
                  تأكيد وإنشاء تقرير PDF
                </button>
                <button
                  type="button"
                  onClick={() => setAuditScreen("closed")}
                  className="touch-button min-h-16 rounded-2xl border border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  العودة للتعديل
                </button>
              </footer>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

function OwnerPinGate({
  pin,
  error,
  isDefaultPin,
  onDigit,
  onDelete,
  onClose,
}: {
  pin: string
  error: boolean
  isDefaultPin: boolean
  onDigit: (digit: string) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-title"
      className={`w-full max-w-[450px] rounded-[26px] border bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.4)] dark:bg-[#111827] ${error ? "border-red-400" : "border-slate-200 dark:border-slate-700"
        }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <LockIcon className="size-7" />
          </span>
          <div>
            <p className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
              منطقة محمية
            </p>
            <h2
              id="pin-title"
              className="font-display mt-1 text-[23px] font-bold"
            >
              رمز دخول المالك
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <p className="mt-4 text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
        أدخل الرمز المكون من 4 أرقام دون استخدام لوحة المفاتيح
      </p>
      <div
        className="mt-4 flex justify-center gap-3"
        aria-label={`${pin.length} من 4`}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`grid size-14 place-items-center rounded-2xl border-2 transition ${index < pin.length
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
              : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              }`}
          >
            {index < pin.length && (
              <span className="size-3 rounded-full bg-indigo-600" />
            )}
          </span>
        ))}
      </div>
      <p
        className={`mt-2 min-h-5 text-center text-[12px] font-bold ${error ? "text-red-600" : "text-slate-400"
          }`}
      >
        {error
          ? "الرمز غير صحيح، حاول مرة أخرى"
          : "أدخل رمز PIN للمتابعة"}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => onDigit(digit)}
            className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[24px] font-bold tabular-nums shadow-sm hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-indigo-950"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="touch-button min-h-14 rounded-2xl text-[12px] font-bold text-slate-500 active:scale-95 dark:text-slate-400"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={() => onDigit("0")}
          className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[24px] font-bold tabular-nums shadow-sm hover:border-indigo-300 active:scale-95 dark:border-slate-600 dark:bg-slate-800"
        >
          0
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="حذف الرقم الأخير"
          className="touch-button grid min-h-14 place-items-center rounded-2xl bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <BackspaceIcon className="size-5" />
        </button>
      </div>
    </section>
  )
}

function ChangeOwnerPin({
  currentPin,
  onSave,
  onBack,
}: {
  currentPin: string
  onSave: (pin: string) => void
  onBack: () => void
}) {
  const [stage, setStage] = useState<"current" | "new" | "confirm">("current")
  const [entry, setEntry] = useState("")
  const [nextPin, setNextPin] = useState("")
  const [error, setError] = useState("")

  const enterDigit = (digit: string) => {
    if (entry.length >= 4) return
    const nextEntry = `${entry}${digit}`
    setEntry(nextEntry)
    setError("")
    navigator.vibrate?.(18)
    if (nextEntry.length !== 4) return

    window.setTimeout(() => {
      if (stage === "current") {
        if (nextEntry !== currentPin) {
          setError("رمز PIN الحالي غير صحيح")
          setEntry("")
          navigator.vibrate?.([60, 40, 60])
          return
        }
        setStage("new")
        setEntry("")
        return
      }
      if (stage === "new") {
        if (nextEntry === currentPin) {
          setError("اختر رمزاً جديداً مختلفاً عن الرمز الحالي")
          setEntry("")
          return
        }
        setNextPin(nextEntry)
        setStage("confirm")
        setEntry("")
        return
      }
      if (nextEntry !== nextPin) {
        setError("الرمزان غير متطابقين، أعد التأكيد")
        setEntry("")
        navigator.vibrate?.([60, 40, 60])
        return
      }
      onSave(nextEntry)
    }, 140)
  }

  const labels = {
    current: {
      eyebrow: "الخطوة 1 من 3",
      title: "أدخل رمز PIN الحالي",
      description: "نحتاج للتحقق من هوية المالك قبل تغيير الرمز.",
    },
    new: {
      eyebrow: "الخطوة 2 من 3",
      title: "اختر رمز PIN جديداً",
      description: "اختر أربعة أرقام يسهل عليك تذكرها ويصعب تخمينها.",
    },
    confirm: {
      eyebrow: "الخطوة 3 من 3",
      title: "أكد رمز PIN الجديد",
      description: "أدخل الرمز الجديد مرة أخرى للتأكد.",
    },
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pin-title"
      className="w-full max-w-[470px] rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <LockIcon className="size-7" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {labels[stage].eyebrow}
            </p>
            <h2
              id="change-pin-title"
              className="font-display mt-1 text-[21px] font-bold"
            >
              {labels[stage].title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="العودة"
          className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
      <p className="mt-3 text-[12px] font-medium leading-6 text-slate-500 dark:text-slate-400">
        {labels[stage].description}
      </p>

      <div className="mt-4 flex justify-center gap-3">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`grid size-14 place-items-center rounded-2xl border-2 transition ${index < entry.length
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
              : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              }`}
          >
            {index < entry.length && (
              <span className="size-3 rounded-full bg-indigo-600" />
            )}
          </span>
        ))}
      </div>
      <p className="mt-2 min-h-6 text-center text-[11px] font-bold text-red-600">
        {error}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => enterDigit(digit)}
            className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[24px] font-bold tabular-nums active:scale-95 dark:border-slate-600 dark:bg-slate-800"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={onBack}
          className="touch-button min-h-14 rounded-2xl text-[11px] font-bold text-slate-500 dark:text-slate-400"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={() => enterDigit("0")}
          className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[24px] font-bold tabular-nums active:scale-95 dark:border-slate-600 dark:bg-slate-800"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setEntry((current) => current.slice(0, -1))}
          aria-label="حذف الرقم الأخير"
          className="touch-button grid min-h-14 place-items-center rounded-2xl bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <BackspaceIcon className="size-5" />
        </button>
      </div>
    </section>
  )
}

function RolePinsEditor({
  rolePins,
  onSave,
  onBack,
}: {
  rolePins: RolePins
  onSave: (pins: RolePins) => Promise<void>
  onBack: () => void
}) {
  const [pins, setPins] = useState(rolePins)
  const [saving, setSaving] = useState(false)
  const valid =
    /^\d{4}$/.test(pins.butcher) &&
    /^\d{4}$/.test(pins.restaurant) &&
    pins.butcher !== pins.restaurant

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-pins-title"
      className="w-full max-w-[500px] rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-violet-600">
            حماية مساحات العمل
          </p>
          <h2
            id="role-pins-title"
            className="font-display mt-1 text-[22px] font-bold"
          >
            رموز دخول الملحمة والمطعم
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="العودة"
          className="touch-button grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
      <p className="mt-3 text-[11px] font-medium leading-6 text-slate-500">
        استخدم رمزين مختلفين من أربعة أرقام. سيُطلب الرمز عند كل تشغيل للتطبيق.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {([
          ["butcher", "PIN الملحمة"],
          ["restaurant", "PIN المطعم"],
        ] as const).map(([role, label]) => (
          <label key={role} className="text-[11px] font-bold">
            {label}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pins[role]}
              onChange={(event) =>
                setPins((current) => ({
                  ...current,
                  [role]: event.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              className="mt-2 min-h-16 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-[26px] font-bold tracking-[0.45em] outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        ))}
      </div>
      {!valid && (
        <p className="mt-3 text-[11px] font-bold text-red-600">
          يجب إدخال رمزين مختلفين، وكل رمز يتكون من 4 أرقام.
        </p>
      )}
      <button
        type="button"
        disabled={!valid || saving}
        onClick={() => {
          setSaving(true)
          void onSave(pins).finally(() => setSaving(false))
        }}
        className="touch-button mt-5 min-h-14 w-full rounded-2xl bg-violet-600 text-[13px] font-bold text-white disabled:bg-slate-400"
      >
        {saving ? "جاري الحفظ..." : "حفظ رموز المواقع"}
      </button>
    </section>
  )
}

function DispatchFallbackScreen({
  isOnline,
  qrDataUrl,
  qrFailed,
  reportText,
  reportCopied,
  onOpenWhatsApp,
  onCopy,
  onShare,
  onClose,
}: {
  isOnline: boolean
  qrDataUrl: string
  qrFailed: boolean
  reportText: string
  reportCopied: boolean
  onOpenWhatsApp: () => void
  onCopy: () => void
  onShare: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-title"
        className="flex h-[calc(100dvh-16px)] max-h-[720px] w-full max-w-[850px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[#111827]"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span
              className={`grid size-14 place-items-center rounded-2xl ${isOnline
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
            >
              {isOnline ? (
                <CheckIcon className="size-7" />
              ) : (
                <OfflineIcon className="size-7" />
              )}
            </span>
            <div>
              <p
                className={`text-[12px] font-bold ${isOnline
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-300"
                  }`}
              >
                {isOnline ? "التقرير جاهز للإرسال" : "لا يوجد اتصال بالإنترنت"}
              </p>
              <h2
                id="dispatch-title"
                className="font-display mt-1 text-[23px] font-bold"
              >
                إرسال تقرير الجرد
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق شاشة الإرسال"
            className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
          >
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 sm:p-5 md:grid-cols-[minmax(0,1fr)_290px] md:gap-5">
          <div className="flex min-h-0 flex-col">
            <div
              className={`rounded-2xl border p-4 ${isOnline
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                }`}
            >
              <h3 className="font-display text-[17px] font-bold">
                {isOnline
                  ? "يمكنك فتح واتساب أو مشاركة التقرير"
                  : "تم حفظ التقرير في قائمة الإرسال"}
              </h3>
              <p className="mt-1.5 text-[12px] font-medium leading-6 text-slate-600 dark:text-slate-300">
                {isOnline
                  ? "إذا لم يفتح واتساب تلقائياً، استخدم الزر أدناه أو امسح الرمز من هاتف آخر."
                  : "لن تفقد بيانات الجرد. امسح رمز QR بهاتف متصل أو أعد المحاولة بعد عودة الشبكة."}
              </p>
            </div>

            <div className="mt-3 min-h-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">
                  معاينة التقرير النصي
                </h3>
                <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                  محفوظ على الجهاز
                </span>
              </div>
              <pre
                dir="rtl"
                className="mt-3 max-h-52 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] font-medium leading-7 text-slate-600 dark:text-slate-300"
              >
                {reportText}
              </pre>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCopy}
                className="touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-[12px] font-bold text-slate-700 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                {reportCopied ? (
                  <CheckIcon className="size-5 text-emerald-600" />
                ) : (
                  <CopyIcon className="size-5" />
                )}
                {reportCopied ? "تم نسخ التقرير" : "نسخ التقرير النصي"}
              </button>
              <button
                type="button"
                onClick={onShare}
                className="touch-button flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white text-[12px] font-bold text-slate-700 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <ShareIcon className="size-5" />
                مشاركة عبر الجهاز
              </button>
            </div>
          </div>

          <aside className="flex flex-col rounded-[22px] bg-slate-950 p-4 text-white">
            <div className="rounded-2xl bg-white p-3">
              {qrDataUrl ? (
                <img
                  onError={handleImageError}
                  src={qrDataUrl}
                  alt="رمز QR لفتح تقرير الجرد في واتساب"
                  className="aspect-square w-full"
                />
              ) : qrFailed ? (
                <div className="grid aspect-square place-items-center p-5 text-center text-slate-600">
                  <div>
                    <IoWarningOutline className="mx-auto size-8 text-amber-500" />
                    <p className="mt-2 text-[11px] font-bold">
                      تعذر إنشاء رمز QR
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-slate-500">
                      استخدم نسخ التقرير أو المشاركة بدلاً منه.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid aspect-square place-items-center">
                  <span className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                </div>
              )}
            </div>
            <h3 className="font-display mt-4 text-center text-[17px] font-bold">
              امسح الرمز بهاتفك
            </h3>
            <p className="mt-1 text-center text-[11px] font-medium leading-6 text-slate-400">
              يفتح واتساب على الهاتف مع التقرير مكتوباً وجاهزاً للإرسال.
            </p>
            <button
              type="button"
              onClick={onOpenWhatsApp}
              disabled={!isOnline}
              className="touch-button mt-auto flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-3 text-[13px] font-bold text-white shadow-lg shadow-green-900/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 active:scale-[0.98]"
            >
              <SendIcon className="size-5" />
              {isOnline ? "فتح واتساب الآن" : "بانتظار عودة الاتصال"}
            </button>
          </aside>
        </div>
      </section>
    </div>
  )
}

function WasteDialog({
  item,
  onSave,
  onClose,
}: {
  item: Item
  onSave: (quantity: number, note: string) => Promise<void>
  onClose: () => void
}) {
  const [quantity, setQuantity] = useState(0)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="waste-dialog-title"
      className="w-full max-w-[440px] rounded-[26px] border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-900 dark:bg-[#111827]"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-amber-600">حركة مخزون</p>
          <h2
            id="waste-dialog-title"
            className="font-display text-[20px] font-bold"
          >
            تسجيل هدر · {item.name_ar}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق تسجيل الهدر"
          className="grid size-11 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
      <label className="mt-4 block text-[11px] font-bold">
        الكمية ({unitName(item)})
        <input
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value) || 0)}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-[14px] font-bold dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="mt-3 block text-[11px] font-bold">
        السبب
        <input
          value={note}
          maxLength={180}
          onChange={(event) => setNote(event.target.value.slice(0, 180))}
          placeholder="مثال: تلف أثناء التحضير"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-[12px] dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      {error && (
        <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>
      )}
      <button
        type="button"
        disabled={busy || quantity <= 0}
        onClick={() => {
          setBusy(true)
          void onSave(quantity, note)
            .catch((reason) =>
              setError(
                reason instanceof Error ? reason.message : "تعذر تسجيل الهدر.",
              ),
            )
            .finally(() => setBusy(false))
        }}
        className="touch-button mt-4 min-h-13 w-full rounded-xl bg-amber-500 text-[12px] font-bold text-white disabled:bg-slate-400"
      >
        حفظ الهدر وخصمه
      </button>
    </section>
  )
}

function OwnerSessionGate({
  role,
  accessPin,
  onUnlock,
  onOpenDeviceConnect,
  branchId,
}: {
  role: DeviceRole
  accessPin: string
  onUnlock: () => void
  onOpenDeviceConnect: () => void
  branchId: string
}) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)
  const roleName =
    role === "owner" ? "المالك" : role === "butcher" ? "الملحمة" : "المطعم"

  return (
    <main
      dir="rtl"
      className="grid min-h-screen place-items-center bg-[#f1f5f9] p-4 text-slate-900 dark:bg-[#0b0f19] dark:text-white"
    >
      <section className="w-full max-w-[440px] rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-700 dark:bg-[#111827]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            سحابي: <code className="font-mono">{branchId}</code>
          </span>
          <button
            type="button"
            onClick={onOpenDeviceConnect}
            className="text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            تغيير الفرع أو الدور ⚙️
          </button>
        </div>

        <span className="mx-auto mt-4 grid size-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
          <LockIcon className="size-7" />
        </span>
        <h1 className="font-display mt-3 text-[24px] font-bold">
          دخول جهاز {roleName}
        </h1>
        <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
          أدخل رمز PIN لفتح مساحة هذا الجهاز.
        </p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 4)
            setPin(next)
            setError(false)
            if (next.length === 4) {
              if (next === accessPin) {
                onUnlock()
              } else {
                void Promise.all([
                  inventoryDataService.getOwnerPin(),
                  inventoryDataService.getRolePins(),
                ])
                  .then(([freshOwnerPin, freshRolePins]) => {
                    const expected =
                      role === "owner"
                        ? freshOwnerPin
                        : freshRolePins[role as "butcher" | "restaurant"]
                    if (next === expected) {
                      onUnlock()
                    } else {
                      setError(true)
                      setPin("")
                    }
                  })
                  .catch(() => {
                    setError(true)
                    setPin("")
                  })
              }
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            if (pin === accessPin) onUnlock()
            else {
              setError(true)
              setPin("")
            }
          }}
          placeholder="••••"
          className="mt-4 min-h-16 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-[28px] font-bold tracking-[0.6em] outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
        />
        {error && (
          <p className="mt-2 text-[11px] font-bold text-red-600">
            رمز PIN غير صحيح.
          </p>
        )}
        <button
          type="button"
          disabled={pin.length !== 4}
          onClick={() => {
            if (pin === accessPin) onUnlock()
            else {
              setError(true)
              setPin("")
            }
          }}
          className="touch-button mt-4 min-h-14 w-full rounded-2xl bg-indigo-600 text-[13px] font-bold text-white disabled:bg-slate-400"
        >
          دخول مساحة {roleName}
        </button>

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onOpenDeviceConnect}
            className="touch-button flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <span>🔄</span>
            <span>تغيير دور هذا الجهاز أو ربطه بأجهزة أخرى</span>
          </button>
        </div>
      </section>
    </main>
  )
}

function RoleSetup({
  ownerPin,
  rolePins,
  onChoose,
}: {
  ownerPin: string
  rolePins: RolePins
  onChoose: (role: DeviceRole) => void
}) {
  const [selectedRole, setSelectedRole] = useState<DeviceRole | null>(null)
  const [pin, setPin] = useState("")
  const [branchId, setBranchId] = useState(() => storeAuthService.getBranchId())
  const [liveRolePins, setLiveRolePins] = useState<RolePins>(rolePins)
  const [liveOwnerPin, setLiveOwnerPin] = useState<string>(ownerPin)
  const [error, setError] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    setLiveRolePins(rolePins)
  }, [rolePins])

  useEffect(() => {
    setLiveOwnerPin(ownerPin)
  }, [ownerPin])

  useEffect(() => {
    const handleRefresh = async () => {
      try {
        const freshPins = await inventoryDataService.getRolePins()
        const freshOwnerPin = await inventoryDataService.getOwnerPin()
        setLiveRolePins(freshPins)
        setLiveOwnerPin(freshOwnerPin)
      } catch {
        // ignore
      }
    }
    window.addEventListener("smart-inventory-data-refreshed", handleRefresh)
    return () => {
      window.removeEventListener("smart-inventory-data-refreshed", handleRefresh)
    }
  }, [])

  const choose = (role: DeviceRole) => {
    setError("")
    setPin("")
    setSelectedRole(role)
  }

  const roleLabel =
    selectedRole === "owner"
      ? "المالك"
      : selectedRole === "butcher"
        ? "الملحمة"
        : "المطعم"

  const submitRole = async () => {
    if (!selectedRole) return
    setIsConnecting(true)
    setError("")

    try {
      await inventoryDataService.switchBranch(branchId)
      const freshPins = await inventoryDataService.getRolePins()
      const freshOwnerPin = await inventoryDataService.getOwnerPin()
      setLiveRolePins(freshPins)
      setLiveOwnerPin(freshOwnerPin)

      const expected =
        selectedRole === "owner"
          ? freshOwnerPin
          : freshPins[selectedRole]

      const fallbackExpected =
        selectedRole === "owner"
          ? (liveOwnerPin || ownerPin)
          : (liveRolePins[selectedRole] || rolePins[selectedRole])

      if (pin !== expected && pin !== fallbackExpected) {
        setError(`رمز ${roleLabel} غير صحيح.`)
        setPin("")
        setIsConnecting(false)
        return
      }

      await storeAuthService.ensureDeviceAuthenticated()
      onChoose(selectedRole)
    } catch (authError) {
      console.warn("Device auth warning:", authError)
      const fallbackExpected =
        selectedRole === "owner"
          ? (liveOwnerPin || ownerPin)
          : (liveRolePins[selectedRole] || rolePins[selectedRole])

      if (pin !== fallbackExpected) {
        setError(`رمز ${roleLabel} غير صحيح.`)
        setPin("")
      } else {
        onChoose(selectedRole)
      }
    } finally {
      setIsConnecting(false)
    }
  }
  return (
    <main
      dir="rtl"
      className="grid min-h-screen place-items-center bg-[#f1f5f9] p-4 text-slate-950 dark:bg-[#0b0f19] dark:text-white"
    >
      <section className="w-full max-w-[780px] rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.2)] dark:border-slate-700 dark:bg-[#111827] sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-slate-950">
              <img src={logoMark} alt="" className="size-14 object-contain" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-600">
                إعداد النظام وربط الأجهزة السحابية لأول مرة
              </p>
              <h1 className="font-display mt-0.5 text-[24px] font-extrabold">
                حدد دور هذا الجهاز في المنشأة
              </h1>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            سحابة Firebase جاهزة
          </span>
        </div>

        <p className="mt-4 text-[13px] font-medium leading-6 text-slate-600 dark:text-slate-300">
          يعمل النظام بالتزامن الفوري عبر 3 أجهزة: جهاز الميزان بالملحمة، شاشة المطبخ بالمطعم، وجهاز المالك للإدارة والمراقبة.
        </p>

        <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900/60 dark:bg-teal-950/30">
          <label className="block text-[12px] font-bold text-teal-900 dark:text-teal-200">
            معرّف الفرع المشترك (Cloud Branch ID)
            <span className="mt-0.5 block text-[11px] font-normal text-slate-600 dark:text-slate-400">
              يجب أن يكون نفس المعرّف في أجهزة الملحمة والمطعم والمالك لتبادل البيانات فورياً.
            </span>
            <input
              type="text"
              value={branchId}
              onChange={(event) =>
                setBranchId(
                  event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                )
              }
              placeholder="main_branch"
              className="mt-2 min-h-11 w-full rounded-xl border border-teal-300 bg-white px-3 text-left font-mono text-[14px] font-bold text-teal-900 shadow-sm dark:border-teal-700 dark:bg-slate-900 dark:text-teal-200"
              dir="ltr"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([
            ["butcher", "جهاز الملحمة", "الميزان الذكي واللحوم", "وزن الذبائح واللحوم وإرسال التحويلات الفورية للمطعم", "🥩"],
            ["restaurant", "جهاز المطعم", "شاشة المطبخ والاستلام", "استلام اللحوم الواردة من الملحمة بضغطة زر وجرد المطبخ", "🍔"],
            ["owner", "جهاز المالك", "الإدارة والرقابة المركزية", "متابعة الملحمة والمطعم حياً، والتقارير وتعديل الأسعار", "🛡️"],
          ] as const).map(([role, title, subtitle, description, icon]) => (
            <button
              key={role}
              type="button"
              onClick={() => choose(role)}
              className={`touch-button min-h-36 rounded-2xl border p-4 text-right transition-all active:scale-[0.98] ${selectedRole === role
                ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/20 dark:bg-indigo-950"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[24px]">{icon}</span>
              </div>
              <strong className="font-display mt-2 block text-[17px] font-bold">
                {title}
              </strong>
              <span className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {subtitle}
              </span>
              <span className="mt-1.5 block text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </span>
            </button>
          ))}
        </div>

        {selectedRole && (
          <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
            <label className="block text-[12px] font-bold text-indigo-900 dark:text-indigo-200">
              أدخل رمز PIN الخاص بـ {roleLabel}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 4)
                setPin(next)
                setError("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRole()
              }}
              placeholder="••••"
              className="mt-2 min-h-14 w-full rounded-xl border border-indigo-200 bg-white px-4 text-center text-[26px] font-bold tracking-[0.5em] outline-none dark:border-indigo-800 dark:bg-slate-900"
            />
            {error && (
              <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>
            )}
            <button
              type="button"
              onClick={submitRole}
              disabled={pin.length !== 4 || isConnecting}
              className="touch-button mt-3 min-h-12 w-full rounded-xl bg-indigo-600 text-[13px] font-bold text-white shadow-md hover:bg-indigo-700 disabled:bg-slate-400"
            >
              {isConnecting ? "جاري الاتصال السحابي وتجهيز الجهاز..." : `دخول ${roleLabel}`}
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

function TransferCenter({
  mode,
  items,
  categories,
  transfers,
  transferLines,
  locationWeights,
  ledger,
  onSend,
  onReceive,
  onCancel,
  onCombinedReport,
  onClose,
}: {
  mode: "send" | "incoming" | "owner"
  items: Item[]
  categories: Category[]
  transfers: Transfer[]
  transferLines: TransferLine[]
  locationWeights: Record<InventoryLocation, Record<string, number | null>>
  ledger: StockMovement[]
  onSend: (lines: TransferRequestLine[]) => Promise<void>
  onReceive: (
    transferId: string,
    received: Record<string, number>,
  ) => Promise<void>
  onCancel: (transferId: string, reason: string) => Promise<void>
  onCombinedReport: () => void
  onClose: () => void
}) {
  const simpleItems = items.filter(
    (item) => item.active !== false && !item.is_composite,
  )
  const [sendLines, setSendLines] = useState<Array<{
    id: string
    item_id: string
    quantity: number
  }>>(() =>
    simpleItems[0]
      ? [{ id: createEntityId(), item_id: simpleItems[0].id, quantity: 1 }]
      : [],
  )
  const [received, setReceived] = useState<Record<string, number>>({})
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({})
  const [ownerLocation, setOwnerLocation] = useState<"all" | InventoryLocation>(
    "all",
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const sentTransfers = transfers.filter(
    (transfer) => transfer.status === "Sent",
  )
  const lineItem = (line: TransferLine) =>
    items.find((item) => item.id === line.item_id)
  const stockRows = (["butcher", "restaurant"] as const)
    .filter((location) => ownerLocation === "all" || ownerLocation === location)
    .flatMap((location) =>
      items
        .filter(
          (item) =>
            item.active !== false &&
            (location === "restaurant" || !item.is_composite),
        )
        .map((item) => ({
          location,
          item,
          quantity: locationWeights[location][item.id] ?? null,
        })),
    )
  const wasteRows = ledger.filter(
    (movement) =>
      movement.type === "waste" &&
      (ownerLocation === "all" || movement.location === ownerLocation),
  )

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-center-title"
      className="flex max-h-[calc(100dvh-16px)] w-full max-w-[980px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div>
          <p className="text-[10px] font-bold text-emerald-600">
            النظام المرتبط
          </p>
          <h2
            id="transfer-center-title"
            className="font-display text-[22px] font-bold"
          >
            {mode === "send"
              ? "إرسال إلى المطعم"
              : mode === "incoming"
                ? "الوارد من الملحمة"
                : "لوحة المالك الموحدة"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800"
          aria-label="إغلاق"
        >
          <CloseIcon className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {message && (
          <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </div>
        )}

        {mode === "send" && (
          <div>
            <div className="space-y-2">
              {sendLines.map((line, index) => {
                const item = items.find((entry) => entry.id === line.item_id)
                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-[1fr_110px_42px] gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <select
                      value={line.item_id}
                      onChange={(event) =>
                        setSendLines((current) =>
                          current.map((entry) =>
                            entry.id === line.id
                              ? { ...entry, item_id: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold dark:border-slate-600 dark:bg-slate-900"
                    >
                      {simpleItems
                        .filter(
                          (candidate) =>
                            candidate.id === line.item_id ||
                            !sendLines.some(
                              (entry) => entry.item_id === candidate.id,
                            ),
                        )
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name_ar}
                          </option>
                        ))}
                    </select>
                    <label className="relative">
                      <input
                        type="number"
                        min="0"
                        step={item?.unit === "piece" ? "1" : "any"}
                        value={line.quantity}
                        onChange={(event) =>
                          setSendLines((current) =>
                            current.map((entry) =>
                              entry.id === line.id
                                ? {
                                  ...entry,
                                  quantity: Number(event.target.value) || 0,
                                }
                                : entry,
                            ),
                          )
                        }
                        aria-label={`كمية السطر ${index + 1}`}
                        className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 pl-12 text-[12px] font-bold dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="pointer-events-none absolute left-2 top-3 rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 dark:bg-slate-800">
                        {item ? unitName(item) : ""}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSendLines((current) =>
                          current.filter((entry) => entry.id !== line.id),
                        )
                      }
                      className="touch-button grid size-11 place-items-center self-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950"
                      aria-label="حذف السطر"
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const candidate = simpleItems.find(
                  (item) => !sendLines.some((line) => line.item_id === item.id),
                )
                if (!candidate) return
                setSendLines((current) => [
                  ...current,
                  {
                    id: createEntityId(),
                    item_id: candidate.id,
                    quantity: 1,
                  },
                ])
              }}
              className="touch-button mt-3 min-h-11 rounded-xl border border-dashed border-emerald-400 px-4 text-[11px] font-bold text-emerald-700"
            >
              + إضافة صنف
            </button>
            <button
              type="button"
              disabled={busy || !sendLines.length}
              onClick={() => {
                setBusy(true)
                setMessage("")
                void onSend(
                  sendLines.map((line) => {
                    const item = items.find(
                      (entry) => entry.id === line.item_id,
                    )!
                    return {
                      item_id: line.item_id,
                      quantity_sent: storedToBaseQuantity(line.quantity, item),
                    }
                  }),
                )
                  .then(() => {
                    setMessage("تم إرسال التحويل وخصم مخزون الملحمة.")
                    setSendLines([])
                  })
                  .catch((error) =>
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "تعذر إرسال التحويل.",
                    ),
                  )
                  .finally(() => setBusy(false))
              }}
              className="touch-button mt-5 min-h-14 w-full rounded-2xl bg-emerald-600 text-[13px] font-bold text-white disabled:bg-slate-400"
            >
              {busy ? "جاري الإرسال..." : "إنهاء وإرسال التحويل"}
            </button>
          </div>
        )}

        {mode === "incoming" && (
          <div className="space-y-3">
            {sentTransfers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
                <p className="font-display text-[17px] font-bold">
                  لا توجد تحويلات واردة
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  ستظهر هنا التحويلات التي أرسلتها الملحمة.
                </p>
              </div>
            ) : (
              sentTransfers.map((transfer) => {
                const lines = transferLines.filter(
                  (line) => line.transfer_id === transfer.id,
                )
                return (
                  <article
                    key={transfer.id}
                    className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-[12px]">
                        تحويل {transfer.id.slice(0, 8)}
                      </strong>
                      <span className="rounded-lg bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white">
                        مرسل
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {lines.map((line) => {
                        const item = lineItem(line)
                        const sentDisplay = item
                          ? baseToStoredQuantity(
                            line.quantity_sent,
                            line.unit,
                            item,
                          )
                          : line.quantity_sent
                        return (
                          <div
                            key={line.id}
                            className="grid grid-cols-[1fr_120px] items-center gap-2 rounded-xl bg-white p-2 dark:bg-slate-900"
                          >
                            <div>
                              <p className="text-[11px] font-bold">
                                {item?.name_ar ?? "صنف"}
                              </p>
                              <p className="text-[9px] text-slate-500">
                                المرسل: {sentDisplay}{" "}
                                {item ? unitName(item) : line.unit}
                              </p>
                            </div>
                            <label className="relative">
                              <input
                                type="number"
                                min="0"
                                step={item?.unit === "piece" ? "1" : "any"}
                                value={received[line.id] ?? sentDisplay}
                                onChange={(event) =>
                                  setReceived((current) => ({
                                    ...current,
                                    [line.id]: Number(event.target.value) || 0,
                                  }))
                                }
                                aria-label={`الكمية المستلمة من ${item?.name_ar ?? "الصنف"}`}
                                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 pl-12 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800"
                              />
                              <span className="pointer-events-none absolute left-2 top-2.5 rounded-lg bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500 dark:bg-slate-700">
                                {item ? unitName(item) : line.unit}
                              </span>
                            </label>
                          </div>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true)
                        const quantities = Object.fromEntries(
                          lines.map((line) => {
                            const item = lineItem(line)!
                            const display =
                              received[line.id] ??
                              baseToStoredQuantity(
                                line.quantity_sent,
                                line.unit,
                                item,
                              )
                            return [
                              line.id,
                              storedToBaseQuantity(display, item),
                            ]
                          }),
                        )
                        void onReceive(transfer.id, quantities)
                          .then(() =>
                            setMessage(
                              "تم تأكيد الاستلام وتحديث مخزون المطعم.",
                            ),
                          )
                          .catch((error) =>
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "تعذر تأكيد الاستلام.",
                            ),
                          )
                          .finally(() => setBusy(false))
                      }}
                      className="touch-button mt-3 min-h-12 w-full rounded-xl bg-indigo-600 text-[12px] font-bold text-white disabled:bg-slate-400"
                    >
                      تأكيد الاستلام
                    </button>
                  </article>
                )
              })
            )}
          </div>
        )}

        {mode === "owner" && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "butcher", "restaurant"] as const).map((location) => (
                <button
                  key={location}
                  type="button"
                  onClick={() => setOwnerLocation(location)}
                  className={`touch-button min-h-10 rounded-xl px-4 text-[10px] font-bold ${ownerLocation === location
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                >
                  {location === "all"
                    ? "الموقعان"
                    : location === "butcher"
                      ? "الملحمة"
                      : "المطعم"}
                </button>
              ))}
              <button
                type="button"
                onClick={onCombinedReport}
                className="touch-button mr-auto min-h-10 rounded-xl bg-emerald-600 px-4 text-[10px] font-bold text-white"
              >
                PDF ومشاركة واتساب
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <h3 className="font-display text-[15px] font-bold">
                  المخزون الموحد
                </h3>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {stockRows.map(({ location, item, quantity }) => (
                    <div
                      key={`${location}-${item.id}`}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[10px] dark:bg-slate-800"
                    >
                      <span className="font-bold">
                        {item.name_ar} ·{" "}
                        {location === "butcher" ? "الملحمة" : "المطعم"}
                      </span>
                      <span className="font-bold tabular-nums">
                        {quantity === null ? "—" : quantity.toFixed(3)}{" "}
                        {unitName(item)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-red-200 p-3 dark:border-red-900">
                <h3 className="font-display text-[15px] font-bold">
                  الهدر والفروقات
                </h3>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {wasteRows.length === 0 ? (
                    <p className="py-8 text-center text-[10px] text-slate-500">
                      لا توجد حركات هدر أو فروقات.
                    </p>
                  ) : (
                    wasteRows.map((movement) => {
                      const item = items.find(
                        (entry) => entry.id === movement.item_id,
                      )
                      const category = categories.find(
                        (entry) => entry.id === item?.category_id,
                      )
                      return (
                        <div
                          key={movement.id}
                          className="rounded-xl bg-red-50 px-3 py-2 text-[10px] dark:bg-red-950/40"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-bold">
                              {item?.name_ar ?? "صنف"} ·{" "}
                              {movement.location === "butcher"
                                ? "الملحمة"
                                : "المطعم"}
                            </span>
                            <span className="font-bold text-red-600">
                              {movement.quantity} {baseUnitName(movement.unit)}
                            </span>
                          </div>
                          <p className="mt-1 text-[9px] text-red-700">
                            {category?.name_ar} · {movement.note}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </div>

            <section className="mt-3 rounded-2xl border border-indigo-200 p-3 dark:border-indigo-900">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">
                  سجل التحويلات
                </h3>
                <span className="text-[10px] font-bold text-red-600">
                  {
                    transfers.filter(
                      (transfer) => transfer.status === "Discrepancy",
                    ).length
                  }{" "}
                  فروقات
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {[...transfers].reverse().map((transfer) => (
                  <div
                    key={transfer.id}
                    className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-bold">
                        {transfer.id.slice(0, 8)} ·{" "}
                        {
                          transferLines.filter(
                            (line) => line.transfer_id === transfer.id,
                          ).length
                        }{" "}
                        أصناف
                      </span>
                      <span
                        className={`rounded-lg px-2 py-1 font-bold ${transfer.status === "Discrepancy"
                          ? "bg-red-100 text-red-700"
                          : transfer.status === "Received"
                            ? "bg-emerald-100 text-emerald-700"
                            : transfer.status === "Cancelled"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                      >
                        {transfer.status}
                      </span>
                    </div>
                    {transfer.status === "Sent" && (
                      <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
                        <input
                          value={cancelReasons[transfer.id] ?? ""}
                          onChange={(event) =>
                            setCancelReasons((current) => ({
                              ...current,
                              [transfer.id]: event.target.value,
                            }))
                          }
                          placeholder="سبب الإلغاء"
                          className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] dark:border-slate-700 dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setBusy(true)
                            void onCancel(
                              transfer.id,
                              cancelReasons[transfer.id] ?? "",
                            )
                              .catch((error) =>
                                setMessage(
                                  error instanceof Error
                                    ? error.message
                                    : "تعذر الإلغاء.",
                                ),
                              )
                              .finally(() => setBusy(false))
                          }}
                          disabled={busy}
                          className="touch-button min-h-10 rounded-xl bg-red-600 text-[10px] font-bold text-white disabled:bg-slate-400"
                        >
                          إلغاء التحويل
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}

function ProductManager({
  products,
  categories,
  weights,
  movements,
  recipeComponents,
  onSave,
  onToggleActive,
  onDelete,
  onArchiveAll,
  onDeleteAll,
  onImport,
  onBack,
}: {
  products: Item[]
  categories: Category[]
  weights: Record<string, number | null>
  movements: Record<string, InventoryFlow>
  recipeComponents: RecipeComponent[]
  onSave: (product: Item, components: RecipeComponent[]) => Promise<void>
  onToggleActive: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onArchiveAll: () => Promise<void>
  onDeleteAll: () => Promise<void>
  onImport: (plan: ProductImportPlanRow[]) => Promise<void>
  onBack: () => void
}) {
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active")
  const [catalogSearch, setCatalogSearch] = useState("")
  const [draft, setDraft] = useState<Item | null>(null)
  const [draftComponents, setDraftComponents] = useState<RecipeComponent[]>([])
  const [recipeError, setRecipeError] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)
  const [bulkAction, setBulkAction] = useState<"archive" | "delete" | null>(
    null,
  )
  const [bulkBusy, setBulkBusy] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")
  const [importPreview, setImportPreview] = useState<{
    fileName: string
    plan: ProductImportPlanRow[]
    issues: ProductImportIssue[]
  } | null>(null)
  const [imageSource, setImageSource] = useState<"library" | "upload">(
    "library",
  )
  const imageInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const imageChoices = providedProductImages
  const normalizedCatalogSearch = normalizeArabicText(catalogSearch)
  const visible = products
    .filter((product) => {
      if (filter === "active") return product.active !== false
      if (filter === "archived") return product.active === false
      return true
    })
    .filter((product) => {
      if (!normalizedCatalogSearch) return true
      const category =
        categories.find((definition) => definition.id === product.category_id)
          ?.label_ar ?? ""
      return normalizeArabicText(
        `${product.name_ar} ${product.name_en} ${category} ${product.unit_label} ${unitName(product)}`,
      ).includes(normalizedCatalogSearch)
    })
  const activeCount = products.filter(
    (product) => product.active !== false,
  ).length
  const importAddCount =
    importPreview?.plan.filter((row) => row.action === "add").length ?? 0
  const importUpdateCount =
    importPreview?.plan.filter((row) => row.action === "update").length ?? 0

  const createProduct = () => {
    setImageSource("library")
    setUploadError("")
    setRecipeError("")
    setDraftComponents([])
    const timestamp = entityTimestamp()
    const category = categories[0]
    setDraft({
      id: createEntityId(),
      active: true,
      is_composite: false,
      name_ar: "",
      name_en: "",
      category_id: category?.id ?? CATEGORY_IDS.meat,
      unit: "kg",
      unit_label: "كجم",
      package_size: 1,
      opening_quantity: 0,
      minimum_stock_alert: 0,
      cost_per_unit: 0,
      shrinkage_percent: 0,
      initial_quantity: null,
      image_url: imageChoices[0] ?? logoMark,
      created_at: timestamp,
      updated_at: timestamp,
    })
  }

  const editProduct = (product: Item) => {
    setDraft({ ...product })
    setDraftComponents(
      recipeComponents.filter(
        (component) => component.composite_item_id === product.id,
      ),
    )
    setRecipeError("")
    setImageSource(
      product.image_url.startsWith("data:image") ? "upload" : "library",
    )
    setUploadError("")
  }

  const saveDraft = async () => {
    if (!draft?.name_ar.trim()) return
    const components = draft.is_composite ? draftComponents : []
    const validationError = draft.is_composite
      ? validateRecipe(draft.id, components, products)
      : null
    if (validationError) {
      setRecipeError(validationError)
      return
    }
    setRecipeError("")
    try {
      await onSave(
        {
          ...draft,
          unit: draft.is_composite ? "piece" : draft.unit,
          unit_label: draft.is_composite ? "حبة" : draft.unit_label,
          package_size: draft.is_composite ? 1 : draft.package_size,
          cost_per_unit: draft.is_composite
            ? calculatedRecipeCost
            : draft.cost_per_unit,
          name_ar: draft.name_ar.trim(),
          name_en: draft.name_en.trim(),
        },
        components,
      )
      setDraft(null)
      setDraftComponents([])
      setFilter("all")
    } catch (error) {
      setRecipeError(
        error instanceof Error ? error.message : "تعذر حفظ الوصفة.",
      )
    }
  }

  const addComponent = () => {
    if (!draft) return
    const available = products.find(
      (item) =>
        !item.is_composite &&
        item.id !== draft.id &&
        !draftComponents.some(
          (component) => component.component_item_id === item.id,
        ),
    )
    if (!available) {
      setRecipeError("لا توجد أصناف بسيطة أخرى متاحة للإضافة.")
      return
    }
    const timestamp = entityTimestamp()
    setDraftComponents((current) => [
      ...current,
      {
        id: createEntityId(),
        composite_item_id: draft.id,
        component_item_id: available.id,
        quantity: 1,
        unit: defaultBaseUnit(available),
        created_at: timestamp,
        updated_at: timestamp,
      },
    ])
    setRecipeError("")
  }

  const recipeSummary = draft?.is_composite
    ? draftComponents
      .map((component) => {
        const item = products.find(
          (entry) => entry.id === component.component_item_id,
        )
        return item
          ? `${component.quantity} ${baseUnitName(component.unit)} ${item.name_ar}`
          : ""
      })
      .filter(Boolean)
      .join(" + ")
    : ""
  const calculatedRecipeCost = draftComponents.reduce((total, component) => {
    const item = products.find(
      (entry) => entry.id === component.component_item_id,
    )
    return item ? total + componentCost(component, item) : total
  }, 0)

  const uploadCustomImage = async (file?: File) => {
    if (!file || !draft) return
    setUploadError("")
    setIsUploading(true)
    try {
      const image = await compressProductImage(file)
      setDraft({ ...draft, image_url: image })
      setImageSource("upload")
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "تعذر رفع الصورة المختارة",
      )
    } finally {
      setIsUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }

  const readImportFile = async (file?: File) => {
    if (!file) return
    if (importInputRef.current) importInputRef.current.value = ""
    setImportError("")
    setImportSuccess("")
    setImportPreview(null)
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
      setImportError("اختر ملف Excel بصيغة XLSX.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportError("حجم ملف Excel أكبر من الحد المسموح 10 ميجابايت.")
      return
    }
    setIsImporting(true)
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser")
      const workbook = await readXlsxFile(file)
      const parsedSheets = workbook
        .map((sheet) => ({
          sheet: sheet.sheet,
          parsed: parseProductImportRows(sheet.data, categories),
        }))
        .sort((a, b) => b.parsed.rows.length - a.parsed.rows.length)
      const selectedSheet = parsedSheets[0]
      const parsed = selectedSheet?.parsed ?? {
        rows: [],
        issues: [
          {
            rowNumber: 0,
            message: "لا يحتوي المصنف على أوراق قابلة للقراءة.",
          },
        ],
      }
      const plan = createProductImportPlan(parsed.rows, products)
      if (!plan.length) {
        setImportError(
          parsed.issues[0]?.message ??
          "لم يتم العثور على أصناف قابلة للاستيراد.",
        )
        return
      }
      setImportPreview({
        fileName: selectedSheet?.sheet
          ? `${file.name} · ${selectedSheet.sheet}`
          : file.name,
        plan,
        issues: parsed.issues,
      })
    } catch {
      setImportError(
        "تعذر قراءة ملف Excel. تأكد أنه ملف XLSX سليم وغير محمي بكلمة مرور.",
      )
    } finally {
      setIsImporting(false)
    }
  }

  const confirmImport = async () => {
    if (!importPreview || isImporting) return
    setIsImporting(true)
    setImportError("")
    try {
      await onImport(importPreview.plan)
      setImportSuccess(
        `تم الاستيراد وحفظ البيانات على الجهاز: ${importAddCount} جديد و${importUpdateCount} محدث.`,
      )
      setCatalogSearch("")
      setFilter("all")
      setDraft(null)
      setImportPreview(null)
    } catch {
      setImportError(
        "تعذر حفظ الاستيراد. لم يتم تغيير الكتالوج؛ تحقق من مساحة الجهاز وحاول مجدداً.",
      )
    } finally {
      setIsImporting(false)
    }
  }

  const exportExcel = async () => {
    setImportError("")
    try {
      const { default: writeXlsxFile } = await import(
        "write-excel-file/browser"
      )
      const header = [
        "الصنف",
        "الاسم الإنجليزي",
        "القسم",
        "الوحدة",
        "رصيد أول اليوم",
        "الوارد",
        "الصادر",
        "الرصيد الفعلي",
        "تنبيه الحد الأدنى",
        "تكلفة الوحدة",
        "ملاحظات",
      ]
      const rows = products.map((product) => {
        const category = categories.find(
          (entry) => entry.id === product.category_id,
        )
        const movement =
          movements[product.id] ??
          emptyMovement(product.opening_quantity, product.id)
        return [
          product.name_ar,
          product.name_en,
          category?.name_ar ?? "",
          product.unit_label || inventoryUnitName(product.unit),
          movement.opening,
          movement.incoming,
          movement.outgoing,
          weights[product.id] ?? null,
          product.minimum_stock_alert,
          product.cost_per_unit,
          movement.notes,
        ]
      })
      await writeXlsxFile([header, ...rows], {
        sheet: "الأصناف",
        rightToLeft: true,
        columns: [
          { width: 28 },
          { width: 24 },
          { width: 16 },
          { width: 12 },
          ...Array.from({ length: 7 }, () => ({ width: 16 })),
        ],
      }).toFile(`smart-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`)
      setImportSuccess("تم تصدير ملف Excel شاملاً التوابل والحركة الحالية.")
    } catch {
      setImportError("تعذر تصدير ملف Excel. حاول مرة أخرى.")
    }
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="products-title"
      className="relative flex h-[calc(100dvh-16px)] max-h-[780px] w-full max-w-[1080px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
            <ProductManagementIcon className="size-6" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              إعدادات المالك · الكتالوج
            </p>
            <h2
              id="products-title"
              className="font-display text-[23px] font-bold"
            >
              إدارة الأصناف والمنتجات
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkAction("archive")}
            disabled={activeCount === 0}
            className="touch-button min-h-12 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-[12px] font-bold text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          >
            أرشفة الكل
          </button>
          <button
            type="button"
            onClick={() => setBulkAction("delete")}
            disabled={products.length === 0}
            className="touch-button min-h-12 rounded-2xl border border-red-200 bg-red-50 px-4 text-[12px] font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            حذف الكل
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className="touch-button flex min-h-12 items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-[12px] font-bold text-indigo-700 disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
          >
            <UploadImageIcon className="size-5" />
            {isImporting ? "جاري فحص الملف..." : "استيراد Excel"}
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            className="touch-button flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-[12px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <DataBackupIcon className="size-5" />
            تصدير Excel
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => void readImportFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={createProduct}
            className="touch-button min-h-12 rounded-2xl bg-emerald-600 px-5 text-[13px] font-bold text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
          >
            + إضافة صنف جديد
          </button>
          <button
            type="button"
            onClick={onBack}
            className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            aria-label="العودة لإعدادات المالك"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
      </header>

      {(importError || importSuccess) && (
        <div
          role={importError ? "alert" : "status"}
          className={`mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[11px] font-bold ${importError
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
            }`}
        >
          <span>{importError || importSuccess}</span>
          <button
            type="button"
            onClick={() => {
              setImportError("")
              setImportSuccess("")
            }}
            aria-label="إغلاق رسالة الاستيراد"
            className="touch-button grid size-9 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-800"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      )}

      {bulkAction && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/60 p-6 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-action-title"
            className={`w-full max-w-[520px] rounded-[24px] border bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.4)] dark:bg-[#111827] ${bulkAction === "delete"
              ? "border-red-300 dark:border-red-900"
              : "border-amber-300 dark:border-amber-900"
              }`}
          >
            <span
              className={`grid size-16 place-items-center rounded-2xl ${bulkAction === "delete"
                ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
            >
              <AlertIcon className="size-8" />
            </span>
            <h3
              id="bulk-action-title"
              className="font-display mt-4 text-[24px] font-bold"
            >
              {bulkAction === "delete"
                ? "تأكيد حذف جميع المنتجات"
                : "تأكيد أرشفة جميع المنتجات"}
            </h3>
            <p className="mt-2 text-[14px] font-medium leading-7 text-slate-600 dark:text-slate-300">
              {bulkAction === "delete"
                ? `سيتم حذف جميع المنتجات وعددها ${products.length} مع أوزانها وإعداداتها نهائياً. لا يمكن التراجع عن هذه العملية.`
                : `سيتم إخفاء جميع المنتجات النشطة وعددها ${activeCount} من شاشة الجرد. لن تُحذف البيانات ويمكن استعادة الأصناف لاحقاً.`}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.8fr] sm:gap-3">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => {
                  setBulkBusy(true)
                  setImportError("")
                  const action =
                    bulkAction === "delete" ? onDeleteAll() : onArchiveAll()
                  void action
                    .then(() => {
                      if (bulkAction === "delete") {
                        setFilter("all")
                        setDraft(null)
                      } else {
                        setFilter("archived")
                      }
                      setBulkAction(null)
                    })
                    .catch((error) =>
                      setImportError(
                        error instanceof Error
                          ? error.message
                          : "تعذر تنفيذ الإجراء ولم تتغير البيانات المحفوظة.",
                      ),
                    )
                    .finally(() => setBulkBusy(false))
                }}
                className={`touch-button min-h-16 rounded-2xl text-[14px] font-bold text-white shadow-lg disabled:bg-slate-400 active:scale-[0.98] ${bulkAction === "delete"
                  ? "bg-red-600 shadow-red-600/20"
                  : "bg-amber-500 shadow-amber-500/20"
                  }`}
              >
                {bulkBusy
                  ? "جاري الحفظ..."
                  : bulkAction === "delete"
                    ? "نعم، حذف جميع المنتجات"
                    : "نعم، أرشفة جميع المنتجات"}
              </button>
              <button
                type="button"
                onClick={() => setBulkAction(null)}
                disabled={bulkBusy}
                className="touch-button min-h-16 rounded-2xl border border-slate-300 bg-white text-[13px] font-bold text-slate-600 disabled:opacity-50 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                إلغاء والعودة
              </button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-import-title"
            className="flex max-h-[calc(100dvh-32px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[26px] border border-indigo-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)] dark:border-indigo-900 dark:bg-[#111827]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                  <UploadImageIcon className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    معاينة آمنة قبل الحفظ
                  </p>
                  <h2
                    id="excel-import-title"
                    className="font-display truncate text-[20px] font-bold"
                  >
                    استيراد المنتجات من Excel
                  </h2>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                    {importPreview.fileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                disabled={isImporting}
                aria-label="إلغاء استيراد Excel"
                className="touch-button grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              >
                <CloseIcon className="size-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                  <p className="text-[9px] font-semibold text-slate-400">
                    صالح للاستيراد
                  </p>
                  <strong className="mt-1 block text-[22px] tabular-nums">
                    {importPreview.plan.length}
                  </strong>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <p className="text-[9px] font-semibold">أصناف جديدة</p>
                  <strong className="mt-1 block text-[22px] tabular-nums">
                    {importAddCount}
                  </strong>
                </div>
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <p className="text-[9px] font-semibold">تحديث المتطابق</p>
                  <strong className="mt-1 block text-[22px] tabular-nums">
                    {importUpdateCount}
                  </strong>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-medium leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                تتم المطابقة بعد توحيد اختلافات الهمزات والتشكيل والتطويل.
                الخلايا الرقمية الفارغة لا تمسح بيانات صنف موجود، بينما تُحفظ قيم
                رصيد أول اليوم والوارد والصادر والرصيد الفعلي والملاحظات عندما
                تكون موجودة.
              </div>

              {importError && (
                <div
                  role="alert"
                  className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {importError}
                </div>
              )}

              {importPreview.issues.length > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                    تم تجاوز {importPreview.issues.length} صف غير صالح
                  </p>
                  <ul className="mt-2 space-y-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    {importPreview.issues.slice(0, 5).map((issue) => (
                      <li key={`${issue.rowNumber}-${issue.message}`}>
                        {issue.rowNumber > 0 ? `الصف ${issue.rowNumber}: ` : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-[1fr_90px_80px] bg-slate-100 px-3 py-2 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <span>الصنف</span>
                  <span>القسم</span>
                  <span>الإجراء</span>
                </div>
                <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {importPreview.plan.map((row) => (
                    <div
                      key={`${row.rowNumber}-${row.name_ar}`}
                      className="grid grid-cols-[1fr_90px_80px] items-center px-3 py-2.5 text-[10px]"
                    >
                      <span className="truncate font-bold">{row.name_ar}</span>
                      <span className="truncate text-slate-500 dark:text-slate-400">
                        {
                          categories.find(
                            (category) => category.id === row.category_id,
                          )?.label_ar
                        }
                      </span>
                      <span
                        className={`w-fit rounded-lg px-2 py-1 font-bold ${row.action === "add"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                      >
                        {row.action === "add" ? "إضافة" : "تحديث"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="grid shrink-0 grid-cols-[1.4fr_0.8fr] gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={isImporting || importPreview.plan.length === 0}
                className="touch-button min-h-14 rounded-2xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-lg shadow-emerald-600/20 disabled:bg-slate-400 active:scale-[0.98]"
              >
                {isImporting
                  ? "جاري الحفظ الآمن..."
                  : `استيراد ${importPreview.plan.length} صنف`}
              </button>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                disabled={isImporting}
                className="touch-button min-h-14 rounded-2xl border border-slate-300 bg-white px-4 text-[12px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                إلغاء
              </button>
            </footer>
          </section>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:grid-cols-[minmax(0,1fr)_420px] md:overflow-hidden md:p-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-h-0 flex-col">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
              {[
                ["active", `النشطة (${activeCount})`],
                ["archived", `المؤرشفة (${products.length - activeCount})`],
                ["all", `الكل (${products.length})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(value as "active" | "archived" | "all")
                  }
                  className={`touch-button min-h-11 rounded-xl text-[12px] font-bold transition ${filter === value
                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="relative flex min-h-12 items-center rounded-2xl border border-slate-200 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900">
              <SearchIcon className="pointer-events-none absolute right-3 size-4 text-slate-400" />
              <input
                type="search"
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder="بحث في الكتالوج..."
                aria-label="البحث في كتالوج المالك"
                className="h-full w-full bg-transparent pr-10 pl-11 text-[11px] font-bold outline-none"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch("")}
                  aria-label="مسح بحث الكتالوج"
                  className="touch-button absolute left-1.5 grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200"
                >
                  <CloseIcon className="size-4" />
                </button>
              )}
            </label>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pl-1">
            {visible.length === 0 ? (
              <div className="grid h-full min-h-48 place-items-center rounded-2xl border-2 border-dashed border-slate-200 text-center dark:border-slate-700">
                <div>
                  <GridIcon className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 text-[13px] font-bold text-slate-500">
                    {catalogSearch
                      ? "لا توجد نتائج مطابقة للبحث"
                      : "لا توجد أصناف في هذا القسم"}
                  </p>
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch("")}
                      className="touch-button mt-3 min-h-10 rounded-xl bg-indigo-600 px-4 text-[11px] font-bold text-white"
                    >
                      مسح البحث
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {visible.map((product) => (
                  <div
                    key={product.id}
                    className={`rounded-2xl border p-3 ${product.active === false
                      ? "border-slate-200 bg-slate-100 opacity-75 dark:border-slate-700 dark:bg-slate-800"
                      : "border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        onError={handleImageError}
                        src={product.image_url}
                        alt=""
                        className="size-14 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display truncate text-[14px] font-bold">
                          {product.name_ar}
                        </h3>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          وحدة الجرد: {unitName(product)} · مواصفة الورقة:{" "}
                          {product.unit_label}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ${product.active === false
                            ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                        >
                          {product.active === false ? "مؤرشف" : "نشط"}
                        </span>
                      </div>
                    </div>
                    {deleteId === product.id ? (
                      <div className="mt-3 rounded-xl bg-red-50 p-2 dark:bg-red-950/50">
                        <p className="text-[10px] font-bold text-red-700 dark:text-red-300">
                          حذف نهائي؟ لن يظهر الصنف في السجلات الجديدة.
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteBusyId(product.id)
                              setImportError("")
                              void onDelete(product.id)
                                .then(() => {
                                  setDeleteId(null)
                                  if (draft?.id === product.id) setDraft(null)
                                })
                                .catch(() =>
                                  setImportError(
                                    "تعذر حذف الصنف ولم تتغير البيانات المحفوظة.",
                                  ),
                                )
                                .finally(() => setDeleteBusyId(null))
                            }}
                            disabled={
                              products.length <= 1 ||
                              deleteBusyId === product.id
                            }
                            className="touch-button min-h-10 rounded-lg bg-red-600 text-[10px] font-bold text-white disabled:bg-slate-300"
                          >
                            {deleteBusyId === product.id
                              ? "جاري الحذف..."
                              : "تأكيد الحذف"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="touch-button min-h-10 rounded-lg bg-white text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => editProduct(product)}
                          className="touch-button min-h-10 rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleActive(product.id)}
                          disabled={
                            product.active !== false && activeCount <= 1
                          }
                          className="touch-button min-h-10 rounded-lg bg-amber-50 text-[10px] font-bold text-amber-700 disabled:opacity-40 dark:bg-amber-950 dark:text-amber-300"
                        >
                          {product.active === false ? "استعادة" : "أرشفة"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(product.id)}
                          className="touch-button min-h-10 rounded-lg bg-red-50 text-[10px] font-bold text-red-600 dark:bg-red-950 dark:text-red-300"
                        >
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
          {draft ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {products.some((product) => product.id === draft.id)
                      ? "تعديل الصنف"
                      : "صنف جديد"}
                  </p>
                  <h3 className="font-display text-[18px] font-bold">
                    بيانات المنتج
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="touch-button grid size-10 place-items-center rounded-xl bg-white text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>

              <label className="mt-4 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                الاسم بالعربية
                <input
                  value={draft.name_ar}
                  onChange={(event) =>
                    setDraft({ ...draft, name_ar: event.target.value })
                  }
                  placeholder="مثال: لحم عجل طازج"
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                الاسم بالإنجليزية
                <input
                  value={draft.name_en}
                  onChange={(event) =>
                    setDraft({ ...draft, name_en: event.target.value })
                  }
                  placeholder="Example: Ground cumin"
                  dir="ltr"
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-left text-[14px] font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>

              <p className="mt-4 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                نوع الصنف
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-900">
                {([
                  [false, "صنف بسيط"],
                  [true, "منتج مركب"],
                ] as const).map(([isComposite, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setDraft({
                        ...draft,
                        is_composite: isComposite,
                        ...(isComposite && {
                          unit: "piece" as const,
                          unit_label: "حبة",
                          package_size: 1,
                        }),
                      })
                      if (!isComposite) setDraftComponents([])
                      setRecipeError("")
                    }}
                    className={`touch-button min-h-11 rounded-xl text-[10px] font-bold ${draft.is_composite === isComposite
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                التصنيف
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        category_id: category.id,
                        ...(category.slug === "spices" && {
                          unit: "g" as const,
                          unit_label: "جم",
                          image_url: defaultItemImage(category),
                        }),
                      })
                    }
                    className={`touch-button min-h-11 rounded-xl text-[10px] font-bold ${draft.category_id === category.id
                      ? "bg-slate-950 text-white dark:bg-emerald-600"
                      : "border border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    {category.label_ar}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                وحدة الجرد
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {([
                  ["g", "جرام"],
                  ["kg", "كيلوجرام"],
                  ["ml", "ملليلتر"],
                  ["pack", "عبوة"],
                  ["jar", "برطمان"],
                  ["piece", "حبة"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={draft.is_composite && value !== "piece"}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        unit: value,
                        unit_label: inventoryUnitName(value),
                        package_size: 1,
                      })
                    }
                    className={`touch-button min-h-11 rounded-xl text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-35 ${draft.unit === value
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                وصف الوحدة كما يظهر في المصدر
                <input
                  value={draft.unit_label}
                  onChange={(event) =>
                    setDraft({ ...draft, unit_label: event.target.value })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  ["opening_quantity", "الكمية الافتتاحية"],
                  ["minimum_stock_alert", "تنبيه الحد الأدنى"],
                  ["cost_per_unit", "تكلفة الوحدة"],
                ] as const).map(([field, label]) => (
                  <label
                    key={field}
                    className="block text-[10px] font-bold text-slate-600 dark:text-slate-300"
                  >
                    {label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft[field]}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [field]: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 text-[12px] font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                  </label>
                ))}
              </div>

              {draft.is_composite && (
                <section className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-3 dark:border-orange-900 dark:bg-orange-950/30">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-orange-800 dark:text-orange-200">
                        مكونات المنتج
                      </p>
                      <p className="mt-0.5 text-[9px] text-orange-700 dark:text-orange-300">
                        الكمية المستخدمة لإنتاج حبة واحدة
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addComponent}
                      className="touch-button min-h-10 rounded-xl bg-orange-600 px-3 text-[10px] font-bold text-white"
                    >
                      + إضافة مكون
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {draftComponents.map((component, index) => {
                      const options = products.filter(
                        (item) =>
                          !item.is_composite &&
                          item.id !== draft.id &&
                          (!draftComponents.some(
                            (entry) =>
                              entry.id !== component.id &&
                              entry.component_item_id === item.id,
                          ) ||
                            item.id === component.component_item_id),
                      )
                      const selectedComponent = products.find(
                        (item) => item.id === component.component_item_id,
                      )
                      return (
                        <div
                          key={component.id}
                          className="rounded-2xl border border-orange-200 bg-white p-3 shadow-sm dark:border-orange-900 dark:bg-slate-900"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              onError={handleImageError}
                              src={selectedComponent?.image_url || logoMark}
                              alt=""
                              className="size-12 shrink-0 rounded-xl bg-slate-100 object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                                {selectedComponent?.name_ar ?? "اختر مكوناً"}
                              </p>
                              <p className="mt-0.5 text-[9px] font-semibold text-orange-700 dark:text-orange-300">
                                مكون {index + 1} · وحدة الوصفة{" "}
                                {baseUnitName(component.unit)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftComponents((current) =>
                                  current.filter(
                                    (entry) => entry.id !== component.id,
                                  ),
                                )
                              }
                              aria-label={`حذف المكون ${index + 1}`}
                              className="touch-button grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950"
                            >
                              <CloseIcon className="size-4" />
                            </button>
                          </div>

                          <label className="mt-3 block text-[9px] font-bold text-slate-500 dark:text-slate-400">
                            الصنف البسيط
                            <div className="relative mt-1">
                              <select
                                value={component.component_item_id}
                                onChange={(event) => {
                                  const item = products.find(
                                    (entry) => entry.id === event.target.value,
                                  )
                                  setDraftComponents((current) =>
                                    current.map((entry) =>
                                      entry.id === component.id
                                        ? {
                                          ...entry,
                                          component_item_id:
                                            event.target.value,
                                          unit: item
                                            ? defaultBaseUnit(item)
                                            : entry.unit,
                                          updated_at: entityTimestamp(),
                                        }
                                        : entry,
                                    ),
                                  )
                                }}
                                className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pl-10 text-[12px] font-bold text-slate-900 outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              >
                                {options.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name_ar}
                                    {item.name_en ? ` · ${item.name_en}` : ""}
                                  </option>
                                ))}
                              </select>
                              <span className="pointer-events-none absolute left-3 top-3.5 text-[12px] text-slate-400">
                                ▾
                              </span>
                            </div>
                          </label>

                          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                            <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                              الكمية في حبة واحدة
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={component.quantity}
                                aria-label={`كمية المكون ${index + 1}`}
                                onChange={(event) =>
                                  setDraftComponents((current) =>
                                    current.map((entry) =>
                                      entry.id === component.id
                                        ? {
                                          ...entry,
                                          quantity: Number(
                                            event.target.value,
                                          ),
                                          updated_at: entityTimestamp(),
                                        }
                                        : entry,
                                    ),
                                  )
                                }
                                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-[14px] font-bold dark:border-slate-700 dark:bg-slate-800"
                              />
                            </label>
                            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                              وحدة القياس
                              <div className="mt-1 flex min-h-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 text-[12px] font-bold text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
                                {baseUnitName(component.unit)}
                              </div>
                            </div>
                          </div>
                          <p className="mt-2 text-[9px] leading-5 text-slate-500 dark:text-slate-400">
                            سيُخصم هذا المقدار تلقائياً عند تسجيل المنتج المركب،
                            ويمكن جرد الصنف أو تسجيل استهلاكه منفرداً في أي وقت.
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-950 p-3 text-white">
                    <p className="text-[9px] font-semibold text-slate-400">
                      ملخص الوصفة المباشر
                    </p>
                    <p className="mt-1 text-[11px] font-bold leading-6">
                      1 {draft.name_ar || "منتج مركب"} ={" "}
                      {recipeSummary || "أضف المكونات والكميات"}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-emerald-400">
                      التكلفة المحسوبة للوحدة: {calculatedRecipeCost.toFixed(3)}
                    </p>
                  </div>
                  {recipeError && (
                    <p
                      role="alert"
                      className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300"
                    >
                      {recipeError}
                    </p>
                  )}
                </section>
              )}

              <p className="mt-4 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                صورة المنتج
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setImageSource("library")
                    setUploadError("")
                  }}
                  className={`touch-button flex min-h-12 items-center justify-center gap-2 rounded-xl text-[11px] font-bold ${imageSource === "library"
                    ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                    : "text-slate-500 dark:text-slate-400"
                    }`}
                >
                  <ImageLibraryIcon className="size-5" />
                  الصور المتوفرة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageSource("upload")
                    setUploadError("")
                  }}
                  className={`touch-button flex min-h-12 items-center justify-center gap-2 rounded-xl text-[11px] font-bold ${imageSource === "upload"
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                    : "text-slate-500 dark:text-slate-400"
                    }`}
                >
                  <UploadImageIcon className="size-5" />
                  رفع من الجهاز
                </button>
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) =>
                  void uploadCustomImage(event.target.files?.[0])
                }
              />
              {imageSource === "library" ? (
                <div className="state-panel mt-2 grid grid-cols-4 gap-1.5">
                  {imageChoices.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setDraft({ ...draft, image_url: image })}
                      aria-label="اختيار صورة المنتج"
                      className={`touch-button overflow-hidden rounded-xl border-2 ${draft.image_url === image
                        ? "border-emerald-500 shadow-md shadow-emerald-500/20"
                        : "border-transparent"
                        }`}
                    >
                      <img
                        onError={handleImageError}
                        src={image}
                        alt=""
                        className="aspect-square size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="state-panel mt-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploading}
                    className="touch-button flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-3 text-[12px] font-bold text-indigo-700 disabled:opacity-60 active:scale-[0.98] dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
                      <UploadImageIcon className="size-6" />
                    </span>
                    {isUploading
                      ? "جاري ضغط وتجهيز الصورة..."
                      : "اختر صورة من معرض الجهاز"}
                  </button>
                  <p className="mt-1.5 text-[10px] font-medium leading-5 text-slate-500 dark:text-slate-400">
                    PNG أو JPG أو WebP · حتى 10 ميجابايت · تُضغط وتحفظ على هذا
                    الجهاز
                  </p>
                  {uploadError && (
                    <p className="mt-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-600 dark:bg-red-950 dark:text-red-300">
                      {uploadError}
                    </p>
                  )}
                  {draft.image_url.startsWith("data:image") && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/40">
                      <img
                        onError={handleImageError}
                        src={draft.image_url}
                        alt="معاينة الصورة المرفوعة"
                        className="size-14 rounded-lg object-cover"
                      />
                      <div>
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          تم تجهيز الصورة المخصصة
                        </p>
                        <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                          ستُحفظ مع المنتج على هذا الجهاز
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={!draft.name_ar.trim()}
                className="touch-button mt-4 min-h-14 w-full rounded-2xl bg-emerald-600 text-[13px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-[0.98]"
              >
                حفظ المنتج
              </button>
            </>
          ) : (
            <div className="grid h-full min-h-64 place-items-center text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950">
                  <GridIcon className="size-7" />
                </span>
                <h3 className="font-display mt-3 text-[16px] font-bold">
                  اختر صنفاً لتعديله
                </h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  أو أضف منتجاً جديداً إلى كتالوج الجرد.
                </p>
                <button
                  type="button"
                  onClick={createProduct}
                  className="touch-button mt-4 min-h-12 rounded-xl bg-indigo-600 px-5 text-[12px] font-bold text-white active:scale-[0.98]"
                >
                  إضافة صنف جديد
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function OwnerConfigurator({
  products,
  draftConfig,
  ownerPhone,
  deviceRole,
  resetConfirm,
  onAdjust,
  onEditPhone,
  onChangePin,
  onManageRolePins,
  onManageProducts,
  onOpenAnalytics,
  onOpenBackup,
  onOpenDeviceConnect,
  onRoleChange,
  onResetRequest,
  onResetCancel,
  onResetConfirm,
  onSave,
  onClose,
}: {
  products: Item[]
  draftConfig: ProductConfig
  ownerPhone: string
  deviceRole: DeviceRole
  resetConfirm: boolean
  onAdjust: (
    id: string,
    field: "opening_quantity" | "shrinkage_percent",
    delta: number,
  ) => void
  onEditPhone: () => void
  onChangePin: () => void
  onManageRolePins: () => void
  onManageProducts: () => void
  onOpenAnalytics: () => void
  onOpenBackup: () => void
  onOpenDeviceConnect: () => void
  onRoleChange: (role: DeviceRole) => void
  onResetRequest: () => void
  onResetCancel: () => void
  onResetConfirm: () => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-title"
      className="flex h-[calc(100dvh-16px)] max-h-[780px] w-full max-w-[1040px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <OwnerSettingsIcon className="size-6" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              إعدادات المالك
            </p>
            <h2
              id="config-title"
              className="font-display text-[22px] font-bold"
            >
              إدارة الكتالوج ودورة المخزون
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الإعدادات"
          className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <CloseIcon className="size-5" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:grid-cols-[minmax(0,1fr)_290px] md:overflow-hidden md:p-4">
        <div className="min-h-0 overflow-y-auto pl-1">
          {products.length === 0 ? (
            <div className="grid min-h-full place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <GridIcon className="mx-auto size-10 text-slate-300" />
                <h3 className="font-display mt-3 text-[18px] font-bold">
                  لا توجد أصناف نشطة
                </h3>
                <p className="mt-2 text-[12px] font-medium leading-6 text-slate-500 dark:text-slate-400">
                  افتح إدارة الأصناف لإضافة منتج جديد أو استعادة المنتجات
                  المؤرشفة.
                </p>
                <button
                  type="button"
                  onClick={onManageProducts}
                  className="touch-button mt-4 min-h-14 rounded-2xl bg-emerald-600 px-6 text-[13px] font-bold text-white active:scale-[0.98]"
                >
                  فتح إدارة الأصناف
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {products.map((product) => {
                return (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        onError={handleImageError}
                        src={product.image_url}
                        alt=""
                        className="size-10 rounded-xl object-cover"
                      />
                      <h3 className="font-display line-clamp-1 text-[13px] font-bold">
                        {product.name_ar}
                      </h3>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[10px] font-bold dark:bg-slate-900">
                      <span className="text-slate-500">وحدة الجرد</span>
                      <span>
                        {unitName(product)} · {product.unit_label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto pl-1">
          <div className="flex flex-col gap-3">
            <section className="rounded-2xl bg-slate-950 p-4 text-white ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/20">
                    <ProductManagementIcon className="size-6" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-400">
                      كتالوج الأصناف
                    </p>
                    <h3 className="font-display mt-1 text-[16px] font-bold">
                      إدارة المنتجات
                    </h3>
                  </div>
                </div>
                <strong className="text-[24px] font-bold tabular-nums text-emerald-400">
                  {products.length}
                </strong>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                إضافة وتعديل وأرشفة وحذف أصناف المخزون.
              </p>
              <button
                type="button"
                onClick={onManageProducts}
                className="touch-button mt-3 min-h-12 w-full rounded-xl bg-emerald-500 text-[12px] font-bold text-white active:scale-[0.98]"
              >
                فتح إدارة الأصناف
              </button>
            </section>

            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
                  <AnalyticsIcon className="size-6" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold">
                    تحليلات الجرد
                  </h3>
                  <p className="mt-1 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                    اتجاهات الرصيد والفرق المتكرر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAnalytics}
                className="touch-button mt-3 min-h-12 w-full rounded-xl bg-indigo-600 text-[12px] font-bold text-white active:scale-[0.98]"
              >
                فتح لوحة التحليلات
              </button>
            </section>

            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-violet-600 shadow-sm dark:bg-slate-800 dark:text-violet-300">
                  <LockIcon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold">
                    رموز الملحمة والمطعم
                  </h3>
                  <p className="mt-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
                    PIN مستقل لكل موقع لمنع الدخول المتبادل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onManageRolePins}
                className="touch-button mt-3 min-h-12 w-full rounded-xl bg-violet-600 text-[12px] font-bold text-white active:scale-[0.98]"
              >
                إدارة رموز المواقع
              </button>
            </section>

            <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950/40">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-teal-600 shadow-sm dark:bg-slate-800 dark:text-teal-300">
                  <OwnerSettingsIcon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold">
                    معرّف الفرع السحابي
                  </h3>
                  <p className="mt-1 text-[10px] font-medium text-teal-700 dark:text-teal-300">
                    لربط أجهزة الملحمة والمطعم والمالك فورياً
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-teal-300 bg-white p-2.5 dark:border-teal-800 dark:bg-slate-900">
                <p className="text-[10px] font-bold text-slate-500">
                  معرّف الفرع النشط (Branch ID):
                </p>
                <code
                  dir="ltr"
                  className="font-mono text-[13px] font-bold text-teal-700 dark:text-teal-300"
                >
                  {storeAuthService.getBranchId()}
                </code>
              </div>
              <button
                type="button"
                onClick={onOpenDeviceConnect}
                className="touch-button mt-3 min-h-11 w-full rounded-xl bg-teal-600 text-[12px] font-bold text-white hover:bg-teal-700 active:scale-[0.98]"
              >
                فتح مركز ربط الأجهزة السحابية
              </button>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-slate-800 dark:text-emerald-300">
                  <DataBackupIcon className="size-6" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold">
                    بيانات الجهاز
                  </h3>
                  <p className="mt-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    نسخ احتياطي ونقل آمن للبيانات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenBackup}
                className="touch-button mt-3 min-h-12 w-full rounded-xl bg-emerald-600 text-[12px] font-bold text-white active:scale-[0.98]"
              >
                فتح النسخ والاستعادة
              </button>
            </section>

            <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
              <h3 className="font-display text-[15px] font-bold">
                دور هذا الجهاز
              </h3>
              <p className="mt-1 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                تم فتح هذا المحول بعد التحقق من رمز المالك.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {([
                  ["owner", "المالك"],
                  ["butcher", "الملحمة"],
                  ["restaurant", "المطعم"],
                ] as const).map(([role, label]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onRoleChange(role)}
                    className={`touch-button min-h-11 rounded-xl text-[10px] font-bold ${deviceRole === role
                      ? "bg-sky-600 text-white"
                      : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                رقم واتساب مستلم التقرير
              </p>
              <strong
                dir="ltr"
                className="mt-2 block text-[20px] font-bold tabular-nums"
              >
                +{ownerPhone}
              </strong>
              <button
                type="button"
                onClick={onEditPhone}
                className="touch-button mt-3 min-h-12 w-full rounded-xl border border-slate-300 bg-white text-[12px] font-bold text-indigo-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-700 dark:text-indigo-300"
              >
                تعديل الرقم بلوحة الأرقام
              </button>
            </section>

            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
                  <LockIcon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold">
                    رمز دخول المالك
                  </h3>
                  <p className="mt-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                    رمز مكون من 4 أرقام
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onChangePin}
                className="touch-button mt-3 min-h-12 w-full rounded-xl bg-indigo-600 text-[12px] font-bold text-white active:scale-[0.98]"
              >
                تغيير رمز PIN
              </button>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
              <h3 className="font-display text-[15px] font-bold text-amber-900 dark:text-amber-200">
                بدء شفت جرد جديد
              </h3>
              <p className="mt-1 text-[11px] font-medium leading-5 text-amber-700 dark:text-amber-300">
                سيُنقل الرصيد الفعلي إلى رصيد أول اليوم، ثم يُصفّر الوارد والصادر
                والجرد الفعلي للدورة الجديدة.
              </p>
              {resetConfirm ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onResetConfirm}
                    className="touch-button min-h-12 rounded-xl bg-red-600 text-[11px] font-bold text-white active:scale-95"
                  >
                    متابعة إعداد الشفت
                  </button>
                  <button
                    type="button"
                    onClick={onResetCancel}
                    className="touch-button min-h-12 rounded-xl bg-white text-[11px] font-bold text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onResetRequest}
                  className="touch-button mt-3 min-h-12 w-full rounded-xl border border-red-200 bg-white text-[11px] font-bold text-red-600 active:scale-[0.98] dark:border-red-900 dark:bg-red-950"
                >
                  إقفال الحركة وبدء شفت جديد
                </button>
              )}
            </section>

            <div className="mt-auto rounded-2xl bg-emerald-50 p-3 text-[11px] font-semibold leading-5 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              تُحفظ الأصناف والوحدات وحركة اليوم محلياً وتُطبّق فوراً على الرصيد
              المتوقع والفرق.
            </div>
          </div>
        </aside>
      </div>

      <footer className="grid grid-cols-1 gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[1.3fr_0.7fr] sm:gap-3 sm:px-6 sm:py-4 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={onSave}
          className="touch-button min-h-14 rounded-2xl bg-emerald-600 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
        >
          حفظ الإعدادات وتطبيقها
        </button>
        <button
          type="button"
          onClick={onClose}
          className="touch-button min-h-14 rounded-2xl border border-slate-300 bg-white text-[13px] font-bold text-slate-600 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          إلغاء التعديلات
        </button>
      </footer>
    </section>
  )
}

function ConfigStepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
}: {
  label: string
  value: string
  unit: string
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white p-1.5 dark:bg-slate-900">
      <span className="min-w-0 flex-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <button
        type="button"
        onClick={onMinus}
        className="touch-button grid size-9 place-items-center rounded-lg bg-slate-100 text-[20px] font-bold text-slate-700 active:scale-90 dark:bg-slate-700 dark:text-white"
      >
        −
      </button>
      <strong className="min-w-[58px] text-center text-[13px] font-bold tabular-nums">
        {value} <span className="text-[10px]">{unit}</span>
      </strong>
      <button
        type="button"
        onClick={onPlus}
        className="touch-button grid size-9 place-items-center rounded-lg bg-emerald-100 text-[20px] font-bold text-emerald-700 active:scale-90 dark:bg-emerald-900 dark:text-emerald-200"
      >
        +
      </button>
    </div>
  )
}

function PhoneKeypad({
  phone,
  onDigit,
  onDelete,
  onSave,
  onBack,
}: {
  phone: string
  onDigit: (digit: string) => void
  onDelete: () => void
  onSave: () => void
  onBack: () => void
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-title"
      className="w-full max-w-[450px] rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-[#111827]"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            إعدادات المالك
          </p>
          <h2 id="phone-title" className="font-display text-[21px] font-bold">
            رقم واتساب التقرير
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="touch-button grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div
        dir="ltr"
        className="mt-5 rounded-2xl bg-slate-950 px-4 py-4 text-center text-[26px] font-bold tabular-nums text-emerald-400"
      >
        +{phone || "—"}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => onDigit(digit)}
            className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[23px] font-bold tabular-nums active:scale-95 dark:border-slate-600 dark:bg-slate-800"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={onBack}
          className="touch-button min-h-14 rounded-2xl text-[12px] font-bold text-slate-500 dark:text-slate-400"
        >
          رجوع
        </button>
        <button
          type="button"
          onClick={() => onDigit("0")}
          className="touch-button min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[23px] font-bold tabular-nums active:scale-95 dark:border-slate-600 dark:bg-slate-800"
        >
          0
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="حذف الرقم الأخير"
          className="touch-button grid min-h-14 place-items-center rounded-2xl bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
        >
          <BackspaceIcon className="size-5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={phone.length < 10}
        className="touch-button mt-4 min-h-14 w-full rounded-2xl bg-emerald-600 text-[14px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-[0.98]"
      >
        حفظ رقم الواتساب
      </button>
    </section>
  )
}

function AuditCountCard({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: "green" | "amber" | "red"
}) {
  const styles = {
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
  }
  return (
    <div className={`rounded-2xl border p-4 text-center ${styles[tone]}`}>
      <strong className="block text-[31px] font-bold tabular-nums">
        {count}
      </strong>
      <span className="mt-1 block text-[12px] font-bold">{label}</span>
    </div>
  )
}

function ProductCard({
  product,
  movement,
  weight,
  autoDeductions,
  selected,
  onSelect,
}: {
  product: Item
  movement: InventoryFlow
  weight: number | null
  autoDeductions: AutoDeductView[]
  selected: boolean
  onSelect: () => void
}) {
  const status = getInventoryStatus(product, weight)
  const unit = unitName(product)
  const difference = weight === null ? null : weight - product.opening_quantity
  const statusClasses = {
    matched:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    tolerance:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    shortage: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    pending:
      "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect()
      }}
      aria-pressed={selected}
      className={`product-card touch-button group flex min-h-[258px] min-w-0 flex-col overflow-hidden rounded-2xl border-2 p-3.5 text-right transition ${selected
        ? "border-emerald-600 bg-emerald-50 shadow-[0_8px_28px_rgba(5,150,105,0.16)] dark:border-emerald-400 dark:bg-emerald-950/50"
        : weight === null
          ? "border-dashed border-slate-300 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-800/40"
          : "border-slate-200 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.05)] hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500"
        }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative size-[92px] shrink-0 overflow-hidden rounded-[14px] bg-slate-100 shadow-sm">
          <img
            onError={handleImageError}
            src={product.image_url}
            alt={product.name_ar}
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
          {selected && (
            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
              <CheckIcon className="size-4" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display line-clamp-2 min-h-[52px] text-[19px] font-bold leading-[26px]">
            {product.name_ar}
          </h2>
          <span
            className={`mt-1.5 inline-flex max-w-full truncate rounded-lg px-2.5 py-1.5 text-[12px] font-bold ${statusClasses[status.tone]}`}
          >
            {status.label}
          </span>
          {product.is_composite && (
            <span className="mt-1.5 inline-flex rounded-lg bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
              منتج مركب
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-100 px-2.5 py-2 dark:bg-slate-900/60">
          <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            أول اليوم + الوارد
          </p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums">
            {movement.opening.toFixed(2)} + {movement.incoming.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-2.5 py-2 dark:bg-slate-900/60">
          <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            الصادر ← الرصيد المتوقع
          </p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums">
            {movement.outgoing.toFixed(2)} ←{" "}
            {product.opening_quantity.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex min-h-[54px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900">
        <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">
          الفعلي {difference === null ? "" : `· الفرق ${difference.toFixed(2)}`}
        </span>
        <strong
          className={`text-[33px] font-bold leading-none tabular-nums ${weight === null ? "text-slate-300 dark:text-slate-600" : ""
            }`}
        >
          {weight === null ? "— —" : weight.toFixed(2)}{" "}
          <span className="text-[12px] font-semibold text-slate-500">
            {unit}
          </span>
        </strong>
      </div>
      {product.is_composite && weight !== null && (
        <details
          className="mt-2 min-w-0 rounded-xl border border-orange-200 bg-orange-50 p-2 dark:border-orange-900 dark:bg-orange-950/30"
          onClick={(event) => event.stopPropagation()}
        >
          <summary className="cursor-pointer truncate text-[10px] font-bold text-orange-800 dark:text-orange-200">
            المكونات المخصومة تلقائياً ({autoDeductions.length})
          </summary>
          <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
            {autoDeductions.map((deduction) => (
              <div
                key={deduction.movementId}
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-[9px] dark:bg-slate-900"
              >
                <span className="font-bold">{deduction.name}</span>
                <span
                  className={
                    deduction.negativeStock
                      ? "font-bold text-red-600"
                      : "text-slate-500"
                  }
                >
                  −{deduction.quantity} {baseUnitName(deduction.unit)}
                  {deduction.negativeStock ? " · رصيد سالب" : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </article>
  )
}

function SummaryMetric({
  label,
  value,
  unit,
  danger = false,
}: {
  label: string
  value: string
  unit: string
  danger?: boolean
}) {
  return (
    <div className="flex items-end justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5 dark:border-slate-700">
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <strong
        className={`text-[13px] font-bold tabular-nums ${danger ? "text-red-600 dark:text-red-400" : ""
          }`}
      >
        {value} <span className="text-[10px]">{unit}</span>
      </strong>
    </div>
  )
}
