# Deliverable 8 — State Machine Diagrams Specification

> **Document**: `ai-system-diagrams/08-state-machine-diagrams.md`  
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Standard**: UML 2.5 Superstructure (ISO/IEC 19505-2) — State Machine Modeling  
> **Traceability**: Derived from `01-requirements.md` (FR-01 to FR-52, NFR-01 to NFR-25), `02-use-case-diagram.md`, `03-use-case-scenarios.md`, `05-class-diagram.md`, and `src/models.ts`  
> **Date**: 2026-11-22  
> **Version**: 1.0  

---

## 1. Architectural Modeling Framework & Formal Semantics

Deliverable 8 models the discrete behavioral lifecycles of stateful entities, background daemons, and peripheral drivers in the Smart Inventory platform using **UML 2.5 State Machine Diagrams**. Every diagram adheres to the standard transition syntax:

$$\text{Trigger} \; [\text{Guard}] \; / \; \text{Behavioral Actions}$$

The state machines are structured into four focused models plus an architectural overview companion:

1. **Lifecycle 1: Inter-Location Transfer Entity (`TransferStatus`)** (`plantuml/state-machine-transfer.puml`)
2. **Lifecycle 2: Work Shift & Audit Session (`ShiftInfo` & `AuditRecord`)** (`plantuml/state-machine-audit-shift.puml`)
3. **Lifecycle 3: BLE Scale Connection & GATT Measurement** (`plantuml/state-machine-ble-scale.puml`)
4. **Lifecycle 4: Cloud Synchronization & Conflict Resolution Engine** (`plantuml/state-machine-sync-engine.puml`)
5. **High-Level Entity Lifecycles Overview**: Mermaid companion (`mermaid/state-machine-overview.mmd`)

---

## 2. Lifecycle 1: Inter-Location Transfer Entity (`TransferStatus`)

### 2.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/state-machine-transfer.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/state-machine-transfer.svg`
- **Code Reference**: `TransferStatus = "Sent" | "Received" | "Discrepancy" | "Cancelled"` in `src/models.ts#L45`; state transitions in `src/data/inventoryDataService.ts#L520-L685`.

### 2.2 Formal State Transition Matrix

| Initial State | Trigger Event | `[Guard Condition]` | Action / Effect (`/`) | Target State | Terminal? |
|---|---|---|---|---|---|
| `[*]` (None) | `createTransferManifest()` | `true` | `initTransferLines()` | `Draft` | No |
| `Draft` | `dispatchTransfer()` | `lines.length > 0 && sentWeight > 0` | `assignUUID()`; `setStatus("Sent")`; `reserveStockInButcherLedger()`; `writeFirestore("transfers/{id}")` | `Sent` | No |
| `Sent` | `cancelTransfer()` | `status == "Sent"` | `revertReservedStockInButcherLedger()`; `updateFirestoreStatus("Cancelled")`; `notifyReceiver()` | `Cancelled` | **Yes** |
| `Sent` | `openPendingTransfer()` | `true` | `displayManifestDetails()`; `preparePhysicalWeighing()` | `InTransitInspection` | No |
| `InTransitInspection` | `confirmReceipt()` | `\|received - sent\| <= 0.01 * sent` | `setStatus("Received")`; `creditRestaurantStock(verifiedWeight)`; `reconcileButcherLedger()`; `updateFirestoreStatus("Received")` | `Received` | **Yes** |
| `InTransitInspection` | `flagDiscrepancy()` | `\|received - sent\| > 0.01 * sent` | `setStatus("Discrepancy")`; `requireDisputeReason(reasonCode)`; `creditRestaurantStock(actualWeight)`; `logDeficitShrinkageAgainstButcher(delta)`; `alertOwnerAnalytics()` | `Discrepancy` | **Yes** |

### 2.3 State Details & Invariants
- **`Draft`**: Local ephemeral state on butcher terminal. Uncommitted; no stock deductions.
- **`Sent`**: Active in-transit status. Outbound cuts are deducted/reserved in butcher local ledger. Document published to Firestore; real-time listener pushes alert to kitchen tablet.
- **`Cancelled`**: Terminal revocation state. Only callable by sender while shipment is unaccepted. Reverts reserved inventory in butcher ledger.
- **`InTransitInspection`**: Composite transitional state on restaurant terminal. Kitchen staff inspects physical cuts on scale pan and enters verified received weights.
- **`Received`**: Terminal happy-path state. Physical weights verified within +/-1% operational tolerance. Verified weights credited to kitchen stock; ledger reconciled.
- **`Discrepancy`**: Terminal dispute state (`UC-20b`). Mismatch exceeds tolerance. System requires mandatory categorization (`scale_difference`, `transit_spill`, `short_delivered`, `rejected`) and explanatory notes. Only actual received weight is credited to kitchen; deficit is logged as shrinkage against butcher outbound ledger; high-priority alert is dispatched to Owner Analytics.

---

## 3. Lifecycle 2: Work Shift & Audit Session (`ShiftInfo` & `AuditRecord`)

### 3.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/state-machine-audit-shift.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/state-machine-audit-shift.svg`
- **Code Reference**: `ShiftInfo` and `AuditRecord` in `src/models.ts#L52`; UI flows in `src/ShiftSetup.tsx` and `src/App.tsx#L2650-L2880`.

### 3.2 Formal State Transition Matrix

| Initial State | Trigger Event | `[Guard Condition]` | Action / Effect (`/`) | Target State |
|---|---|---|---|---|
| `[*]` | `appBootstrap()` | `schemaValid == true` | `checkLocalStorage()`; `displayShiftSetupScreen()` | `Uninitialized` |
| `Uninitialized` | `startShift()` | `shiftType in ["morning", "evening", "night"] && branchId != null` | `createShiftInfo()`; `loadCategoryCatalog()`; `persistCurrentShiftToLocal()` | `ActiveShift.CountingState` |
| `ActiveShift.CountingState` | `recordCount(itemId, qty)` | `qty >= 0` | `pushUndoStack()`; `updateVariance()`; `evaluateStatusBadge()`; `queueFirestoreSync()` | `ActiveShift.CountingState` |
| `ActiveShift.CountingState` | `undoLastCount()` | `undoStack.length > 0` | `popUndoStack()`; `restorePreviousCount()`; `recalculateVariance()` | `ActiveShift.CountingState` |
| `ActiveShift.CountingState` | `initiateAuditFinalization()` | `true` | `checkUncountedItems()`; `calculateAggregateShrinkage()` | `ActiveShift.ReviewingVariance` |
| `ActiveShift.ReviewingVariance` | `resumeCounting()` | `true` | `unlockItemEditor()` | `ActiveShift.CountingState` |
| `ActiveShift.ReviewingVariance` | `clickCommitFinalAudit()` | `true` | `promptSecurityPinModal()` | `ActiveShift.SecurityVerification` |
| `ActiveShift.SecurityVerification` | `verifyPin(pin)` | `pinInvalid && failures < 3` | `triggerShakeAnimation()`; `incrementFailures()` | `ActiveShift.SecurityVerification` |
| `ActiveShift.SecurityVerification` | `verifyPin(pin)` | `pinInvalid && failures >= 3` | `startLockoutTimer(30s)` | `ActiveShift.PinLockout` |
| `ActiveShift.PinLockout` | `lockoutTimerExpired()` | `timer == 0` | `resetFailureCounter()`; `reEnableKeypad()` | `ActiveShift.SecurityVerification` |
| `ActiveShift.SecurityVerification` | `verifyPin(pin)` | `pinValid` | `compileImmutableAuditRecord()`; `saveToLocalAudits()`; `pushAuditToFirestore()`; `resetShiftCounters()`; `archiveStartingStockForNextShift()` | `CommittedAudit` |
| `CommittedAudit` | `closeShiftSession()` | `true` | `transitionToShiftSetup()` | `[*]` |

---

## 4. Lifecycle 3: BLE Scale Connection & Measurement

### 4.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/state-machine-ble-scale.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/state-machine-ble-scale.svg`
- **Code Reference**: `BleScaleClient` in `src/features/bleScale.ts#L42-L130`; pairing UI in `src/ScaleConnection.tsx`.

### 4.2 Formal State Transition Matrix

| Initial State | Trigger Event | `[Guard Condition]` | Action / Effect (`/`) | Target State |
|---|---|---|---|---|
| `[*] / Disconnected` | `scanAndConnect()` | `bleSupported == true` | `requestDevice({ services: ["0x181D"] })` | `Scanning` |
| `Scanning` | `cancelScan()` or `timeout` | `elapsed >= 15s` | `displayScanTimeoutAlert()` | `Disconnected` |
| `Scanning` | `deviceDiscovered(id)` | `id != null` | `BleClient.connect(deviceId)` | `Connecting` |
| `Connecting` | `connectionFailed(err)`| `true` | `logBleError(err)`; `displayRetryButton()` | `ErrorState` |
| `Connecting` | `gattConnected()` | `true` | `cacheDeviceId()`; `setBleConnected(true)` | `ConnectedIdle` |
| `ConnectedIdle` | `startWeightStream()` | `true` | `startNotifications("0x181D", "0x2A9D")` | `StreamingActive.Fluctuating` |
| `StreamingActive.Fluctuating` | `packetReceived()` | `\|delta\| > 0.005 kg` | `resetStabilizationTimer()`; `updateLiveDisplay()` | `StreamingActive.Fluctuating` |
| `StreamingActive.Fluctuating` | `timerExpired()` | `delta <= 0.005 kg for > 1.2s` | `emitStabilizationChime()`; `enableAcceptWeightButton()` | `StreamingActive.Stabilized` |
| `StreamingActive.Stabilized` | `packetReceived()` | `\|current - locked\| > 0.005 kg` | `disableAcceptButton()`; `restartStabilizationTimer()` | `StreamingActive.Fluctuating` |
| `StreamingActive.Stabilized` | `acceptWeight(val)` | `true` | `stopWeightStream()`; `populateCountInputField()` | `ConnectedIdle` |
| `ConnectedIdle` / `StreamingActive` | `gattDisconnected()` | `true` | `setBleConnected(false)`; `attemptAutoReconnect(3x)` | `ErrorState` |
| `ErrorState` | `retryConnect()` | `true` | `scanAndConnect()` | `Scanning` |
| `ErrorState` | `dismissError()` | `true` | `fallbackToManualKeypad()` | `Disconnected` |

---

## 5. Lifecycle 4: Cloud Synchronization & Conflict Resolution Engine

### 5.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/state-machine-sync-engine.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/state-machine-sync-engine.svg`
- **Code Reference**: `FirebaseInventorySync` in `src/data/firebaseInventorySync.ts#L85-L520`.

### 5.2 Formal State Transition Matrix

| Initial State | Trigger Event | `[Guard Condition]` | Action / Effect (`/`) | Target State |
|---|---|---|---|---|
| `[*]` | `appBootstrap()` | `navigator.onLine == true` | `initFirestoreListeners()`; `startHeartbeatDaemon(12s)` | `OnlineSynced` |
| `[*]` | `appBootstrap()` | `navigator.onLine == false` | `enableLocalOnlyOperations()`; `setSyncPill("Offline")` | `Offline` |
| `OnlineSynced` | `localMutation(k, v)` | `true` | `enqueueBatch(k, v)`; `startDebounceTimer(250ms)`; `setSyncPill("Pending")` | `OnlinePending` |
| `OnlinePending` | `rapidLocalMutation()` | `true` | `resetDebounceTimer(250ms)`; `updatePendingBatch()` | `OnlinePending` |
| `OnlinePending` | `debounceTimerExpired()`| `isOnline == true` | `batchCommitToFirestore()`; `drainLocalWriteQueue()`; `setSyncPill("Synced")` | `OnlineSynced` |
| `OnlineSynced` / `OnlinePending` | `networkLost()` | `window.offline` | `suspendPresenceHeartbeats()`; `bufferBatchInLocalQueue()`; `setSyncPill("Offline")` | `Offline` |
| `Offline` | `localMutationOffline()`| `true` | `writeToStorageQueue(k, v)`; `incrementCounter()` | `Offline` |
| `Offline` | `networkRestored()` | `window.online` | `pingFirestoreEndpoint()` | `Reconnecting` |
| `Reconnecting` | `pingFailed()` | `timeout` | `scheduleBackoffRetry(2s-30s)` | `Offline` |
| `Reconnecting` | `pingSuccess()` | `storageQueue.length == 0` | `resumePresenceHeartbeats()`; `setSyncPill("Synced")` | `OnlineSynced` |
| `Reconnecting` | `pingSuccess()` | `storageQueue.length > 0` | `fetchRemoteSnapshotsForQueue()`; `setSyncPill("Reconciling")` | `ConflictResolution` |
| `ConflictResolution` | `conflictDetected(k)` | `remoteVer > localVer` | `routeToDomainMergeStrategy(k)` | `ResolvingDomainLogic` |
| `ResolvingDomainLogic` | `domainResolved(k)` | `true` | `updateCanonicalLocal(k)`; `prepareBatchWrite(k)` | `ConflictResolution` |
| `ConflictResolution` | `allConflictsResolved()`| `queue.empty == true` | `commitResolvedBatchToFirestore()`; `clearStorageQueue()`; `setSyncPill("Synced")`; `notifyUI()` | `OnlineSynced` |

---

## 6. Deliverable Artifact Index & Verification Summary

| Artifact | Nature | Format | Output Path | Verification Status |
|---|---|---|---|---|
| **Lifecycle 1: Transfer Entity** | PlantUML | `.puml` | `plantuml/output/state-machine-transfer.svg` | Verified (19.9 KB SVG) |
| **Lifecycle 2: Shift & Audit** | PlantUML | `.puml` | `plantuml/output/state-machine-audit-shift.svg` | Verified (23.4 KB SVG) |
| **Lifecycle 3: BLE Scale** | PlantUML | `.puml` | `plantuml/output/state-machine-ble-scale.svg` | Verified (28.0 KB SVG) |
| **Lifecycle 4: Sync & Conflict** | PlantUML | `.puml` | `plantuml/output/state-machine-sync-engine.svg` | Verified (30.5 KB SVG) |
| **Overview Lifecycles Companion** | Mermaid | `.mmd` | `mermaid/output/state-machine-overview.svg` | Verified (84.2 KB SVG) |
| **Documentation Specification** | State Machines | `.md` | `ai-system-diagrams/08-state-machine-diagrams.md` | Authoritative |
