# dsh-wallpaper / 背景图片

A background image plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) Web UI. Upload a local image once; the Harness host keeps it and paints it behind the window, with four display effects that adapt to light and dark themes.

为 DeepSeek Harness 的 Web 界面提供背景图片：本地图片只需上传一次，由 Harness 主机保存，并提供原图 / 清晰 / 平衡 / 柔和四档效果，自动适配浅色与深色主题。

## Features

- **Settings → General → 背景图片**: upload, replace, remove, preview, and see the file name and dimensions.
- **Host-side storage**: the image lives in `$DSH_HOME/wallpapers/` (`image` + `meta.json`), so it survives restarts and Web-port changes.
- **Four effects** — 原图 (raw), 清晰 (thin mask), 平衡 (default), 柔和 (stronger mask). Switching applies immediately; the image's mean brightness is measured and normalized for the active palette.
- **Browser fallback**: without a Web carrier, the image is kept in this browser's storage.
- **No external network requests**: the image never leaves this machine.

## Install

npm package:

```sh
dsh plugin --profile web add @ferii87/dsh-wallpaper
```

GitHub:

```sh
dsh plugin --profile web add github:ferii-87/ferii-dsh-wallpaper
```

In the Desktop app, install it from **Settings → Plugins** (or the plugin market). Restart `dsh web` / the Desktop app if the Settings row does not appear immediately.

## Usage

1. Open **Settings → General → 背景图片**.
2. Upload an image. It is downscaled to at most 1920 px on the long edge and stored as a JPEG.
3. Pick **效果**:
   - **原图** — stored image, no scrim and no surface tint.
   - **清晰** — light surface treatment; the image stays close to the original.
   - **平衡** — default balance of image strength and text contrast.
   - **柔和** — stronger surface tint for maximum text readability.
4. **移除** deletes the stored image and restores the normal background.

## How it works

The Host half (`index.js`) registers four routes on the Web carrier:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/dsh-wallpaper/meta` | current metadata or `{ present: false }` |
| `GET` | `/dsh-wallpaper/image?v=<rev>` | stored image bytes |
| `POST` | `/dsh-wallpaper` | store a JSON `{ dataUrl, name, width, height, luminance }` |
| `DELETE` | `/dsh-wallpaper` | remove the stored image |

Images live under `$DSH_HOME/wallpapers/` (default `~/.dsh/wallpapers/`). The browser half (`client.js`) adds the Settings row, measures the image's mean luminance, and stacks a theme-token layer so the app surfaces show the image through. Without the routes, it falls back to `localStorage`.

## Privacy and security

- No network access; the image never leaves this machine.
- The plugin's routes carry no session authentication. Reads return only the stored wallpaper; writes require a JSON body plus the `x-dsh-wallpaper: 1` header. The default Harness composition binds the Web carrier to loopback; if you bind it to a network interface, these routes are exposed to that network. Do not treat the wallpaper as private on a shared/public bind address.
- The plugin writes only under `$DSH_HOME/wallpapers/`.

## Compatibility

Tested with DeepSeek Harness `0.2.1-rc.5` on Windows, in the Desktop Web UI. Requires a composition with the Web UI, `webServer`, and the `settings.general.item` slot.

## Development

Plain ESM JavaScript; no build step.

| File | Role |
|---|---|
| `index.js` | Host routes and file storage |
| `client.js` | Settings row, image preparation, rendering |
| `cordis.patch.yml` | bundle patch |
| `locale/` | plugin metadata copy |
| `icon.svg` | in-app icon |

## License

[MIT](LICENSE) © 2026 ferii-87
