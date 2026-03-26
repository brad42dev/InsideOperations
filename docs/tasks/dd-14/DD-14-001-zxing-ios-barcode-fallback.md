---
id: DD-14-001
title: Wire up zxing-js as iOS barcode scanning fallback in BarcodeGate
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When an operator on an iOS/Safari device reaches a barcode gate checkpoint, the app should activate the device camera and use zxing-js to decode barcodes — because the native BarcodeDetector API is not available on iOS. The current fallback is a manual text entry field, which does not provide camera access and undermines the physical presence verification goal of the barcode gate.

## Spec Excerpt (verbatim)

> Barcode gate: PWA BarcodeDetector API (Chrome/Android), zxing-js fallback (iOS/Safari)
> On unsupported browsers: searchable equipment list or manual equipment ID entry
> — 14_ROUNDS_MODULE.md, §Barcode Gate

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundPlayer.tsx` — BarcodeGate component at lines 13–126; the `startScan` function at line 27 is where the fallback logic must be inserted
- `frontend/package.json` — `@zxing/library@0.21.3` is already declared as a dependency at line 33

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `@zxing/library` is imported in RoundPlayer.tsx (or a dedicated BarcodeGate component file)
- [ ] When `BarcodeDetector` is not in `window`, the code falls through to a zxing-js-powered camera scan (not just the manual entry fallback)
- [ ] The zxing path opens the device camera, scans frames, resolves on first barcode detected
- [ ] The `expected_value` check is applied to zxing-scanned values the same way it is for BarcodeDetector values
- [ ] The existing manual entry fallback is still present as a third option (for devices where camera is denied)

## Assessment

- **Status**: ⚠️ Partial — BarcodeDetector path implemented correctly; zxing-js installed in package.json but never imported; iOS devices get manual entry only, no camera scan

## Fix Instructions (if needed)

1. In `frontend/src/pages/rounds/RoundPlayer.tsx`, update the `BarcodeGate` component's `startScan` function.

2. Add import at the top of the file (or extract BarcodeGate to its own file for cleaner code):
   ```ts
   import { BrowserMultiFormatReader } from '@zxing/library'
   ```

3. In `startScan`, after the `if (!('BarcodeDetector' in window))` block, replace the `setScanError` + `return` with a zxing-js camera scan path:
   ```ts
   if (!('BarcodeDetector' in window)) {
     // iOS/Safari: fall back to zxing-js
     const codeReader = new BrowserMultiFormatReader()
     try {
       const result = await codeReader.decodeFromVideoDevice(null, videoRef.current!, (result, err) => {
         if (result) {
           codeReader.reset()
           stopScan()
           const raw = result.getText()
           if (expectedValue && raw !== expectedValue) {
             setScanError(`Wrong barcode. Expected: ${expectedValue}`)
             return
           }
           onUnlock(raw)
         }
         if (err && !(err instanceof NotFoundException)) {
           // transient decode errors during scanning are normal — ignore them
         }
       })
       setScanning(true)
     } catch (err) {
       setScanError('Camera access denied.')
     }
     return
   }
   ```

4. Stop the zxing reader on cleanup — update `stopScan` to also call `codeReader.reset()` if it was started.

5. The manual entry UI at lines 106–119 stays as the fallback for when the user denies camera permission.

Do NOT:
- Remove the manual text entry fallback — it is still needed for permission-denied scenarios
- Import the full zxing/library bundle if tree-shaking is a concern — use `BrowserMultiFormatReader` from `@zxing/library` which covers all common formats
- Use `decodeOnceFromVideoDevice` as it does not give the streaming loop needed for a "scan until found" UX
