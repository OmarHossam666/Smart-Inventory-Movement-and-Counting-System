import { describe, expect, it } from "vitest"
import {
  CATEGORY_IDS,
  seedCategories,
  seedItems,
  unitName,
} from "./inventoryCatalog"

describe("inventory catalog", () => {
  it("defines Spices as a stable empty category between Vegetables and Beverages", () => {
    const slugs = seedCategories.map((category) => category.slug)
    expect(slugs).toEqual([
      "meat",
      "poultry",
      "vegetables",
      "spices",
      "beverages",
    ])
    expect(
      seedCategories.find((category) => category.slug === "spices"),
    ).toMatchObject({
      id: CATEGORY_IDS.spices,
      name_ar: "التوابل",
      name_en: "Spices",
    })
    expect(
      seedItems.filter((item) => item.category_id === CATEGORY_IDS.spices),
    ).toEqual([])
  })

  it("labels every supported inventory unit", () => {
    expect(
      (["g", "kg", "ml", "pack", "jar", "piece"] as const).map((unit) =>
        unitName({ unit }),
      ),
    ).toEqual(["جم", "كجم", "مل", "عبوة", "برطمان", "حبة"])
  })
})
