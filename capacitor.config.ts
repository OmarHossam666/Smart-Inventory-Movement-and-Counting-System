import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.smartinventory.restaurant",
  appName: "نظام حركة وجرد المخزون",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
    },
  },
}

export default config
