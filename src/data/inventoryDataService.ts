import {
  CATEGORY_IDS,
  INVENTORY_SCHEMA_VERSION,
  defaultItemImage,
  emptyMovement,
  seedCategories,
  seedItems,
} from "../inventoryCatalog"
import type {
  AuditRecord,
  Category,
  CategorySlug,
  DeviceRole,
  InventoryFlow,
  InventoryLocation,
  Item,
  ItemConfig,
  InventoryBackup,
  MascotPreferences,
  RecipeComponent,
  RolePins,
  ShiftInfo,
  StockMovement,
  Transfer,
  TransferLine,
} from "../models"
import { createEntityId, entityTimestamp } from "../models"
import {
  applyCompositeCountState,
  adjustStockByBaseQuantity,
  defaultBaseUnit,
  storedToBaseQuantity,
  validateRecipe,
} from "../features/compositeInventory"
import {
  INVENTORY_CLOUD_KEYS,
  INVENTORY_STORAGE_KEYS,
  inventoryStorage,
  type StorageEntries,
} from "../storage/repository"
import {
  pickCloudEntries,
  firebaseInventorySync,
} from "./firebaseInventorySync"

export { INVENTORY_STORAGE_KEYS }

export type InventoryBootstrap = {
  categories: Category[]
  items: Item[]
  weights: Record<string, number | null>
  config: Record<string, ItemConfig>
  movements: Record<string, InventoryFlow>
  recipeComponents: RecipeComponent[]
  stockLedger: StockMovement[]
  auditHistory: AuditRecord[]
  pendingReportText: string
  theme: "light" | "dark" | "system"
  scaleName: string
  shift: ShiftInfo
  ownerPin: string
  ownerPhone: string
  deviceRole: DeviceRole | null
  locationWeights: Record<InventoryLocation, Record<string, number | null>>
  transfers: Transfer[]
  transferLines: TransferLine[]
  rolePins: RolePins
}

type TransferRequestLine = {
  item_id: string
  quantity_sent: number
}

const KEYS = {
  categories: "smart-inventory-categories",
  items: "smart-inventory-products",
  weights: "smart-inventory-weights",
  config: "smart-inventory-config",
  movements: "smart-inventory-movements",
  recipes: "smart-inventory-recipe-components",
  ledger: "smart-inventory-stock-ledger",
  auditHistory: "smart-inventory-audit-history",
  pendingReport: "smart-inventory-pending-report",
  theme: "smart-inventory-theme",
  scaleName: "smart-inventory-scale-name",
  shift: "smart-inventory-current-shift",
  ownerPin: "smart-inventory-owner-pin",
  ownerPhone: "smart-inventory-owner-phone",
  mascot: "smart-inventory-mascot-preferences",
  deviceRole: "smart-inventory-device-role",
  locationWeights: "smart-inventory-location-weights",
  transfers: "smart-inventory-transfers",
  transferLines: "smart-inventory-transfer-lines",
  rolePins: "smart-inventory-role-pins",
  schema: "smart-inventory-schema-version",
} as const

function parseJson<T>(value: string, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function parseArray<T>(value: string) {
  const parsed = parseJson<unknown>(value, [])
  return (Array.isArray(parsed) ? parsed : []) as T[]
}

function parseRecord<T>(value: string) {
  const parsed = parseJson<unknown>(value, {})
  return (
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  ) as Record<string, T>
}

function finiteNumber(value: unknown, fallback: number, minimum?: number) {
  const numeric = Number(value)
  if (
    !Number.isFinite(numeric) ||
    (minimum !== undefined && numeric < minimum)
  ) {
    return fallback
  }
  return numeric
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function legacySeedId(value: number) {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
}

function categoryIdFromLegacy(value: unknown) {
  if (isUuid(value)) return value
  const slug = String(value ?? "") as CategorySlug
  return CATEGORY_IDS[slug] ?? CATEGORY_IDS.meat
}

export function selectItemMigrationSource(
  storedItems: Array<Record<string, unknown>>,
) {
  return storedItems
}

export function migrateItemImage(categoryId: string, value: unknown) {
  const image = String(value ?? "")
  if (
    categoryId === CATEGORY_IDS.spices &&
    image.startsWith("data:image/svg+xml")
  ) {
    return defaultItemImage("spices")
  }
  const categorySlug = (Object.entries(CATEGORY_IDS).find(
    ([, id]) => id === categoryId,
  )?.[0] ?? "meat") as CategorySlug
  return image || defaultItemImage(categorySlug)
}

function migrateAuditRecords(value: string): AuditRecord[] {
  const records = parseArray<Record<string, unknown>>(value)
  return records.map((record) => {
    const createdAt = Number(
      record.created_at_ms ?? record.createdAt ?? Date.now(),
    )
    const safeCreatedAt = Number.isFinite(createdAt) ? createdAt : Date.now()
    const timestamp =
      typeof record.created_at === "string"
        ? record.created_at
        : new Date(safeCreatedAt).toISOString()
    return {
      ...record,
      id: isUuid(record.id) ? record.id : createEntityId(),
      created_at: timestamp,
      updated_at:
        typeof record.updated_at === "string" ? record.updated_at : timestamp,
      created_at_ms: safeCreatedAt,
      shift: typeof record.shift === "string" ? record.shift : "سجل جرد",
      completed: finiteNumber(record.completed, 0, 0),
      total: finiteNumber(record.total, 0, 0),
      book: finiteNumber(record.book, 0),
      actual: finiteNumber(record.actual, 0),
      allowance: finiteNumber(record.allowance, 0, 0),
      shortage: finiteNumber(record.shortage, 0),
      delivery: record.delivery === "sent" ? "sent" : "queued",
      reportText:
        typeof record.reportText === "string" ? record.reportText : "",
      shortageItems: Array.isArray(record.shortageItems)
        ? record.shortageItems
            .filter((item) => item && typeof item === "object")
            .map((item) => {
              const entry = item as Record<string, unknown>
              return {
                item_id:
                  typeof entry.item_id === "string" ? entry.item_id : undefined,
                name: typeof entry.name === "string" ? entry.name : "صنف",
                amount: finiteNumber(entry.amount, 0),
                unit: typeof entry.unit === "string" ? entry.unit : undefined,
              }
            })
        : [],
      items: Array.isArray(record.items)
        ? record.items
            .filter((item) => item && typeof item === "object")
            .map((item) => {
              const entry = item as Record<string, unknown>
              const nullableNumber = (input: unknown) =>
                input === null || input === undefined
                  ? null
                  : finiteNumber(input, 0)
              return {
                item_id:
                  typeof entry.item_id === "string" ? entry.item_id : undefined,
                name: typeof entry.name === "string" ? entry.name : "صنف",
                category_id:
                  typeof entry.category_id === "string"
                    ? entry.category_id
                    : undefined,
                category:
                  typeof entry.category === "string"
                    ? entry.category
                    : "المخزون",
                unit: typeof entry.unit === "string" ? entry.unit : "وحدة",
                opening: finiteNumber(entry.opening, 0),
                incoming: finiteNumber(entry.incoming, 0),
                outgoing: finiteNumber(entry.outgoing, 0),
                expected: finiteNumber(entry.expected, 0),
                actual: nullableNumber(entry.actual),
                difference: nullableNumber(entry.difference),
                notes: typeof entry.notes === "string" ? entry.notes : "",
              }
            })
        : [],
      composite_consumption: Array.isArray(record.composite_consumption)
        ? record.composite_consumption
            .filter((entry) => entry && typeof entry === "object")
            .map((entry) => {
              const consumption = entry as Record<string, unknown>
              return {
                parent_movement_id: String(
                  consumption.parent_movement_id ?? "",
                ),
                composite_item_id: String(consumption.composite_item_id ?? ""),
                composite_name:
                  typeof consumption.composite_name === "string"
                    ? consumption.composite_name
                    : "صنف مركب",
                component_item_id: String(consumption.component_item_id ?? ""),
                component_name:
                  typeof consumption.component_name === "string"
                    ? consumption.component_name
                    : "مكون",
                quantity: Math.abs(finiteNumber(consumption.quantity, 0)),
                unit:
                  consumption.unit === "ml" || consumption.unit === "piece"
                    ? consumption.unit
                    : "g",
                negative_stock: consumption.negative_stock === true,
              }
            })
        : [],
    } as AuditRecord
  })
}

function migrateShift(value: string): ShiftInfo {
  const stored = parseJson<Record<string, unknown>>(value, {})
  const startedAt = Number(stored.started_at ?? stored.startedAt ?? Date.now())
  const safeStartedAt = Number.isFinite(startedAt) ? startedAt : Date.now()
  const timestamp =
    typeof stored.created_at === "string"
      ? stored.created_at
      : new Date(safeStartedAt).toISOString()
  return {
    id: isUuid(stored.id) ? stored.id : createEntityId(),
    type:
      stored.type === "morning" ||
      stored.type === "night" ||
      stored.type === "evening"
        ? stored.type
        : "evening",
    label: typeof stored.label === "string" ? stored.label : "شفت المساء",
    branch:
      typeof stored.branch === "string" ? stored.branch : "فرع المدينة المنورة",
    started_at: safeStartedAt,
    created_at: timestamp,
    updated_at:
      typeof stored.updated_at === "string" ? stored.updated_at : timestamp,
  }
}

export function normalizeLocationWeights(
  items: Item[],
  fallbackWeights: Record<string, number | null>,
  stored: Partial<Record<InventoryLocation, Record<string, number | null>>>,
): Record<InventoryLocation, Record<string, number | null>> {
  const normalize = (
    source: Record<string, number | null> | undefined,
    fallback: Record<string, number | null> = {},
  ) =>
    Object.fromEntries(
      items.map((item) => {
        const raw = Object.prototype.hasOwnProperty.call(source ?? {}, item.id)
          ? source?.[item.id]
          : fallback[item.id]
        return [
          item.id,
          raw === null || raw === undefined || !Number.isFinite(Number(raw))
            ? null
            : Number(raw),
        ]
      }),
    )
  return {
    butcher: normalize(stored.butcher),
    restaurant: normalize(stored.restaurant, fallbackWeights),
  }
}

export function pruneItemRelations<T>(
  itemId: string,
  entries: Record<string, T>,
) {
  const { [itemId]: _removed, ...remaining } = entries
  return remaining
}

export function pruneItemLedger(itemId: string, ledger: StockMovement[]) {
  const removedIds = new Set(
    ledger
      .filter((movement) => movement.item_id === itemId)
      .map((movement) => movement.id),
  )
  return ledger.filter(
    (movement) =>
      movement.item_id !== itemId &&
      (movement.parent_movement_id === null ||
        !removedIds.has(movement.parent_movement_id)),
  )
}

export function validateTransferRequest(lines: TransferRequestLine[]) {
  if (!lines.length) return "أضف صنفاً واحداً بكمية صحيحة على الأقل."
  const itemIds = new Set<string>()
  for (const line of lines) {
    if (
      !line.item_id ||
      !Number.isFinite(line.quantity_sent) ||
      line.quantity_sent <= 0
    ) {
      return "أضف صنفاً واحداً بكمية صحيحة على الأقل."
    }
    if (itemIds.has(line.item_id)) return "لا يمكن تكرار الصنف في التحويل نفسه."
    itemIds.add(line.item_id)
  }
  return null
}

export function prepareBackupReplacements(backup: InventoryBackup) {
  const restored: StorageEntries = Object.fromEntries(
    INVENTORY_STORAGE_KEYS.map((key) => [key, null]),
  )
  Object.entries(backup.data).forEach(([key, value]) => {
    if ((INVENTORY_STORAGE_KEYS as readonly string[]).includes(key)) {
      restored[key] = value
    }
  })
  if (backup.version === 1) {
    restored[KEYS.schema] = null
    restored[KEYS.movements] = null
  }
  return restored
}

export function mergeLocationWeights(
  local: Record<InventoryLocation, Record<string, number | null>>,
  remote: Record<InventoryLocation, Record<string, number | null>>,
  localRole: DeviceRole | null,
): Record<InventoryLocation, Record<string, number | null>> {
  const localButcher = local.butcher ?? {}
  const remoteButcher = remote.butcher ?? {}
  const localRestaurant = local.restaurant ?? {}
  const remoteRestaurant = remote.restaurant ?? {}

  let mergedButcher: Record<string, number | null>
  let mergedRestaurant: Record<string, number | null>

  if (localRole === "butcher") {
    mergedButcher = { ...remoteButcher, ...localButcher }
    mergedRestaurant = { ...localRestaurant, ...remoteRestaurant }
  } else if (localRole === "restaurant") {
    mergedButcher = { ...localButcher, ...remoteButcher }
    mergedRestaurant = { ...remoteRestaurant, ...localRestaurant }
  } else {
    mergedButcher = { ...localButcher, ...remoteButcher }
    mergedRestaurant = { ...localRestaurant, ...remoteRestaurant }
  }

  return {
    butcher: mergedButcher,
    restaurant: mergedRestaurant,
  }
}

export function mergeTransfers(
  local: Transfer[],
  remote: Transfer[],
): Transfer[] {
  const map = new Map<string, Transfer>()
  local.forEach((t) => {
    if (t && t.id) map.set(t.id, t)
  })
  remote.forEach((r) => {
    if (!r || !r.id) return
    const l = map.get(r.id)
    if (!l) {
      map.set(r.id, r)
      return
    }
    const lTerminal = l.status !== "Sent"
    const rTerminal = r.status !== "Sent"
    if (lTerminal && !rTerminal) {
      map.set(r.id, {
        ...r,
        status: l.status,
        received_at: l.received_at ?? r.received_at,
        updated_at: l.updated_at,
      })
    } else if (!lTerminal && rTerminal) {
      map.set(r.id, r)
    } else {
      const lTime = new Date(l.updated_at || l.created_at || 0).getTime()
      const rTime = new Date(r.updated_at || r.created_at || 0).getTime()
      map.set(r.id, rTime >= lTime ? r : l)
    }
  })
  return Array.from(map.values())
}

export function mergeTransferLines(
  local: TransferLine[],
  remote: TransferLine[],
): TransferLine[] {
  const map = new Map<string, TransferLine>()
  local.forEach((l) => {
    if (l && l.id) map.set(l.id, l)
  })
  remote.forEach((r) => {
    if (!r || !r.id) return
    const l = map.get(r.id)
    if (!l) {
      map.set(r.id, r)
      return
    }
    if (l.quantity_received !== null && r.quantity_received === null) {
      map.set(r.id, l)
    } else if (r.quantity_received !== null && l.quantity_received === null) {
      map.set(r.id, r)
    } else {
      const lTime = new Date(l.updated_at || l.created_at || 0).getTime()
      const rTime = new Date(r.updated_at || r.created_at || 0).getTime()
      map.set(r.id, rTime >= lTime ? r : l)
    }
  })
  return Array.from(map.values())
}

export function mergeStockLedger(
  local: StockMovement[],
  remote: StockMovement[],
): StockMovement[] {
  const map = new Map<string, StockMovement>()
  local.forEach((m) => {
    if (m && m.id) map.set(m.id, m)
  })
  remote.forEach((m) => {
    if (m && m.id) map.set(m.id, m)
  })
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  )
}

export function mergeRolePins(
  local: RolePins,
  remote: RolePins,
  localRole: DeviceRole | null,
): RolePins {
  if (localRole === "butcher" || localRole === "restaurant") {
    return {
      butcher: /^\d{4}$/.test(remote.butcher) ? remote.butcher : local.butcher,
      restaurant: /^\d{4}$/.test(remote.restaurant) ? remote.restaurant : local.restaurant,
    }
  }
  const remoteButcherSet = remote.butcher && remote.butcher !== "0000"
  const remoteRestSet = remote.restaurant && remote.restaurant !== "0000"
  return {
    butcher:
      local.butcher && local.butcher !== "0000"
        ? local.butcher
        : remoteButcherSet ? remote.butcher : local.butcher,
    restaurant:
      local.restaurant && local.restaurant !== "0000"
        ? local.restaurant
        : remoteRestSet ? remote.restaurant : local.restaurant,
  }
}

function itemCount(entries: StorageEntries) {
  return parseJson<unknown[]>(entries[KEYS.items] ?? "", []).length
}

export function chooseInitialCloudEntries(
  localEntries: StorageEntries,
  remoteEntries: StorageEntries,
) {
  if (itemCount(localEntries) > 0 && itemCount(remoteEntries) === 0) {
    return localEntries
  }
  return remoteEntries
}

class InventoryDataService {
  private initialized = false

  async initialize() {
    if (this.initialized) return
    await inventoryStorage.initialize()
    await this.migrateAndSeed()
    const legacyEntries = inventoryStorage.legacySnapshot(INVENTORY_CLOUD_KEYS)
    if (
      itemCount(inventoryStorage.snapshot(INVENTORY_CLOUD_KEYS)) === 0 &&
      itemCount(legacyEntries) > 0
    ) {
      await inventoryStorage.applyRemote(legacyEntries)
      await this.migrateAndSeed()
    }
    const localEntries = inventoryStorage.snapshot(INVENTORY_CLOUD_KEYS)
    const remoteEntries = await firebaseInventorySync.initialize(localEntries)
    if (remoteEntries && Object.keys(remoteEntries).length > 0) {
      await this.mergeAndApplyRemoteEntries(remoteEntries)
    }
    inventoryStorage.setMutationListener((entries) => {
      firebaseInventorySync.queue(entries)
    })
    firebaseInventorySync.setRemoteUpdateListener(async (entries) => {
      await this.mergeAndApplyRemoteEntries(entries)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("smart-inventory-data-refreshed"))
      }
    })
    const activeRole = this.getCachedDeviceRole()
    if (activeRole) {
      firebaseInventorySync.setCurrentRole(activeRole)
    }
    this.initialized = true
  }

  async refreshFromCloud() {
    const remoteEntries = await firebaseInventorySync.pull()
    if (!remoteEntries || !Object.keys(remoteEntries).length) return false
    await this.mergeAndApplyRemoteEntries(remoteEntries)
    return true
  }

  async mergeAndApplyRemoteEntries(remoteEntries: StorageEntries) {
    const role = this.getCachedDeviceRole()
    const merged: StorageEntries = {}

    for (const [key, remoteRaw] of Object.entries(remoteEntries)) {
      if (remoteRaw === null) {
        merged[key] = null
        continue
      }

      if (key === KEYS.locationWeights) {
        const localWeights = parseRecord<Record<string, number | null>>(
          inventoryStorage.getCached(KEYS.locationWeights),
        )
        const remoteWeights = parseRecord<Record<string, number | null>>(remoteRaw)
        const mergedWeights = mergeLocationWeights(
          {
            butcher: localWeights.butcher ?? {},
            restaurant: localWeights.restaurant ?? {},
          },
          {
            butcher: remoteWeights.butcher ?? {},
            restaurant: remoteWeights.restaurant ?? {},
          },
          role,
        )
        merged[key] = JSON.stringify(mergedWeights)
        const activeLocation = role === "restaurant" ? "restaurant" : "butcher"
        merged[KEYS.weights] = JSON.stringify(mergedWeights[activeLocation] ?? {})
      } else if (key === KEYS.transfers) {
        const localTransfers = parseArray<Transfer>(
          inventoryStorage.getCached(KEYS.transfers),
        )
        const remoteTransfers = parseArray<Transfer>(remoteRaw)
        const mergedTransfers = mergeTransfers(localTransfers, remoteTransfers)
        merged[key] = JSON.stringify(mergedTransfers)
      } else if (key === KEYS.transferLines) {
        const localLines = parseArray<TransferLine>(
          inventoryStorage.getCached(KEYS.transferLines),
        )
        const remoteLines = parseArray<TransferLine>(remoteRaw)
        const mergedLines = mergeTransferLines(localLines, remoteLines)
        merged[key] = JSON.stringify(mergedLines)
      } else if (key === KEYS.ledger) {
        const localLedger = parseArray<StockMovement>(
          inventoryStorage.getCached(KEYS.ledger),
        )
        const remoteLedger = parseArray<StockMovement>(remoteRaw)
        const mergedLedger = mergeStockLedger(localLedger, remoteLedger)
        merged[key] = JSON.stringify(mergedLedger)
      } else if (key === KEYS.rolePins) {
        const localPins = parseRecord<string>(
          inventoryStorage.getCached(KEYS.rolePins),
        )
        const remotePins = parseRecord<string>(remoteRaw)
        const mergedPins = mergeRolePins(
          {
            butcher: localPins.butcher || "0000",
            restaurant: localPins.restaurant || "0000",
          },
          {
            butcher: remotePins.butcher || "0000",
            restaurant: remotePins.restaurant || "0000",
          },
          role,
        )
        merged[key] = JSON.stringify(mergedPins)
      } else if (key === KEYS.items) {
        const localItems = parseArray<Item>(inventoryStorage.getCached(KEYS.items))
        const remoteItems = parseArray<Item>(remoteRaw)
        if (remoteItems.length > 0 || localItems.length === 0) {
          merged[key] = remoteRaw
        }
      } else if (key === KEYS.categories) {
        const remoteCats = parseArray<Category>(remoteRaw)
        if (remoteCats.length > 0) {
          merged[key] = remoteRaw
        }
      } else {
        merged[key] = remoteRaw
      }
    }

    if (Object.keys(merged).length > 0) {
      await inventoryStorage.applyRemote(merged)
    }
  }

  private async migrateAndSeed() {
    const storedItems = parseArray<Record<string, unknown>>(
      inventoryStorage.getCached(KEYS.items),
    )
    const itemSource = selectItemMigrationSource(storedItems)
    const idMap = new Map<string, string>()
    const now = entityTimestamp()
    const items: Item[] = itemSource.map((source, index) => {
      const legacyId = source.id ?? index + 1
      const numericId = Number(legacyId)
      const id = isUuid(legacyId)
        ? legacyId
        : Number.isFinite(numericId) && numericId > 0
          ? legacySeedId(numericId)
          : createEntityId()
      idMap.set(String(legacyId), id)
      const categoryId = categoryIdFromLegacy(
        source.category_id ?? source.category,
      )
      return {
        id,
        category_id: categoryId,
        name_ar: String(source.name_ar ?? source.title ?? "صنف"),
        name_en: String(source.name_en ?? ""),
        unit:
          source.unit === "g" ||
          source.unit === "ml" ||
          source.unit === "pack" ||
          source.unit === "jar" ||
          source.unit === "piece"
            ? source.unit
            : "kg",
        unit_label: String(
          source.unit_label ??
            source.unitLabel ??
            (source.unit === "piece" ? "حبة" : "كجم"),
        ),
        package_size: finiteNumber(
          source.package_size ?? source.packageSize,
          1,
          Number.EPSILON,
        ),
        opening_quantity: finiteNumber(
          source.opening_quantity ?? source.book,
          0,
          0,
        ),
        minimum_stock_alert: finiteNumber(source.minimum_stock_alert, 0, 0),
        cost_per_unit: finiteNumber(source.cost_per_unit, 0, 0),
        shrinkage_percent: Math.min(
          100,
          finiteNumber(
            source.shrinkage_percent ?? source.shrinkagePercent,
            0,
            0,
          ),
        ),
        initial_quantity:
          source.initial_quantity === null ||
          source.initialWeight === null ||
          (source.initial_quantity === undefined &&
            source.initialWeight === undefined)
            ? null
            : finiteNumber(source.initial_quantity ?? source.initialWeight, 0),
        image_url: migrateItemImage(
          categoryId,
          source.image_url ??
            source.image ??
            seedItems.find((item) => item.category_id === categoryId)
              ?.image_url,
        ),
        active: source.active !== false,
        is_composite: source.is_composite === true,
        created_at:
          typeof source.created_at === "string" ? source.created_at : now,
        updated_at:
          typeof source.updated_at === "string" ? source.updated_at : now,
      }
    })

    const itemIds = new Set(items.map((item) => item.id))
    const mapKeys = <T>(value: string, convert: (entry: unknown) => T) =>
      Object.fromEntries(
        Object.entries(parseRecord<unknown>(value))
          .map(([legacyId, entry]) => [
            idMap.get(legacyId) ??
              (isUuid(legacyId) ? legacyId : createEntityId()),
            convert(entry),
          ])
          .filter(([itemId]) => itemIds.has(String(itemId))),
      )

    const weights = mapKeys<number | null>(
      inventoryStorage.getCached(KEYS.weights),
      (entry) =>
        entry === null || entry === undefined ? null : finiteNumber(entry, 0),
    )
    const movements = Object.fromEntries(
      Object.entries(
        parseRecord<unknown>(inventoryStorage.getCached(KEYS.movements)),
      )
        .map(([legacyId, entry]) => {
          const itemId =
            idMap.get(legacyId) ??
            (isUuid(legacyId) ? legacyId : createEntityId())
          const movement = (entry ?? {}) as Partial<InventoryFlow>
          const timestamp =
            typeof movement.created_at === "string"
              ? movement.created_at
              : entityTimestamp()
          return [
            itemId,
            {
              id: isUuid(movement.id) ? movement.id : createEntityId(),
              item_id: itemId,
              opening: finiteNumber(movement.opening, 0, 0),
              incoming: finiteNumber(movement.incoming, 0, 0),
              outgoing: finiteNumber(movement.outgoing, 0, 0),
              notes: typeof movement.notes === "string" ? movement.notes : "",
              created_at: timestamp,
              updated_at:
                typeof movement.updated_at === "string"
                  ? movement.updated_at
                  : timestamp,
            } satisfies InventoryFlow,
          ]
        })
        .filter(([itemId]) => itemIds.has(String(itemId))),
    )
    const legacyConfig = parseRecord<Record<string, unknown>>(
      inventoryStorage.getCached(KEYS.config),
    )
    const config: Record<string, ItemConfig> = {}
    items.forEach((item) => {
      const legacyEntry = Object.entries(legacyConfig).find(
        ([legacyId]) => idMap.get(legacyId) === item.id || legacyId === item.id,
      )?.[1]
      config[item.id] = {
        opening_quantity: finiteNumber(
          legacyEntry?.opening_quantity ??
            legacyEntry?.book ??
            item.opening_quantity,
          item.opening_quantity,
          0,
        ),
        shrinkage_percent: Math.min(
          100,
          finiteNumber(
            legacyEntry?.shrinkage_percent ??
              legacyEntry?.shrinkagePercent ??
              item.shrinkage_percent,
            item.shrinkage_percent,
            0,
          ),
        ),
        minimum_stock_alert: finiteNumber(
          legacyEntry?.minimum_stock_alert ?? item.minimum_stock_alert,
          item.minimum_stock_alert,
          0,
        ),
        cost_per_unit: finiteNumber(
          legacyEntry?.cost_per_unit ?? item.cost_per_unit,
          item.cost_per_unit,
          0,
        ),
      }
      if (!Object.prototype.hasOwnProperty.call(movements, item.id)) {
        movements[item.id] = emptyMovement(item.opening_quantity, item.id)
      }
      if (!Object.prototype.hasOwnProperty.call(weights, item.id)) {
        weights[item.id] = item.initial_quantity
      }
    })

    const storedCategories = parseArray<Category>(
      inventoryStorage.getCached(KEYS.categories),
    ).filter(
      (category) =>
        category &&
        isUuid(category.id) &&
        Object.prototype.hasOwnProperty.call(CATEGORY_IDS, category.slug) &&
        typeof category.name_ar === "string" &&
        typeof category.name_en === "string" &&
        typeof category.label_ar === "string" &&
        Object.prototype.hasOwnProperty.call(CATEGORY_IDS, category.icon_key) &&
        (category.color === "slate" ||
          category.color === "amber" ||
          category.color === "emerald" ||
          category.color === "orange" ||
          category.color === "sky") &&
        Number.isFinite(category.sort_order),
    )
    const categoryMap = new Map(
      storedCategories.map((category) => [category.id, category]),
    )
    seedCategories.forEach((category) => {
      if (!categoryMap.has(category.id)) categoryMap.set(category.id, category)
    })
    const categories = [...categoryMap.values()].sort(
      (first, second) => first.sort_order - second.sort_order,
    )
    const auditHistory = migrateAuditRecords(
      inventoryStorage.getCached(KEYS.auditHistory),
    )
    const shift = migrateShift(inventoryStorage.getCached(KEYS.shift))
    const existingLocationWeights = parseRecord<Record<string, number | null>>(
      inventoryStorage.getCached(KEYS.locationWeights),
    )
    const locationWeights = normalizeLocationWeights(
      items,
      weights,
      existingLocationWeights,
    )
    const migratedRecipes = parseArray<Record<string, unknown>>(
      inventoryStorage.getCached(KEYS.recipes),
    )
      .filter(
        (component) =>
          typeof component.composite_item_id === "string" &&
          itemIds.has(component.composite_item_id) &&
          typeof component.component_item_id === "string" &&
          itemIds.has(component.component_item_id) &&
          component.component_item_id !== component.composite_item_id &&
          items.find((item) => item.id === component.composite_item_id)
            ?.is_composite === true &&
          items.find((item) => item.id === component.component_item_id)
            ?.is_composite === false &&
          Number.isFinite(Number(component.quantity)) &&
          Number(component.quantity) > 0 &&
          (component.unit === "g" ||
            component.unit === "ml" ||
            component.unit === "piece"),
      )
      .map((component) => {
        const timestamp = entityTimestamp()
        return {
          id: isUuid(component.id) ? component.id : createEntityId(),
          composite_item_id: String(component.composite_item_id),
          component_item_id: String(component.component_item_id),
          quantity: Number(component.quantity),
          unit: component.unit as RecipeComponent["unit"],
          created_at:
            typeof component.created_at === "string"
              ? component.created_at
              : timestamp,
          updated_at:
            typeof component.updated_at === "string"
              ? component.updated_at
              : timestamp,
        } satisfies RecipeComponent
      })
    const migratedLedger = parseArray<Record<string, unknown>>(
      inventoryStorage.getCached(KEYS.ledger),
    )
      .filter(
        (movement) =>
          typeof movement.item_id === "string" &&
          itemIds.has(movement.item_id) &&
          (movement.type === "count" ||
            movement.type === "auto_deduct" ||
            movement.type === "waste" ||
            movement.type === "transfer") &&
          Number.isFinite(Number(movement.quantity)) &&
          (movement.unit === "g" ||
            movement.unit === "ml" ||
            movement.unit === "piece"),
      )
      .map((movement) => {
        const timestamp = entityTimestamp()
        return {
          id: isUuid(movement.id) ? movement.id : createEntityId(),
          item_id: String(movement.item_id),
          location: movement.location === "butcher" ? "butcher" : "restaurant",
          type: movement.type as StockMovement["type"],
          quantity: Number(movement.quantity),
          unit: movement.unit as StockMovement["unit"],
          parent_movement_id:
            typeof movement.parent_movement_id === "string"
              ? movement.parent_movement_id
              : null,
          reference_id:
            typeof movement.reference_id === "string"
              ? movement.reference_id
              : null,
          note: typeof movement.note === "string" ? movement.note : "",
          created_at:
            typeof movement.created_at === "string"
              ? movement.created_at
              : timestamp,
          updated_at:
            typeof movement.updated_at === "string"
              ? movement.updated_at
              : timestamp,
        } satisfies StockMovement
      })
    const migratedTransfers = parseArray<Record<string, unknown>>(
      inventoryStorage.getCached(KEYS.transfers),
    )
      .filter(
        (transfer) =>
          isUuid(transfer.id) &&
          (transfer.status === "Sent" ||
            transfer.status === "Received" ||
            transfer.status === "Discrepancy" ||
            transfer.status === "Cancelled"),
      )
      .map((transfer) => {
        const timestamp = entityTimestamp()
        return {
          id: String(transfer.id),
          status: transfer.status as Transfer["status"],
          from_location: "butcher" as const,
          to_location: "restaurant" as const,
          sent_at:
            typeof transfer.sent_at === "string" ? transfer.sent_at : timestamp,
          received_at:
            typeof transfer.received_at === "string"
              ? transfer.received_at
              : null,
          cancelled_reason:
            typeof transfer.cancelled_reason === "string"
              ? transfer.cancelled_reason
              : null,
          created_at:
            typeof transfer.created_at === "string"
              ? transfer.created_at
              : timestamp,
          updated_at:
            typeof transfer.updated_at === "string"
              ? transfer.updated_at
              : timestamp,
        } satisfies Transfer
      })
    const transferIds = new Set(migratedTransfers.map((entry) => entry.id))
    const migratedTransferLines = parseArray<Record<string, unknown>>(
      inventoryStorage.getCached(KEYS.transferLines),
    )
      .filter(
        (line) =>
          isUuid(line.id) &&
          typeof line.transfer_id === "string" &&
          transferIds.has(line.transfer_id) &&
          typeof line.item_id === "string" &&
          itemIds.has(line.item_id) &&
          Number.isFinite(Number(line.quantity_sent)) &&
          Number(line.quantity_sent) > 0 &&
          (line.unit === "g" || line.unit === "ml" || line.unit === "piece"),
      )
      .map((line) => {
        const timestamp = entityTimestamp()
        const received =
          line.quantity_received === null ||
          line.quantity_received === undefined
            ? null
            : finiteNumber(line.quantity_received, 0, 0)
        return {
          id: String(line.id),
          transfer_id: String(line.transfer_id),
          item_id: String(line.item_id),
          quantity_sent: Number(line.quantity_sent),
          quantity_received: received,
          unit: line.unit as TransferLine["unit"],
          created_at:
            typeof line.created_at === "string" ? line.created_at : timestamp,
          updated_at:
            typeof line.updated_at === "string" ? line.updated_at : timestamp,
        } satisfies TransferLine
      })

    await inventoryStorage.replace({
      [KEYS.categories]: JSON.stringify(categories),
      [KEYS.items]: JSON.stringify(items),
      [KEYS.weights]: JSON.stringify(weights),
      [KEYS.movements]: JSON.stringify(movements),
      [KEYS.recipes]: JSON.stringify(migratedRecipes),
      [KEYS.ledger]: JSON.stringify(migratedLedger),
      [KEYS.locationWeights]: JSON.stringify(locationWeights),
      [KEYS.transfers]: JSON.stringify(migratedTransfers),
      [KEYS.transferLines]: JSON.stringify(migratedTransferLines),
      [KEYS.rolePins]: inventoryStorage.getCached(
        KEYS.rolePins,
        JSON.stringify({ butcher: "0000", restaurant: "0000" }),
      ),
      [KEYS.config]: JSON.stringify(config),
      [KEYS.auditHistory]: JSON.stringify(auditHistory),
      [KEYS.shift]: JSON.stringify(shift),
      [KEYS.schema]: String(INVENTORY_SCHEMA_VERSION),
    })
  }

  async getCategories() {
    const stored = parseArray<Category>(
      inventoryStorage.getCached(KEYS.categories),
    )
    return (stored.length ? stored : seedCategories).sort(
      (first, second) => first.sort_order - second.sort_order,
    )
  }

  async getItems() {
    return parseArray<Item>(inventoryStorage.getCached(KEYS.items))
  }

  async getRecipeComponents() {
    return parseArray<RecipeComponent>(inventoryStorage.getCached(KEYS.recipes))
  }

  async getStockLedger() {
    return parseArray<StockMovement>(inventoryStorage.getCached(KEYS.ledger))
  }

  async getLocationWeights() {
    const stored = parseRecord<Record<string, number | null>>(
      inventoryStorage.getCached(KEYS.locationWeights),
    )
    return {
      butcher: stored.butcher ?? {},
      restaurant: stored.restaurant ?? {},
    }
  }

  async getTransfers() {
    return parseArray<Transfer>(inventoryStorage.getCached(KEYS.transfers))
  }

  async getTransferLines() {
    return parseArray<TransferLine>(
      inventoryStorage.getCached(KEYS.transferLines),
    )
  }

  getCachedDeviceRole(): DeviceRole | null {
    const raw = inventoryStorage.getCached(KEYS.deviceRole)
    return raw === "owner" || raw === "butcher" || raw === "restaurant"
      ? (raw as DeviceRole)
      : null
  }

  async setDeviceRole(role: DeviceRole | null) {
    if (role === null) {
      await this.removeRawValue(KEYS.deviceRole)
      firebaseInventorySync.setCurrentRole(null)
      return
    }
    await this.setRawValue(KEYS.deviceRole, role)
    firebaseInventorySync.setCurrentRole(role)
  }

  async switchBranch(branchId: string) {
    const remoteEntries = await firebaseInventorySync.switchBranch(branchId)
    if (remoteEntries && Object.keys(remoteEntries).length > 0) {
      await inventoryStorage.applyRemote(remoteEntries)
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("smart-inventory-data-refreshed"))
    }
  }

  async sendSyncPing(role: DeviceRole) {
    return firebaseInventorySync.sendPing(role)
  }

  async replaceRecipeComponents(
    compositeItemId: string,
    components: RecipeComponent[],
  ) {
    const items = await this.getItems()
    const item = items.find((entry) => entry.id === compositeItemId)
    if (!item) throw new Error("الصنف المركب غير موجود.")
    if (item.is_composite) {
      const error = validateRecipe(compositeItemId, components, items)
      if (error) throw new Error(error)
    }
    const allComponents = await this.getRecipeComponents()
    const next = [
      ...allComponents.filter(
        (component) => component.composite_item_id !== compositeItemId,
      ),
      ...(item.is_composite ? components : []),
    ]
    await this.setRawValue(KEYS.recipes, JSON.stringify(next))
    return next
  }

  async removeItemRelations(itemId: string) {
    const items = (await this.getItems()).filter((item) => item.id !== itemId)
    const recipes = (await this.getRecipeComponents()).filter(
      (component) =>
        component.composite_item_id !== itemId &&
        component.component_item_id !== itemId,
    )
    const ledger = pruneItemLedger(itemId, await this.getStockLedger())
    const locationWeights = await this.getLocationWeights()
    const nextLocationWeights = {
      butcher: pruneItemRelations(itemId, locationWeights.butcher),
      restaurant: pruneItemRelations(itemId, locationWeights.restaurant),
    }
    const weights = pruneItemRelations(
      itemId,
      parseJson<Record<string, number | null>>(
        inventoryStorage.getCached(KEYS.weights),
        {},
      ),
    )
    const movements = pruneItemRelations(
      itemId,
      parseJson<Record<string, InventoryFlow>>(
        inventoryStorage.getCached(KEYS.movements),
        {},
      ),
    )
    const config = pruneItemRelations(
      itemId,
      parseJson<Record<string, ItemConfig>>(
        inventoryStorage.getCached(KEYS.config),
        {},
      ),
    )
    await inventoryStorage.replace({
      [KEYS.items]: JSON.stringify(items),
      [KEYS.recipes]: JSON.stringify(recipes),
      [KEYS.ledger]: JSON.stringify(ledger),
      [KEYS.locationWeights]: JSON.stringify(nextLocationWeights),
      [KEYS.weights]: JSON.stringify(weights),
      [KEYS.movements]: JSON.stringify(movements),
      [KEYS.config]: JSON.stringify(config),
    })
    return {
      items,
      recipes,
      ledger,
      locationWeights: nextLocationWeights,
      weights,
      movements,
      config,
    }
  }

  async setCount(
    itemId: string,
    quantity: number | null,
    note = "",
    location: InventoryLocation = "restaurant",
  ) {
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      throw new Error("الكمية يجب أن تكون رقماً صحيحاً لا يقل عن صفر.")
    }
    const items = await this.getItems()
    const item = items.find((entry) => entry.id === itemId)
    if (!item) throw new Error("الصنف غير موجود.")
    const locationWeights = await this.getLocationWeights()
    const weights = locationWeights[location]
    const ledger = await this.getStockLedger()
    if (!item.is_composite) {
      const nextWeights = { ...weights, [itemId]: quantity }
      const referenceId = `current-count:${location}:${itemId}`
      const previousIds = new Set(
        ledger
          .filter(
            (movement) =>
              movement.type === "count" &&
              movement.item_id === itemId &&
              movement.location === location &&
              movement.reference_id === referenceId,
          )
          .map((movement) => movement.id),
      )
      const nextLedger = ledger.filter(
        (movement) =>
          !previousIds.has(movement.id) &&
          !(
            movement.parent_movement_id !== null &&
            previousIds.has(movement.parent_movement_id)
          ),
      )
      let parentMovementId: string | null = null
      if (quantity !== null) {
        const timestamp = entityTimestamp()
        parentMovementId = createEntityId()
        nextLedger.push({
          id: parentMovementId,
          item_id: itemId,
          location,
          type: "count",
          quantity: storedToBaseQuantity(quantity, item),
          unit: defaultBaseUnit(item),
          parent_movement_id: null,
          reference_id: referenceId,
          note,
          created_at: timestamp,
          updated_at: timestamp,
        })
      }
      await inventoryStorage.replace({
        [KEYS.locationWeights]: JSON.stringify({
          ...locationWeights,
          [location]: nextWeights,
        }),
        [KEYS.weights]: JSON.stringify(nextWeights),
        [KEYS.ledger]: JSON.stringify(nextLedger),
      })
      return {
        weights: nextWeights,
        locationWeights: {
          ...locationWeights,
          [location]: nextWeights,
        },
        ledger: nextLedger,
        parentMovementId,
        negativeComponentIds: [] as string[],
      }
    }
    const components = (await this.getRecipeComponents()).filter(
      (component) => component.composite_item_id === itemId,
    )
    const error = validateRecipe(itemId, components, items)
    if (error) throw new Error(error)
    const result = applyCompositeCountState({
      composite: item,
      quantity,
      items,
      components,
      weights,
      ledger,
      note,
      location,
    })
    await inventoryStorage.replace({
      [KEYS.locationWeights]: JSON.stringify({
        ...locationWeights,
        [location]: result.weights,
      }),
      [KEYS.weights]: JSON.stringify(result.weights),
      [KEYS.ledger]: JSON.stringify(result.ledger),
    })
    return {
      ...result,
      locationWeights: {
        ...locationWeights,
        [location]: result.weights,
      },
    }
  }

  async createTransfer(lines: TransferRequestLine[]) {
    const items = await this.getItems()
    const validationError = validateTransferRequest(lines)
    if (validationError) throw new Error(validationError)
    const timestamp = entityTimestamp()
    const transferId = createEntityId()
    const transfer: Transfer = {
      id: transferId,
      status: "Sent",
      from_location: "butcher",
      to_location: "restaurant",
      sent_at: timestamp,
      received_at: null,
      cancelled_reason: null,
      created_at: timestamp,
      updated_at: timestamp,
    }
    const locationWeights = await this.getLocationWeights()
    const butcherWeights = { ...locationWeights.butcher }
    const ledger = await this.getStockLedger()
    const transferLines = await this.getTransferLines()
    const newLines: TransferLine[] = lines.map((line) => {
      const item = items.find((entry) => entry.id === line.item_id)
      if (!item) throw new Error("أحد أصناف التحويل غير موجود.")
      const nextQuantity = adjustStockByBaseQuantity(
        butcherWeights[item.id],
        item,
        -line.quantity_sent,
        defaultBaseUnit(item),
      )
      if (nextQuantity < 0) {
        throw new Error(`الكمية المطلوبة تتجاوز رصيد «${item.name_ar}».`)
      }
      butcherWeights[item.id] = nextQuantity
      ledger.push({
        id: createEntityId(),
        item_id: item.id,
        location: "butcher",
        type: "transfer",
        quantity: -line.quantity_sent,
        unit: defaultBaseUnit(item),
        parent_movement_id: null,
        reference_id: transferId,
        note: "إرسال إلى المطعم",
        created_at: timestamp,
        updated_at: timestamp,
      })
      return {
        id: createEntityId(),
        transfer_id: transferId,
        item_id: item.id,
        quantity_sent: line.quantity_sent,
        quantity_received: null,
        unit: defaultBaseUnit(item),
        created_at: timestamp,
        updated_at: timestamp,
      }
    })
    const transfers = [...(await this.getTransfers()), transfer]
    const nextLocationWeights = {
      ...locationWeights,
      butcher: butcherWeights,
    }
    await inventoryStorage.replace({
      [KEYS.transfers]: JSON.stringify(transfers),
      [KEYS.transferLines]: JSON.stringify([...transferLines, ...newLines]),
      [KEYS.locationWeights]: JSON.stringify(nextLocationWeights),
      [KEYS.ledger]: JSON.stringify(ledger),
    })
    void firebaseInventorySync.sendPing("butcher")
    return {
      transfer,
      transfers,
      transferLines: [...transferLines, ...newLines],
      locationWeights: nextLocationWeights,
      ledger,
    }
  }

  async receiveTransfer(transferId: string, received: Record<string, number>) {
    const transfers = await this.getTransfers()
    const transfer = transfers.find((entry) => entry.id === transferId)
    if (!transfer || transfer.status !== "Sent") {
      throw new Error("هذا التحويل غير متاح للاستلام.")
    }
    const items = await this.getItems()
    const allLines = await this.getTransferLines()
    const lines = allLines.filter((line) => line.transfer_id === transferId)
    if (!lines.length)
      throw new Error("لا يحتوي التحويل على أصناف قابلة للاستلام.")
    const timestamp = entityTimestamp()
    const locationWeights = await this.getLocationWeights()
    const restaurantWeights = { ...locationWeights.restaurant }
    const ledger = await this.getStockLedger()
    let hasDiscrepancy = false
    const nextLines = allLines.map((line) => {
      if (line.transfer_id !== transferId) return line
      const rawReceived = received[line.id] ?? 0
      if (!Number.isFinite(rawReceived) || rawReceived < 0) {
        throw new Error("إحدى كميات الاستلام غير صالحة.")
      }
      const quantityReceived = rawReceived
      const item = items.find((entry) => entry.id === line.item_id)
      if (!item) throw new Error("أحد أصناف التحويل غير موجود.")
      restaurantWeights[item.id] = adjustStockByBaseQuantity(
        restaurantWeights[item.id],
        item,
        quantityReceived,
        line.unit,
      )
      ledger.push({
        id: createEntityId(),
        item_id: item.id,
        location: "restaurant",
        type: "transfer",
        quantity: quantityReceived,
        unit: line.unit,
        parent_movement_id: null,
        reference_id: transferId,
        note: "استلام من الملحمة",
        created_at: timestamp,
        updated_at: timestamp,
      })
      const gap = line.quantity_sent - quantityReceived
      if (gap !== 0) {
        hasDiscrepancy = true
      }
      if (gap > 0) {
        ledger.push({
          id: createEntityId(),
          item_id: item.id,
          location: "restaurant",
          type: "waste",
          quantity: -gap,
          unit: line.unit,
          parent_movement_id: null,
          reference_id: transferId,
          note: `فرق استلام: ${gap}`,
          created_at: timestamp,
          updated_at: timestamp,
        })
      }
      return {
        ...line,
        quantity_received: quantityReceived,
        updated_at: timestamp,
      }
    })
    const nextTransfers = transfers.map((entry) =>
      entry.id === transferId
        ? {
            ...entry,
            status: hasDiscrepancy
              ? "Discrepancy" as const
              : "Received" as const,
            received_at: timestamp,
            updated_at: timestamp,
          }
        : entry,
    )
    const nextLocationWeights = {
      ...locationWeights,
      restaurant: restaurantWeights,
    }
    await inventoryStorage.replace({
      [KEYS.transfers]: JSON.stringify(nextTransfers),
      [KEYS.transferLines]: JSON.stringify(nextLines),
      [KEYS.locationWeights]: JSON.stringify(nextLocationWeights),
      [KEYS.ledger]: JSON.stringify(ledger),
    })
    void firebaseInventorySync.sendPing("restaurant")
    return {
      transfers: nextTransfers,
      transferLines: nextLines,
      locationWeights: nextLocationWeights,
      ledger,
    }
  }

  async cancelTransfer(transferId: string, reason: string) {
    if (!reason.trim()) throw new Error("سبب الإلغاء مطلوب.")
    const transfers = await this.getTransfers()
    const transfer = transfers.find((entry) => entry.id === transferId)
    if (!transfer || transfer.status !== "Sent") {
      throw new Error("يمكن إلغاء التحويلات المرسلة فقط.")
    }
    const items = await this.getItems()
    const lines = (await this.getTransferLines()).filter(
      (line) => line.transfer_id === transferId,
    )
    const locationWeights = await this.getLocationWeights()
    const butcherWeights = { ...locationWeights.butcher }
    const ledger = await this.getStockLedger()
    const timestamp = entityTimestamp()
    for (const line of lines) {
      const item = items.find((entry) => entry.id === line.item_id)
      if (!item) continue
      butcherWeights[item.id] = adjustStockByBaseQuantity(
        butcherWeights[item.id],
        item,
        line.quantity_sent,
        line.unit,
      )
      ledger.push({
        id: createEntityId(),
        item_id: item.id,
        location: "butcher",
        type: "transfer",
        quantity: line.quantity_sent,
        unit: line.unit,
        parent_movement_id: null,
        reference_id: transferId,
        note: `إلغاء التحويل: ${reason.trim()}`,
        created_at: timestamp,
        updated_at: timestamp,
      })
    }
    const nextTransfers = transfers.map((entry) =>
      entry.id === transferId
        ? {
            ...entry,
            status: "Cancelled" as const,
            cancelled_reason: reason.trim(),
            updated_at: timestamp,
          }
        : entry,
    )
    const nextLocationWeights = {
      ...locationWeights,
      butcher: butcherWeights,
    }
    await inventoryStorage.replace({
      [KEYS.transfers]: JSON.stringify(nextTransfers),
      [KEYS.locationWeights]: JSON.stringify(nextLocationWeights),
      [KEYS.ledger]: JSON.stringify(ledger),
    })
    void firebaseInventorySync.sendPing("butcher")
    return {
      transfers: nextTransfers,
      locationWeights: nextLocationWeights,
      ledger,
    }
  }

  async recordWaste(
    itemId: string,
    quantity: number,
    location: InventoryLocation,
    note: string,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("كمية الهدر يجب أن تكون أكبر من صفر.")
    }
    const item = (await this.getItems()).find((entry) => entry.id === itemId)
    if (!item) throw new Error("الصنف غير موجود.")
    const locationWeights = await this.getLocationWeights()
    const weights = { ...locationWeights[location] }
    const unit = defaultBaseUnit(item)
    weights[itemId] = adjustStockByBaseQuantity(
      weights[itemId],
      item,
      -quantity,
      unit,
    )
    const timestamp = entityTimestamp()
    const ledger = [
      ...(await this.getStockLedger()),
      {
        id: createEntityId(),
        item_id: itemId,
        location,
        type: "waste" as const,
        quantity: -quantity,
        unit,
        parent_movement_id: null,
        reference_id: null,
        note: note.trim() || "هدر مسجل",
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]
    const nextLocationWeights = {
      ...locationWeights,
      [location]: weights,
    }
    await inventoryStorage.replace({
      [KEYS.locationWeights]: JSON.stringify(nextLocationWeights),
      [KEYS.ledger]: JSON.stringify(ledger),
    })
    return { locationWeights: nextLocationWeights, ledger }
  }

  async createItem(input: Omit<Item, "id" | "created_at" | "updated_at">) {
    const timestamp = entityTimestamp()
    const item: Item = {
      ...input,
      id: createEntityId(),
      created_at: timestamp,
      updated_at: timestamp,
    }
    const items = [...(await this.getItems()), item]
    await this.setRawValue(KEYS.items, JSON.stringify(items))
    return item
  }

  async updateItem(
    id: string,
    changes: Partial<Omit<Item, "id" | "created_at">>,
  ) {
    let updated: Item | null = null
    const items = (await this.getItems()).map((item) => {
      if (item.id !== id) return item
      updated = { ...item, ...changes, id, updated_at: entityTimestamp() }
      return updated
    })
    if (!updated) throw new Error("الصنف غير موجود.")
    await this.setRawValue(KEYS.items, JSON.stringify(items))
    return updated
  }

  async deleteItem(id: string) {
    const items = (await this.getItems()).filter((item) => item.id !== id)
    await this.setRawValue(KEYS.items, JSON.stringify(items))
  }

  async getBootstrap(): Promise<InventoryBootstrap> {
    const categories = await this.getCategories()
    const items = await this.getItems()
    const pending = parseRecord<unknown>(
      inventoryStorage.getCached(KEYS.pendingReport),
    )
    const theme = inventoryStorage.getCached(KEYS.theme, "system")
    return {
      categories,
      items,
      weights: parseRecord<number | null>(
        inventoryStorage.getCached(KEYS.weights),
      ),
      config: parseRecord<ItemConfig>(inventoryStorage.getCached(KEYS.config)),
      movements: parseRecord<InventoryFlow>(
        inventoryStorage.getCached(KEYS.movements),
      ),
      recipeComponents: await this.getRecipeComponents(),
      stockLedger: await this.getStockLedger(),
      locationWeights: await this.getLocationWeights(),
      transfers: await this.getTransfers(),
      transferLines: await this.getTransferLines(),
      auditHistory: migrateAuditRecords(
        inventoryStorage.getCached(KEYS.auditHistory),
      ),
      pendingReportText:
        typeof pending.reportText === "string" ? pending.reportText : "",
      theme:
        theme === "light" || theme === "dark" || theme === "system"
          ? theme
          : "system",
      scaleName: inventoryStorage.getCached(
        KEYS.scaleName,
        "ميزان المطبخ الرئيسي",
      ),
      shift: migrateShift(inventoryStorage.getCached(KEYS.shift)),
      ownerPin: inventoryStorage.getCached(KEYS.ownerPin, "0000"),
      ownerPhone: inventoryStorage.getCached(KEYS.ownerPhone, "966555551234"),
      deviceRole:
        inventoryStorage.getCached(KEYS.deviceRole) === "owner" ||
        inventoryStorage.getCached(KEYS.deviceRole) === "butcher" ||
        inventoryStorage.getCached(KEYS.deviceRole) === "restaurant"
          ? inventoryStorage.getCached(KEYS.deviceRole) as DeviceRole
          : null,
      rolePins: (() => {
        const stored = parseRecord<unknown>(
          inventoryStorage.getCached(KEYS.rolePins),
        )
        return {
          butcher:
            typeof stored.butcher === "string" && /^\d{4}$/.test(stored.butcher)
              ? stored.butcher
              : "0000",
          restaurant:
            typeof stored.restaurant === "string" &&
            /^\d{4}$/.test(stored.restaurant)
              ? stored.restaurant
              : "0000",
        }
      })(),
    }
  }

  async getRolePins(): Promise<RolePins> {
    const stored = parseRecord<unknown>(
      inventoryStorage.getCached(KEYS.rolePins),
    )
    return {
      butcher:
        typeof stored.butcher === "string" && /^\d{4}$/.test(stored.butcher)
          ? stored.butcher
          : "0000",
      restaurant:
        typeof stored.restaurant === "string" &&
        /^\d{4}$/.test(stored.restaurant)
          ? stored.restaurant
          : "0000",
    }
  }

  async getOwnerPin(): Promise<string> {
    return inventoryStorage.getCached(KEYS.ownerPin, "0000")
  }

  async setRolePins(rolePins: RolePins) {
    const normalized: RolePins = {
      butcher: /^\d{4}$/.test(rolePins.butcher) ? rolePins.butcher : "0000",
      restaurant: /^\d{4}$/.test(rolePins.restaurant)
        ? rolePins.restaurant
        : "0000",
    }
    await this.setRawValue(KEYS.rolePins, JSON.stringify(normalized))
    await firebaseInventorySync.flush()
    void firebaseInventorySync.sendPing("owner")
    return normalized
  }

  async getRawValue(key: string, fallback = "") {
    return inventoryStorage.getCached(key, fallback)
  }

  async setRawValue(key: string, value: string) {
    inventoryStorage.set(key, value)
    await inventoryStorage.flush()
  }

  async removeRawValue(key: string) {
    inventoryStorage.remove(key)
    await inventoryStorage.flush()
  }

  async replaceRawValues(entries: StorageEntries) {
    await inventoryStorage.replace(entries)
  }

  async snapshot(keys: readonly string[] = INVENTORY_STORAGE_KEYS) {
    await inventoryStorage.flush()
    return inventoryStorage.snapshot(keys)
  }

  async flush() {
    await inventoryStorage.flush()
    await firebaseInventorySync.flush()
  }

  async clearInventoryData() {
    const emptyValues: StorageEntries = {
      [KEYS.items]: "[]",
      [KEYS.weights]: "{}",
      [KEYS.config]: "{}",
      [KEYS.movements]: "{}",
      [KEYS.recipes]: "[]",
      [KEYS.ledger]: "[]",
      [KEYS.auditHistory]: "[]",
      [KEYS.pendingReport]: "",
      [KEYS.locationWeights]: JSON.stringify({
        butcher: {},
        restaurant: {},
      }),
      [KEYS.transfers]: "[]",
      [KEYS.transferLines]: "[]",
    }
    await inventoryStorage.replace(emptyValues)
  }

  async createBackup(): Promise<InventoryBackup> {
    return {
      app: "smart-inventory",
      version: 2,
      exportedAt: entityTimestamp(),
      data: await this.snapshot(INVENTORY_STORAGE_KEYS),
    }
  }

  validateBackup(value: unknown): InventoryBackup {
    if (!value || typeof value !== "object") {
      throw new Error("الملف لا يحتوي على بيانات نسخة احتياطية.")
    }
    const candidate = value as Partial<InventoryBackup>
    if (
      candidate.app !== "smart-inventory" ||
      (candidate.version !== 1 && candidate.version !== 2) ||
      typeof candidate.exportedAt !== "string" ||
      !Number.isFinite(new Date(candidate.exportedAt).getTime()) ||
      !candidate.data ||
      typeof candidate.data !== "object"
    ) {
      throw new Error("هذا الملف ليس نسخة متوافقة مع نظام الجرد.")
    }
    const recognized = INVENTORY_STORAGE_KEYS.filter((key) =>
      Object.prototype.hasOwnProperty.call(candidate.data, key),
    )
    if (!recognized.length) {
      throw new Error("لم يتم العثور على أي بيانات قابلة للاستعادة.")
    }
    for (const key of recognized) {
      const entry = candidate.data[key]
      if (entry !== null && typeof entry !== "string") {
        throw new Error("تحتوي النسخة على بيانات غير صالحة.")
      }
    }
    return candidate as InventoryBackup
  }

  async restoreBackup(backup: InventoryBackup) {
    const previous = await this.snapshot(INVENTORY_STORAGE_KEYS)
    try {
      await this.replaceRawValues(prepareBackupReplacements(backup))
    } catch (error) {
      await this.replaceRawValues(previous)
      throw error
    }
  }

  async getMascotPreferences(): Promise<MascotPreferences | null> {
    return parseJson<MascotPreferences | null>(
      inventoryStorage.getCached(KEYS.mascot),
      null,
    )
  }

  async setMascotPreferences(preferences: MascotPreferences) {
    await this.setRawValue(KEYS.mascot, JSON.stringify(preferences))
  }
}

export const inventoryDataService = new InventoryDataService()
