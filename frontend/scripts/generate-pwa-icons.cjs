/**
 * Generate PWA icons: icon-192.png and icon-512.png
 * Pure Node.js — no external dependencies required.
 * Renders the I/O brand mark: dark background + cyan "I" bar + "O" circle.
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const OUTPUT_DIR = path.join(__dirname, '..', 'public')

// Brand colors
const BG = { r: 9, g: 9, b: 11 }        // #09090b
const FG = { r: 45, g: 212, b: 191 }    // #2dd4bf (io-accent)

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4) // RGBA

  // Helper: set pixel
  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
    pixels[i + 3] = a
  }

  // Fill background
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = BG.r
    pixels[i + 1] = BG.g
    pixels[i + 2] = BG.b
    pixels[i + 3] = 255
  }

  // Draw rounded rectangle background (corner rounding for maskable)
  // Corner radius: ~19% of size
  const r = Math.round(size * 0.19)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x)
      const dy = Math.min(y, size - 1 - y)
      if (dx < r && dy < r) {
        const dist = Math.sqrt((r - dx) * (r - dx) + (r - dy) * (r - dy))
        if (dist > r) {
          // Outside rounded corner — transparent
          const i = (y * size + x) * 4
          pixels[i + 3] = 0
        }
      }
    }
  }

  // === I-bar: cyan vertical rectangle on left third ===
  // Scale everything relative to a 32px source coordinate system
  const scale = size / 32

  function fillRect(x0, y0, w, h, rx, color) {
    const px0 = Math.round(x0 * scale)
    const py0 = Math.round(y0 * scale)
    const pw = Math.round(w * scale)
    const ph = Math.round(h * scale)
    const prx = Math.round(rx * scale)

    for (let py = py0; py < py0 + ph; py++) {
      for (let px = px0; px < px0 + pw; px++) {
        const ldx = Math.min(px - px0, pw - 1 - (px - px0))
        const ldy = Math.min(py - py0, ph - 1 - (py - py0))
        if (ldx < prx && ldy < prx) {
          const d = Math.sqrt((prx - ldx) * (prx - ldx) + (prx - ldy) * (prx - ldy))
          if (d > prx) continue
        }
        setPixel(px, py, color.r, color.g, color.b)
      }
    }
  }

  function drawCircleOutline(cx, cy, r, stroke, color) {
    const pCx = cx * scale
    const pCy = cy * scale
    const pR = r * scale
    const pStroke = stroke * scale

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const dist = Math.sqrt((px - pCx) * (px - pCx) + (py - pCy) * (py - pCy))
        if (dist >= pR - pStroke / 2 && dist <= pR + pStroke / 2) {
          setPixel(px, py, color.r, color.g, color.b)
        }
      }
    }
  }

  // I: x=8,y=8,w=4,h=16,rx=1.5
  fillRect(8, 8, 4, 16, 1.5, FG)

  // O: circle cx=22,cy=16,r=6,stroke=2.5
  drawCircleOutline(22, 16, 6, 2.5, FG)

  return pixels
}

function encodePNG(size, pixels) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    // CRC32 over type + data
    const crcData = Buffer.concat([typeBytes, data])
    const crc = crc32(crcData)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc >>> 0, 0)
    return Buffer.concat([len, typeBytes, data, crcBuf])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // IDAT: filter type 0 (None) for each row
  const rawRows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    rawRows[y * (size * 4 + 1)] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      rawRows[dst] = pixels[src]
      rawRows[dst + 1] = pixels[src + 1]
      rawRows[dst + 2] = pixels[src + 2]
      rawRows[dst + 3] = pixels[src + 3]
    }
  }

  const compressed = zlib.deflateSync(rawRows, { level: 6 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// CRC32 implementation (IEEE polynomial)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1)
    }
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// Generate both sizes
for (const size of [192, 512]) {
  const pixels = generateIcon(size)
  const png = encodePNG(size, pixels)
  const outPath = path.join(OUTPUT_DIR, `icon-${size}.png`)
  fs.writeFileSync(outPath, png)
  console.log(`Generated ${outPath} (${png.length} bytes)`)
}

console.log('Done.')
