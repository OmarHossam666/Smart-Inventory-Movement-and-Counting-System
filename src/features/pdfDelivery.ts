import { Capacitor, registerPlugin } from "@capacitor/core"

type NativePdfBridge = {
  openPdf(options: { base64: string; fileName: string }): Promise<{
    uri: string
  }>
  savePdf(options: { base64: string; fileName: string }): Promise<{
    uri: string
  }>
  sharePdfToWhatsApp(options: {
    base64: string
    fileName: string
    phone: string
    text: string
  }): Promise<{ packageName: string }>
}

export const nativePdfBridge = registerPlugin<NativePdfBridge>("PdfBridge")

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
}

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.startsWith("00") ? digits.slice(2) : digits
}

export function createOwnerWhatsAppUrl(phone: string, text: string) {
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(text)}`
}

export async function blobToBase64(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("تعذر تجهيز ملف PDF."))
    reader.onload = () => {
      const result = String(reader.result)
      const separator = result.indexOf(",")
      if (separator < 0) {
        reject(new Error("تعذر ترميز ملف PDF."))
        return
      }
      resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(blob)
  })
}
