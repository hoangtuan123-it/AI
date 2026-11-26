# AI Staff Card Editor

Web app local-first for preparing employee cards from SVG templates and generating print exports. The React editor runs in the browser; an Express API persists uploaded templates, employee records, and export history in a Docker/local data directory.

## What works

- Edit full name, position, employee ID, phone, and photo independently; preview updates immediately. Full names and positions display, save, and export in Vietnamese uppercase (for example, `Bùi Nguyễn Lan Anh` becomes `BÙI NGUYỄN LAN ANH`).
- Customize each employee field and each detected AI/PDF text object independently with a font, size, color, bold/italic styling, and alignment; changes carry through the card preview, SVG/PNG/PDF exports, and Illustrator bridge scripts.
- Upload JPG/PNG portraits; zoom and drag to reposition inside the detected AI portrait frame. For PDF-compatible AI, the replacement photo and mapped text appear as live overlays and are included in PNG/PDF preview exports; the original AI asset remains unchanged until the Illustrator bridge runs.
- Upload SVG templates (up to 100 MB), detect `<text>` and `<image>` objects, map them to employee fields, and update SVG content without replacing other template elements. SVG scripts, event attributes, foreign objects, and external/javascript links are removed before preview.
- Upload PDF and AI source files as preserved assets. When an AI file contains PDF-compatible data, the editor renders every page for preview and extracts selectable text snippets to suggest employee-field mappings. Editing a mapped field updates a text overlay; other detected text on every page can be edited and styled in page-specific inputs and is included in PNG/PDF exports and Illustrator bridge scripts. The visual preview does not rewrite the original AI. Apply changes to native Illustrator text frames with the JSX bridge.
- Import CSV and XLSX rosters with `PHOTO`, `FULL_NAME`, `POSITION`, `EMPLOYEE_ID`, and `PHONE_NUMBER` columns. A PHOTO cell may contain a data URL; photo paths are not fetched from disk automatically by the browser.
- Export SVG, PNG, PDF, and a ZIP containing one SVG per roster row. For PDF-compatible AI/PDF sources, PNG/PDF exports re-render the original selected page at 300 DPI before compositing edited photo/text overlays; they do not upscale the low-resolution live preview. SVG card exports retain vectors and text.
- Persist SVG/AI/PDF uploads, employee values, and export history in `DATA_DIR` through the API. Delete APIs are available for templates, employees, and export history.
- Responsive dashboard with light/dark toggle.

## Illustrator `.ai` limits

A `.ai` extension is not a file conversion. Without Adobe Illustrator, this project cannot reliably parse arbitrary AI layers, fonts, clipping masks, linked/embedded artwork, or produce a native editable AI document. AI uploads are stored unchanged. When the file is PDF-compatible, PDF.js previews all pages and provides text suggestions; this does not change the PDF/AI source or make the text preview live. Selecting **Adobe Illustrator** downloads an ExtendScript (`.jsx`) bridge, not an `.ai` file. In Illustrator, choose **File > Scripts > Other Script** and open the downloaded bridge. If the original template is already open, confirm using the active document; otherwise, choose the original `.ai` file in the dialog. Confirm the text to replace, optionally select a replacement photo for a placed image named `PHOTO` or `{{PHOTO}}`, and the script saves an editable `.ai` beside the source. If the photo is embedded or unnamed, label it as a placed item in Illustrator first. Raster PNG/PDF exports from an AI template export the currently selected original preview page. The AI bulk ZIP contains per-employee JSX bridge scripts, not native AI files. SVG export is disabled for AI/PDF sources to avoid implying vector preservation.

For predictable repeatable output, make a PDF-compatible Illustrator template with named text frames `FULL_NAME`, `POSITION`, `EMPLOYEE_ID`, `PHONE_NUMBER`, and a linked placed image named `PHOTO`, or put matching `{{FIELD_NAME}}` text in the template. Text sizing/overflow, font substitution, and layout still need validation in Illustrator with the real production template.

## Run locally

Requires Node.js 22+ and npm.

```powershell
npm ci
npm run dev:full
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The Express API listens on port 3001. API storage defaults to `./data`; set `DATA_DIR` or `PORT` to change it.

To run only the API and frontend separately, use `npm run server` and `npm run dev` in two terminals. Vite proxies `/api` to port 3001.

## Run with Docker

```powershell
docker compose up --build
```

Open `http://localhost:3000`. The named `staff-card-data` volume persists uploaded files and JSON records. Use `docker compose down` to stop the app. Removing the named volume permanently deletes its persisted files/data.

## API

- `GET /api/health`
- `GET, POST /api/templates`; `GET /api/templates/:id/file`; `DELETE /api/templates/:id`
- `GET, POST /api/employees`; `DELETE /api/employees/:id`
- `GET, POST, DELETE /api/exports`

Upload endpoints accept only `.svg`, `.pdf`, or `.ai` file extensions, one file, maximum 100 MB. Employee photo data is restricted to PNG/JPEG data URLs. Uploaded content is never executed by the server. Keep the app on a trusted local network: authentication, role management, remote hosting hardening, and encryption-at-rest are not included.

## Development notes

```powershell
npm run build
npm run lint
```

Parsing arbitrary `.ai` internals, automatic image-object recognition in AI/PDF, reusable object mappings per template, batch native AI/PDF generation through Illustrator automation, font auto-fit, authentication, and validation against actual customer templates remain follow-up work. Test with copies of production artwork before print use.
# AI
