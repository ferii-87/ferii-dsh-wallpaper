/**
 * Host half of the wallpaper bundle: persists the uploaded image under the
 * harness home and serves it over three same-origin HTTP routes.
 *
 * Routes:
 *   GET    /dsh-wallpaper/meta        current metadata or { present: false }
 *   GET    /dsh-wallpaper/image?v=... the stored image bytes (rev cache key)
 *   POST   /dsh-wallpaper             store a base64 data URL (JSON body)
 *   DELETE /dsh-wallpaper             remove the stored image
 *
 * Writes are protected against cross-site form posts by requiring the JSON
 * content type, a custom header, and a bounded body. The server is a loopback
 * carrier by default, and GET responses carry no CORS headers.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Route namespace for this plugin. */
const ROUTE = '/dsh-wallpaper'
const META_ROUTE = ROUTE + '/meta'
const IMAGE_ROUTE = ROUTE + '/image'
/** Maximum accepted request body (the client sends a compressed JPEG data URL). */
const MAX_BODY_BYTES = 4 * 1024 * 1024
/** Maximum accepted decoded image size. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
/** Image types the client is allowed to store. */
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Directory holding the wallpaper image and its metadata. */
function dataDirectory() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, 'wallpapers')
}

const imagePath = () => join(dataDirectory(), 'image')
const metaPath = () => join(dataDirectory(), 'meta.json')

/** Send one JSON response. */
function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

/** Read the stored metadata, or null when absent or invalid. */
async function readMeta() {
  try {
    const meta = JSON.parse(await readFile(metaPath(), 'utf8'))
    if (meta && typeof meta.rev === 'string' && MIME_TYPES.has(meta.mime)) return meta
  } catch (failure) {
    // absent or unreadable metadata means "no wallpaper"
  }
  return null
}

/** Read a request body up to a byte limit; null when the limit is exceeded. */
async function readBody(request, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** Parse a client data URL into a whitelisted mime and bounded bytes. */
function decodeDataUrl(value) {
  if (typeof value !== 'string') return null
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (match === null) return null
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null
  return { mime: match[1], bytes }
}

/** Persist an image and its metadata, returning the new record. */
async function saveImage(record, bytes) {
  const directory = dataDirectory()
  await mkdir(directory, { recursive: true })
  const imageTemp = join(directory, 'image.tmp')
  await writeFile(imageTemp, bytes)
  await rename(imageTemp, imagePath())
  const next = {
    rev: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: record.name,
    width: record.width,
    height: record.height,
    mime: record.mime,
    luminance: Number.isFinite(record.luminance) ? Math.min(1, Math.max(0, record.luminance)) : null,
  }
  const metaTemp = join(directory, 'meta.json.tmp')
  await writeFile(metaTemp, JSON.stringify(next))
  await rename(metaTemp, metaPath())
  return next
}

/** Remove the stored image and metadata. */
async function deleteImage() {
  await rm(imagePath(), { force: true })
  await rm(metaPath(), { force: true })
}

/** Wrap a route handler so a failure still yields one response. */
function guard(handler) {
  return async (request, response) => {
    try {
      await handler(request, response)
    } catch (failure) {
      if (response.headersSent) response.destroy()
      else sendJson(response, 500, { error: 'internal' })
    }
  }
}

/** Written mutations must carry the plugin's custom header. */
function hasWriteHeader(request) {
  return request.headers['x-dsh-wallpaper'] === '1'
}

/** The upload body is JSON; rejecting other types blocks simple form posts. */
function hasJsonContentType(request) {
  return String(request.headers['content-type'] || '').startsWith('application/json')
}

const handleMeta = guard(async (request, response) => {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  const meta = await readMeta()
  if (meta === null) {
    sendJson(response, 200, { present: false })
    return
  }
  try {
    await stat(imagePath())
  } catch (failure) {
    sendJson(response, 200, { present: false })
    return
  }
  sendJson(response, 200, {
    present: true,
    rev: meta.rev,
    name: typeof meta.name === 'string' ? meta.name : '',
    width: Number.isFinite(meta.width) ? meta.width : 0,
    height: Number.isFinite(meta.height) ? meta.height : 0,
    luminance: Number.isFinite(meta.luminance) ? meta.luminance : null,
    mime: meta.mime,
  })
})

const handleImage = guard(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  const meta = await readMeta()
  if (meta === null) {
    sendJson(response, 404, { error: 'not-found' })
    return
  }
  let bytes
  try {
    bytes = await readFile(imagePath())
  } catch (failure) {
    sendJson(response, 404, { error: 'not-found' })
    return
  }
  response.writeHead(200, {
    'content-type': meta.mime,
    'content-length': bytes.length,
    'cache-control': 'public, max-age=31536000, immutable',
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
  })
  if (request.method === 'HEAD') response.end()
  else response.end(bytes)
})

const handleCollection = guard(async (request, response) => {
  if (request.method === 'DELETE') {
    if (!hasWriteHeader(request)) {
      sendJson(response, 403, { error: 'forbidden' })
      return
    }
    await deleteImage()
    sendJson(response, 200, { present: false })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  if (!hasWriteHeader(request) || !hasJsonContentType(request)) {
    sendJson(response, 403, { error: 'forbidden' })
    return
  }
  const body = await readBody(request, MAX_BODY_BYTES)
  if (body === null) {
    sendJson(response, 413, { error: 'too-large' })
    return
  }
  let payload
  try {
    payload = JSON.parse(body.toString('utf8'))
  } catch (failure) {
    sendJson(response, 400, { error: 'invalid-json' })
    return
  }
  const decoded = decodeDataUrl(payload && payload.dataUrl)
  if (decoded === null) {
    sendJson(response, 400, { error: 'invalid-image' })
    return
  }
  const record = await saveImage({
    name: typeof payload.name === 'string' ? payload.name.slice(0, 200) : '',
    width: Number.isFinite(payload.width) ? Math.max(0, Math.round(payload.width)) : 0,
    height: Number.isFinite(payload.height) ? Math.max(0, Math.round(payload.height)) : 0,
    luminance: Number.isFinite(payload.luminance) ? Math.min(1, Math.max(0, payload.luminance)) : null,
    mime: decoded.mime,
  }, decoded.bytes)
  sendJson(response, 200, {
    present: true,
    rev: record.rev,
    name: record.name,
    width: record.width,
    height: record.height,
    luminance: record.luminance,
    mime: record.mime,
  })
})

/**
 * Host plugin body: register the three storage routes when a Web carrier is
 * present; without one the browser half falls back to local browser storage.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (child) => {
    child.effect(() => {
      const disposers = [
        child.webServer.register({ kind: 'exact', path: META_ROUTE, handler: handleMeta }),
        child.webServer.register({ kind: 'exact', path: IMAGE_ROUTE, handler: handleImage }),
        child.webServer.register({ kind: 'exact', path: ROUTE, handler: handleCollection }),
      ]
      return () => {
        for (const dispose of disposers.reverse()) dispose()
      }
    }, 'wallpaper: HTTP storage routes')
  })
}
