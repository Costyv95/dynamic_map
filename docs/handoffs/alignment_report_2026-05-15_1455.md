# Alignment Report
**Date:** 2026-05-15 14:55

## Source Audit
Scanned `/docs/` directory.

## Discrepancies Identified (Drift)

### 🔴 Critical
- **None.** The `CALL_SERVICE` execution pipeline was successfully patched to decouple entity targets from abstract script payloads.

### 🟡 Moderate
- **Shortcut Entity Decoupling**: The previous documentation assumed that every shortcut inherently required a `entity_id` to function. The architecture was shifted to support "Abstract Shortcuts" (shortcuts without an entity ID that just run scripts). `shortcut_design.md` was missing this capability.

### 🟢 Low
- **Map Update Timestamp**: The `map.md` timestamp was out of date.

## Actions Executed
1. Regenerated `docs/map.md` with an updated timestamp and structural verification.
2. Updated `docs/shortcut_design.md` with a new "Entity Decoupling" section that explicitly details how `CALL_SERVICE` triggers abstract, payload-driven Home Assistant scripts.
