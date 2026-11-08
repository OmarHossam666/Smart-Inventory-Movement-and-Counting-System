import { describe, expect, it } from "vitest"
import { CATEGORY_IDS, seedCategories } from "../inventoryCatalog"
import type { Item } from "../models"
import {
  createProductImportPlan,
  normalizeArabicText,
  parseProductImportRows,
} from "./productImport"

function item(
  id: string,
  name_ar: string,
  category_id = CATEGORY_IDS.meat,
): Item {
  return {
    id,
    name_ar,
    name_en: "",
    category_id,
    unit: "kg",
    unit_label: "كجم",
    package_size: 1,
    opening_quantity: 0,
    minimum_stock_alert: 0,
    cost_per_unit: 0,
    shrinkage_percent: 0,
    initial_quantity: null,
    image_url: "",
    active: true,
    is_composite: false,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  }
}

describe("product Excel import", () => {
  const sheet = [
    [
      "القسم",
      "الصنف",
      "الوحده ( كجم )",
      "رصيد اول اليوم",
      "وارد",
      "الصادر",
      "الرصيد",
      "الفرق",
      "ملاحظات",
    ],
    ["القسم الأول ( اللحوم )", "كفتة", "1000كجم", 10, 2, 1, 11, 0, "سليم"],
    [null, "ريـــــش", "1000كجم", null, null, null, null, null, null],
    [null, "الصنف", "الوحدة", "رصيد اول اليوم"],
    ["قسم المشروبات", "مياه", null, 4, 0, 1, 3, 0, ""],
  ]

  it("parses merged categories, repeated headers, movement values, and blank beverage units", () => {
    const result = parseProductImportRows(sheet, seedCategories)
    expect(result.issues).toEqual([])
    expect(result.rows).toHaveLength(3)
    expect(result.rows[1]?.name_ar).toBe("ريش")
    expect(result.rows[0]).toMatchObject({
      unit: "kg",
      opening: 10,
      incoming: 2,
      outgoing: 1,
      actual: 11,
    })
    expect(result.rows[2]).toMatchObject({
      category_id: CATEGORY_IDS.beverages,
      unit: "piece",
      opening: 4,
      outgoing: 1,
      actual: 3,
    })
  })

  it("keeps KG quantities in kilograms instead of converting them to grams", () => {
    const result = parseProductImportRows(
      [
        ["القسم", "الصنف", "الوحدة", "رصيد أول اليوم", "الرصيد الفعلي"],
        ["اللحوم", "لحم اختبار", "KG", 12.5, 11.75],
      ],
      seedCategories,
    )

    expect(result.issues).toEqual([])
    expect(result.rows[0]).toMatchObject({
      unit: "kg",
      opening: 12.5,
      actual: 11.75,
    })
  })

  it.each([
    ["KG", "kg", "KG"],
    ["جم", "g", "جم"],
    ["ML", "ml", "ML"],
    ["حبة", "piece", "حبة"],
  ] as const)(
    "preserves %s as the imported display unit without changing quantities",
    (unitLabel, unit, expectedLabel) => {
      const result = parseProductImportRows(
        [
          ["القسم", "الصنف", "الوحدة", "رصيد أول اليوم", "الرصيد الفعلي"],
          ["اللحوم", `اختبار ${unitLabel}`, unitLabel, 12.5, 11.75],
        ],
        seedCategories,
      )

      expect(result.issues).toEqual([])
      expect(result.rows[0]).toMatchObject({
        unit,
        unit_label: expectedLabel,
        opening: 12.5,
        actual: 11.75,
      })
    },
  )

  it("defaults blank Spices units to grams and preserves editable fields", () => {
    const result = parseProductImportRows(
      [
        [
          "القسم",
          "الصنف",
          "الاسم الإنجليزي",
          "الوحدة",
          "رصيد أول اليوم",
          "تنبيه الحد الأدنى",
          "تكلفة الوحدة",
        ],
        ["Spices", "كمون", "Cumin", "", 500, 100, 0.25],
      ],
      seedCategories,
    )
    expect(result.issues).toEqual([])
    expect(result.rows[0]).toMatchObject({
      category_id: CATEGORY_IDS.spices,
      name_ar: "كمون",
      name_en: "Cumin",
      unit: "g",
      opening: 500,
      minimum_stock_alert: 100,
      cost_per_unit: 0.25,
    })
  })

  it("normalizes Arabic spelling and decoration for search and matching", () => {
    expect(normalizeArabicText("  أوصــــال ضأن ")).toBe(
      normalizeArabicText("اوصال ضان"),
    )
  })

  it("rejects invalid numeric values and duplicate rows safely", () => {
    const result = parseProductImportRows(
      [
        ["القسم", "الصنف", "رصيد اول اليوم"],
        ["اللحوم", "كفتة", -1],
        ["اللحوم", "ريش", 2],
        [null, "ريــــش", 3],
      ],
      seedCategories,
    )
    expect(result.rows).toHaveLength(1)
    expect(result.issues).toHaveLength(2)
  })

  it("plans normalized matches as updates and unknown products as additions", () => {
    const existingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const parsed = parseProductImportRows(
      [
        ["القسم", "الصنف"],
        ["اللحوم", "اوصال ضان"],
        [null, "منتج جديد"],
      ],
      seedCategories,
    )
    const plan = createProductImportPlan(parsed.rows, [
      item(existingId, "أوصال ضأن"),
    ])
    expect(plan.map((row) => row.action)).toEqual(["update", "add"])
    expect(plan[0]?.existingId).toBe(existingId)
  })

  it("updates one unambiguous same-category typo without creating a duplicate", () => {
    const firstId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const existing = [
      item(firstId, "فيليه"),
      item("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "لية"),
    ]
    const parsed = parseProductImportRows(
      [
        ["القسم", "الصنف"],
        ["اللحوم", "فليه"],
      ],
      seedCategories,
    )
    expect(createProductImportPlan(parsed.rows, existing)[0]).toMatchObject({
      action: "update",
      existingId: firstId,
    })
  })
})
