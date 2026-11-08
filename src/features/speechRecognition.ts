import { Capacitor } from "@capacitor/core"
import type { InventoryUnit } from "../models"

export type NativeSpeechErrorCode = "unavailable" | "permission-denied" | "no-match" | "cancelled" | "unknown"

export class NativeSpeechError extends Error {
  constructor(
    readonly code: NativeSpeechErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export function isNativeSpeechPlatform() {
  return Capacitor.isNativePlatform()
}

export async function recognizeArabicNative() {
  const { SpeechRecognition } = await import(
    "@capacitor-community/speech-recognition"
  )
  const availability = await SpeechRecognition.available()
  if (!availability.available) {
    throw new NativeSpeechError(
      "unavailable",
      "التعرف الصوتي غير متاح على هذا الجهاز.",
    )
  }

  let permission = await SpeechRecognition.checkPermissions()
  if (permission.speechRecognition !== "granted") {
    permission = await SpeechRecognition.requestPermissions()
  }
  if (permission.speechRecognition !== "granted") {
    throw new NativeSpeechError(
      "permission-denied",
      "لم يتم السماح باستخدام الميكروفون.",
    )
  }

  try {
    const result = await SpeechRecognition.start({
      language: "ar-SA",
      maxResults: 5,
      prompt: "انطق الوزن أو العدد الآن",
      partialResults: false,
      popup: false,
    })
    const matches = (result.matches ?? [])
      .map((match) => match.trim())
      .filter(Boolean)
    if (!matches.length) {
      throw new NativeSpeechError(
        "no-match",
        "لم نسمع كمية واضحة. حاول مرة أخرى.",
      )
    }
    return matches
  } catch (error) {
    if (error instanceof NativeSpeechError) throw error
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("cancel")) {
      throw new NativeSpeechError("cancelled", "تم إلغاء الاستماع.")
    }
    throw new NativeSpeechError(
      "unknown",
      "تعذر تشغيل التعرف الصوتي على هذا الجهاز.",
    )
  } finally {
    await SpeechRecognition.removeAllListeners().catch(() => undefined)
  }
}

export async function stopNativeSpeechRecognition() {
  if (!isNativeSpeechPlatform()) return
  try {
    const { SpeechRecognition } = await import(
      "@capacitor-community/speech-recognition"
    )
    if ((await SpeechRecognition.isListening()).listening) {
      await SpeechRecognition.stop()
    }
    await SpeechRecognition.removeAllListeners()
  } catch {
    // Stopping is best-effort during dialog close and component teardown.
  }
}

export function parseSpokenWeight(transcript: string): number | null {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩"
  let normalized = transcript
    .toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[٫,،]/g, ".")
    .replace(/كيلوجرام|كيلو جرام|كيلوغرام|كيلوات|كيلو/g, " كيلو ")
    .replace(/غرام|جرام|غرامات|جرامات/g, " جرام ")
    .replace(/\s+/g, " ")
    .trim()

  const isGrams = normalized.includes("جرام") && !normalized.includes("كيلو")
  const numericMatch = normalized.match(/\d+(?:\.\d+)?/)
  let value = numericMatch ? Number(numericMatch[0]) : null

  if (value === null) {
    const numberWords: Record<string, number> = {
      صفر: 0,
      واحد: 1,
      واحدة: 1,
      اثنين: 2,
      اثنان: 2,
      اتنين: 2,
      ثلاثة: 3,
      ثلاثه: 3,
      اربعة: 4,
      أربعة: 4,
      اربعه: 4,
      خمسة: 5,
      خمسه: 5,
      ستة: 6,
      سته: 6,
      سبعة: 7,
      سبعه: 7,
      ثمانية: 8,
      ثمانيه: 8,
      تسعة: 9,
      تسعه: 9,
      عشرة: 10,
      عشره: 10,
      عشر: 10,
      احدعشر: 11,
      "احد عشر": 11,
      اتناشر: 12,
      اثناعشر: 12,
      "اثنا عشر": 12,
      تلتاشر: 13,
      ثلاثةعشر: 13,
      اربعتاشر: 14,
      خمستاشر: 15,
      ستاشر: 16,
      سبعتاشر: 17,
      تمنتاشر: 18,
      ثمانيةعشر: 18,
      تسعتاشر: 19,
      عشرين: 20,
      ثلاثين: 30,
      اربعين: 40,
      أربعين: 40,
      خمسين: 50,
      ستين: 60,
      سبعين: 70,
      ثمانين: 80,
      تسعين: 90,
      مئة: 100,
      مائه: 100,
      ميتين: 200,
      مئتين: 200,
      تلتمية: 300,
      اربعمية: 400,
      خمسمية: 500,
      ستمية: 600,
      سبعمية: 700,
      تمنمية: 800,
      تسعمية: 900,
    }
    normalized = normalized.replace(/[^\p{L}\d.\s]/gu, " ")
    const phrase = (normalized.split(/\s+(?:كيلو|جرام|حبة)\s*/)[0] ?? "")
      .replace(/^(?:وزن|عدد)\s+/, "")
      .trim()
    const direct = numberWords[phrase]
    if (direct !== undefined) {
      value = direct
    } else {
      const tokens = phrase.split(/\s+/).map((token) => token.replace(/^و/, ""))
      const values = tokens
        .map((token) => numberWords[token])
        .filter((entry) => entry !== undefined)
      if (values.length > 0)
        value = values.reduce((sum, entry) => sum + entry, 0)
    }
  }

  const hasHalf = /(?:و\s*)?(?:نص|نصف)/.test(normalized)
  const hasQuarter = /(?:و\s*)?ربع/.test(normalized)
  const hasThreeQuarters = /ثلاث(?:ة|ه)?\s+ارباع|ثلاث(?:ة|ه)?\s+أرباع/.test(
    normalized,
  )

  if (
    value === null &&
    normalized.startsWith("كيلو") &&
    (hasHalf || hasQuarter || hasThreeQuarters)
  ) {
    value = 1
  } else if (value === null && (hasHalf || hasQuarter || hasThreeQuarters)) {
    value = 0
  }
  if (value === null || !Number.isFinite(value)) return null
  if (!numericMatch || !numericMatch[0].includes(".")) {
    if (hasThreeQuarters) value += 0.75
    else if (hasHalf) value += 0.5
    else if (hasQuarter) value += 0.25
  }
  if (isGrams) value /= 1000
  if (value <= 0 || value > 500) return null
  return Number(value.toFixed(3))
}

export function parseSpokenInventoryQuantity(
  transcript: string,
  unit: InventoryUnit,
) {
  const parsed = parseSpokenWeight(transcript)
  if (parsed === null) return null
  return unit === "g" ? Number((parsed * 1000).toFixed(3)) : parsed
}
