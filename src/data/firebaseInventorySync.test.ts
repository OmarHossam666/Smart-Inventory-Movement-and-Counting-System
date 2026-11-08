import { describe, expect, it } from "vitest"
import {
  pickCloudEntries,
  parseCloudDocumentValue,
} from "./firebaseInventorySync"
import { storeAuthService } from "./firebase/authService"

describe("Firebase inventory sync", () => {
  it("uploads shared inventory while keeping device-private settings local", () => {
    expect(
      pickCloudEntries({
        "smart-inventory-products": "[]",
        "smart-inventory-location-weights": "{}",
        "smart-inventory-transfers": "[]",
        "smart-inventory-device-role": "butcher",
        "smart-inventory-owner-pin": "1234",
        "smart-inventory-owner-phone": "966500000000",
        "smart-inventory-theme": "dark",
        "smart-inventory-scale-name": "scale-1",
        "smart-inventory-mascot-preferences": '{"minimized":true}',
      }),
    ).toEqual({
      "smart-inventory-products": "[]",
      "smart-inventory-location-weights": "{}",
      "smart-inventory-transfers": "[]",
    })
  })

  it("validates and sanitizes cloud document values", () => {
    expect(parseCloudDocumentValue('{"items":[]}')).toBe('{"items":[]}')
    expect(parseCloudDocumentValue(null)).toBeNull()
    expect(parseCloudDocumentValue(123)).toBeNull()
    expect(parseCloudDocumentValue({})).toBeNull()
    expect(parseCloudDocumentValue([])).toBeNull()
    expect(parseCloudDocumentValue(undefined)).toBeNull()
  })

  it("manages store branch isolation and pairing state", () => {
    storeAuthService.setBranchId("branch_madinah_01")
    expect(storeAuthService.getBranchId()).toBe("branch_madinah_01")

    storeAuthService.setStoreCode("butcher-99")
    expect(storeAuthService.getStoreCode()).toBe("BUTCHER-99")

    const state = storeAuthService.getAuthState()
    expect(state.branchId).toBe("branch_madinah_01")
    expect(state.storeCode).toBe("BUTCHER-99")

    // Reset back to main_branch
    storeAuthService.setBranchId("main_branch")
    expect(storeAuthService.getBranchId()).toBe("main_branch")
  })

  it("includes role-pins in pickCloudEntries for multi-device sync", () => {
    const entries = {
      "smart-inventory-role-pins": JSON.stringify({
        butcher: "1111",
        restaurant: "2222",
      }),
      "smart-inventory-products": "[]",
      "smart-inventory-theme": "dark",
    }
    const picked = pickCloudEntries(entries)
    expect(picked["smart-inventory-role-pins"]).toBe(
      JSON.stringify({ butcher: "1111", restaurant: "2222" }),
    )
    expect(picked["smart-inventory-products"]).toBe("[]")
    expect(picked["smart-inventory-theme"]).toBeUndefined()
  })

  it("filters out role-pins for non-owner devices so workers cannot overwrite owner PINs", () => {
    const entries = {
      "smart-inventory-role-pins": JSON.stringify({
        butcher: "0000",
        restaurant: "0000",
      }),
      "smart-inventory-location-weights": "{}",
    }

    const butcherPicked = pickCloudEntries(entries, "butcher")
    expect(butcherPicked["smart-inventory-role-pins"]).toBeUndefined()
    expect(butcherPicked["smart-inventory-location-weights"]).toBe("{}")

    const restPicked = pickCloudEntries(entries, "restaurant")
    expect(restPicked["smart-inventory-role-pins"]).toBeUndefined()

    const ownerPicked = pickCloudEntries(entries, "owner")
    expect(ownerPicked["smart-inventory-role-pins"]).toBeDefined()
  })
})
