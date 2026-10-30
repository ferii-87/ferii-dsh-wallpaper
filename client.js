/**
 * Background wallpaper for the Harness Web UI.
 *
 * The browser half owns the Settings row, image preparation, and rendering.
 * The Host half (index.js) persists the uploaded image under the harness home
 * and serves it over same-origin HTTP routes, so the wallpaper survives a
 * restart even when the Web GUI comes back on a different port. Browser
 * storage remains a fallback for compositions without a Web carrier and for
 * migrating an image saved by the first version of this plugin.
 *
 * Rendering: a package-owned stylesheet paints the image on the document while
 * a theme token layer makes the app's base surfaces translucent, so the image
 * shows through every column without touching text or accent tokens.
 */
window.__ModuleLoader__.load({
  id: '@ferii/dsh-wallpaper',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Legacy per-browser record written by the first version of this plugin. */
    const LEGACY_KEY = 'dsh.wallpaper.v1'
    /** Host route namespace registered by index.js. */
    const HOST_BASE = '/dsh-wallpaper'
    const HOST_META = HOST_BASE + '/meta'
    const HOST_IMAGE = HOST_BASE + '/image'
    /** Longest accepted local-fallback data URL (characters). */
    const MAX_DATA_URL = 1600000
    /** Longest edge kept when downscaling an upload. */
    const MAX_EDGE = 1920
    /** Uploads above this size are refused before decoding. */
    const MAX_FILE_BYTES = 25 * 1024 * 1024
    /** Browser-local key for the chosen rendering effect. */
    const EFFECT_KEY = 'dsh.wallpaper.effect.v1'
    /** Default effect when the browser has no stored choice. */
    const DEFAULT_EFFECT = 'balanced'
    /**
     * Rendering presets. The image is normalized toward `target` by its own
     * scrim, app surfaces use `panel`, and the sidebar column uses `sidebar`.
     * `clear` uses the same target and strengths in both palettes, so its light
     * and dark versions differ only in tint color; `original` skips both the
     * scrim and the surfaces and shows the stored image exactly as uploaded.
     */
    const EFFECTS = {
      original: {
        raw: true,
        light: { target: 0, panel: 0, sidebar: 0 },
        dark: { target: 0, panel: 0, sidebar: 0 },
      },
      clear: {
        light: { target: 0.30, panel: 0.14, sidebar: 0.18 },
        dark: { target: 0.30, panel: 0.14, sidebar: 0.18 },
      },
      balanced: {
        light: { target: 0.22, panel: 0.22, sidebar: 0.26 },
        dark: { target: 0.22, panel: 0.22, sidebar: 0.26 },
      },
      soft: {
        light: { target: 0.14, panel: 0.34, sidebar: 0.40 },
        dark: { target: 0.14, panel: 0.34, sidebar: 0.40 },
      },
    }

    /** English copy for the Settings row. */
    const EN = {
      title: 'Background wallpaper',
      description: 'Upload a local image as the window background. It adapts to light and dark, offers original/clear/balanced/soft effects, and is stored on the Harness host by default.',
      upload: 'Upload image',
      replace: 'Replace',
      remove: 'Remove',
      empty: 'No wallpaper',
      previewAlt: 'Image preview',
      processing: 'Processing…',
      errorType: 'Please choose an image file.',
      errorRead: 'Could not read that image. Please try another one.',
      errorSize: 'That image is too large. Try a smaller one.',
      errorStorage: 'This browser could not store the image either. Please try a smaller one.',
      errorHostFallback: 'Could not reach the Harness host, so the image is kept in this browser only and may disappear after a restart.',
      errorHostDelete: 'Could not remove the image from the Harness host. Please try again.',
      effectLabel: 'Effect',
      effectOriginal: 'Original',
      effectClear: 'Clear',
      effectBalanced: 'Balanced',
      effectSoft: 'Soft',
    }

    /** Chinese copy for the Settings row. */
    const ZH = {
      title: '背景图片',
      description: '上传本地图片作为窗口背景，自动适配浅色/深色，可切换原图/清晰/平衡/柔和效果；图片默认保存在 Harness 主机上。',
      upload: '上传图片',
      replace: '更换',
      remove: '移除',
      empty: '未设置',
      previewAlt: '图片预览',
      processing: '处理中…',
      errorType: '请选择图片文件。',
      errorRead: '无法读取这张图片，请换一张重试。',
      errorSize: '图片过大，请换一张更小的图片。',
      errorStorage: '浏览器也无法保存这张图片，请换一张更小的图片。',
      errorHostFallback: '无法连接 Harness 主机，图片只保存在浏览器中，重启后可能需要重新上传。',
      errorHostDelete: '无法删除 Harness 主机上的图片，请稍后重试。',
      effectLabel: '效果',
      effectOriginal: '原图',
      effectClear: '清晰',
      effectBalanced: '平衡',
      effectSoft: '柔和',
    }

    /**
     * Token layer for one effect preset. The app frame and the conversation
     * column both paint `--dsw-alias-bg-base`; the preset's low alpha keeps the
     * UI crisp, while `backgroundCss` normalizes the image itself to the
     * active palette so text keeps its contrast on any wallpaper. Both palettes
     * share the strength; only the tint color follows the palette.
     */
    function tokenLayer(effect) {
      const preset = EFFECTS[effect] || EFFECTS[DEFAULT_EFFECT]
      return {
        '--dsw-alias-bg-base': {
          light: 'rgba(255, 255, 255, ' + preset.light.panel + ')',
          dark: 'rgba(18, 18, 20, ' + preset.dark.panel + ')',
        },
        '--dsw-specific-sidebar-fill': {
          light: 'rgba(247, 248, 250, ' + preset.light.sidebar + ')',
          dark: 'rgba(14, 14, 16, ' + preset.dark.sidebar + ')',
        },
      }
    }

    /** Effect presets in display order with their locale keys. */
    const EFFECT_ORDER = [
      ['original', 'effectOriginal'],
      ['clear', 'effectClear'],
      ['balanced', 'effectBalanced'],
      ['soft', 'effectSoft'],
    ]

    /** Styles for the Settings row, matching the General section's row pattern.
     * Buttons use the adaptive surface and label tokens rather than the brand
     * fill: brand-primary is near-white in the dark palette, which made white
     * button text invisible.
     */
    const ROW_CSS = [
      '.dshw-row{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dshw-text{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dshw-title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.dshw-description{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dshw-meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}',
      '.dshw-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}',
      '.dshw-control{display:flex;align-items:center;gap:12px;flex:none}',
      '.dshw-preview{width:128px;height:72px;flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dshw-preview[data-empty=true]{border-style:dashed}',
      '.dshw-preview img{display:block;width:100%;height:100%;object-fit:cover}',
      '.dshw-buttons{display:flex;flex-direction:column;gap:6px}',
      '.dshw-btn{height:28px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}',
      '.dshw-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshw-btn:disabled{cursor:default;opacity:.6}',
      '.dshw-btn-ghost{background:transparent}',
      '.dshw-effect{display:flex;align-items:center;gap:8px;margin-top:2px}',
      '.dshw-effect-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.dshw-seg{display:inline-flex;overflow:hidden;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2)}',
      '.dshw-seg button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;padding:5px 9px;cursor:pointer;white-space:nowrap}',
      '.dshw-seg button+button{border-left:.5px solid var(--dsw-alias-border-l2)}',
      '.dshw-seg button[data-active=true]{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}',
    ].join('')

    /** Read the legacy per-browser record, or null when absent/corrupt. */
    function readLegacy() {
      try {
        if (typeof localStorage === 'undefined') return null
        const raw = localStorage.getItem(LEGACY_KEY)
        if (!raw) return null
        const value = JSON.parse(raw)
        if (!value || typeof value.dataUrl !== 'string' || value.dataUrl.indexOf('data:image/') !== 0) return null
        return value
      } catch (failure) {
        return null
      }
    }

    /** Persist the legacy fallback record; false means the browser refused. */
    function writeLegacy(value) {
      try {
        if (typeof localStorage === 'undefined') return false
        localStorage.setItem(LEGACY_KEY, JSON.stringify(value))
        return true
      } catch (failure) {
        return false
      }
    }

    /** Drop the legacy record once the Host owns the image. */
    function clearLegacy() {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_KEY)
      } catch (failure) {
        // a refused cleanup only leaves a stale fallback behind
      }
    }

    /** Read the browser-local rendering effect, defaulting to balanced. */
    function readEffect() {
      try {
        const match = /(?:^|;\s*)dsh_wallpaper_effect=([a-z]+)/.exec(document.cookie)
        if (match && Object.prototype.hasOwnProperty.call(EFFECTS, match[1])) return match[1]
      } catch (failure) {
        // cookies unavailable: fall through to localStorage
      }
      try {
        if (typeof localStorage === 'undefined') return DEFAULT_EFFECT
        const value = localStorage.getItem(EFFECT_KEY)
        return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EFFECTS, value) ? value : DEFAULT_EFFECT
      } catch (failure) {
        return DEFAULT_EFFECT
      }
    }

    /** Persist the rendering effect for this browser (cookie survives port changes). */
    function writeEffect(value) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(EFFECT_KEY, value)
      } catch (failure) {
        // the cookie below may still persist it
      }
      try {
        document.cookie = 'dsh_wallpaper_effect=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax'
      } catch (failure) {
        // the choice still applies to this page session
      }
    }

    /** Revision-keyed Host image URL; a new upload always gets a new URL. */
    function imageUrl(rev) {
      return HOST_IMAGE + '?v=' + encodeURIComponent(rev)
    }

    /** Project Host metadata into the browser-side record. */
    function recordFromMeta(meta) {
      return {
        src: imageUrl(meta.rev),
        name: typeof meta.name === 'string' ? meta.name : '',
        width: Number.isFinite(meta.width) ? meta.width : 0,
        height: Number.isFinite(meta.height) ? meta.height : 0,
        luminance: Number.isFinite(meta.luminance) ? meta.luminance : null,
        remote: true,
      }
    }

    /** Read Host metadata; null means the Host has no wallpaper. Throws when unreachable. */
    async function fetchHostMeta() {
      const response = await fetch(HOST_META, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('host')
      const meta = await response.json()
      if (!meta || typeof meta !== 'object') throw new Error('host')
      return meta.present === true && typeof meta.rev === 'string' ? meta : null
    }

    /** Send one prepared image to the Host and return its new metadata. */
    async function uploadToHost(value) {
      const response = await fetch(HOST_BASE, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-dsh-wallpaper': '1',
        },
        body: JSON.stringify({
          dataUrl: value.dataUrl,
          name: value.name,
          width: value.width,
          height: value.height,
          luminance: value.luminance,
        }),
      })
      if (!response.ok) throw new Error('host')
      const meta = await response.json()
      if (!meta || meta.present !== true || typeof meta.rev !== 'string') throw new Error('host')
      return meta
    }

    /** Delete the Host-stored image. */
    async function deleteFromHost() {
      const response = await fetch(HOST_BASE, {
        method: 'DELETE',
        headers: { 'x-dsh-wallpaper': '1' },
      })
      if (!response.ok) throw new Error('host')
    }

    /**
     * Document stylesheet painting one image behind the app for both palettes.
     *
     * A wallpaper's mean luminance decides how much its own scrim lifts or
     * darkens it toward the preset's target, so text keeps its contrast. With
     * the image normalized, the surface tokens stay nearly transparent and the
     * wallpaper remains crisp. Each palette uses its own preset values; the
     * light tint is thinner at the same perceived strength.
     */
    function backgroundCss(src, luminance, effect) {
      const preset = EFFECTS[effect] || EFFECTS[DEFAULT_EFFECT]
      const value = Number.isFinite(luminance) ? Math.min(1, Math.max(0, luminance)) : 0.5
      const raw = preset.raw === true
      const lightAlpha = raw ? 0 : Math.round(Math.min(0.8, Math.max(0, (preset.light.target - value) / (1 - value))) * 100) / 100
      const darkAlpha = raw ? 0 : Math.round(Math.min(0.8, Math.max(0, value <= 0 ? 0 : (value - preset.dark.target) / value)) * 100) / 100
      const image = 'url("' + src + '")'
      const geometry = 'background-position:center!important;background-size:cover!important;background-repeat:no-repeat!important;background-attachment:fixed!important;'
      return 'body{background-image:linear-gradient(rgba(255,255,255,' + lightAlpha + '),rgba(255,255,255,' + lightAlpha + ')),' + image + '!important;' + geometry + '}' +
        'body[data-ds-dark-theme]{background-image:linear-gradient(rgba(8,8,10,' + darkAlpha + '),rgba(8,8,10,' + darkAlpha + ')),' + image + '!important;' + geometry + '}'
    }

    /** Mean sRGB luminance (0-1) of one drawable source, or null when unreadable. */
    function meanLuminance(source) {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 48
        canvas.height = 48
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(source, 0, 0, 48, 48)
        const pixels = context.getImageData(0, 0, 48, 48).data
        let total = 0
        for (let index = 0; index < pixels.length; index += 4) {
          total += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]
        }
        return total / (pixels.length / 4) / 255
      } catch (failure) {
        return null
      }
    }

    /** Measure a stored image URL (Host URL or data URL); null on failure. */
    function measureLuminance(src) {
      return new Promise((resolve) => {
        const image = new Image()
        image.onload = () => resolve(meanLuminance(image))
        image.onerror = () => resolve(null)
        image.src = src
      })
    }

    /** Decode a local file, preferring an orientation-correct bitmap. */
    function loadSource(file) {
      if (typeof createImageBitmap === 'function') {
        return Promise.resolve()
          .then(() => createImageBitmap(file, { imageOrientation: 'from-image' }))
          .catch(() => loadElement(file))
      }
      return loadElement(file)
    }

    /** Fallback decode through an HTMLImageElement with an object URL. */
    function loadElement(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => {
          URL.revokeObjectURL(url)
          resolve(image)
        }
        image.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('read'))
        }
        image.src = url
      })
    }

    /** Draw a decoded source scaled to `edge` and encode it as JPEG. */
    function encodeJpeg(source, edge, quality) {
      const sourceWidth = source.naturalWidth || source.width
      const sourceHeight = source.naturalHeight || source.height
      const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight))
      const width = Math.max(1, Math.round(sourceWidth * scale))
      const height = Math.max(1, Math.round(sourceHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(source, 0, 0, width, height)
      return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height }
    }

    /**
     * Validate, downscale, and encode one uploaded file. Thrown messages are
     * stable codes the row maps to localized copy: unsupported, size.
     */
    async function prepareFile(file) {
      if (!file || typeof file.type !== 'string' || file.type.indexOf('image/') !== 0) {
        throw new Error('unsupported')
      }
      if (file.size > MAX_FILE_BYTES) throw new Error('size')
      const source = await loadSource(file)
      try {
        /** Cheapest first; stop as soon as the payload fits the quota budget. */
        const candidates = [[MAX_EDGE, 0.86], [MAX_EDGE, 0.72], [1600, 0.7], [1280, 0.68], [1024, 0.64]]
        let encoded = null
        for (const [edge, quality] of candidates) {
          encoded = encodeJpeg(source, edge, quality)
          if (encoded.dataUrl.length <= MAX_DATA_URL) break
        }
        if (!encoded || encoded.dataUrl.length > MAX_DATA_URL) throw new Error('size')
        return {
          dataUrl: encoded.dataUrl,
          width: encoded.width,
          height: encoded.height,
          name: typeof file.name === 'string' ? file.name : '',
          luminance: meanLuminance(source),
        }
      } finally {
        if (source && typeof source.close === 'function') source.close()
      }
    }

    return {
      /** Client services this plugin cannot work without. */
      inject: ['slots', 'locale', 'theme'],

      /**
       * Client half: own the global stylesheet, restore the stored image from
       * the Host (migrating a legacy browser copy), and contribute the
       * Settings → General row.
       * @param ctx - Client Cordis context.
       */
      apply(ctx) {
        /** Package-owned global stylesheet, removed with the plugin. */
        let styleNode = null
        /** Disposer of the active theme token layer. */
        let tokenDisposer = null
        /** Set by the restore effect cleanup so a late fetch cannot paint. */
        let disposed = false
        /** Current wallpaper record, or null. */
        let currentWallpaper = null
        /** Chosen rendering preset for this browser. */
        let effectMode = readEffect()
        /** Preset currently applied to the theme token layer. */
        let paintedEffect = null
        /** Row subscribers to the wallpaper record. */
        const listeners = new Set()

        /** Paint the document and stack/unstack the translucent-surface layer. */
        const paint = (next) => {
          const luminance = next
            ? (Number.isFinite(next.luminance) ? next.luminance : 0.5)
            : null
          if (styleNode) {
            styleNode.textContent = ROW_CSS + (next ? backgroundCss(next.src, luminance, effectMode) : '')
          }
          if (next) {
            if (!tokenDisposer || paintedEffect !== effectMode) {
              try {
                tokenDisposer = ctx.theme.overrideTokens('wallpaper', tokenLayer(effectMode))
                paintedEffect = effectMode
              } catch (failure) {
                console.error('[wallpaper] could not stack the surface token layer', failure)
              }
            }
          } else {
            if (tokenDisposer) {
              tokenDisposer()
              tokenDisposer = null
            }
            paintedEffect = null
          }
          if (next && !Number.isFinite(next.luminance)) {
            const target = next
            measureLuminance(next.src).then((value) => {
              if (!Number.isFinite(value) || currentWallpaper !== target) return
              target.luminance = value
              paint(target)
            })
          }
        }

        /** Switch the rendering preset and repaint immediately. */
        const setEffect = (mode) => {
          if (!Object.prototype.hasOwnProperty.call(EFFECTS, mode) || mode === effectMode) return
          effectMode = mode
          writeEffect(mode)
          if (currentWallpaper) paint(currentWallpaper)
        }

        /** Small store shared by the restore effect and the Settings row. */
        const store = {
          get: () => currentWallpaper,
          subscribe: (listener) => {
            listeners.add(listener)
            return () => {
              listeners.delete(listener)
            }
          },
          set: (next) => {
            currentWallpaper = next
            paint(next)
            for (const listener of [...listeners]) listener()
          },
        }

        ctx.effect(() => ctx.locale.register('wallpaper', 'en', EN), 'wallpaper: English dictionaries')
        ctx.effect(() => ctx.locale.register('wallpaper', 'zh', ZH), 'wallpaper: Chinese dictionaries')

        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = '@ferii/dsh-wallpaper'
          style.textContent = ROW_CSS
          document.head.appendChild(style)
          styleNode = style
          return () => {
            style.remove()
            styleNode = null
            if (tokenDisposer) {
              tokenDisposer()
              tokenDisposer = null
            }
          }
        }, 'wallpaper: document stylesheet')

        ctx.effect(() => {
          const restore = async () => {
            let next = null
            let hostReachable = false
            try {
              const meta = await fetchHostMeta()
              hostReachable = true
              if (meta) next = recordFromMeta(meta)
            } catch (failure) {
              // no Web carrier or the route is not registered yet
            }
            if (next) {
              clearLegacy()
            } else {
              const legacy = readLegacy()
              if (legacy) {
                if (hostReachable) {
                  try {
                    const meta = await uploadToHost(legacy)
                    clearLegacy()
                    next = recordFromMeta(meta)
                  } catch (failure) {
                    // keep the browser copy as the visible fallback
                  }
                }
                if (!next) {
                  next = {
                    src: legacy.dataUrl,
                    name: typeof legacy.name === 'string' ? legacy.name : '',
                    width: Number.isFinite(legacy.width) ? legacy.width : 0,
                    height: Number.isFinite(legacy.height) ? legacy.height : 0,
                    remote: false,
                  }
                }
              }
            }
            if (!disposed) store.set(next)
          }
          restore()
          return () => {
            disposed = true
          }
        }, 'wallpaper: restore stored image')

        /**
         * One preference row in Settings → General.
         * @param props - composed slot props; `t` is bound to the wallpaper namespace.
         * @returns the row element tree.
         */
        function WallpaperRow({ t }) {
          const translate = typeof t === 'function' ? t : ctx.locale.bind('wallpaper')
          const [current, setLocalWallpaper] = React.useState(store.get)
          const [busy, setBusy] = React.useState(false)
          const [errorKey, setErrorKey] = React.useState(null)
          const [effect, setEffectState] = React.useState(readEffect)
          const inputRef = React.useRef(null)

          const chooseEffect = (mode) => {
            setEffect(mode)
            setEffectState(mode)
          }

          React.useEffect(() => {
            const update = () => setLocalWallpaper(store.get())
            const unsubscribe = store.subscribe(update)
            update()
            return unsubscribe
          }, [])

          const openPicker = () => {
            setErrorKey(null)
            if (inputRef.current) inputRef.current.click()
          }

          const handleFile = async (event) => {
            const input = event.currentTarget
            const file = input.files && input.files[0]
            input.value = ''
            if (!file) return
            setBusy(true)
            setErrorKey(null)
            try {
              const value = await prepareFile(file)
              try {
                const meta = await uploadToHost(value)
                clearLegacy()
                store.set(recordFromMeta(meta))
              } catch (hostFailure) {
                const stored = writeLegacy(value)
                store.set({
                  src: value.dataUrl,
                  name: value.name,
                  width: value.width,
                  height: value.height,
                  remote: false,
                })
                setErrorKey(stored ? 'errorHostFallback' : 'errorStorage')
              }
            } catch (failure) {
              const code = failure && failure.message
              setErrorKey(code === 'unsupported' ? 'errorType' : code === 'size' ? 'errorSize' : 'errorRead')
            } finally {
              setBusy(false)
            }
          }

          const removeWallpaper = async () => {
            setErrorKey(null)
            setBusy(true)
            let hostFailure = false
            try {
              await deleteFromHost()
            } catch (failure) {
              hostFailure = true
            }
            clearLegacy()
            store.set(null)
            if (hostFailure && current && current.remote) setErrorKey('errorHostDelete')
            setBusy(false)
          }

          const meta = current && current.name
            ? current.name + (current.width && current.height ? ' · ' + current.width + '×' + current.height : '')
            : null

          return h(
            'div',
            { className: 'dshw-row', 'aria-busy': busy ? 'true' : undefined },
            h(
              'div',
              { className: 'dshw-text' },
              h('div', { className: 'dshw-title' }, translate('title')),
              h('div', { className: 'dshw-description' }, translate('description')),
              h(
                'div',
                { className: 'dshw-effect' },
                h('span', { className: 'dshw-effect-label' }, translate('effectLabel')),
                h(
                  'div',
                  { className: 'dshw-seg' },
                  EFFECT_ORDER.map(([mode, key]) => h(
                    'button',
                    {
                      key: mode,
                      type: 'button',
                      'data-active': effect === mode ? 'true' : 'false',
                      'aria-pressed': effect === mode,
                      onClick: () => chooseEffect(mode),
                    },
                    translate(key),
                  )),
                ),
              ),
              meta ? h('div', { className: 'dshw-meta' }, meta) : null,
              errorKey ? h('div', { className: 'dshw-error', role: 'alert' }, translate(errorKey)) : null,
            ),
            h(
              'div',
              { className: 'dshw-control' },
              h(
                'div',
                { className: 'dshw-preview', 'data-empty': current ? 'false' : 'true' },
                current
                  ? h('img', { src: current.src, alt: translate('previewAlt'), title: meta || undefined })
                  : h('span', null, translate('empty')),
              ),
              h(
                'div',
                { className: 'dshw-buttons' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dshw-btn',
                    onClick: openPicker,
                    disabled: busy,
                  },
                  busy ? translate('processing') : current ? translate('replace') : translate('upload'),
                ),
                current
                  ? h(
                    'button',
                    { type: 'button', className: 'dshw-btn dshw-btn-ghost', onClick: removeWallpaper, disabled: busy },
                    translate('remove'),
                  )
                  : null,
              ),
              h('input', {
                ref: inputRef,
                type: 'file',
                accept: 'image/*',
                style: { display: 'none' },
                onChange: handleFile,
              }),
            ),
          )
        }

        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: 'wallpaper',
          order: 11.5,
          locale: 'wallpaper',
        }, WallpaperRow))
      },
    }
  },
})
