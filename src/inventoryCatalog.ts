import {
  createEntityId,
  entityTimestamp,
  BaseUnit,
  Category,
  CategorySlug,
  InventoryFlow,
  InventoryUnit,
  Item,
} from "./models"

export const INVENTORY_SCHEMA_VERSION = 4

export const CATEGORY_IDS: Record<CategorySlug, string> = {
  meat: "11111111-1111-4111-8111-111111111111",
  poultry: "22222222-2222-4222-8222-222222222222",
  vegetables: "33333333-3333-4333-8333-333333333333",
  spices: "44444444-4444-4444-8444-444444444444",
  beverages: "55555555-5555-4555-8555-555555555555",
}

const seedTimestamp = "2025-01-01T00:00:00.000Z"

export const seedCategories: Category[] = [
  {
    id: CATEGORY_IDS.meat,
    slug: "meat",
    name_ar: "اللحوم",
    name_en: "Meat",
    label_ar: "القسم الأول · اللحوم",
    icon_key: "meat",
    color: "slate",
    sort_order: 10,
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: CATEGORY_IDS.poultry,
    slug: "poultry",
    name_ar: "الطيور",
    name_en: "Poultry",
    label_ar: "القسم الثاني · الطيور",
    icon_key: "poultry",
    color: "amber",
    sort_order: 20,
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: CATEGORY_IDS.vegetables,
    slug: "vegetables",
    name_ar: "الخضروات",
    name_en: "Vegetables",
    label_ar: "القسم الثالث · الخضروات",
    icon_key: "vegetables",
    color: "emerald",
    sort_order: 30,
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: CATEGORY_IDS.spices,
    slug: "spices",
    name_ar: "التوابل",
    name_en: "Spices",
    label_ar: "قسم التوابل",
    icon_key: "spices",
    color: "orange",
    sort_order: 40,
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: CATEGORY_IDS.beverages,
    slug: "beverages",
    name_ar: "المشروبات",
    name_en: "Beverages",
    label_ar: "قسم المشروبات",
    icon_key: "beverages",
    color: "sky",
    sort_order: 50,
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
]

const categoryImages: Record<CategorySlug, string> = {
  meat: "https://images.unsplash.com/photo-1600180786489-2e9a5b4041b5?auto=format&fit=crop&w=700&q=85",
  poultry:
    "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=700&q=85",
  vegetables:
    "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=700&q=85",
  spices:
    "https://images.unsplash.com/photo-1690983323310-3f8e55c9272f?auto=format&fit=crop&w=700&q=85",
  beverages:
    "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=85",
}

export function defaultItemImage(category: Category | CategorySlug) {
  return categoryImages[typeof category === "string" ? category : category.slug]
}

type SourceItem = [nameAr: string, unitLabel?: string]

const sourceCatalog: Partial<Record<CategorySlug, SourceItem[]>> = {
  meat: [
    ["كفتة", "1000كجم"],
    ["أوصال بتلو", "1000كجم"],
    ["أوصال ضأن", "1000كجم"],
    ["ريش", "1000كجم"],
    ["طرب", "1000كجم"],
    ["نبفا", "1000كجم"],
    ["ضلع بتلو", "1000كجم"],
    ["ستيك", "1000كجم"],
    ["فيليه", "1000كجم"],
    ["موزة", "1000كجم"],
    ["لحم طواجن", "1000كجم"],
    ["كوارع", "1000كجم"],
    ["عكاوي", "1000كجم"],
    ["لحم معصج", "1000كجم"],
    ["كبدة", "1000كجم"],
    ["حواوشي", "1000كجم"],
    ["سجق", "1000كجم"],
    ["لية", "1000كجم"],
    ["ورق لحمة", "1000كجم"],
  ],
  poultry: [
    ["دجاج مشوي", "900كجم"],
    ["دجاج محشي", "900كجم"],
    ["دجاج بانيه", "1000كجم"],
    ["شيش طاووق", "1000كجم"],
    ["كباب دجاج", "1000كجم"],
    ["بط", "2200كجم"],
    ["حمام محشي أرز", "حبة"],
    ["حمام محشي فريك", "حبة"],
    ["حمام مشوي", "حبة"],
  ],
  vegetables: [
    ["طماطم", "1000كجم"],
    ["خيار", "1000كجم"],
    ["بطاطس", "1000كجم"],
    ["فلفل رومي", "1000كجم"],
    ["فلفل شطة أخضر", "1000كجم"],
    ["فلفل شطة أحمر", "1000كجم"],
    ["فلفل حلو أصفر", "1000كجم"],
    ["فلفل حلو أحمر", "1000كجم"],
    ["جزر", "1000كجم"],
    ["ليمون إنجليزي", "1000كجم"],
    ["ليمون عصير", "1000كجم"],
    ["كرفس", "1000كجم"],
    ["باذنجان رومي", "1000كجم"],
    ["باذنجان محشي", "1000كجم"],
    ["كوسة محشي", "1000كجم"],
    ["بصل أبيض", "1000كجم"],
    ["بصل أحمر", "1000كجم"],
    ["ثوم", "1000كجم"],
    ["كابوتشي أخضر", "حبة"],
    ["كابوتشي موف", "حبة"],
    ["كرنب محشي", "حبة"],
    ["بقدونس", "حبة"],
    ["كزبرة خضراء", "حبة"],
    ["شبت", "حبة"],
    ["نعناع أخضر", "حبة"],
    ["ريحان", "حبة"],
    ["روزماري أخضر", "حبة"],
    ["خس", "حبة"],
  ],
  beverages: [
    ["بيبسي 360", "حبة"],
    ["سفن 360", "حبة"],
    ["بيبسي دايت 360", "حبة"],
    ["سفن دايت 360", "حبة"],
    ["ميرندا 360", "حبة"],
    ["حمضيات 360", "حبة"],
    ["مياه", "حبة"],
  ],
}

function seedItemId(legacyId: number) {
  return `00000000-0000-4000-8000-${String(legacyId).padStart(12, "0")}`
}

function parseSourceUnit(unitLabel: string) {
  if (unitLabel === "حبة") {
    return { unit: "piece" as const, packageSize: 1 }
  }
  const grams = Number.parseInt(unitLabel, 10)
  return {
    unit: "kg" as const,
    packageSize: Number.isFinite(grams) ? grams / 1000 : 1,
  }
}

export const seedItems: Item[] = Object.entries(sourceCatalog).flatMap(
  ([slug, items], categoryIndex) =>
    (items ?? []).map(([nameAr, unitLabel = "حبة"], itemIndex) => {
      const categorySlug = slug as CategorySlug
      const legacyId = categoryIndex * 100 + itemIndex + 1
      const { unit, packageSize } = parseSourceUnit(unitLabel)
      return {
        id: seedItemId(legacyId),
        category_id: CATEGORY_IDS[categorySlug],
        name_ar: nameAr,
        name_en: "",
        unit,
        unit_label: unitLabel,
        package_size: packageSize,
        opening_quantity: 0,
        minimum_stock_alert: 0,
        cost_per_unit: 0,
        shrinkage_percent: 0,
        initial_quantity: null,
        image_url: categoryImages[categorySlug],
        active: true,
        is_composite: false,
        created_at: seedTimestamp,
        updated_at: seedTimestamp,
      }
    }),
)

export function emptyMovement(
  opening = 0,
  itemId = createEntityId(),
): InventoryFlow {
  const timestamp = entityTimestamp()
  return {
    id: createEntityId(),
    item_id: itemId,
    opening,
    incoming: 0,
    outgoing: 0,
    notes: "",
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export function expectedBalance(movement: InventoryFlow) {
  return Number(
    Math.max(
      0,
      movement.opening + movement.incoming - movement.outgoing,
    ).toFixed(3),
  )
}

export function unitName(item: Pick<Item, "unit">) {
  return inventoryUnitName(item.unit)
}

export function inventoryUnitName(unit: InventoryUnit) {
  const labels: Record<InventoryUnit, string> = {
    g: "جم",
    kg: "كجم",
    ml: "مل",
    pack: "عبوة",
    jar: "برطمان",
    piece: "حبة",
  }
  return labels[unit]
}

export function baseUnitName(unit: BaseUnit) {
  const labels: Record<BaseUnit, string> = {
    g: "جرام",
    ml: "مل",
    piece: "حبة",
  }
  return labels[unit]
}
