import {
  createEntityId,
  entityTimestamp,
  type BaseUnit,
  type Item,
  type InventoryLocation,
  type RecipeComponent,
  type StockMovement,
} from "../models"

export type CompositeCountResult = {
  weights: Record<string, number | null>
  ledger: StockMovement[]
  parentMovementId: string | null
  negativeComponentIds: string[]
}

export function defaultBaseUnit(item: Item): BaseUnit {
  if (item.unit === "ml") return "ml"
  return item.unit === "kg" || item.unit === "g" ? "g" : "piece"
}

export function baseToStoredQuantity(
  quantity: number,
  baseUnit: BaseUnit,
  item: Item,
) {
  if (baseUnit === "g" && item.unit === "kg") return quantity / 1000
  return quantity
}

export function storedToBaseQuantity(quantity: number, item: Item) {
  return item.unit === "kg" ? quantity * 1000 : quantity
}

export function adjustStockByBaseQuantity(
  current: number | null | undefined,
  item: Item,
  baseQuantityDelta: number,
  unit: BaseUnit,
) {
  return (
    (current ?? item.opening_quantity) +
    baseToStoredQuantity(baseQuantityDelta, unit, item)
  )
}

export function componentCost(component: RecipeComponent, item: Item) {
  return (
    baseToStoredQuantity(component.quantity, component.unit, item) *
    item.cost_per_unit
  )
}

export function validateRecipe(
  compositeItemId: string,
  components: RecipeComponent[],
  items: Item[],
) {
  if (!components.length) return "أضف مكوناً واحداً على الأقل."
  const seen = new Set<string>()
  for (const component of components) {
    const item = items.find((entry) => entry.id === component.component_item_id)
    if (!item || item.id === compositeItemId || item.is_composite) {
      return "يمكن اختيار أصناف بسيطة فقط كمكونات."
    }
    if (!Number.isFinite(component.quantity) || component.quantity <= 0) {
      return "يجب أن تكون كمية كل مكون أكبر من صفر."
    }
    if (component.unit !== defaultBaseUnit(item)) {
      return "وحدة المكون لا تطابق وحدة الصنف الأساسية."
    }
    if (seen.has(component.component_item_id)) {
      return "لا يمكن تكرار المكون نفسه."
    }
    seen.add(component.component_item_id)
  }
  return null
}

export function applyCompositeCountState({
  composite,
  quantity,
  items,
  components,
  weights,
  ledger,
  note,
  location,
}: {
  composite: Item
  quantity: number | null
  items: Item[]
  components: RecipeComponent[]
  weights: Record<string, number | null>
  ledger: StockMovement[]
  note: string
  location: InventoryLocation
}): CompositeCountResult {
  const referenceId = `current-count:${location}:${composite.id}`
  const previousParents = ledger.filter(
    (movement) =>
      movement.type === "count" &&
      movement.item_id === composite.id &&
      movement.reference_id === referenceId,
  )
  const previousParentIds = new Set(
    previousParents.map((movement) => movement.id),
  )
  const previousChildren = ledger.filter(
    (movement) =>
      movement.type === "auto_deduct" &&
      movement.parent_movement_id !== null &&
      previousParentIds.has(movement.parent_movement_id),
  )
  const nextWeights = { ...weights }

  for (const child of previousChildren) {
    const item = items.find((entry) => entry.id === child.item_id)
    if (!item) continue
    const current = nextWeights[item.id] ?? item.opening_quantity
    nextWeights[item.id] =
      current - baseToStoredQuantity(child.quantity, child.unit, item)
  }

  let nextLedger = ledger.filter(
    (movement) =>
      !previousParentIds.has(movement.id) &&
      !(
        movement.parent_movement_id !== null &&
        previousParentIds.has(movement.parent_movement_id)
      ),
  )
  nextWeights[composite.id] = quantity
  if (quantity === null) {
    return {
      weights: nextWeights,
      ledger: nextLedger,
      parentMovementId: null,
      negativeComponentIds: [],
    }
  }

  const timestamp = entityTimestamp()
  const parentMovementId = createEntityId()
  const parent: StockMovement = {
    id: parentMovementId,
    item_id: composite.id,
    location,
    type: "count",
    quantity,
    unit: "piece",
    parent_movement_id: null,
    reference_id: referenceId,
    note,
    created_at: timestamp,
    updated_at: timestamp,
  }
  const negativeComponentIds: string[] = []
  const children = components.map((component) => {
    const item = items.find((entry) => entry.id === component.component_item_id)
    if (!item) throw new Error("تعذر العثور على أحد مكونات الوصفة.")
    const deductedBaseQuantity = quantity * component.quantity
    const current = nextWeights[item.id] ?? item.opening_quantity
    const next =
      current - baseToStoredQuantity(deductedBaseQuantity, component.unit, item)
    nextWeights[item.id] = next
    if (next < 0) negativeComponentIds.push(item.id)
    return {
      id: createEntityId(),
      item_id: item.id,
      location,
      type: "auto_deduct",
      quantity: -deductedBaseQuantity,
      unit: component.unit,
      parent_movement_id: parentMovementId,
      reference_id: component.id,
      note: `خصم تلقائي من ${composite.name_ar}`,
      created_at: timestamp,
      updated_at: timestamp,
    } satisfies StockMovement
  })
  nextLedger = [...nextLedger, parent, ...children]
  return {
    weights: nextWeights,
    ledger: nextLedger,
    parentMovementId,
    negativeComponentIds,
  }
}
