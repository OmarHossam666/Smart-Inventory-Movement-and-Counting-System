import type { Category, InventoryUnit, Item } from "../models"

export type ProductImportRow = {
  rowNumber: number
  name_ar: string
  name_en: string
  category_id: string
  unit: InventoryUnit
  unit_label: string
  package_size: number
  opening: number | null
  incoming: number | null
  outgoing: number | null
  actual: number | null
  minimum_stock_alert: number | null
  cost_per_unit: number | null
  notes: string | null
}

export type ProductImportIssue = {
  rowNumber: number
  message: string
}

export type ProductImportPlanRow = ProductImportRow & {
  action: "add" | "update"
  existingId: string | null
}

type ParsedUnit = {
  unit: InventoryUnit
  unit_label: string
  package_size: number
}

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
}

export function normalizeArabicText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("ar")
}

function cleanDisplayText(value: unknown) {
  return String(value ?? "")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseCategory(value: unknown, categories: Category[]) {
  const text = normalizeArabicText(value)
  if (!text) return null
  return (
    categories.find((category) => {
      const names = [
        category.name_ar,
        category.name_en,
        category.label_ar,
        category.slug,
      ].map(normalizeArabicText)
      return names.some(
        (name) =>
          text === name ||
          text.includes(name) ||
          (category.slug === "meat" &&
            (text.includes("لحم") || text.includes("لحوم"))) ||
          (category.slug === "poultry" &&
            (text.includes("طير") ||
              text.includes("طيور") ||
              text.includes("دجاج"))) ||
          (category.slug === "vegetables" && text.includes("خضر")) ||
          (category.slug === "spices" &&
            (text.includes("توابل") || text.includes("بهارات"))) ||
          (category.slug === "beverages" && text.includes("مشروب")),
      )
    })?.id ?? null
  )
}

function parseUnit(value: unknown, category: Category): ParsedUnit {
  const display = cleanDisplayText(value)
  const text = normalizeArabicText(display)
  const amountMatch = text.match(/(\d+(?:[.,]\d+)?)/)
  const amount = amountMatch
    ? Number((amountMatch[1] ?? "").replace(",", "."))
    : 1000
  if (
    text === "kg" ||
    text.includes("kilogram") ||
    text.includes("كيلو") ||
    text.includes("كجم")
  ) {
    return {
      unit: "kg",
      unit_label: display || "كجم",
      package_size: Number.isFinite(amount) && amount > 0 ? amount / 1000 : 1,
    }
  }
  if (
    text === "g" ||
    text.includes("gram") ||
    text === "جم" ||
    text.endsWith(" جم")
  ) {
    return { unit: "g", unit_label: display || "جم", package_size: 1 }
  }
  if (
    text === "ml" ||
    text.includes("milliliter") ||
    text.includes("ملليلتر") ||
    text === "مل"
  ) {
    return { unit: "ml", unit_label: display || "مل", package_size: 1 }
  }
  if (text === "pack" || text.includes("عبوه") || text.includes("باك")) {
    return { unit: "pack", unit_label: display || "عبوة", package_size: 1 }
  }
  if (text === "jar" || text.includes("برطمان") || text.includes("مرطبان")) {
    return { unit: "jar", unit_label: display || "برطمان", package_size: 1 }
  }
  if (
    text === "piece" ||
    text.includes("حبه") ||
    text.includes("قطعه") ||
    text.includes("عدد")
  ) {
    return { unit: "piece", unit_label: display || "حبة", package_size: 1 }
  }
  if (!text && category.slug === "spices") {
    return { unit: "g", unit_label: "جم", package_size: 1 }
  }
  if (!text && category.slug === "beverages") {
    return { unit: "piece", unit_label: "حبة", package_size: 1 }
  }
  return {
    unit: "kg",
    unit_label: display || "كجم",
    package_size: Number.isFinite(amount) && amount > 0 ? amount / 1000 : 1,
  }
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN
  let normalized = String(value)
    .replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] ?? digit)
    .replace(/٬/g, "")
    .replace(/٫/g, ".")
    .trim()
  if (normalized.includes(",") && !normalized.includes(".")) {
    const fractionLength = normalized.length - normalized.lastIndexOf(",") - 1
    normalized =
      fractionLength === 3
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".")
  } else {
    normalized = normalized.replace(/,/g, "")
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

function findColumn(headers: unknown[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeArabicText)
  return headers.findIndex((header) => {
    const normalized = normalizeArabicText(header)
    return normalizedAliases.some(
      (alias) => normalized === alias || normalized.includes(alias),
    )
  })
}

export function parseProductImportRows(
  rows: readonly unknown[][],
  categories: Category[],
): {
  rows: ProductImportRow[]
  issues: ProductImportIssue[]
} {
  const issues: ProductImportIssue[] = []
  if (rows.length > 5001) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 0,
          message: "الملف يتجاوز الحد الأقصى وهو 5000 صف.",
        },
      ],
    }
  }

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeArabicText(cell) === "الصنف"),
  )
  if (headerIndex < 0) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 0,
          message: "لم يتم العثور على عمود «الصنف» في الملف.",
        },
      ],
    }
  }

  const headers = rows[headerIndex]
  if (!headers) {
    return {
      rows: [],
      issues: [{ rowNumber: 0, message: "تعذر قراءة صف عناوين الأعمدة." }],
    }
  }
  const columns = {
    category: findColumn(headers, ["القسم", "التصنيف"]),
    nameAr: findColumn(headers, [
      "الصنف",
      "المنتج",
      "اسم الصنف",
      "name ar",
      "arabic name",
    ]),
    nameEn: findColumn(headers, ["name en", "english name", "الاسم الانجليزي"]),
    unit: findColumn(headers, ["الوحدة", "الوحده"]),
    opening: findColumn(headers, ["رصيد اول اليوم", "رصيد أول اليوم"]),
    incoming: findColumn(headers, ["وارد", "الوارد"]),
    outgoing: findColumn(headers, ["الصادر", "صادر"]),
    actual: findColumn(headers, ["الرصيد الفعلي", "الرصيد", "فعلي"]),
    minimumStock: findColumn(headers, [
      "minimum stock",
      "min stock",
      "الحد الادني",
      "تنبيه الحد الادني",
    ]),
    costPerUnit: findColumn(headers, [
      "cost per unit",
      "unit cost",
      "تكلفه الوحده",
    ]),
    notes: findColumn(headers, ["ملاحظات", "الملاحظات"]),
  }

  if (columns.nameAr < 0) {
    return {
      rows: [],
      issues: [{ rowNumber: 0, message: "عمود اسم الصنف غير موجود." }],
    }
  }

  const parsedRows: ProductImportRow[] = []
  const seen = new Set<string>()
  let currentCategoryId: string | null = null

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2
    const nameAr = cleanDisplayText(row[columns.nameAr])
    if (!nameAr || normalizeArabicText(nameAr) === "الصنف") return

    const categoryCell =
      columns.category >= 0 ? row[columns.category] : undefined
    if (cleanDisplayText(categoryCell)) {
      currentCategoryId = parseCategory(categoryCell, categories)
      if (!currentCategoryId) {
        issues.push({
          rowNumber,
          message: `تعذر التعرف على القسم «${cleanDisplayText(categoryCell)}».`,
        })
        return
      }
    }
    if (!currentCategoryId) {
      issues.push({ rowNumber, message: "لا يوجد قسم معروف لهذا الصنف." })
      return
    }

    const key = normalizeArabicText(nameAr)
    if (seen.has(key)) {
      issues.push({ rowNumber, message: `الصنف «${nameAr}» مكرر في الملف.` })
      return
    }

    const numericValues = {
      opening: columns.opening >= 0 ? parseNumber(row[columns.opening]) : null,
      incoming:
        columns.incoming >= 0 ? parseNumber(row[columns.incoming]) : null,
      outgoing:
        columns.outgoing >= 0 ? parseNumber(row[columns.outgoing]) : null,
      actual: columns.actual >= 0 ? parseNumber(row[columns.actual]) : null,
      minimumStock:
        columns.minimumStock >= 0
          ? parseNumber(row[columns.minimumStock])
          : null,
      costPerUnit:
        columns.costPerUnit >= 0 ? parseNumber(row[columns.costPerUnit]) : null,
    }
    const invalidNumber = Object.entries(numericValues).find(
      ([, value]) => value !== null && (!Number.isFinite(value) || value < 0),
    )
    if (invalidNumber) {
      issues.push({
        rowNumber,
        message: `توجد قيمة رقمية غير صالحة في بيانات «${nameAr}».`,
      })
      return
    }

    const category =
      categories.find((entry) => entry.id === currentCategoryId) ??
      categories[0]
    if (!category) {
      issues.push({ rowNumber, message: "لا توجد فئات متاحة للاستيراد." })
      return
    }
    const parsedUnit = parseUnit(
      columns.unit >= 0 ? row[columns.unit] : undefined,
      category,
    )
    seen.add(key)
    parsedRows.push({
      rowNumber,
      name_ar: nameAr,
      name_en: columns.nameEn >= 0 ? cleanDisplayText(row[columns.nameEn]) : "",
      category_id: currentCategoryId,
      ...parsedUnit,
      opening: numericValues.opening,
      incoming: numericValues.incoming,
      outgoing: numericValues.outgoing,
      actual: numericValues.actual,
      minimum_stock_alert: numericValues.minimumStock,
      cost_per_unit: numericValues.costPerUnit,
      notes:
        columns.notes >= 0
          ? cleanDisplayText(row[columns.notes]).slice(0, 180) || null
          : null,
    })
  })

  if (!parsedRows.length && !issues.length) {
    issues.push({
      rowNumber: 0,
      message: "لا يحتوي الملف على أصناف قابلة للاستيراد.",
    })
  }
  return { rows: parsedRows, issues }
}

export function createProductImportPlan(
  rows: ProductImportRow[],
  products: Item[],
): ProductImportPlanRow[] {
  const existingByName = new Map(
    products.map((product) => [normalizeArabicText(product.name_ar), product]),
  )
  return rows.map((row) => {
    const normalizedTitle = normalizeArabicText(row.name_ar)
    const exact = existingByName.get(normalizedTitle)
    const closeMatches = exact
      ? []
      : products.filter((product) => {
          const normalizedProductTitle = normalizeArabicText(product.name_ar)
          return (
            product.category_id === row.category_id &&
            normalizedProductTitle.startsWith(normalizedTitle.charAt(0)) &&
            damerauLevenshtein(normalizedTitle, normalizedProductTitle) <= 1
          )
        })
    const existing =
      exact ?? (closeMatches.length === 1 ? closeMatches[0] : null)
    return {
      ...row,
      action: existing ? "update" : "add",
      existingId: existing?.id ?? null,
    }
  })
}

function damerauLevenshtein(left: string, right: string) {
  const rows = left.length + 1
  const columns = right.length + 1
  const matrix = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0),
  )
  for (let index = 0; index < rows; index += 1) matrix[index]![0] = index
  for (let index = 0; index < columns; index += 1) matrix[0]![index] = index

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + cost,
      )
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        matrix[row]![column] = Math.min(
          matrix[row]![column]!,
          matrix[row - 2]![column - 2]! + cost,
        )
      }
    }
  }
  return matrix[left.length]![right.length]!
}
