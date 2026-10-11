**Язык / Language:** [Русский](README.md) · **English**

# ZeTer Photo Editor

ZeTer Photo Editor is a browser-based image editor with layers, undo/redo and Canvas 2D rendering. Images are processed in the browser during normal editing. It runs online or locally from `index.html`.

## Get started

1. Open https://dkl.do.am/servisi/PhotoEditor/index.html or download https://github.com/zeter1/ZeTer-Photo-Editor/archive/refs/heads/main.zip and extract the whole folder.
2. On Windows, open `start.bat` or `index.html`. Python and Node.js are not required for normal use.
3. Open an image, edit it, save the editable project as `.zpe`, and export the finished image in the format you need.

Keep original files and saved projects separately from browser recovery storage. AI tools require a separate model download. Browser storage availability may depend on the browser and launch mode.

## Main features

- Raster, text, shape and adjustment layers; groups, masks and blending modes.
- Supported layered PSD/PSB import and export, ICC metadata, RGB 16/32-bit and CMYK workflows.
- Selection tools, Select & Mask, painting, retouching and Content-Aware Fill.
- Editable text, local fonts, vector shapes and pen paths.
- A separate Object Removal tool using a locally downloaded LaMa model. This tool does not support native high-depth/CMYK sources.

Photoshop compatibility is partial. Complex group compositing, blend-if and some fill/vector workflows have limitations. See the detailed [compatibility notes in Russian](README.md#ограничения-относительно-photopea) before using important PSD/PSB documents.

## For developers

Runtime use does not require npm packages. Node.js 20+ is required for the development test suite:

```sh
npm test
```

The [project map](docs/PROJECT.md), [architecture](README.md#архитектура) and [change history](CHANGELOG.md) describe the implementation. These detailed documents are currently in Russian. Browser checks of menus, clipboard, drag-and-drop, undo/redo and export complement automated tests.

## Support and security

Report reproducible problems using https://github.com/zeter1/ZeTer-Photo-Editor/issues/new?template=bug_report.yml. Include the version, browser, OS, launch mode, document size, color mode/bit depth and exact steps. Share only minimal example files without private content. Use [SECURITY.md](SECURITY.md) for vulnerability disclosure.

## Developer contacts

- [zeter11@gmail.com](mailto:zeter11@gmail.com)
- [https://t.me/zeter1](https://t.me/zeter1)
- [https://www.linkedin.com/in/zeter/](https://www.linkedin.com/in/zeter/)
- [https://www.facebook.com/zeter1](https://www.facebook.com/zeter1)
- [https://vk.ru/zeter1](https://vk.ru/zeter1)
- [https://www.instagram.com/zeter1992/](https://www.instagram.com/zeter1992/)
- [https://tenchat.ru/zeter](https://tenchat.ru/zeter)
- [https://x.com/zeter1](https://x.com/zeter1)
- [https://www.threads.com/@zeter1992](https://www.threads.com/@zeter1992)
- [https://ok.ru/zeter1](https://ok.ru/zeter1)
- [https://t.me/zeterchat](https://t.me/zeterchat) — Telegram group: about me, projects and chat
