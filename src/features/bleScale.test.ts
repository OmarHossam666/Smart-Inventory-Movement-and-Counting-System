import { describe, expect, it } from "vitest"
import { parseWeightMeasurement } from "./bleScale"

function packet(flags: number, rawWeight: number) {
  const value = new DataView(new ArrayBuffer(3))
  value.setUint8(0, flags)
  value.setUint16(1, rawWeight, true)
  return value
}

describe("parseWeightMeasurement", () => {
  it("parses the Bluetooth SIG metric resolution", () => {
    expect(parseWeightMeasurement(packet(0, 3690))).toEqual({
      kilograms: 18.45,
      sourceUnit: "kg",
      rawValue: 3690,
    })
  })

  it("converts imperial measurements to kilograms", () => {
    expect(parseWeightMeasurement(packet(1, 2205)).kilograms).toBeCloseTo(
      10.002,
      3,
    )
  })

  it("rejects malformed and unsafe packets", () => {
    expect(() =>
      parseWeightMeasurement(new DataView(new ArrayBuffer(2))),
    ).toThrow()
    expect(() => parseWeightMeasurement(packet(0, 65535))).toThrow()
  })
})
