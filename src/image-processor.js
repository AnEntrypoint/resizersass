export class ImageProcessor {
  constructor() {
    this.algorithms = {
      nearest: this.nearestNeighbor,
      bilinear: this.bilinear,
      bicubic: this.bicubic,
      lanczos: this.lanczos
    }
  }

  async processFromFile(file, options) {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    bitmap.close()

    const dims = this.calculateDimensions(imageData.width, imageData.height, options)
    const resized = this.algorithms[options.algorithm || 'lanczos'].call(
      this, imageData, dims.width, dims.height
    )

    const outCanvas = document.createElement('canvas')
    outCanvas.width = resized.width
    outCanvas.height = resized.height
    const outCtx = outCanvas.getContext('2d')
    const outData = new ImageData(
      new Uint8ClampedArray(resized.data), resized.width, resized.height
    )
    outCtx.putImageData(outData, 0, 0)

    return {
      canvas: outCanvas,
      width: resized.width,
      height: resized.height,
      originalWidth: imageData.width,
      originalHeight: imageData.height
    }
  }

  async toBlob(canvas, format = 'image/png', quality = 0.92) {
    return new Promise(resolve => canvas.toBlob(resolve, format, quality))
  }

  nearestNeighbor(sourceData, targetWidth, targetHeight) {
    const srcW = sourceData.width
    const srcH = sourceData.height
    const src = sourceData.data
    const dst = new Uint8Array(targetWidth * targetHeight * 4)
    const xR = srcW / targetWidth
    const yR = srcH / targetHeight

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sX = Math.floor(x * xR)
        const sY = Math.floor(y * yR)
        const sI = (sY * srcW + sX) * 4
        const dI = (y * targetWidth + x) * 4
        dst[dI] = src[sI]
        dst[dI + 1] = src[sI + 1]
        dst[dI + 2] = src[sI + 2]
        dst[dI + 3] = src[sI + 3]
      }
    }
    return { width: targetWidth, height: targetHeight, data: dst }
  }

  bilinear(sourceData, targetWidth, targetHeight) {
    const srcW = sourceData.width
    const srcH = sourceData.height
    const src = sourceData.data
    const dst = new Uint8Array(targetWidth * targetHeight * 4)
    const xR = (srcW - 1) / (targetWidth - 1 || 1)
    const yR = (srcH - 1) / (targetHeight - 1 || 1)

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sX = x * xR
        const sY = y * yR
        const x0 = Math.floor(sX)
        const y0 = Math.floor(sY)
        const x1 = Math.min(x0 + 1, srcW - 1)
        const y1 = Math.min(y0 + 1, srcH - 1)
        const fx = sX - x0
        const fy = sY - y0
        const i00 = (y0 * srcW + x0) * 4
        const i10 = (y0 * srcW + x1) * 4
        const i01 = (y1 * srcW + x0) * 4
        const i11 = (y1 * srcW + x1) * 4
        const dI = (y * targetWidth + x) * 4
        for (let c = 0; c < 4; c++) {
          const v0 = src[i00 + c] * (1 - fx) + src[i10 + c] * fx
          const v1 = src[i01 + c] * (1 - fx) + src[i11 + c] * fx
          dst[dI + c] = Math.round(v0 * (1 - fy) + v1 * fy)
        }
      }
    }
    return { width: targetWidth, height: targetHeight, data: dst }
  }

  bicubic(sourceData, targetWidth, targetHeight) {
    const srcW = sourceData.width
    const srcH = sourceData.height
    const src = sourceData.data
    const dst = new Uint8Array(targetWidth * targetHeight * 4)
    const xR = (srcW - 1) / (targetWidth - 1 || 1)
    const yR = (srcH - 1) / (targetHeight - 1 || 1)

    const kernel = (t) => {
      const a = Math.abs(t)
      if (a <= 1) return 1 - 2 * a * a + a * a * a
      if (a < 2) return -4 + 8 * a - 5 * a * a + a * a * a
      return 0
    }

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sX = x * xR
        const sY = y * yR
        const xi = Math.floor(sX)
        const yi = Math.floor(sY)
        const dI = (y * targetWidth + x) * 4
        for (let c = 0; c < 4; c++) {
          let r = 0, wS = 0
          for (let dy = -1; dy <= 2; dy++) {
            for (let dx = -1; dx <= 2; dx++) {
              const px = Math.min(Math.max(xi + dx, 0), srcW - 1)
              const py = Math.min(Math.max(yi + dy, 0), srcH - 1)
              const w = kernel(sX - px) * kernel(sY - py)
              r += src[(py * srcW + px) * 4 + c] * w
              wS += w
            }
          }
          dst[dI + c] = Math.max(0, Math.min(255, Math.round(wS ? r / wS : r)))
        }
      }
    }
    return { width: targetWidth, height: targetHeight, data: dst }
  }

  lanczos(sourceData, targetWidth, targetHeight) {
    const srcW = sourceData.width
    const srcH = sourceData.height
    const src = sourceData.data
    const dst = new Uint8Array(targetWidth * targetHeight * 4)
    const xR = (srcW - 1) / (targetWidth - 1 || 1)
    const yR = (srcH - 1) / (targetHeight - 1 || 1)
    const L = 3
    const PI = Math.PI
    const sinc = (v) => v === 0 ? 1 : Math.sin(PI * v) / (PI * v)
    const lk = (t) => {
      const a = Math.abs(t)
      return a === 0 ? 1 : a < L ? sinc(t) * sinc(t / L) : 0
    }

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sX = x * xR
        const sY = y * yR
        const xi = Math.floor(sX)
        const yi = Math.floor(sY)
        const dI = (y * targetWidth + x) * 4
        for (let c = 0; c < 4; c++) {
          let r = 0, wS = 0
          for (let dy = -L + 1; dy <= L; dy++) {
            for (let dx = -L + 1; dx <= L; dx++) {
              const px = Math.min(Math.max(xi + dx, 0), srcW - 1)
              const py = Math.min(Math.max(yi + dy, 0), srcH - 1)
              const w = lk(sX - px) * lk(sY - py)
              r += src[(py * srcW + px) * 4 + c] * w
              wS += w
            }
          }
          dst[dI + c] = Math.max(0, Math.min(255, Math.round(wS ? r / wS : r)))
        }
      }
    }
    return { width: targetWidth, height: targetHeight, data: dst }
  }

  calculateDimensions(srcW, srcH, options) {
    const { width, height, scale, aspectRatio, fit } = options
    let tW = width, tH = height

    if (scale) {
      tW = Math.round(srcW * scale)
      tH = Math.round(srcH * scale)
    }

    if (aspectRatio && tW && !tH) tH = Math.round(tW / aspectRatio)
    else if (aspectRatio && tH && !tW) tW = Math.round(tH * aspectRatio)

    if (!tW && !tH) {
      tW = srcW
      tH = srcH
    } else if (tW && !tH) {
      tH = Math.round(srcH * (tW / srcW))
    } else if (!tW && tH) {
      tW = Math.round(srcW * (tH / srcH))
    }

    if (width && height) {
      if (fit === 'cover') return this.fitCover(srcW, srcH, tW, tH)
      if (fit === 'contain') return this.fitContain(srcW, srcH, tW, tH)
    }
    return { width: tW, height: tH }
  }

  fitCover(srcW, srcH, tW, tH) {
    const sa = srcW / srcH, ta = tW / tH
    return sa > ta
      ? { width: Math.round(tH * sa), height: tH }
      : { width: tW, height: Math.round(tW / sa) }
  }

  fitContain(srcW, srcH, tW, tH) {
    const sa = srcW / srcH, ta = tW / tH
    return sa > ta
      ? { width: tW, height: Math.round(tW / sa) }
      : { width: Math.round(tH * sa), height: tH }
  }
}

export default new ImageProcessor()
