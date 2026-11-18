import { copy } from '@/content/copy'
import type { Artwork } from '@/types/domain'
import type { ArtworkExporter } from '@/types/services'

const W = 1080
const H = 1360
const GOLD = 'rgba(212, 175, 55, 0.85)'
const GOLD_DIM = 'rgba(212, 175, 55, 0.45)'
const PAPER = '#F3E9D2'
const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", Georgia, serif'
const MONO = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace'

function formatDate(ms: number): string {
  const d = new Date(ms)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch {
      // 回退到 Image 解码
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** 黑金美术馆拍立得：1080×1360，沙盘 920×920，底部衬线展签 + 几何印章 */
export const canvasArtworkExporter: ArtworkExporter = {
  async export(artwork: Artwork, snapshot: Blob | null): Promise<Blob | null> {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#10131A'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 2
    ctx.strokeRect(12, 12, W - 24, H - 24)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = GOLD
    ctx.font = `500 24px ${MONO}`
    ctx.fillText('S H A P E   O F   S O U N D · 声之形', W / 2, 74)

    const imgX = 80
    const imgY = 104
    const imgSize = 920
    ctx.fillStyle = '#0A0C10'
    ctx.fillRect(imgX, imgY, imgSize, imgSize)
    if (snapshot) {
      const bitmap = await loadBitmap(snapshot)
      if (bitmap) {
        ctx.drawImage(bitmap, imgX, imgY, imgSize, imgSize)
        if ('close' in bitmap) bitmap.close()
      }
    }
    ctx.strokeStyle = GOLD_DIM
    ctx.lineWidth = 2
    ctx.strokeRect(imgX, imgY, imgSize, imgSize)

    ctx.strokeStyle = GOLD_DIM
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(80, 1066)
    ctx.lineTo(1000, 1066)
    ctx.stroke()

    const title = artwork.title?.trim() || '无题声纹'
    ctx.textAlign = 'left'
    ctx.fillStyle = PAPER
    ctx.font = `600 58px ${SERIF}`
    ctx.fillText(fitText(ctx, `《${title}》`, 800), 80, 1150)

    ctx.fillStyle = 'rgba(232, 230, 225, 0.78)'
    ctx.font = `400 30px ${SERIF}`
    ctx.fillText(fitText(ctx, `${artwork.author} · ${formatDate(artwork.createdAt)}`, 800), 80, 1210)

    ctx.fillStyle = GOLD_DIM
    ctx.font = `400 22px ${MONO}`
    const themeLabel = copy.sections.studio.themes[artwork.theme]
    const mediumLabel = copy.sections.studio.mediums[artwork.pattern.medium ?? 'sand']
    ctx.fillText(
      fitText(
        ctx,
        `${Math.round(artwork.frequencyHz)} HZ · ${themeLabel} · ${mediumLabel} · CHLADNI PLATE`,
        800,
      ),
      80,
      1262,
    )

    // 几何小印章：菱形金框 + 「声」字
    ctx.save()
    ctx.translate(952, 1176)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 2.5
    ctx.strokeRect(-36, -36, 72, 72)
    ctx.restore()
    ctx.textAlign = 'center'
    ctx.fillStyle = GOLD
    ctx.font = `600 40px ${SERIF}`
    ctx.fillText('声', 952, 1190)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (blob) {
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
      downloadBlob(blob, `声之形-${safeTitle}.png`)
    }
    return blob
  },
}