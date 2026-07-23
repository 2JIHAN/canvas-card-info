# Canvas Card Info

Right-click any card in an Obsidian **Canvas** and choose **"Copy card info"** to copy that card's data to your clipboard.

## What gets copied

| Card type | Copied fields |
|-----------|---------------|
| Text | id, text, position (x, y), size (w, h), color |
| File | id, file path, subpath, position, size, color |
| Link | id, URL, position, size, color |
| Group | id, label, position, size, color |

- Select multiple cards, then right-click, to copy them all at once.
- In **Settings → Canvas Card Info**, choose the copy format — **readable text**, **raw JSON**, or **both** — and toggle the copy notice.

## Install (manual)

1. Copy this folder (`canvas-card-info`) into `<your vault>/.obsidian/plugins/`.
2. In Obsidian, open **Settings → Community plugins** and enable **Canvas Card Info**.

## Development

```bash
npm install
npm run build   # produces main.js
```

## License

MIT
