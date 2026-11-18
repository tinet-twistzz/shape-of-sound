import type { ExhibitionArtwork, GalleryService } from '@/types/services'

// 内存假展厅：仅供组件测试与无后端环境，真实发布走 real/galleryService
export function createMockGalleryService(): GalleryService {
  const items: ExhibitionArtwork[] = []
  let seq = 0
  return {
    list() {
      return Promise.resolve({ items: [...items], hasMore: false, nextOffset: null })
    },
    detail(id) {
      const found = items.find((it) => it.id === id)
      if (!found) return Promise.reject(new Error('not_found'))
      return Promise.resolve({ ...found, stateUrl: '' })
    },
    publish(input) {
      seq += 1
      const id = `mock-${seq}`
      items.unshift({
        ...input,
        id,
        createdAt: Date.now(),
        imageUrl: '',
      })
      return Promise.resolve({ id })
    },
  }
}