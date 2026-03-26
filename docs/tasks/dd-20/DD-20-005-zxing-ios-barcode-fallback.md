---
id: DD-20-005
title: Wire zxing-js as BarcodeDetector fallback for iOS Safari
unit: DD-20
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

iOS Safari does not support the BarcodeDetector API. When `BarcodeDetector` is not available, the app must use `@zxing/library` (Apache 2.0, already in package.json) as a fallback — capturing camera frames and running the ZXing barcode reader via canvas analysis. Currently the BarcodeDetector path falls through to "Camera scan not supported in this browser. Use manual entry below." — meaning iOS users cannot scan barcodes for barcode-gated checkpoints.

## Spec Excerpt (verbatim)

> **Barcode Scanning**
> - **Chrome Android**: BarcodeDetector API (native, no library)
> - **iOS Safari**: zxing-js/library (Apache 2.0) — camera + canvas frame analysis
> - **Zebra tablets**: DataWedge injects barcode as keyboard input, no API needed
> - Feature-detect BarcodeDetector, fall back to zxing-js automatically
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Media Capture > Barcode Scanning

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundPlayer.tsx` — line 26-82: `BarcodeGate` component with `startScan` function
- `frontend/package.json` — line 33: `"@zxing/library": "^0.21.3"` is already installed

## Verification Checklist

- [ ] When `'BarcodeDetector' in window` is false, the component does NOT show an error — it falls back to zxing
- [ ] The zxing fallback uses `BrowserQRCodeReader` or `BrowserMultiFormatReader` from `@zxing/library`
- [ ] The zxing path accesses the rear camera (`video: { facingMode: 'environment' }`)
- [ ] Successful barcode scan via zxing calls `onUnlock(raw)` the same way BarcodeDetector does
- [ ] The fallback does not break the Zebra DataWedge path (keyboard input into the manual text field)

## Assessment

- **Status**: ⚠️ Wrong — @zxing/library is installed but never imported or used; iOS falls through to manual-only error

## Fix Instructions

In `frontend/src/pages/rounds/RoundPlayer.tsx`, update `startScan` (starting at line 27):

```typescript
import { BrowserMultiFormatReader } from '@zxing/library'

const startScan = async () => {
  setScanError(null)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
    setScanning(true)

    if ('BarcodeDetector' in window) {
      // Chrome Android: native BarcodeDetector
      // @ts-expect-error BarcodeDetector not in TS lib yet
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix'] })
      const interval = setInterval(async () => {
        if (!videoRef.current) { clearInterval(interval); return }
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            clearInterval(interval)
            stopScan()
            const raw = barcodes[0].rawValue as string
            if (expectedValue && raw !== expectedValue) {
              setScanError(`Wrong barcode. Expected: ${expectedValue}`)
              return
            }
            onUnlock(raw)
          }
        } catch { /* ignore detection frame errors */ }
      }, 300)
    } else {
      // iOS Safari fallback: ZXing canvas-based decoding
      const reader = new BrowserMultiFormatReader()
      reader.decodeFromVideoElement(videoRef.current!, (result, err) => {
        if (!result) return
        stopScan()
        reader.reset()
        const raw = result.getText()
        if (expectedValue && raw !== expectedValue) {
          setScanError(`Wrong barcode. Expected: ${expectedValue}`)
          return
        }
        onUnlock(raw)
      })
    }
  } catch (err) {
    setScanError('Could not access camera. Check permissions.')
    setScanning(false)
  }
}
```

Note: `BrowserMultiFormatReader.decodeFromVideoElement` streams continuously until `reader.reset()` is called. Call `reader.reset()` in the `stopScan` cleanup or store the reader instance in a ref.

Do NOT:
- Remove the manual entry fallback — it remains the last resort for all platforms
- Eagerly import BrowserMultiFormatReader at module top level — it is ~600 KB; use a dynamic import `const { BrowserMultiFormatReader } = await import('@zxing/library')` inside `startScan` so it only loads when the camera path is taken
