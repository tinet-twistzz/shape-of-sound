import type {
  ExhibitionArtwork,
  ExhibitionDetail,
  GalleryPage,
  GalleryService,
  PublishInput,
} from '@/types/services'

const API = '/functions/v1/app/api'

export class GalleryError extends Error {
  code: string
  status: number

  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'same-origin', ...init })
  } catch {
    throw new GalleryError('network_error', 0)
  }
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // 非 JSON 响应按错误处理
  }
  if (!response.ok) {
    const code =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: { code?: unknown } }).error?.code ?? 'request_failed')
        : 'request_failed'
    throw new GalleryError(code, response.status)
  }
  return data
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

function parseItem(v: unknown): ExhibitionArtwork {
  if (
    !isRecord(v) ||
    typeof v.id !== 'string' ||
    typeof v.title !== 'string' ||
    typeof v.author !== 'string' ||
    typeof v.imageUrl !== 'string' ||
    !isRecord(v.pattern) ||
    !isRecord(v.replayMeta)
  ) {
    throw new GalleryError('invalid_response', 0)
  }
  return v as unknown as ExhibitionArtwork
}

async function putFile(signedUrl: string, body: Blob | ArrayBuffer, contentType: string) {
  let response: Response
  try {
    response = await fetch(signedUrl, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': contentType },
      body,
    })
  } catch {
    throw new GalleryError('upload_failed', 0)
  }
  if (!response.ok) throw new GalleryError('upload_failed', response.status)
}

export const galleryService: GalleryService = {
  async list(offset: number): Promise<GalleryPage> {
    const data = await requestJson(`${API}/artworks?offset=${offset}`)
    if (!isRecord(data) || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean') {
      throw new GalleryError('invalid_response', 0)
    }
    return {
      items: data.items.map(parseItem),
      hasMore: data.hasMore,
      nextOffset: typeof data.nextOffset === 'number' ? data.nextOffset : null,
    }
  },

  async detail(id: string): Promise<ExhibitionDetail> {
    const data = await requestJson(`${API}/artworks/${encodeURIComponent(id)}`)
    const item = parseItem(data)
    if (!isRecord(data) || typeof data.stateUrl !== 'string') {
      throw new GalleryError('invalid_response', 0)
    }
    return { ...item, stateUrl: data.stateUrl }
  },

  async publish(input: PublishInput, image: Blob, state: ArrayBuffer): Promise<{ id: string }> {
    const created = await requestJson(`${API}/artworks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (
      !isRecord(created) ||
      typeof created.id !== 'string' ||
      !isRecord(created.imageUpload) ||
      typeof created.imageUpload.signedUrl !== 'string' ||
      !isRecord(created.stateUpload) ||
      typeof created.stateUpload.signedUrl !== 'string'
    ) {
      throw new GalleryError('invalid_response', 0)
    }
    // 两个签名 URL 同在创建时签发、有效期约 60s；并行上传缩短总耗时，避免慢网下第二个 token 过期
    await Promise.all([
      putFile(created.imageUpload.signedUrl, image, image.type || 'image/webp'),
      putFile(created.stateUpload.signedUrl, state, 'application/octet-stream'),
    ])
    const done = await requestJson(`${API}/artworks/${created.id}/complete`, { method: 'POST' })
    if (!isRecord(done) || done.status !== 'ready') {
      throw new GalleryError('complete_failed', 0)
    }
    return { id: created.id }
  },
}
