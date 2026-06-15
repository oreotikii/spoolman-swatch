# AGENTS.md

## Scope

This file applies to the entire repository.

## Project Context

This repository is a fork of Spoolman for a custom `spoolman-swatch` image. The current fork-specific edits are concentrated in:

- `client/src/pages/printing/printing.tsx`
- `client/src/pages/printing/spoolQrCodePrintingDialog.tsx`
- `.github/workflows/build-swatch-image.yml`

The main local feature is QR label printing support for a large filament color swatch and structured spool label layout. The `{filament.color_swatch}` template token is still supported for inline swatches inside custom templates. The custom GitHub Actions workflow builds and pushes `ghcr.io/${{ github.repository_owner }}/spoolman-swatch` images from `master`.

## Development Commands

Frontend work is under `client/` and uses Node 20.

```powershell
cd client
npm install
npm run lint
npm run format-check
npm run build
```

Backend work uses Python 3.10+ with `uv` and Poe tasks.

```powershell
uv run poe run
uv run pytest
uv run ruff check .
```

The custom image workflow builds the frontend with `VITE_APIURL=/api/v1` before Docker build. Keep that environment variable when reproducing the workflow locally or changing the workflow.

## Swatch Printing Notes

- `{filament.color_swatch}` is a synthetic print-template token, not a direct model field.
- Single-color spools use `filament.color_hex`.
- Multi-color spools use `filament.multi_color_hexes`; `coaxial` and `radial` directions render as conic gradients, other multi-color directions render as horizontal linear gradients.
- Spool QR labels render with a two-column layout: large color block above the QR code on the left, and template-driven spool text on the right.
- Inline `{filament.color_swatch}` swatches are rendered as `span` elements with millimeter sizing and print color adjustment enabled so browser print output preserves the color block.
- Conditional template syntax such as `{Color: {filament.color_swatch}}` should omit the prefix and suffix when no valid color is available.
- Keep the template renderer returning React nodes. Do not convert it back to whole-string replacement, because that loses the ability to insert swatch elements.
- Label templates support explicit formatting markers that may wrap placeholders: `[small]`, `[medium]`, `[large]`, `[huge]`, `[bold]`, and matching closing tags. `**bold**` remains supported as a bold shorthand.

## Editing Guidelines

- Prefer small, targeted changes that are easy to rebase onto upstream Spoolman.
- Keep fork-specific changes documented here when they affect build, image publishing, or print-template behavior.
- Preserve existing Ant Design and Refine patterns in the client.
- Use existing query hooks and saved-state helpers instead of adding new state-management patterns.
- Keep source files UTF-8. When editing label text, avoid mojibake around non-ASCII characters, especially degree-C temperature labels.
- Do not commit secrets, registry tokens, or local deployment credentials. The swatch image workflow should continue to use `secrets.GITHUB_TOKEN`.

## Validation Expectations

For client printing changes, run at least:

```powershell
cd client
npm run lint
npm run build
```

For workflow-only edits, verify the YAML shape and check that the image name, tags, `VITE_APIURL`, and Docker build args still match the custom `spoolman-swatch` image behavior.
