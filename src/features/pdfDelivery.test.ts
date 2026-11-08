import { describe, expect, it } from "vitest"
import { createOwnerWhatsAppUrl, normalizeWhatsAppPhone } from "./pdfDelivery"

describe("PDF delivery helpers", () => {
  it("normalizes international WhatsApp owner numbers", () => {
    expect(normalizeWhatsAppPhone("+966 55 555 1234")).toBe("966555551234")
    expect(normalizeWhatsAppPhone("00966555551234")).toBe("966555551234")
  })

  it("creates an exact-owner WhatsApp URL with encoded report text", () => {
    const url = createOwnerWhatsAppUrl("+966 55", "تقرير الجرد PDF")
    expect(url).toBe(
      `https://wa.me/96655?text=${encodeURIComponent("تقرير الجرد PDF")}`,
    )
  })
})
