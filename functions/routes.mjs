// 公共展厅 API：全站免登录，业务校验全部在这里完成。
// 依赖注入仅用于本地 fixture 测试；index.ts 保留 Deno.serve 与平台注入模块。
// 对象路径一律由服务端生成，绝不接受浏览器提交的路径。
export function application({ db, storage, BackendError }) {
  const PAGE = 20
  const MAX_OFFSET = 200
  const MAX_WORKS = 500
  const IMAGE_MAX_BYTES = 300 * 1024
  const STATE_MAX_BYTES = 8 + 30000 * 5
  const PENDING_TTL_MS = 10 * 60 * 1000
  const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png']
  const THEMES = ['gold', 'glacier', 'neon', 'voice']
  const SHAPES = ['square', 'circle', 'hexagon', 'triangle']
  const MEDIA = ['sand', 'mercury', 'filings', 'spores']
  const SOURCES = ['slider', 'mic']

  const fail = (code, status) => {
    throw new BackendError(code, status)
  }
  const rows = (result) => {
    if (result.error) fail(result.error.code || 'database_unavailable', result.error.status || 503)
    return result.data ?? []
  }
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
  const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

  async function input(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      fail('invalid_input', 400)
    const reader = request.body?.getReader()
    if (!reader) fail('invalid_input', 400)
    let size = 0
    const chunks = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 16384) {
          await reader.cancel()
          fail('payload_too_large', 413)
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      fail('invalid_input', 400)
    }
  }

  function cleanPattern(p) {
    if (!p || typeof p !== 'object') fail('invalid_input', 400)
    if (!int(p.n, 1, 32) || !int(p.m, 1, 32)) fail('invalid_input', 400)
    const out = { n: p.n, m: p.m }
    if (p.a !== undefined) {
      if (!num(p.a, -2, 2)) fail('invalid_input', 400)
      out.a = p.a
    }
    if (p.b !== undefined) {
      if (!num(p.b, -2, 2)) fail('invalid_input', 400)
      out.b = p.b
    }
    if (p.twist !== undefined) {
      if (!num(p.twist, -1, 1)) fail('invalid_input', 400)
      out.twist = p.twist
    }
    if (p.plateShape !== undefined) {
      if (!SHAPES.includes(p.plateShape)) fail('invalid_input', 400)
      out.plateShape = p.plateShape
    }
    if (p.medium !== undefined) {
      if (!MEDIA.includes(p.medium)) fail('invalid_input', 400)
      out.medium = p.medium
    }
    if (p.secondary !== undefined) {
      const s = p.secondary
      if (!s || !int(s.n, 1, 32) || !int(s.m, 1, 32) || !num(s.weight, 0, 1))
        fail('invalid_input', 400)
      out.secondary = { n: s.n, m: s.m, weight: s.weight }
    }
    if (p.compressionMode !== undefined) {
      if (!['exposure', 'rings'].includes(p.compressionMode)) fail('invalid_input', 400)
      out.compressionMode = p.compressionMode
    }
    if (p.timelineSlices !== undefined) {
      if (
        !Array.isArray(p.timelineSlices) ||
        p.timelineSlices.length < 1 ||
        p.timelineSlices.length > 24
      ) {
        fail('invalid_input', 400)
      }
      out.timelineSlices = p.timelineSlices.map((s) => {
        if (
          !s ||
          !int(s.n, 1, 32) ||
          !int(s.m, 1, 32) ||
          !num(s.a, -2, 2) ||
          !num(s.b, -2, 2) ||
          !num(s.weight, 0, 1)
        ) {
          fail('invalid_input', 400)
        }
        return { n: s.n, m: s.m, a: s.a, b: s.b, weight: s.weight }
      })
    }
    return out
  }

  function cleanMeta(m) {
    if (
      !m ||
      typeof m !== 'object' ||
      !num(m.density, 0.25, 1) ||
      !num(m.energy, 0, 1) ||
      !int(m.activeColorBand, 0, 3) ||
      !int(m.count, 500, 30000) ||
      !num(m.frequencyHz, 1, 20000)
    ) {
      fail('invalid_input', 400)
    }
    return {
      density: m.density,
      energy: m.energy,
      activeColorBand: m.activeColorBand,
      count: m.count,
      frequencyHz: m.frequencyHz,
    }
  }

  // 有界读取已存对象：不信任 Content-Length，按实际流字节数限流限时
  async function readStoredObject(response, { maxBytes, allowedTypes }) {
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (!response.ok || !response.body || !allowedTypes.includes(type)) {
      await response.body?.cancel().catch(() => {})
      fail('invalid_upload', 422)
    }
    const reader = response.body.getReader()
    let size = 0
    let timedOut = false
    const chunks = []
    const timer = setTimeout(() => {
      timedOut = true
      void reader.cancel().catch(() => {})
    }, 15000)
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (timedOut) fail('storage_unavailable', 503)
        if (done) break
        size += value.byteLength
        if (size > maxBytes) fail('invalid_upload', 422)
        chunks.push(value)
      }
      if (size === 0) fail('invalid_upload', 422)
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      return bytes
    } catch (error) {
      if (error instanceof BackendError) throw error
      fail('storage_unavailable', 503)
    } finally {
      clearTimeout(timer)
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }

  async function downloadOrPending(path) {
    try {
      return await storage.download(path)
    } catch (error) {
      if (error?.code === 'storage_object_not_found') fail('upload_pending', 409)
      fail('storage_unavailable', 503)
    }
  }

  const toItem = (r) => ({
    id: r.id,
    title: r.title,
    author: r.author_display,
    theme: r.theme,
    source: r.source,
    frequencyHz: r.replay_meta?.frequencyHz ?? 0,
    pattern: r.pattern,
    replayMeta: r.replay_meta,
    createdAt: Date.parse(r.created_at),
  })

  // 校验前 12 字节真实图片魔数（WebP RIFF..WEBP / JPEG FF D8 FF / PNG 89 50 4E 47）
  function hasValidImageMagic(bytes) {
    if (bytes.length < 12) return false
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    return isWebp || isJpeg || isPng
  }

  // 展厅容量有限：顺手清掉超过 10 分钟仍未完成上传的孤儿 pending 记录与对象
  async function cleanupStalePending() {
    try {
      const stale = rows(
        await db
          .from('artworks')
          .select('id,image_path,state_path,created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(20),
      )
      const cutoff = Date.now() - PENDING_TTL_MS
      for (const r of stale) {
        if (Date.parse(r.created_at) >= cutoff) continue
        rows(await db.from('artworks').delete().eq('id', r.id).eq('status', 'pending'))
        await storage.remove([r.image_path, r.state_path]).catch(() => {})
      }
    } catch {
      // 清理失败不影响本次发布
    }
  }

  return async (ctx) => {
    const request = ctx.request
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/)
    if (!match) fail('not_found', 404)
    const path = match[1] || '/'

    if (path === '/api/health' && request.method === 'GET') return Response.json({ ok: true })

    if (path === '/api/artworks' && request.method === 'GET') {
      const offsetRaw = url.searchParams.get('offset') ?? '0'
      if (!/^\d{1,4}$/.test(offsetRaw)) fail('invalid_input', 400)
      const offset = Number(offsetRaw)
      if (offset > MAX_OFFSET) fail('invalid_input', 400)
      const data = rows(
        await db
          .from('artworks')
          .select('id,title,author_display,theme,source,pattern,replay_meta,image_path,created_at')
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(offset + PAGE + 1),
      )
      const window = data.slice(offset, offset + PAGE + 1)
      const hasMore = window.length > PAGE
      const items = await Promise.all(
        window.slice(0, PAGE).map(async (r) => ({
          ...toItem(r),
          imageUrl: (await storage.createSignedUrl(r.image_path, 3600)).signedUrl,
        })),
      )
      return Response.json(
        { items, hasMore, nextOffset: hasMore ? offset + PAGE : null },
        { headers: { 'cache-control': 'no-store' } },
      )
    }

    if (path === '/api/artworks' && request.method === 'POST') {
      const body = await input(request)
      const title = typeof body?.title === 'string' ? body.title.trim() : ''
      const author = typeof body?.author === 'string' ? body.author.trim() : ''
      if (!title || title.length > 60 || !author || author.length > 30) fail('invalid_input', 400)
      if (!THEMES.includes(body?.theme) || !SOURCES.includes(body?.source))
        fail('invalid_input', 400)
      const pattern = cleanPattern(body?.pattern)
      const replayMeta = cleanMeta(body?.replayMeta)

      await cleanupStalePending()
      const all = rows(
        await db
          .from('artworks')
          .select('id')
          .eq('status', 'ready')
          .limit(MAX_WORKS + 1),
      )
      if (all.length >= MAX_WORKS) fail('gallery_full', 429)

      const id = crypto.randomUUID()
      const imagePath = `artworks/${id}.webp`
      const statePath = `artworks/${id}.state`
      rows(
        await db.from('artworks').insert({
          id,
          title,
          author_display: author,
          theme: body.theme,
          source: body.source,
          pattern,
          replay_meta: replayMeta,
          image_path: imagePath,
          state_path: statePath,
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
      )
      const imageUpload = await storage.createSignedUploadUrl(imagePath, { upsert: false })
      const stateUpload = await storage.createSignedUploadUrl(statePath, { upsert: false })
      return Response.json(
        { id, imageUpload, stateUpload },
        { status: 201, headers: { 'cache-control': 'no-store' } },
      )
    }

    const detail = path.match(/^\/api\/artworks\/([0-9a-f-]{36})$/)
    if (detail && uuid(detail[1]) && request.method === 'GET') {
      const found = rows(
        await db
          .from('artworks')
          .select(
            'id,title,author_display,theme,source,pattern,replay_meta,image_path,state_path,created_at',
          )
          .eq('id', detail[1])
          .eq('status', 'ready')
          .limit(1),
      )
      if (!found.length) fail('not_found', 404)
      const r = found[0]
      const imageUrl = (await storage.createSignedUrl(r.image_path, 3600)).signedUrl
      const stateUrl = (await storage.createSignedUrl(r.state_path, 3600)).signedUrl
      return Response.json(
        { ...toItem(r), imageUrl, stateUrl },
        { headers: { 'cache-control': 'no-store' } },
      )
    }

    const complete = path.match(/^\/api\/artworks\/([0-9a-f-]{36})\/complete$/)
    if (complete && uuid(complete[1]) && request.method === 'POST') {
      const found = rows(
        await db
          .from('artworks')
          .select('id,status,image_path,state_path,replay_meta')
          .eq('id', complete[1])
          .limit(1),
      )
      if (!found.length) fail('not_found', 404)
      const r = found[0]
      if (r.status === 'ready') return Response.json({ id: r.id, status: 'ready' })

      const image = await readStoredObject(await downloadOrPending(r.image_path), {
        maxBytes: IMAGE_MAX_BYTES,
        allowedTypes: IMAGE_TYPES,
      })
      if (!hasValidImageMagic(image)) fail('invalid_upload', 422)
      const state = await readStoredObject(await downloadOrPending(r.state_path), {
        maxBytes: STATE_MAX_BYTES,
        allowedTypes: ['application/octet-stream'],
      })
      // state 格式：SND1 魔数 + uint32 粒数 + 每粒 5 字节（Uint16 x、Uint16 y、Uint8 色桶）
      const count =
        state.length >= 8 ? new DataView(state.buffer, state.byteOffset).getUint32(4, true) : 0
      if (
        state[0] !== 0x53 ||
        state[1] !== 0x4e ||
        state[2] !== 0x44 ||
        state[3] !== 0x31 ||
        count !== r.replay_meta?.count ||
        state.length !== 8 + count * 5
      ) {
        fail('invalid_upload', 422)
      }
      rows(
        await db
          .from('artworks')
          .update({ status: 'ready' })
          .eq('id', r.id)
          .eq('status', 'pending')
          .select('id'),
      )
      return Response.json({ id: r.id, status: 'ready' })
    }

    fail('not_found', 404)
  }
}
