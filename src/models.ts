export type EntityId = string

export type BaseEntity = {
  id: EntityId
  created_at: string
  updated_at: string
}

export type CategorySlug = "meat" | "poultry" | "vegetables" | "spices" | "beverages"

export type CategoryIconKey = "meat" | "poultry" | "vegetables" | "spices" | "beverages"

export type Category = BaseEntity & {
  slug: CategorySlug
  name_ar: string
  name_en: string
  label_ar: string
  icon_key: CategoryIconKey
  color: "slate" | "amber" | "emerald" | "orange" | "sky"
  sort_order: number
}

export type InventoryUnit = "g" | "kg" | "ml" | "pack" | "jar" | "piece"

export type Item = BaseEntity & {
  category_id: EntityId
  name_ar: string
  name_en: string
  unit: InventoryUnit
  unit_label: string
  package_size: number | null
  opening_quantity: number
  minimum_stock_alert: number
  cost_per_unit: number
  shrinkage_percent: number
  initial_quantity: number | null
  image_url: string
  active: boolean
  is_composite: boolean
}

export type InventoryFlow = BaseEntity & {
  item_id: EntityId
  opening: number
  incoming: number
  outgoing: number
  notes: string
}

export type BaseUnit = "g" | "ml" | "piece"
export type DeviceRole = "owner" | "butcher" | "restaurant"
export type InventoryLocation = "butcher" | "restaurant"
export type RolePins = Record<InventoryLocation, string>

export type RecipeComponent = BaseEntity & {
  composite_item_id: EntityId
  component_item_id: EntityId
  quantity: number
  unit: BaseUnit
}

export type StockMovementType = "count" | "auto_deduct" | "waste" | "transfer"

export type StockMovement = BaseEntity & {
  item_id: EntityId
  location: InventoryLocation
  type: StockMovementType
  quantity: number
  unit: BaseUnit
  parent_movement_id: EntityId | null
  reference_id: string | null
  note: string
}

export type TransferStatus = "Sent" | "Received" | "Discrepancy" | "Cancelled"

export type Transfer = BaseEntity & {
  status: TransferStatus
  from_location: "butcher"
  to_location: "restaurant"
  sent_at: string
  received_at: string | null
  cancelled_reason: string | null
}

export type TransferLine = BaseEntity & {
  transfer_id: EntityId
  item_id: EntityId
  quantity_sent: number
  quantity_received: number | null
  unit: BaseUnit
}

export type ItemConfig = {
  opening_quantity: number
  shrinkage_percent: number
  minimum_stock_alert: number
  cost_per_unit: number
}

export type AuditItem = {
  item_id?: EntityId
  name: string
  category_id?: EntityId
  category?: string
  unit: string
  opening: number
  incoming: number
  outgoing: number
  expected: number
  actual: number | null
  difference: number | null
  notes: string
}

export type AuditRecord = BaseEntity & {
  created_at_ms: number
  shift: string
  completed: number
  total: number
  book: number
  actual: number
  allowance: number
  shortage: number
  delivery: "sent" | "queued"
  reportText: string
  shortageItems: Array<{
    item_id?: EntityId
    name: string
    amount: number
    unit?: string
  }>
  items?: AuditItem[]
  composite_consumption?: Array<{
    parent_movement_id: EntityId
    composite_item_id: EntityId
    composite_name: string
    component_item_id: EntityId
    component_name: string
    quantity: number
    unit: BaseUnit
    negative_stock: boolean
  }>
}

export type ShiftType = "morning" | "evening" | "night"

export type ShiftInfo = BaseEntity & {
  type: ShiftType
  label: string
  branch: string
  started_at: number
}

export type MascotPreferences = {
  xRatio: number
  yRatio: number
  minimized: boolean
}

export type InventoryBackup = {
  app: "smart-inventory"
  version: 1 | 2
  exportedAt: string
  data: Record<string, string | null>
}

export function createEntityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16)
    const digit = value === "x" ? random : (random & 0x3) | 0x8
    return digit.toString(16)
  })
}

export function entityTimestamp() {
  return new Date().toISOString()
}
