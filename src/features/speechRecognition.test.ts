import { describe, expect, it } from "vitest"
import {
  parseSpokenInventoryQuantity,
  parseSpokenWeight,
} from "./speechRecognition"

describe("parseSpokenWeight", () => {
  it.each([
    ["ثمانية عشر كيلو ونصف", 18.5],
    ["٢٫٧٥ كيلو", 2.75],
    ["خمسمية جرام", 0.5],
    ["كيلو وربع", 1.25],
    ["عدد عشرين حبة", 20],
  ])("parses %s", (phrase, expected) => {
    expect(parseSpokenWeight(phrase)).toBe(expected)
  })

  it.each(["", "صوت غير مفهوم", "0 كيلو", "501 كيلو"])(
    "rejects %s",
    (phrase) => {
      expect(parseSpokenWeight(phrase)).toBeNull()
    },
  )

  it("converts spoken kilograms and grams to a gram item's stored unit", () => {
    expect(parseSpokenInventoryQuantity("خمسمية جرام", "g")).toBe(500)
    expect(parseSpokenInventoryQuantity("نصف كيلو", "g")).toBe(500)
  })
})
