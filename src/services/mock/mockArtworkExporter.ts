import type { ArtworkExporter } from '@/types/services'

// TODO: 替换为 Canvas 截图 + 展签合成 + toBlob 导出
export const mockArtworkExporter: ArtworkExporter = {
  export(artwork, snapshot) {
    console.log('[MockArtworkExporter] export', artwork.id, 'snapshot:', snapshot)
    return Promise.resolve(null)
  },
}
