# 🥩 Smart Inventory Movement and Counting System
### Advanced Software Engineering (ASE) Architecture & UML 2.5 Documentation

> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Course / Standard**: Advanced Software Engineering • ISO/IEC/IEEE 29148 • UML 2.5 Superstructure • Kruchten 4+1  
> **Target Platform**: Android 11+ (Capacitor 8.0 Hybrid Native POS) & Web SPA (React 19, Vite 8, Tailwind CSS v4)  
> **Cloud Backend**: Google Cloud Firestore (Real-time sync) & Firebase Auth  
> **Hardware Peripherals**: Bluetooth Low Energy Digital Weight Scale (GATT `0x181D`) & Arabic Speech Engine (`ar-SA`)  
> **Version**: 1.0 (Production Release)  
> **Date**: 2026-11-22  

---

## 🧭 Executive Overview

This directory (`ai-system-diagrams/`) contains the complete set of **9 Advanced Software Engineering deliverables** for the **Smart Inventory Movement and Counting System**. The system is an offline-first, dual-location inventory management platform operating across **Butcher** (`butcher` / الملحمة) and **Restaurant** (`restaurant` / المطعم) stations, supervised by an **Owner** (`owner` / المالك).

Every requirement, actor, class, state transition, and deployment node is **100% grounded in real codebase files and symbols** with zero hallucinations.

---

## 📁 Deliverables Master Directory & Roadmap

| Deliverable # | Title & Specification Document | Primary Formats | Key Contents & Architecture Scope | Status |
|---|---|---|---|---|
| **Deliverable 1** | [**01-requirements.md**](01-requirements.md) | Markdown | ISO 29148 Requirements: 52 Functional Requirements (`FR-01`–`FR-52`), 25 Non-Functional Requirements (`NFR-01`–`NFR-25`), 7 Gaps | Verified |
| **Deliverable 2** | [**02-use-case-diagram.md**](02-use-case-diagram.md) | PlantUML / Mermaid | UML 2.5 Use Case Diagrams (3 sub-diagrams: Counting, Transfers, Admin; 59 Use Cases `UC-01`–`UC-59`) | Verified |
| **Deliverable 3** | [**03-use-case-scenarios.md**](03-use-case-scenarios.md) | Markdown | Cockburn Fully Dressed Scenarios: 14 core tabular scenarios + master 59-use case coverage table | Verified |
| **Deliverable 4** | [**04-activity-diagrams.md**](04-activity-diagrams.md) | PlantUML / Mermaid | UML 2.5 Activity Diagrams: 5 focused swimlane workflows (Counting, Transfers, Recipe Deductions, Audit, Sync) | Verified |
| **Deliverable 5** | [**05-class-diagram.md**](05-class-diagram.md) | PlantUML / Mermaid | UML 2.5 Structural Model: 6 Packages (Domain, Storage, Service Facade, Cloud Sync, Features, UI Controllers) | Verified |
| **Deliverable 6** | [**06-sequence-diagrams.md**](06-sequence-diagrams.md) | PlantUML / Mermaid | UML 2.5 Sequence Diagrams: 6 Runtime Interaction Flows (BLE Scale, Voice, Transfers, Recipes, Audit, Conflict Merge) | Verified |
| **Deliverable 7** | [**07-architecture-views.md**](07-architecture-views.md) | PlantUML / Mermaid | Kruchten 4+1 Views: Logical Subsystems, Physical Processes/Threads, and Hardware Deployment Topology | Verified |
| **Deliverable 8** | [**08-state-machine-diagrams.md**](08-state-machine-diagrams.md) | PlantUML / Mermaid | UML 2.5 State Machines: Transfer Lifecycle (`TransferStatus`), Shift/Audit Session, BLE Scale GATT, Sync Engine | Verified |
| **Deliverable 9** | [**09-implementation.md**](09-implementation.md) | Markdown | Master Requirements Traceability Matrix (RTM), 7-Gap Resolution Audit, and Vitest Test Verification (69/69 passed) | Verified |

---

## 🎨 Diagramming Standards & Zero-Dependency Rendering

All diagrams are authored in **PlantUML (`.puml`)** for strict UML 2.5 fidelity, paired with **Mermaid (`.mmd`)** companions. All diagrams feature a **clean, high-contrast light theme** (`#FFFFFF` background) designed for academic publications, PDF printing, and clear presentation.

### Rendering Commands (Zero Local Java / Chrome Dependencies)

#### 1. Render all PlantUML Diagrams to Standalone SVGs
```bash
python ai-system-diagrams/plantuml/render.py
```
*Output*: Standalone `.svg` vector files written to `ai-system-diagrams/plantuml/output/`.

#### 2. Render all Mermaid Diagrams to Standalone SVGs
```bash
python ai-system-diagrams/mermaid/render.py
```
*Output*: Standalone `.svg` vector files written to `ai-system-diagrams/mermaid/output/` (utilizes Pako zlib compression fallback for large diagrams).

---

## 🖼️ Master Rendered Diagram Artifact Index

### PlantUML Vector SVGs (`ai-system-diagrams/plantuml/output/`)

| Diagram Title | Source `.puml` | Rendered `.svg` | File Size | Description |
|---|---|---|---|---|
| **Use Case Part 1** | `plantuml/use-case.puml` | [`use-case.svg`](plantuml/output/use-case.svg) | 45.4 KB | Inventory Counting & Stock Management (UC-01 to UC-18) |
| **Use Case Part 2** | `plantuml/use-case-part2-transfers-audit.puml` | [`use-case-part2-transfers-audit.svg`](plantuml/output/use-case-part2-transfers-audit.svg) | 43.3 KB | Inter-Location Transfers, Audit Sessions & Reporting (UC-19 to UC-37) |
| **Use Case Part 3** | `plantuml/use-case-part3-owner-admin.puml` | [`use-case-part3-owner-admin.svg`](plantuml/output/use-case-part3-owner-admin.svg) | 47.9 KB | Owner Administration, Device & Data Management (UC-38 to UC-59) |
| **Activity 1: Counting** | `plantuml/activity-counting.puml` | [`activity-counting.svg`](plantuml/output/activity-counting.svg) | 54.9 KB | Keypad, BLE Scale GATT, Arabic Voice, Presets & Undo |
| **Activity 2: Transfers** | `plantuml/activity-transfer.puml` | [`activity-transfer.svg`](plantuml/output/activity-transfer.svg) | 43.5 KB | Manifest creation, dispatch, receipt, discrepancy flagging, revocation |
| **Activity 3: Recipes** | `plantuml/activity-composite-deduction.puml` | [`activity-composite-deduction.svg`](plantuml/output/activity-composite-deduction.svg) | 31.3 KB | Prepared dish counting, ingredient expansion, proportional auto-deduction |
| **Activity 4: Audit & PDF**| `plantuml/activity-audit-reporting.puml` | [`activity-audit-reporting.svg`](plantuml/output/activity-audit-reporting.svg) | 45.8 KB | PIN verification, immutable archival, 2x Canvas PDF, WhatsApp dispatch |
| **Activity 5: Sync Merge** | `plantuml/activity-sync-conflict.puml` | [`activity-sync-conflict.svg`](plantuml/output/activity-sync-conflict.svg) | 39.3 KB | Reconnection detection, pending queue drain, domain merge logic |
| **Class Diagram** | `plantuml/class-diagram.puml` | [`class-diagram.svg`](plantuml/output/class-diagram.svg) | 111.1 KB | Complete 6-package domain model, storage, sync, features & UI |
| **Sequence 1: BLE Scale** | `plantuml/sequence-ble-scale.puml` | [`sequence-ble-scale.svg`](plantuml/output/sequence-ble-scale.svg) | 45.5 KB | Discovery, GATT notifications, stabilization loop, parallel persist |
| **Sequence 2: Voice Input**| `plantuml/sequence-voice-input.puml` | [`sequence-voice-input.svg`](plantuml/output/sequence-voice-input.svg) | 33.6 KB | Arabic audio capture, phonetic normalization, Levenshtein parsing |
| **Sequence 3: Transfers** | `plantuml/sequence-transfer-lifecycle.puml` | [`sequence-transfer-lifecycle.svg`](plantuml/output/sequence-transfer-lifecycle.svg) | 46.0 KB | Manifest dispatch, real-time alerting, discrepancy resolution, reconciliation |
| **Sequence 4: Composite** | `plantuml/sequence-composite-deduction.puml` | [`sequence-composite-deduction.svg`](plantuml/output/sequence-composite-deduction.svg) | 37.7 KB | Dish entry, ingredient calculation loop, atomic multi-table commit |
| **Sequence 5: Audit & PDF**| `plantuml/sequence-audit-pdf-whatsapp.puml` | [`sequence-audit-pdf-whatsapp.svg`](plantuml/output/sequence-audit-pdf-whatsapp.svg) | 50.8 KB | PIN challenge, immutable snapshot, 2x Canvas rendering, WhatsApp export |
| **Sequence 6: Sync Merge** | `plantuml/sequence-sync-conflict.puml` | [`sequence-sync-conflict.svg`](plantuml/output/sequence-sync-conflict.svg) | 37.8 KB | Network resumption, version comparison, LWW and state precedence merge |
| **Logical View** | `plantuml/architecture-logical-view.puml` | [`architecture-logical-view.svg`](plantuml/output/architecture-logical-view.svg) | 48.7 KB | 5-layer subsystem decomposition, component interfaces, boundaries |
| **Physical View** | `plantuml/architecture-physical-view.puml` | [`architecture-physical-view.svg`](plantuml/output/architecture-physical-view.svg) | 45.8 KB | Native Android & WebView processes, threads, in-memory caches, protocols |
| **Deployment View** | `plantuml/deployment-diagram.puml` | [`deployment-diagram.svg`](plantuml/output/deployment-diagram.svg) | 48.0 KB | Butcher & kitchen POS terminals, BLE scale, Google Cloud infrastructure |
| **State 1: Transfer** | `plantuml/state-machine-transfer.puml` | [`state-machine-transfer.svg`](plantuml/output/state-machine-transfer.svg) | 19.9 KB | `Draft` -> `Sent` -> [`Received` \| `Discrepancy` \| `Cancelled`] |
| **State 2: Shift/Audit** | `plantuml/state-machine-audit-shift.puml` | [`state-machine-audit-shift.svg`](plantuml/output/state-machine-audit-shift.svg) | 23.4 KB | `Uninitialized` -> `ActiveShift` (Counting, Reviewing, PIN Gate) -> `Archived` |
| **State 3: BLE Scale** | `plantuml/state-machine-ble-scale.puml` | [`state-machine-ble-scale.svg`](plantuml/output/state-machine-ble-scale.svg) | 28.0 KB | `Disconnected` -> `Scanning` -> `Connecting` -> `StreamingActive` (Stabilized) |
| **State 4: Sync Engine** | `plantuml/state-machine-sync-engine.puml` | [`state-machine-sync-engine.svg`](plantuml/output/state-machine-sync-engine.svg) | 30.5 KB | `OnlineSynced` <-> `OnlinePending` <-> `Offline` -> `ConflictResolution` |

### Mermaid Companion SVGs (`ai-system-diagrams/mermaid/output/`)

| Diagram Title | Source `.mmd` | Rendered `.svg` | File Size | Description |
|---|---|---|---|---|
| **Use Case Overview** | `mermaid/use-case.mmd` | [`use-case.svg`](mermaid/output/use-case.svg) | 1.8 MB | High-level actor-to-domain mapping across all 59 use cases |
| **Activity Overview** | `mermaid/activity-overview.mmd` | [`activity-overview.svg`](mermaid/output/activity-overview.svg) | 220.2 KB | High-level business process flow connecting all 5 operational activities |
| **Class Overview** | `mermaid/class-diagram.mmd` | [`class-diagram.svg`](mermaid/output/class-diagram.svg) | 151.9 KB | Domain entities, storage facade, service singleton & UI controller |
| **Sequence Overview** | `mermaid/sequence-overview.mmd` | [`sequence-overview.svg`](mermaid/output/sequence-overview.svg) | 50.7 KB | End-to-end multi-party counting, transfer, and audit lifecycle loop |
| **Deployment Overview** | `mermaid/deployment-diagram.mmd` | [`deployment-diagram.svg`](mermaid/output/deployment-diagram.svg) | 45.5 KB | Workstation nodes, cloud databases, CDN edge, and WhatsApp gateway |
| **State Overview** | `mermaid/state-machine-overview.mmd` | [`state-machine-overview.svg`](mermaid/output/state-machine-overview.svg) | 84.2 KB | State machine overview of transfers, shift/audit, and cloud sync |

---

## 🧪 Testing & Verification Summary

The implementation was validated against the automated test suite using Vitest:

```bash
pnpm.cmd test
```

```
✓ src/features/bleScale.test.ts (3 tests)
✓ src/features/compositeInventory.test.ts (7 tests)
✓ src/storage/repository.test.ts (6 tests)
✓ src/features/speechRecognition.test.ts (10 tests)
✓ src/features/productImport.test.ts (11 tests)
✓ src/features/pdfDelivery.test.ts (2 tests)
✓ src/inventoryCatalog.test.ts (2 tests)
✓ src/features/inventoryStatus.test.ts (5 tests)
✓ src/data/firebaseInventorySync.test.ts (5 tests)
✓ src/data/inventoryDataService.test.ts (18 tests)

Test Files  10 passed (10)
     Tests  69 passed (69)
```

---

## 🔒 Security Hardening Recommendations

As identified in Deliverables 1, 7, and 9:
1. **Firestore Production Rules**: Replace permissive development rules with tenant-isolated token authorization (`request.auth != null && request.auth.token.role == 'owner'`).
2. **Encrypted Storage**: Continue enforcing SQLCipher AES-256 for native Android POS deployments.
3. **Role PIN Lockout**: Retain 30-second lockout enforcement after 3 consecutive failed PIN attempts.

---

## 📜 Standards Compliance & Authorship

- **Requirements Standard**: ISO/IEC/IEEE 29148:2018
- **Diagram Modeling Standard**: UML 2.5 Superstructure (ISO/IEC 19505-2)
- **Architecture Standard**: ISO/IEC/IEEE 42010:2011 & Kruchten 4+1 View Model
- **Test & Traceability Standard**: IEEE 829
