export const STANDARD_WEIGHT_SERVICE = "0000181d-0000-1000-8000-00805f9b34fb"
export const STANDARD_WEIGHT_CHARACTERISTIC =
  "00002a9d-0000-1000-8000-00805f9b34fb"

export type ScaleReading = {
  kilograms: number
  sourceUnit: "kg" | "lb"
  rawValue: number
}

export function parseWeightMeasurement(value: DataView): ScaleReading {
  if (value.byteLength < 3) {
    throw new Error("حزمة قراءة الميزان أقصر من معيار Bluetooth.")
  }
  const flags = value.getUint8(0)
  const imperial = (flags & 0x01) !== 0
  const rawValue = value.getUint16(1, true)
  if (rawValue === 0xffff) {
    throw new Error("أرسل الميزان قيمة تشير إلى أن القياس غير متاح.")
  }
  const kilograms = imperial ? rawValue * 0.01 * 0.45359237 : rawValue * 0.005
  if (!Number.isFinite(kilograms) || kilograms < 0 || kilograms > 500) {
    throw new Error("أرسل الميزان قراءة خارج النطاق الآمن.")
  }
  return {
    kilograms: Number(kilograms.toFixed(3)),
    sourceUnit: imperial ? "lb" : "kg",
    rawValue,
  }
}

export type ConnectedScale = {
  id: string
  name: string
  rssi: number | null
}

export class BleScaleClient {
  private deviceId: string | null = null
  private initialized = false

  async connect(
    onReading: (reading: ScaleReading) => void,
    onDisconnect: () => void,
  ): Promise<ConnectedScale> {
    const { BleClient } = await import("@capacitor-community/bluetooth-le")
    if (!this.initialized) {
      await BleClient.initialize({ androidNeverForLocation: true })
      this.initialized = true
    }
    if (!(await BleClient.isEnabled())) {
      try {
        await BleClient.requestEnable()
      } catch {
        throw new Error("شغّل Bluetooth من إعدادات الجهاز ثم حاول مجدداً.")
      }
    }
    await BleClient.setDisplayStrings({
      scanning: "جاري البحث عن الموازين...",
      cancel: "إلغاء",
      availableDevices: "الموازين المتاحة",
      noDeviceFound: "لم يتم العثور على ميزان متوافق",
    })
    const device = await BleClient.requestDevice({
      services: [STANDARD_WEIGHT_SERVICE],
      optionalServices: [STANDARD_WEIGHT_SERVICE],
    })
    await BleClient.connect(
      device.deviceId,
      () => {
        this.deviceId = null
        onDisconnect()
      },
      { timeout: 15_000 },
    )
    this.deviceId = device.deviceId

    try {
      await BleClient.startNotifications(
        device.deviceId,
        STANDARD_WEIGHT_SERVICE,
        STANDARD_WEIGHT_CHARACTERISTIC,
        (value) => onReading(parseWeightMeasurement(value)),
        { timeout: 8_000 },
      )

      try {
        const initial = await BleClient.read(
          device.deviceId,
          STANDARD_WEIGHT_SERVICE,
          STANDARD_WEIGHT_CHARACTERISTIC,
          { timeout: 5_000 },
        )
        onReading(parseWeightMeasurement(initial))
      } catch {
        // Some compliant scales expose indications only and cannot be read.
      }

      let rssi: number | null = null
      try {
        rssi = await BleClient.readRssi(device.deviceId)
      } catch {
        // RSSI is not available in Web Bluetooth.
      }
      return {
        id: device.deviceId,
        name: device.name || `ميزان ${device.deviceId.slice(-6)}`,
        rssi,
      }
    } catch (error) {
      this.deviceId = null
      await BleClient.disconnect(device.deviceId).catch(() => undefined)
      throw error
    }
  }

  async refresh() {
    if (!this.deviceId) throw new Error("لا يوجد ميزان متصل.")
    const { BleClient } = await import("@capacitor-community/bluetooth-le")
    const value = await BleClient.read(
      this.deviceId,
      STANDARD_WEIGHT_SERVICE,
      STANDARD_WEIGHT_CHARACTERISTIC,
      { timeout: 5_000 },
    )
    return parseWeightMeasurement(value)
  }

  async disconnect() {
    if (!this.deviceId) return
    const deviceId = this.deviceId
    this.deviceId = null
    const { BleClient } = await import("@capacitor-community/bluetooth-le")
    try {
      await BleClient.stopNotifications(
        deviceId,
        STANDARD_WEIGHT_SERVICE,
        STANDARD_WEIGHT_CHARACTERISTIC,
      )
    } finally {
      await BleClient.disconnect(deviceId)
    }
  }

  async openBluetoothSettings() {
    const { BleClient } = await import("@capacitor-community/bluetooth-le")
    await BleClient.openBluetoothSettings()
  }
}

export const bleScaleClient = new BleScaleClient()
