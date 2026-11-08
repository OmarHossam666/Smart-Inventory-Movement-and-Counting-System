import { describe, expect, it } from "vitest"
import {
  applyCompositeCountState,
  adjustStockByBaseQuantity,
  componentCost,
  validateRecipe,
} from "./compositeInventory"
import type { Item, RecipeComponent } from "../models"

const timestamp = "2025-01-01T00:00:00.000Z"

function item(
  id: string,
  name: string,
  unit: Item["unit"],
  opening: number,
  cost = 0,
  isComposite = false,
): Item {
  return {
    id,
    category_id: "11111111-1111-4111-8111-111111111111",
    name_ar: name,
    name_en: "",
    unit,
    unit_label: unit,
    package_size: 1,
    opening_quantity: opening,
    minimum_stock_alert: 0,
    cost_per_unit: cost,
    shrinkage_percent: 0,
    initial_quantity: null,
    image_url: "",
    active: true,
    is_composite: isComposite,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

function component(
  id: string,
  compositeId: string,
  componentId: string,
  quantity: number,
  unit: RecipeComponent["unit"],
): RecipeComponent {
  return {
    id,
    composite_item_id: compositeId,
    component_item_id: componentId,
    quantity,
    unit,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

describe("composite inventory ledger", () => {
  const hawawshi = item(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "حواوشي",
    "piece",
    0,
    0,
    true,
  )
  const meat = item("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "لحم", "kg", 5, 40)
  const pepper = item(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "فلفل أسود",
    "g",
    200,
    0.02,
  )
  const salt = item(
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "ملح",
    "g",
    300,
    0.01,
  )
  const onion = item("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "بصل", "kg", 2, 5)
  const items = [hawawshi, meat, pepper, salt, onion]
  const recipe = [
    component(
      "10000000-0000-4000-8000-000000000001",
      hawawshi.id,
      meat.id,
      150,
      "g",
    ),
    component(
      "10000000-0000-4000-8000-000000000002",
      hawawshi.id,
      pepper.id,
      2,
      "g",
    ),
    component(
      "10000000-0000-4000-8000-000000000003",
      hawawshi.id,
      salt.id,
      3,
      "g",
    ),
    component(
      "10000000-0000-4000-8000-000000000004",
      hawawshi.id,
      onion.id,
      40,
      "g",
    ),
  ]

  it("deducts exactly N times four Hawawshi components and links child rows", () => {
    const result = applyCompositeCountState({
      composite: hawawshi,
      quantity: 10,
      items,
      components: recipe,
      weights: {},
      ledger: [],
      note: "count 10",
      location: "restaurant",
    })
    expect(result.weights[hawawshi.id]).toBe(10)
    expect(result.weights[meat.id]).toBe(3.5)
    expect(result.weights[pepper.id]).toBe(180)
    expect(result.weights[salt.id]).toBe(270)
    expect(result.weights[onion.id]).toBe(1.6)
    const children = result.ledger.filter(
      (movement) => movement.type === "auto_deduct",
    )
    expect(children).toHaveLength(4)
    expect(children.map((movement) => movement.quantity)).toEqual([
      -1500, -20, -30, -400,
    ])
    expect(
      children.every(
        (movement) => movement.parent_movement_id === result.parentMovementId,
      ),
    ).toBe(true)
  })

  it("reverses the old deductions before editing and fully reverses on delete", () => {
    const first = applyCompositeCountState({
      composite: hawawshi,
      quantity: 10,
      items,
      components: recipe,
      weights: {},
      ledger: [],
      note: "count 10",
      location: "restaurant",
    })
    const edited = applyCompositeCountState({
      composite: hawawshi,
      quantity: 4,
      items,
      components: recipe,
      weights: first.weights,
      ledger: first.ledger,
      note: "edit to 4",
      location: "restaurant",
    })
    expect(edited.weights[meat.id]).toBe(4.4)
    expect(edited.weights[pepper.id]).toBe(192)
    expect(
      edited.ledger.filter((entry) => entry.type === "auto_deduct"),
    ).toHaveLength(4)

    const removed = applyCompositeCountState({
      composite: hawawshi,
      quantity: null,
      items,
      components: recipe,
      weights: edited.weights,
      ledger: edited.ledger,
      note: "delete",
      location: "restaurant",
    })
    expect(removed.weights[hawawshi.id]).toBeNull()
    expect(removed.weights[meat.id]).toBe(5)
    expect(removed.weights[pepper.id]).toBe(200)
    expect(removed.weights[salt.id]).toBe(300)
    expect(removed.weights[onion.id]).toBe(2)
    expect(removed.ledger).toEqual([])
  })

  it("warns but still saves when a component becomes negative", () => {
    const result = applyCompositeCountState({
      composite: hawawshi,
      quantity: 100,
      items,
      components: recipe,
      weights: {},
      ledger: [],
      note: "large count",
      location: "restaurant",
    })
    expect(result.negativeComponentIds).toContain(meat.id)
    expect(result.weights[meat.id]).toBe(-10)
    expect(result.ledger).toHaveLength(5)
  })

  it("deducts a recipe from an independently counted component balance", () => {
    const result = applyCompositeCountState({
      composite: hawawshi,
      quantity: 10,
      items,
      components: recipe,
      weights: {
        [salt.id]: 250,
      },
      ledger: [],
      note: "manual salt count before composite count",
      location: "restaurant",
    })

    expect(result.weights[salt.id]).toBe(220)
  })

  it("rejects duplicates, non-positive quantities, and nested composites", () => {
    const firstComponent = recipe[0]!
    expect(validateRecipe(hawawshi.id, recipe, items)).toBeNull()
    expect(
      validateRecipe(hawawshi.id, [...recipe, firstComponent], items),
    ).toContain("تكرار")
    expect(
      validateRecipe(hawawshi.id, [{ ...firstComponent, quantity: 0 }], items),
    ).toContain("أكبر من صفر")
    expect(
      validateRecipe(
        hawawshi.id,
        [{ ...firstComponent, component_item_id: hawawshi.id }],
        items,
      ),
    ).toContain("بسيطة")
  })

  it("calculates recipe cost from base-unit quantities", () => {
    const cost = recipe.reduce((sum, entry) => {
      const ingredient = items.find(
        (candidate) => candidate.id === entry.component_item_id,
      )!
      return sum + componentCost(entry, ingredient)
    }, 0)
    expect(cost).toBeCloseTo(6 + 0.04 + 0.03 + 0.2)
  })

  it("moves 5 kg from butcher stock to restaurant stock exactly", () => {
    const sentBaseQuantity = 5000
    const butcherAfter = adjustStockByBaseQuantity(
      12,
      meat,
      -sentBaseQuantity,
      "g",
    )
    const restaurantAfter = adjustStockByBaseQuantity(
      3,
      meat,
      sentBaseQuantity,
      "g",
    )
    expect(butcherAfter).toBe(7)
    expect(restaurantAfter).toBe(8)
  })
})
