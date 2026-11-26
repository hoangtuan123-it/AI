import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, DragEvent } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { Activity, ArrowDownToLine, ArrowLeftRight, BadgeCheck, Bell, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CloudUpload, Copy, FileArchive, FileImage, FilePlus2, FileText, FolderOpen, Grid2X2, History, ImagePlus, LayoutDashboard, Link2, Moon, MoreHorizontal, Phone, Plus, RotateCcw, Save, Search, Settings, ShieldCheck, Sun, Trash2, Upload, UserRound, Users, X, ZoomIn, ZoomOut } from 'lucide-react'
import './ai-preview.css'

type Field = 'FULL_NAME' | 'POSITION' | 'EMPLOYEE_ID' | 'PHONE_NUMBER'
type Employee = { PHOTO: string; FULL_NAME: string; POSITION: string; EMPLOYEE_ID: string; PHONE_NUMBER: string }
type TextStyle = { fontFamily: string; fontSize: number; bold: boolean; italic: boolean; color: string; align: 'left' | 'center' | 'right' }
type CardStyleVariables = CSSProperties & Partial<Record<'--full-name-font-family' | '--full-name-font-size' | '--full-name-font-weight' | '--full-name-font-style' | '--full-name-color' | '--full-name-align' | '--position-font-family' | '--position-font-size' | '--position-font-weight' | '--position-font-style' | '--position-color' | '--position-align' | '--employee-id-font-family' | '--employee-id-font-size' | '--employee-id-font-weight' | '--employee-id-font-style' | '--employee-id-color' | '--employee-id-align' | '--phone-number-font-family' | '--phone-number-font-size' | '--phone-number-font-weight' | '--phone-number-font-style' | '--phone-number-color' | '--phone-number-align', string>>
type TemplateObject = { id: string; label: string; value: string; type: string; page?: number; textStyle?: Partial<TextStyle>; bounds?: { x: number; y: number; width: number; height: number; fontSize: number; fontFamily: string; bold: boolean; italic: boolean; fill: string; background: string; centered: boolean } }
type Template = { name: string; source: string; kind: string; width: number; height: number; preview?: string; pages?: string[]; pdfDocument?: PDFDocumentProxy; pdfLoadingTask?: PDFDocumentLoadingTask; photoFrame?: { x: number; y: number; width: number; height: number; page: number }; objects: TemplateObject[] }
const fields: { key: Field; label: string; icon: typeof UserRound }[] = [
  { key: 'FULL_NAME', label: 'Full name', icon: UserRound },
  { key: 'POSITION', label: 'Position', icon: BriefcaseBusiness },
  { key: 'EMPLOYEE_ID', label: 'Employee ID', icon: BadgeCheck },
  { key: 'PHONE_NUMBER', label: 'Phone number', icon: Phone },
]
const initialEmployee: Employee = { PHOTO: '', FULL_NAME: 'Nguyen Minh Anh', POSITION: 'Senior Product Designer', EMPLOYEE_ID: 'EMP-0248', PHONE_NUMBER: '+84 912 345 678' }
const sampleRows: Employee[] = [
  initialEmployee,
  { ...initialEmployee, FULL_NAME: 'Tran Quoc Bao', POSITION: 'Frontend Engineer', EMPLOYEE_ID: 'EMP-0249', PHONE_NUMBER: '+84 938 220 119' },
  { ...initialEmployee, FULL_NAME: 'Le Thu Ha', POSITION: 'People & Culture Lead', EMPLOYEE_ID: 'EMP-0250', PHONE_NUMBER: '+84 903 118 664' },
]

function formatVietnameseUppercase(value: string) {
  return value.normalize('NFC').toLocaleUpperCase('vi-VN')
}

function formatEmployeeField(key: Field, value: string) {
  return key === 'FULL_NAME' || key === 'POSITION' ? formatVietnameseUppercase(value) : value
}

const defaultTextStyles: Record<Field, TextStyle> = {
  FULL_NAME: { fontFamily: 'Manrope, sans-serif', fontSize: 24, bold: true, italic: false, color: '#1f3935', align: 'left' },
  POSITION: { fontFamily: 'DM Sans, sans-serif', fontSize: 13, bold: false, italic: false, color: '#63716a', align: 'left' },
  EMPLOYEE_ID: { fontFamily: 'DM Mono, monospace', fontSize: 11, bold: false, italic: false, color: '#1f3935', align: 'left' },
  PHONE_NUMBER: { fontFamily: 'DM Mono, monospace', fontSize: 11, bold: false, italic: false, color: '#1f3935', align: 'left' },
}
const fontChoices = ['Arial, sans-serif', 'Manrope, sans-serif', 'DM Sans, sans-serif', 'DM Mono, monospace', 'Georgia, serif', 'Times New Roman, serif', 'Verdana, sans-serif', 'Courier New, monospace']

function resolveTextStyle(key: Field, object?: TemplateObject, overrides?: Record<string, Partial<TextStyle>>, overrideKey: string = key): TextStyle {
  const source = object?.bounds
    ? { fontFamily: object.bounds.fontFamily, fontSize: object.bounds.fontSize, bold: object.bounds.bold, italic: object.bounds.italic, color: object.bounds.fill, align: object.bounds.centered ? 'center' as const : 'left' as const }
    : object?.textStyle
  return { ...defaultTextStyles[key], ...source, ...overrides?.[overrideKey] }
}

function safeSvg(text: string) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.tagName.toLowerCase() !== 'svg') throw new Error('Invalid SVG template')
  doc.querySelectorAll('script, foreignObject, iframe, object, embed').forEach((node) => node.remove())
  ;[doc.documentElement, ...doc.querySelectorAll('*')].forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const isReference = attribute.name === 'href' || attribute.name.endsWith(':href')
      const isSafeReference = attribute.value.startsWith('#') || /^data:image\/(png|jpeg);base64,/i.test(attribute.value)
      if (/^on/i.test(attribute.name) || (isReference && !isSafeReference) || (attribute.name === 'style' && /url\s*\(/i.test(attribute.value) && !/url\(\s*['"]?#[-\w]+['"]?\s*\)/i.test(attribute.value))) node.removeAttribute(attribute.name)
    })
  })
  return new XMLSerializer().serializeToString(doc.documentElement)
}

function parseTemplate(source: string, name: string): Template {
  const clean = safeSvg(source)
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox')?.split(/[ ,]+/).map(Number)
  const width = Number(root.getAttribute('width')) || viewBox?.[2] || 1050
  const height = Number(root.getAttribute('height')) || viewBox?.[3] || 600
  const objects: TemplateObject[] = [...root.querySelectorAll('text')].map((node, index) => {
    if (!node.id) node.id = `editable-text-${index + 1}`
    const readStyle = (property: string) => {
      let current: Element | null = node
      while (current) {
        const value = current.getAttribute(property) || current.getAttribute('style')?.split(';').map((entry) => entry.trim()).find((entry) => entry.toLowerCase().startsWith(`${property}:`))?.split(':').slice(1).join(':').trim()
        if (value) return value
        current = current.parentElement
      }
      return ''
    }
    const fontSize = Number.parseFloat(readStyle('font-size'))
    const anchor = readStyle('text-anchor')
    return {
      id: node.id,
      label: node.textContent?.trim() || `Text object ${index + 1}`,
      value: node.textContent?.trim() || '',
      type: 'text',
      textStyle: {
        ...(readStyle('font-family') ? { fontFamily: readStyle('font-family').split(',')[0].trim().replace(/^['"]|['"]$/g, '') } : {}),
        ...(Number.isFinite(fontSize) ? { fontSize } : {}),
        ...(readStyle('font-weight') ? { bold: /bold|[6-9]00/i.test(readStyle('font-weight')) } : {}),
        ...(readStyle('font-style') ? { italic: /italic|oblique/i.test(readStyle('font-style')) } : {}),
        ...(readStyle('fill') ? { color: readStyle('fill') } : {}),
        ...(anchor ? { align: anchor === 'middle' ? 'center' as const : anchor === 'end' ? 'right' as const : 'left' as const } : {}),
      },
    }
  })
  root.querySelectorAll('image').forEach((node, index) => {
    if (!node.id) node.id = `editable-image-${index + 1}`
    objects.push({ id: node.id, label: node.id, value: '', type: 'image' })
  })
  return { name, source: new XMLSerializer().serializeToString(root), kind: 'SVG', width, height, objects }
}

async function analyzePdfCompatible(data: ArrayBuffer) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
  let keepDocument = false
  try {
    const pdfDocument = await loadingTask.promise
    const previews: string[] = []
    const objects: Template['objects'] = []
    let photoFrame: Template['photoFrame']
    let width = 1050
    let height = 600
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber)
      const scale = 3
      const viewport = page.getViewport({ scale })
      if (pageNumber === 1) {
        width = Math.round(viewport.width / scale)
        height = Math.round(viewport.height / scale)
      }
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Could not create a PDF preview canvas.')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      previews.push(canvas.toDataURL('image/png'))
      const operatorList = await page.getOperatorList()
      const operatorNames = new Map(Object.entries(pdfjs.OPS).map(([name, value]) => [value, name]))
      const stack: number[][] = []
      let matrix = [1, 0, 0, 1, 0, 0]
      const imageFrames: NonNullable<Template['photoFrame']>[] = []
      operatorList.fnArray.forEach((operator, index) => {
        const name = operatorNames.get(operator)
        const args = operatorList.argsArray[index] as number[] | [string, number, number] | null
        if (name === 'save') stack.push([...matrix])
        else if (name === 'restore') matrix = stack.pop() || [1, 0, 0, 1, 0, 0]
        else if (name === 'transform' && Array.isArray(args) && args.length === 6) {
          const [a, b, c, d, e, f] = args as number[]
          const [mA, mB, mC, mD, mE, mF] = matrix
          matrix = [mA * a + mC * b, mB * a + mD * b, mA * c + mC * d, mB * c + mD * d, mA * e + mC * f + mE, mB * e + mD * f + mF]
        } else if (name === 'paintImageXObject' && Array.isArray(args)) {
          const [a, b, c, d, e, f] = matrix
          const points = [[e, f], [a + e, b + f], [c + e, d + f], [a + c + e, b + d + f]]
          const xs = points.map((point) => point[0])
          const ys = points.map((point) => point[1])
          const left = Math.min(...xs)
          const right = Math.max(...xs)
          const bottom = Math.min(...ys)
          const top = Math.max(...ys)
          const frameWidth = right - left
          const frameHeight = top - bottom
          if (frameWidth > 35 && frameHeight > 35 && Math.abs(frameWidth / frameHeight - 1) < 0.15 && left < page.view[2] * 0.45 && top < page.view[3] * 0.9) {
            imageFrames.push({ x: left, y: page.view[3] - top, width: frameWidth, height: frameHeight, page: pageNumber })
          }
        }
      })
      const portraitFrame = imageFrames.at(-1)
      if (!photoFrame && portraitFrame) photoFrame = portraitFrame
      const content = await page.getTextContent()
      let fill = '#000000'
      let fontName = ''
      const fillsByText = new Map<string, string>()
      const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim()
      operatorList.fnArray.forEach((operator, index) => {
        const operatorName = operatorNames.get(operator)
        const args = operatorList.argsArray[index]
        if (operatorName === 'setFillRGBColor' && Array.isArray(args) && typeof args[0] === 'string') {
          fill = args[0]
        } else if (operatorName === 'setFillGray' && Array.isArray(args) && typeof args[0] === 'number') {
          const value = Math.round(Math.max(0, Math.min(1, args[0])) * 255).toString(16).padStart(2, '0')
          fill = `#${value}${value}${value}`
        } else if (operatorName === 'setFillCMYKColor' && Array.isArray(args) && args.length >= 4 && args.every((value) => typeof value === 'number')) {
          const [cyan, magenta, yellow, black] = args as number[]
          const channel = (value: number) => Math.round(255 * (1 - Math.min(1, value * (1 - black) + black))).toString(16).padStart(2, '0')
          fill = `#${channel(cyan)}${channel(magenta)}${channel(yellow)}`
        } else if (operatorName === 'setFont' && Array.isArray(args) && typeof args[0] === 'string') {
          fontName = args[0]
        } else if ((operatorName === 'showText' || operatorName === 'showSpacedText') && Array.isArray(args) && Array.isArray(args[0])) {
          const text = args[0].flatMap((glyph) => glyph && typeof glyph === 'object' && 'unicode' in glyph && typeof glyph.unicode === 'string' ? [glyph.unicode] : []).join('')
          if (text.trim()) fillsByText.set(`${fontName}\u0000${normalizeText(text)}`, fill)
        }
      })
      const sampleBackground = (x: number, y: number, boundsWidth: number, boundsHeight: number) => {
        const offsets = [
          [-2, boundsHeight * 0.25], [-2, boundsHeight * 0.5], [-2, boundsHeight * 0.75],
          [boundsWidth + 2, boundsHeight * 0.25], [boundsWidth + 2, boundsHeight * 0.5], [boundsWidth + 2, boundsHeight * 0.75],
          [boundsWidth * 0.2, -2], [boundsWidth * 0.5, -2], [boundsWidth * 0.8, -2],
          [boundsWidth * 0.2, boundsHeight + 2], [boundsWidth * 0.5, boundsHeight + 2], [boundsWidth * 0.8, boundsHeight + 2],
        ]
        const colors = new Map<string, number>()
        offsets.forEach(([offsetX, offsetY]) => {
          const [canvasX, canvasY] = viewport.convertToViewportPoint(x + offsetX, page.view[3] - y - offsetY)
          const pixelX = Math.round(canvasX)
          const pixelY = Math.round(canvasY)
          if (pixelX < 0 || pixelY < 0 || pixelX >= canvas.width || pixelY >= canvas.height) return
          const pixel = context.getImageData(pixelX, pixelY, 1, 1).data
          const channels = [...pixel.slice(0, 3)].map((value) => Math.round(value / 8) * 8)
          const color = `#${channels.map((value) => Math.min(255, value).toString(16).padStart(2, '0')).join('')}`
          colors.set(color, (colors.get(color) || 0) + 1)
        })
        return [...colors].sort((a, b) => b[1] - a[1])[0]?.[0] || '#ffffff'
      }
      objects.push(...content.items.flatMap((item, index) => {
        if (!('str' in item) || !item.str.trim()) return []
        const value = item.str.trim()
        const [scaleX, scaleY, , , x, baseline] = item.transform
        const fontSize = Math.hypot(scaleX, scaleY)
        const font = page.commonObjs.has(item.fontName)
          ? page.commonObjs.get(item.fontName) as { loadedName?: string; bold?: boolean; italic?: boolean }
          : undefined
        const y = page.view[3] - baseline - item.height
        const boxWidth = item.width
        const boxHeight = item.height
        const fontFamily = font?.loadedName || content.styles[item.fontName]?.fontFamily || 'sans-serif'
        return [{
          id: `pdf-text-${pageNumber}-${index}`,
          label: `Page ${pageNumber}: ${value}`,
          value,
          type: 'text',
          page: pageNumber,
          bounds: {
            x,
            y,
            width: boxWidth,
            height: boxHeight,
            fontSize,
            fontFamily,
            bold: Boolean(font?.bold),
            italic: Boolean(font?.italic),
            fill: fillsByText.get(`${item.fontName}\u0000${normalizeText(value)}`) || '#252525',
            background: sampleBackground(x, y, boxWidth, boxHeight),
            centered: Math.abs(x + boxWidth / 2 - (page.view[0] + page.view[2]) / 2) <= Math.max(1.5, boxWidth * 0.03),
          },
        }]
      }))
    }
    keepDocument = true
    return {
      width,
      height,
      preview: previews[0],
      previews,
      pdfDocument,
      pdfLoadingTask: loadingTask,
      photoFrame,
      objects,
      pageCount: pdfDocument.numPages,
    }
  } finally {
    if (!keepDocument) await loadingTask.destroy()
  }
}

async function renderPdfPage(pdfDocument: PDFDocumentProxy, pageNumber: number, scale: number, overlays: LiveTextOverlay[]) {
  const page = await pdfDocument.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = window.document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the high-resolution export canvas.')
  await page.render({ canvas, canvasContext: context, viewport }).promise
  const textContent = await page.getTextContent()
  overlays.forEach((overlay) => {
    const itemIndex = Number(overlay.key.match(/-(\d+)$/)?.[1])
    const item = textContent.items[itemIndex]
    if (!item || !('fontName' in item)) return
    const font = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) as { loadedName?: string } : undefined
    const fontFamily = font?.loadedName || overlay.fontFamily
    const text = overlay.employeeField ? formatEmployeeField(overlay.employeeField, overlay.value) : overlay.value
    const left = (overlay.x - page.view[0]) * viewport.scale
    const top = overlay.y * viewport.scale
    const width = overlay.width * viewport.scale
    const height = overlay.height * viewport.scale
    context.save()
    context.fillStyle = overlay.background
    context.fillRect(left, top, width, height)
    context.font = `${overlay.italic ? 'italic ' : ''}${overlay.bold ? '700' : '400'} ${overlay.fontSize * viewport.scale}px ${fontFamily}`
    context.fillStyle = overlay.fill
    context.textAlign = overlay.align
    context.textBaseline = 'alphabetic'
    context.fillText(text, overlay.align === 'center' ? left + width / 2 : overlay.align === 'right' ? left + width - 1 : left + 1, (overlay.baseline) * viewport.scale)
    context.restore()
  })
  return {
    preview: canvas.toDataURL('image/png'),
    widthPt: page.view[2] - page.view[0],
    heightPt: page.view[3] - page.view[1],
    widthPx: canvas.width,
    heightPx: canvas.height,
  }
}

function inferEmployeeFromPdf(objects: Template['objects']): Employee {
  const text = objects.map((object) => object.value).filter(Boolean)
  const joined = text.join(' ')
  const normalizedDigits = (value: string) => value.replace(/\D/g, '')
  const employeeId = joined.match(/\b\d{6,}\b/)?.[0] || ''
  const phone = joined.match(/\b0\d(?:[\s.-]?\d){8}\b/)?.[0]?.replace(/[.]/g, ' ') || ''
  const position = text.find((value) => /\b(assistant|engineer|designer|manager|director|analyst|specialist|officer|coordinator|supervisor|consultant)\b/i.test(value)) || ''
  const fullName = text.find((value) => /[À-ỹ]/.test(value) && /\p{L}/u.test(value) && value === value.toLocaleUpperCase() && !/\b(ID|PHONE)\b/i.test(value)) || ''
  return {
    PHOTO: '',
    FULL_NAME: fullName,
    POSITION: position,
    EMPLOYEE_ID: employeeId,
    PHONE_NUMBER: phone || normalizedDigits(joined).match(/0\d{9}/)?.[0] || '',
  }
}

function mapPdfFields(objects: Template['objects'], employee: Employee): Record<Field, string> {
  const findText = (predicate: (value: string) => boolean) => objects.find((object) => predicate(object.value))?.id || ''
  return {
    FULL_NAME: findText((value) => value === employee.FULL_NAME),
    POSITION: findText((value) => value === employee.POSITION),
    EMPLOYEE_ID: findText((value) => Boolean(employee.EMPLOYEE_ID) && value.replace(/\D/g, '') === employee.EMPLOYEE_ID),
    PHONE_NUMBER: findText((value) => Boolean(employee.PHONE_NUMBER) && value.replace(/\D/g, '') === employee.PHONE_NUMBER.replace(/\D/g, '')),
  }
}

type LiveTextOverlay = { key: string; employeeField?: Field; value: string; x: number; y: number; width: number; height: number; baseline: number; fontSize: number; fontFamily: string; align: TextStyle['align']; fill: string; background: string; bold: boolean; italic: boolean }
type TemplateTextEdit = { source: string; value: string; textStyle?: TextStyle }

function createLiveOverlayMarkup(template: Template, employee: Employee, overlays: LiveTextOverlay[], photoZoom: number, photoOffset: { x: number; y: number }, page: number) {
  const photoFrame = template.photoFrame?.page === page ? template.photoFrame : undefined
  let photoMarkup = ''
  if (photoFrame && employee.PHOTO && /^data:image\/(png|jpeg);base64,/i.test(employee.PHOTO)) {
    const { x, y, width, height } = photoFrame
    const centerX = x + width / 2
    const centerY = y + height / 2
    const radius = Math.min(width, height) * 0.47
    const escapedPhoto = employee.PHOTO.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    photoMarkup = `<defs><clipPath id="employee-photo-clip"><circle cx="${centerX}" cy="${centerY}" r="${radius}"/></clipPath></defs><circle cx="${centerX}" cy="${centerY}" r="${Math.min(width, height) / 2}" fill="#fff"/><image href="${escapedPhoto}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#employee-photo-clip)" transform="translate(${centerX + photoOffset.x} ${centerY + photoOffset.y}) scale(${photoZoom}) translate(${-centerX} ${-centerY})"/>`
  }
  const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] || character)
  const textMarkup = overlays.map((overlay) => `<g><rect x="${overlay.x}" y="${overlay.y}" width="${overlay.width}" height="${overlay.height}" fill="${overlay.background}"/><text x="${overlay.align === 'center' ? overlay.x + overlay.width / 2 : overlay.align === 'right' ? overlay.x + overlay.width - 1 : overlay.x + 1}" y="${overlay.baseline}" text-anchor="${overlay.align === 'center' ? 'middle' : overlay.align === 'right' ? 'end' : 'start'}" dominant-baseline="alphabetic" font-family="${escapeXml(overlay.fontFamily)}" font-size="${overlay.fontSize}" font-weight="${overlay.bold ? 700 : 400}" font-style="${overlay.italic ? 'italic' : 'normal'}" fill="${overlay.fill}">${escapeXml(overlay.employeeField ? formatEmployeeField(overlay.employeeField, overlay.value) : overlay.value)}</text></g>`).join('')
  return `${photoMarkup}${textMarkup}`
}

function applyTemplate(template: Template, employee: Employee, mapping: Record<Field | 'PHOTO', string>, textStyleOverrides: Record<string, Partial<TextStyle>>) {
  const doc = new DOMParser().parseFromString(template.source, 'image/svg+xml')
  fields.forEach(({ key }) => {
    const target = mapping[key]
    if (!target) return
    const node = doc.getElementById(target)
    if (node) {
      node.textContent = formatEmployeeField(key, employee[key])
      if (textStyleOverrides[key]) {
        const object = template.objects.find((item) => item.id === target)
        const style = resolveTextStyle(key, object, textStyleOverrides)
        node.setAttribute('font-family', style.fontFamily)
        node.setAttribute('font-size', String(style.fontSize))
        node.setAttribute('font-weight', style.bold ? '700' : '400')
        node.setAttribute('font-style', style.italic ? 'italic' : 'normal')
        node.setAttribute('fill', style.color)
        node.setAttribute('text-anchor', style.align === 'center' ? 'middle' : style.align === 'right' ? 'end' : 'start')
      }
    }
  })
  if (mapping.PHOTO && employee.PHOTO) {
    const image = doc.getElementById(mapping.PHOTO)
    if (image?.tagName.toLowerCase() === 'image' && /^data:image\/(png|jpeg);base64,/i.test(employee.PHOTO)) {
      image.setAttribute('href', employee.PHOTO)
      image.removeAttribute('xlink:href')
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement)
}

function TypographyEditor({ fieldLabel, style, onChange, onReset }: { fieldLabel: string; style: TextStyle; onChange: (style: Partial<TextStyle>) => void; onReset: () => void }) {
  return (
    <details className="typography-editor">
      <summary>Customize typography</summary>
      <div className="typography-controls">
        <label>Font<select aria-label={`${fieldLabel} font`} value={style.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })}>{!fontChoices.includes(style.fontFamily) && <option value={style.fontFamily}>{style.fontFamily} (template)</option>}{fontChoices.map((font) => <option value={font} key={font}>{font.split(',')[0]}</option>)}</select></label>
        <label>Size<input aria-label={`${fieldLabel} font size`} type="number" min="1" max="300" value={style.fontSize} onChange={(event) => { const size = Number(event.target.value); if (Number.isFinite(size) && size >= 1 && size <= 300) onChange({ fontSize: size }) }} /></label>
        <label>Color<input aria-label={`${fieldLabel} font color`} type="color" value={/^#[0-9a-f]{6}$/i.test(style.color) ? style.color : '#27342f'} onChange={(event) => onChange({ color: event.target.value })} /></label>
        <label>Align<select aria-label={`${fieldLabel} alignment`} value={style.align} onChange={(event) => { const align = event.target.value; if (align === 'left' || align === 'center' || align === 'right') onChange({ align }) }}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label className="typography-toggle"><input type="checkbox" checked={style.bold} onChange={(event) => onChange({ bold: event.target.checked })} /> Bold</label>
        <label className="typography-toggle"><input type="checkbox" checked={style.italic} onChange={(event) => onChange({ italic: event.target.checked })} /> Italic</label>
        <button type="button" className="typography-reset" onClick={onReset}>Reset style</button>
      </div>
    </details>
  )
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

async function parseXlsx(file: File): Promise<Record<string, unknown>[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const readXml = async (name: string) => {
    const entry = zip.file(name)
    if (!entry) return null
    const document = new DOMParser().parseFromString(await entry.async('text'), 'application/xml')
    if (document.querySelector('parsererror')) throw new Error('The XLSX workbook contains invalid XML.')
    return document
  }
  const workbook = await readXml('xl/workbook.xml')
  const relationships = await readXml('xl/_rels/workbook.xml.rels')
  if (!workbook || !relationships) throw new Error('This is not a valid XLSX workbook.')
  const sheet = workbook.getElementsByTagName('sheet')[0]
  const relationId = sheet?.getAttribute('r:id')
  const relation = [...relationships.getElementsByTagName('Relationship')].find((item) => item.getAttribute('Id') === relationId)
  if (!relation) throw new Error('The workbook has no readable worksheet.')
  const target = relation.getAttribute('Target') || ''
  const worksheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  const normalizedPath = worksheetPath.split('/').reduce<string[]>((parts, segment) => {
    if (segment === '..') parts.pop()
    else if (segment && segment !== '.') parts.push(segment)
    return parts
  }, []).join('/')
  const worksheet = await readXml(normalizedPath)
  if (!worksheet) throw new Error('The first worksheet is missing.')
  const sharedDocument = await readXml('xl/sharedStrings.xml')
  const sharedStrings = sharedDocument ? [...sharedDocument.getElementsByTagName('si')].map((item) => [...item.getElementsByTagName('t')].map((text) => text.textContent || '').join('')) : []
  const rows = [...worksheet.getElementsByTagName('row')].map((row) => {
    const cells = new Map<number, string>()
    for (const cell of [...row.getElementsByTagName('c')]) {
      const reference = cell.getAttribute('r') || ''
      const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() || ''
      const column = [...letters].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) - 1
      const type = cell.getAttribute('t')
      const value = type === 'inlineStr'
        ? [...cell.getElementsByTagName('t')].map((text) => text.textContent || '').join('')
        : cell.getElementsByTagName('v')[0]?.textContent || ''
      cells.set(column, type === 's' ? sharedStrings[Number(value)] || '' : value)
    }
    return cells
  })
  const headerRow = rows.shift()
  if (!headerRow) throw new Error('The worksheet is empty.')
  const headers = [...headerRow.entries()].map(([index, value]) => [index, value.trim().toUpperCase()] as const).filter(([, value]) => value)
  return rows.map((row) => Object.fromEntries(headers.map(([index, header]) => [header, row.get(index) || '']))).filter((row) => Object.values(row).some(Boolean))
}

function App() {
  const [employee, setEmployee] = useState<Employee>(initialEmployee)
  const [employees, setEmployees] = useState<Employee[]>(sampleRows)
  const [template, setTemplate] = useState<Template | null>(null)
  const [mapping, setMapping] = useState<Record<Field | 'PHOTO', string>>({ PHOTO: '', FULL_NAME: '', POSITION: '', EMPLOYEE_ID: '', PHONE_NUMBER: '' })
  const [textStyleOverrides, setTextStyleOverrides] = useState<Record<string, Partial<TextStyle>>>({})
  const [photoZoom, setPhotoZoom] = useState(1)
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dark, setDark] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [activeNav, setActiveNav] = useState('Employee editor')
  const [showOriginal, setShowOriginal] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const [pageTextValues, setPageTextValues] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const photo = employee.PHOTO
  const previewSvg = useMemo(() => template ? applyTemplate(template, employee, mapping, textStyleOverrides) : '', [template, employee, mapping, textStyleOverrides])
  const previewEmployee = showOriginal ? initialEmployee : employee
  const liveTextOverlays = useMemo(() => {
    if (template?.kind !== 'AI') return []
    const employeeOverlays = fields.flatMap(({ key }) => {
      const object = template.objects.find((item) => item.id === mapping[key] && item.page === previewPage)
      if (!object?.bounds || !employee[key]) return []
      const { x: originalX, y: originalY, width: originalWidth, height: originalHeight } = object.bounds
      const x = Math.max(0, originalX - 1)
      const width = originalWidth + 2
      const value = formatEmployeeField(key, employee[key])
      const style = resolveTextStyle(key, object, textStyleOverrides)
      return [{
        key: object.id,
        employeeField: key,
        value,
        x,
        y: Math.max(0, originalY - 1),
        width,
        height: originalHeight + 2,
        baseline: originalY + originalHeight,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        align: style.align,
        fill: style.color,
        background: object.bounds.background,
        bold: style.bold,
        italic: style.italic,
      }]
    })
    const mappedObjectIds = new Set(fields.map(({ key }) => mapping[key]).filter(Boolean))
    const pageOverlays = template.objects.flatMap((object) => {
      if (object.type !== 'text' || object.page !== previewPage || !object.bounds || mappedObjectIds.has(object.id)) return []
      const value = pageTextValues[object.id] ?? object.value
      if (value === object.value && !textStyleOverrides[object.id]) return []
      const { x, y, width, height } = object.bounds
      const overlayWidth = Math.max(1, width + 4)
      const style = resolveTextStyle('FULL_NAME', object, textStyleOverrides, object.id)
      return [{
        key: object.id,
        value,
        x: Math.max(0, x - 1),
        y: Math.max(0, y - 1),
        width: overlayWidth,
        height: height + 2,
        baseline: y + height,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        align: style.align,
        fill: style.color,
        background: object.bounds.background,
        bold: style.bold,
        italic: style.italic,
      }]
    })
    return [...employeeOverlays, ...pageOverlays]
  }, [employee, mapping, pageTextValues, previewPage, template, textStyleOverrides])
  const pageTextFields = template?.kind === 'AI'
    ? template.objects.filter((object) => object.type === 'text' && object.page === previewPage && object.bounds && !fields.some(({ key }) => mapping[key] === object.id))
    : []
  const customTextEdits: TemplateTextEdit[] = template?.kind === 'AI'
    ? template.objects.flatMap((object) => {
      if (object.type !== 'text' || !object.bounds || fields.some(({ key }) => mapping[key] === object.id)) return []
      const value = pageTextValues[object.id] ?? object.value
      const textStyle = textStyleOverrides[object.id] ? resolveTextStyle('FULL_NAME', object, textStyleOverrides, object.id) : undefined
      return value === object.value && !textStyle ? [] : [{ source: object.value, value, ...(textStyle ? { textStyle } : {}) }]
    })
    : []
  const illustratorTextStyles = Object.fromEntries(fields.flatMap(({ key }) => {
    if (!textStyleOverrides[key]) return []
    const object = template?.objects.find((item) => item.id === mapping[key])
    return [[key, resolveTextStyle(key, object, textStyleOverrides)]]
  })) as Partial<Record<Field, TextStyle>>

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const pdfLoadingTask = template?.pdfLoadingTask
    return () => {
      if (pdfLoadingTask) void pdfLoadingTask.destroy()
    }
  }, [template?.pdfLoadingTask])

  useEffect(() => {
    void (async () => {
      try {
        const [employeeResponse, exportResponse, templateResponse] = await Promise.all([
          fetch('/api/employees'), fetch('/api/exports'), fetch('/api/templates'),
        ])
        if (employeeResponse.ok) {
          const savedEmployees = await employeeResponse.json() as Employee[]
          if (savedEmployees.length) { setEmployees(savedEmployees); setEmployee(savedEmployees[0]) }
        }
        if (exportResponse.ok) {
          const savedExports = await exportResponse.json() as { createdAt: string; employee: string; format: string }[]
          setHistory(savedExports.slice(0, 8).map((item) => `${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${item.employee} · ${item.format}`))
        }
        if (templateResponse.ok) {
          const savedTemplates = await templateResponse.json() as { id: string; name: string }[]
          const latestTemplate = savedTemplates.find((item) => /\.(svg|ai|pdf)$/i.test(item.name))
          if (latestTemplate) {
            const response = await fetch(`/api/templates/${latestTemplate.id}/file`)
            if (response.ok && latestTemplate.name.toLowerCase().endsWith('.svg')) {
              setTemplate(parseTemplate(await response.text(), latestTemplate.name))
            } else if (response.ok) {
              const analysis = await analyzePdfCompatible(await response.arrayBuffer())
              const parsed: Template = { name: latestTemplate.name, source: '', kind: latestTemplate.name.split('.').pop()!.toUpperCase(), width: analysis.width, height: analysis.height, preview: analysis.preview, pages: analysis.previews, pdfDocument: analysis.pdfDocument, pdfLoadingTask: analysis.pdfLoadingTask, photoFrame: analysis.photoFrame, objects: analysis.objects }
              const detected = inferEmployeeFromPdf(parsed.objects)
              setTemplate(parsed)
              setMapping((current) => ({ ...current, PHOTO: '', ...mapPdfFields(parsed.objects, detected) }))
              setPreviewPage(1)
              if (detected.FULL_NAME || detected.EMPLOYEE_ID) {
                setEmployee((current) => ({ ...current, ...detected }))
                setEmployees((current) => {
                  const index = current.findIndex((person) => person.EMPLOYEE_ID && person.EMPLOYEE_ID === detected.EMPLOYEE_ID)
                  return index < 0 ? [detected, ...current] : current.map((person, row) => row === index ? { ...person, ...detected } : person)
                })
              }
            }
          }
        }
      } catch (error) {
        setNotice(`Could not restore the saved template preview: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    })()
  }, [])

  const updateEmployee = (key: keyof Employee, value: string) => setEmployee((current) => ({ ...current, [key]: value }))

  const saveTemplate = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) { setNotice('File exceeds the 100 MB upload limit.'); return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['svg', 'ai', 'pdf'].includes(ext)) { setNotice('Choose an SVG, PDF, or AI file.'); return }
    let pdfPreviewLoaded = false
    try {
      if (ext === 'svg') {
        const parsed = parseTemplate(await file.text(), file.name)
        setTemplate(parsed)
        setPageTextValues({})
        setMapping((current) => ({ ...current, PHOTO: parsed.objects.find((o) => o.type === 'image')?.id || '', FULL_NAME: parsed.objects.find((o) => o.type === 'text' && /name|full/i.test(o.label))?.id || '', POSITION: parsed.objects.find((o) => o.type === 'text' && /position|role|title/i.test(o.label))?.id || '', EMPLOYEE_ID: parsed.objects.find((o) => o.type === 'text' && /id|employee/i.test(o.label))?.id || '', PHONE_NUMBER: parsed.objects.find((o) => o.type === 'text' && /phone|mobile/i.test(o.label))?.id || '' }))
      } else {
        let analysis: Awaited<ReturnType<typeof analyzePdfCompatible>> | undefined
        try { analysis = await analyzePdfCompatible(await file.arrayBuffer()) }
        catch (error) {
          if (ext === 'pdf') throw error
        }
        pdfPreviewLoaded = Boolean(analysis?.preview)
        const parsed: Template = {
          name: file.name,
          source: '',
          kind: ext.toUpperCase(),
          width: analysis?.width || 1050,
          height: analysis?.height || 600,
          preview: analysis?.preview,
          pages: analysis?.previews,
          pdfDocument: analysis?.pdfDocument,
          pdfLoadingTask: analysis?.pdfLoadingTask,
          photoFrame: analysis?.photoFrame,
          objects: analysis?.objects || [],
        }
        setTemplate(parsed)
        setPageTextValues({})
        setPreviewPage(1)
        if (analysis?.objects.length) {
          const detected = inferEmployeeFromPdf(parsed.objects)
          setMapping((current) => ({
            ...current,
            PHOTO: '',
            ...mapPdfFields(parsed.objects, detected),
          }))
          if (detected.FULL_NAME || detected.EMPLOYEE_ID) {
            setEmployee((current) => ({ ...current, ...detected }))
            setEmployees((current) => {
              const existing = current.findIndex((person) => person.EMPLOYEE_ID && person.EMPLOYEE_ID === detected.EMPLOYEE_ID)
              if (existing < 0) return [detected, ...current]
              return current.map((person, index) => index === existing ? { ...person, ...detected } : person)
            })
          }
        }
      }
      const body = new FormData(); body.append('template', file)
      let saveError = ''
      try {
        const response = await fetch('/api/templates', { method: 'POST', body })
        if (!response.ok) {
          const result = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(result?.error || `Upload failed (${response.status}).`)
        }
      } catch (error) {
        saveError = error instanceof Error ? error.message : 'The API is unavailable.'
      }
      if (ext === 'ai') {
        setNotice(saveError
          ? `AI opened for this session only; it was not saved (${saveError}). ${pdfPreviewLoaded ? 'PDF-compatible preview and text were read.' : 'No PDF-compatible preview was found.'} Use the JSX bridge in Illustrator to apply edits to the original.`
          : `AI source saved: ${file.name}.${pdfPreviewLoaded ? ' Preview and text read from its PDF-compatible data.' : ' No PDF-compatible preview was found.'} Change the detected fields, then use the JSX bridge in Illustrator to apply them to the original.`)
      } else if (ext === 'pdf') {
        setNotice(saveError ? `PDF opened for this session only; it was not saved (${saveError}).` : `PDF preview loaded and source saved: ${file.name}.`)
      } else {
        setNotice(saveError
          ? `SVG loaded for this session, but not saved (${saveError}). Map the detected text objects below.`
          : `Loaded and saved ${file.name}. Map the detected text objects below.`)
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not read the template.') }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void saveTemplate(file)
  }

  const importPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { setNotice('Use a JPG or PNG smaller than 10 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { updateEmployee('PHOTO', String(reader.result)); setNotice('Photo loaded. Drag it in the preview to reposition.') }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const importRoster = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      let rows: Record<string, unknown>[]
      if (file.name.toLowerCase().endsWith('.csv')) {
        const Papa = (await import('papaparse')).default
        const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true })
        if (parsed.errors.length) throw new Error(parsed.errors[0].message)
        rows = parsed.data
      } else {
        rows = await parseXlsx(file)
      }
      const normalized = rows.map((row) => {
        const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase().trim(), String(value ?? '')]))
        return { PHOTO: values.PHOTO || '', FULL_NAME: values.FULL_NAME || '', POSITION: values.POSITION || '', EMPLOYEE_ID: values.EMPLOYEE_ID || '', PHONE_NUMBER: values.PHONE_NUMBER || '' }
      }).filter((row) => row.FULL_NAME || row.EMPLOYEE_ID)
      if (!normalized.length) throw new Error('No employees found. Expected PHOTO, FULL_NAME, POSITION, EMPLOYEE_ID, PHONE_NUMBER columns.')
      setEmployees(normalized); setEmployee(normalized[0]); setNotice(`${normalized.length} employees imported.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not read this spreadsheet.') }
    event.target.value = ''
  }

  const saveChanges = async () => {
    const savedEmployee = { ...employee, FULL_NAME: formatVietnameseUppercase(employee.FULL_NAME), POSITION: formatVietnameseUppercase(employee.POSITION) }
    setEmployee(savedEmployee)
    setEmployees((current) => {
      const index = current.findIndex((person) => person.EMPLOYEE_ID && person.EMPLOYEE_ID === savedEmployee.EMPLOYEE_ID)
      return index < 0 ? [savedEmployee, ...current] : current.map((person, row) => row === index ? savedEmployee : person)
    })
    try {
      const response = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(savedEmployee) })
      if (!response.ok) throw new Error(`Save failed (${response.status}).`)
      setNotice('Employee saved. The live preview reflects your changes.')
    } catch (error) {
      setNotice(`Preview updated, but employee data was not saved to the workspace: ${error instanceof Error ? error.message : 'API unavailable.'}`)
    }
  }

  const exportSvg = (person = employee) => {
    const source = template?.kind === 'SVG' && template.source ? applyTemplate(template, person, mapping, textStyleOverrides) : createCardSvg(person)
    return new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  }

  const createCardSvg = (person: Employee) => {
    const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] || char)
    const safePhoto = person.PHOTO && /^data:image\/(png|jpeg);base64,/i.test(person.PHOTO) ? `<image href="${person.PHOTO}" x="66" y="72" width="254" height="318" preserveAspectRatio="xMidYMid slice"/>` : '<circle cx="193" cy="195" r="53" fill="#d5ded8"/><path d="M98 365c6-73 42-108 95-108s89 35 95 108" fill="#d5ded8"/>'
    const textAttributes = (key: Field) => {
      if (!textStyleOverrides[key]) return ''
      const style = resolveTextStyle(key, undefined, textStyleOverrides)
      return `font-family="${esc(style.fontFamily)}" font-size="${style.fontSize * 2}" font-weight="${style.bold ? 700 : 400}" font-style="${style.italic ? 'italic' : 'normal'}" fill="${esc(style.color)}" text-anchor="${style.align === 'center' ? 'middle' : style.align === 'right' ? 'end' : 'start'}"`
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="600" viewBox="0 0 1050 600"><rect width="1050" height="600" rx="20" fill="#f5f4ed"/><rect width="24" height="600" fill="#d75338"/><path d="M24 0h1026v152H24z" fill="#1f3935"/><text x="80" y="85" font-family="Arial,sans-serif" font-size="24" fill="#db765d" font-weight="700" letter-spacing="3">FIELDNOTES / STUDIO</text><text x="80" y="128" font-family="Arial,sans-serif" font-size="18" fill="#dce5db">DESIGNING THINGS THAT MATTER</text><rect x="80" y="196" width="260" height="326" rx="12" fill="#e2e4da"/>${safePhoto}<text x="392" y="286" ${textAttributes('FULL_NAME')}>${esc(formatVietnameseUppercase(person.FULL_NAME))}</text><text x="394" y="338" ${textAttributes('POSITION')}>${esc(formatVietnameseUppercase(person.POSITION))}</text><path d="M394 380h540" stroke="#d5d9cf" stroke-width="2"/><text x="394" y="430" font-family="Arial,sans-serif" font-size="16" fill="#8a928c" letter-spacing="2">EMPLOYEE ID</text><text x="394" y="464" ${textAttributes('EMPLOYEE_ID')}>${esc(person.EMPLOYEE_ID)}</text><text x="710" y="430" font-family="Arial,sans-serif" font-size="16" fill="#8a928c" letter-spacing="2">PHONE</text><text x="710" y="464" ${textAttributes('PHONE_NUMBER')}>${esc(person.PHONE_NUMBER)}</text><circle cx="945" cy="545" r="7" fill="#d75338"/></svg>`
  }

  const exportFile = async (format: string) => {
    setExporting(true)
    try {
      const base = (employee.FULL_NAME || 'employee').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
      if (format === 'SVG' && (template?.kind === 'AI' || template?.kind === 'PDF')) {
        setNotice('SVG export is not available for AI/PDF sources because it would flatten or replace the original artwork. Use the Illustrator bridge for editable AI output.')
        return
      }
      if (format === 'SVG') downloadBlob(exportSvg(), `${base}.svg`)
      if (format === 'PNG' || format === 'PDF') {
        const pdfModule = format === 'PDF' ? await import('jspdf') : null
        const highResolutionPage = template?.pdfDocument ? await renderPdfPage(template.pdfDocument, previewPage, 300 / 72, liveTextOverlays) : null
        const sourcePreview = highResolutionPage?.preview || (template?.preview ? template.pages?.[previewPage - 1] || template.preview : '')
        const sourceWidthPt = highResolutionPage?.widthPt || template?.width || 1050
        const sourceHeightPt = highResolutionPage?.heightPt || template?.height || 600
        const svg = sourcePreview ? '' : await exportSvg().text()
        const image = new Image()
        const imageUrl = sourcePreview || URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
        image.src = imageUrl
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Preview could not be rendered.')) })
        const canvas = document.createElement('canvas'); canvas.width = sourcePreview ? image.naturalWidth : (image.naturalWidth || 1050) * 2; canvas.height = sourcePreview ? image.naturalHeight : (image.naturalHeight || 600) * 2
        const context = canvas.getContext('2d')!
        if (format === 'PDF') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height) }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        if (!sourcePreview) URL.revokeObjectURL(imageUrl)
        if (sourcePreview && template?.kind === 'AI' && employee.PHOTO) {
          const overlayMarkup = createLiveOverlayMarkup(template, employee, [], photoZoom, photoOffset, previewPage)
          const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">${overlayMarkup}</svg>`
          const overlayImage = new Image()
          const overlayUrl = URL.createObjectURL(new Blob([overlaySvg], { type: 'image/svg+xml' }))
          overlayImage.src = overlayUrl
          await new Promise<void>((resolve, reject) => { overlayImage.onload = () => resolve(); overlayImage.onerror = () => reject(new Error('Could not render edited text for export.')) })
          context.drawImage(overlayImage, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(overlayUrl)
        }
        if (format === 'PNG') canvas.toBlob((blob) => blob && downloadBlob(blob, `${base}.png`), 'image/png')
        else {
          const widthPt = sourcePreview ? sourceWidthPt : canvas.width * 72 / 600
          const heightPt = sourcePreview ? sourceHeightPt : canvas.height * 72 / 600
          const pdf = new pdfModule!.jsPDF({ orientation: widthPt >= heightPt ? 'landscape' : 'portrait', unit: 'pt', format: [widthPt, heightPt] })
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthPt, heightPt)
          downloadBlob(pdf.output('blob'), `${base}${sourcePreview && template?.pages?.length ? `-page-${previewPage}` : ''}.pdf`)
        }
        if (highResolutionPage) {
          const dpi = Math.round(canvas.width / sourceWidthPt * 72)
          setNotice(`${format} exported at ${canvas.width} × ${canvas.height} px (${dpi} DPI), page ${previewPage}.`)
        } else if (sourcePreview) setNotice(`${format} exported from the original artwork preview, page ${previewPage}.`)
      }
      if (format === 'ZIP') {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        if (template?.kind === 'AI') {
          for (const person of employees) {
            const sourceTexts = Object.fromEntries(fields.map(({ key }) => [key, template.objects.find((object) => object.id === mapping[key])?.value || ''])) as Partial<Record<Field, string>>
            zip.file(`${person.EMPLOYEE_ID || person.FULL_NAME}-illustrator.jsx`, illustratorBridge(person, sourceTexts, customTextEdits, illustratorTextStyles))
          }
          downloadBlob(await zip.generateAsync({ type: 'blob' }), 'employee-illustrator-bridges.zip')
        } else {
          for (const person of employees) zip.file(`${person.EMPLOYEE_ID || person.FULL_NAME}.svg`, exportSvg(person))
          downloadBlob(await zip.generateAsync({ type: 'blob' }), 'employee-cards.zip')
        }
      }
      if (format === 'AI') {
        const sourceTexts = Object.fromEntries(fields.map(({ key }) => [key, template?.objects.find((object) => object.id === mapping[key])?.value || ''])) as Partial<Record<Field, string>>
        const jsx = illustratorBridge(employee, sourceTexts, customTextEdits, illustratorTextStyles)
        downloadBlob(new Blob([jsx], { type: 'text/javascript;charset=utf-8' }), `${base}-illustrator-bridge.jsx`)
        setNotice('Illustrator script (.jsx) downloaded. In Illustrator, choose File > Scripts > Other Script, open it, then select your original .AI file. The edited .AI is saved beside the original.')
      } else if (format !== 'PNG' && format !== 'PDF') setNotice(format === 'ZIP' && template?.kind === 'AI' ? 'Illustrator bridge scripts exported. Run each JSX file in Illustrator and select the original AI template.' : `${format} export ready.`)
      setHistory((items) => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${employee.FULL_NAME} · ${format}`, ...items].slice(0, 8))
      try { await fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee: employee.FULL_NAME, format }) }) } catch { /* Export history stays in the current session. */ }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Export failed.') }
    finally { setExporting(false) }
  }

  const illustratorBridge = (person: Employee, sourceTexts: Partial<Record<Field, string>>, customEdits: TemplateTextEdit[] = [], textStyles: Partial<Record<Field, TextStyle>> = {}) => {
    const values = JSON.stringify({ FULL_NAME: formatVietnameseUppercase(person.FULL_NAME), POSITION: formatVietnameseUppercase(person.POSITION), EMPLOYEE_ID: person.EMPLOYEE_ID, PHONE_NUMBER: person.PHONE_NUMBER })
    const matches = JSON.stringify(sourceTexts)
    const extraTextEdits = JSON.stringify(customEdits)
    const styles = JSON.stringify(textStyles)
    return `#target illustrator
var values = ${values};
var suggestedMatches = ${matches};
var extraTextEdits = ${extraTextEdits};
var textStyles = ${styles};
var source = null;
var doc = null;
if (app.documents.length > 0 && confirm("Use the currently active Illustrator document (" + app.activeDocument.name + ")?")) {
  doc = app.activeDocument;
  try { source = doc.fullName; } catch (error) { doc = null; alert("Save the active Illustrator document before running this script."); }
} else {
  source = File.openDialog("Select the original Illustrator template", "Adobe Illustrator:*.ai");
  if (source && source.exists) {
    try { doc = app.open(source); } catch (error) { alert("Could not open selected Illustrator file: " + source.fsName + ". " + error); }
  } else if (source) alert("Selected Illustrator file was not found: " + source.fsName);
}
if (doc && source) {
  var keys = ["FULL_NAME", "POSITION", "EMPLOYEE_ID", "PHONE_NUMBER"];
  var matchText = {};
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var suggested = suggestedMatches[key] || "{{" + key + "}}";
    matchText[key] = prompt("Confirm the existing template text for " + key + ":", suggested);
  }
  function normalizeText(value) { return String(value || "").replace(/[\\r\\n\\t]+/g, " ").replace(/\\s+/g, " ").replace(/^\\s+|\\s+$/g, "").toLowerCase(); }
  function applyTextStyle(frame, style) {
    if (!style) return;
    var attributes = frame.textRange.characterAttributes;
    attributes.size = style.fontSize;
    attributes.fauxBold = style.bold;
    attributes.fauxItalic = style.italic;
    var family = String(style.fontFamily).split(",")[0].replace(/^\\s+|\\s+$/g, "").replace(/^['"]|['"]$/g, "");
    var selectedFont = null;
    for (var f = 0; f < app.textFonts.length; f++) {
      if (app.textFonts[f].family === family || app.textFonts[f].name === family) { selectedFont = app.textFonts[f]; break; }
    }
    if (selectedFont) attributes.textFont = selectedFont;
    else alert("Font not found in Illustrator: " + family + ". The existing font was kept.");
    var colorMatch = String(style.color).match(/^#([0-9a-f]{6})$/i);
    if (colorMatch) {
      var color = new RGBColor();
      color.red = parseInt(colorMatch[1].substr(0, 2), 16);
      color.green = parseInt(colorMatch[1].substr(2, 2), 16);
      color.blue = parseInt(colorMatch[1].substr(4, 2), 16);
      attributes.fillColor = color;
    }
    var justification = style.align === "center" ? Justification.CENTER : style.align === "right" ? Justification.RIGHT : Justification.LEFT;
    frame.textRange.paragraphAttributes.justification = justification;
  }
  for (var i = 0; i < doc.textFrames.length; i++) {
    var frame = doc.textFrames[i];
    for (var j = 0; j < keys.length; j++) {
      var field = keys[j];
      if (frame.name === field || frame.contents === "{{" + field + "}}" || (matchText[field] && normalizeText(frame.contents) === normalizeText(matchText[field]))) {
        frame.contents = values[field];
        applyTextStyle(frame, textStyles[field]);
      }
    }
    var normalizedFrameText = normalizeText(frame.contents);
    for (var e = 0; e < extraTextEdits.length; e++) {
      if (normalizeText(extraTextEdits[e].source) === normalizedFrameText) { frame.contents = extraTextEdits[e].value; applyTextStyle(frame, extraTextEdits[e].textStyle); break; }
    }
  }
  var photoFile = File.openDialog("Optional: choose a replacement photo for a placed item named PHOTO");
  if (photoFile) for (var p = 0; p < doc.placedItems.length; p++) {
    var placed = doc.placedItems[p];
    if (placed.name === "PHOTO" || placed.name === "{{PHOTO}}") placed.relink(photoFile);
  }
  var outputId = String(values.EMPLOYEE_ID || "employee");
  var safeOutputId = "";
  for (var c = 0; c < outputId.length; c++) {
    var character = outputId.charAt(c);
    safeOutputId += /[a-z0-9._-]/i.test(character) ? character : "_";
  }
  outputId = safeOutputId;
  var outputName = source.name.replace(/\\.ai$/i, "") + "-" + outputId + ".ai";
  var out = new File(source.parent.fsName + "/" + outputName);
  var options = new IllustratorSaveOptions(); options.pdfCompatible = true;
  doc.saveAs(out, options); alert("Saved editable Illustrator file: " + out.fsName);
}
`
  }

  const selectEmployee = (person: Employee) => setEmployee(person)
  const navItems = [{ label: 'Dashboard', icon: LayoutDashboard }, { label: 'Upload template', icon: CloudUpload }, { label: 'Employee editor', icon: Users }, { label: 'Template management', icon: FolderOpen }, { label: 'Export history', icon: History }, { label: 'Settings', icon: Settings }]
  const cardStyleVariables: CardStyleVariables = {}
  fields.forEach(({ key }) => {
    if (!textStyleOverrides[key]) return
    const style = resolveTextStyle(key, undefined, textStyleOverrides)
    const prefix = key === 'FULL_NAME' ? 'full-name' : key === 'POSITION' ? 'position' : key === 'EMPLOYEE_ID' ? 'employee-id' : 'phone-number'
    Object.assign(cardStyleVariables, {
      [`--${prefix}-font-family`]: style.fontFamily,
      [`--${prefix}-font-size`]: `${style.fontSize}px`,
      [`--${prefix}-font-weight`]: style.bold ? '700' : '400',
      [`--${prefix}-font-style`]: style.italic ? 'italic' : 'normal',
      [`--${prefix}-color`]: style.color,
      [`--${prefix}-align`]: style.align,
    })
  })

  return (
    <div className={dark ? 'app-shell dark' : 'app-shell'} onDragOver={(event) => event.preventDefault()}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">fn</div><div><strong>fieldnotes</strong><span>PEOPLE STUDIO</span></div><button className="collapse-button" title="Collapse sidebar"><ChevronLeft size={17} /></button></div>
        <div className="workspace-switch"><div className="workspace-avatar">F</div><div><strong>Fieldnotes Studio</strong><span>Free workspace</span></div><ChevronDown size={15} /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav.toLowerCase() === label.toLowerCase() ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveNav(label); if (label === 'Upload template') fileInput.current?.click() }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Export history' && history.length > 0 && <span className="nav-count">{history.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="storage-label"><span>Storage</span><span>LOCAL</span></div><div className="storage-track"><span /></div><div className="storage-caption">Saved in the workspace data volume</div><div className="sidebar-user"><div className="user-avatar">MA</div><div><strong>Minh Anh Nguyen</strong><span>Workspace admin</span></div><MoreHorizontal size={18} /></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div><div className="top-actions"><div className="status-chip"><span className="status-dot" /> All changes saved</div><button className="icon-button" title="Help"><CircleHelp size={18} /></button><button className="icon-button" title="Notifications"><Bell size={18} /></button><button className="theme-toggle" title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button><div className="top-avatar">MA</div></div></header>
        <section className="page-heading"><div><div className="eyebrow"><span>PEOPLE OPERATIONS</span><span className="eyebrow-dot">/</span><span>DESIGN WORKSPACE</span></div><h1>Employee editor</h1><p>Personalize your staff cards, then export print-ready files.</p></div><div className="heading-actions"><button className="button-secondary" onClick={() => csvInput.current?.click()}><Upload size={15} /> Import roster</button><button className="button-primary" onClick={() => void exportFile('AI')} disabled={exporting}><ArrowDownToLine size={16} /> Export card <ChevronDown size={14} /></button></div></section>

        <div className="editor-layout">
          <section className="form-column">
            <div className="section-title-row"><div><h2>Employee details</h2><p>Fields update your card preview instantly.</p></div><button className="more-button" title="More options"><MoreHorizontal size={19} /></button></div>
            <div className="employee-tabs"><div className="tabs-scroll">{employees.map((person, index) => <button key={`${person.EMPLOYEE_ID}-${index}`} className={person.EMPLOYEE_ID === employee.EMPLOYEE_ID ? 'employee-tab selected' : 'employee-tab'} onClick={() => selectEmployee(person)}><span className="tab-initials">{person.FULL_NAME.split(' ').map((word) => word[0]).slice(-2).join('')}</span>{person.FULL_NAME.split(' ').slice(-2).join(' ')}</button>)}</div><button className="add-tab" title="Add new employee" onClick={() => { const fresh = { PHOTO: '', FULL_NAME: '', POSITION: '', EMPLOYEE_ID: `EMP-${String(251 + employees.length).padStart(4, '0')}`, PHONE_NUMBER: '' }; setEmployees((current) => [...current, fresh]); setEmployee(fresh) }}><Plus size={16} /></button></div>
            <div className="form-card">
              <div className="form-card-heading"><div><h3>Personal information</h3><span>EMPLOYEE RECORD</span></div><span className="record-state"><span /> Active</span></div>
              <div className="field-label photo-label">Photo <span>JPG or PNG · max 10 MB</span></div>
              <div className="photo-uploader" onClick={() => photoInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const f = event.dataTransfer.files[0]; if (f) { const dt = new DataTransfer(); dt.items.add(f); if (photoInput.current) { photoInput.current.files = dt.files; photoInput.current.dispatchEvent(new Event('change', { bubbles: true })) } } }}>
                <div className="photo-thumb">{photo ? <img src={photo} alt="Employee" /> : <UserRound size={23} />}</div><div className="photo-copy"><strong>{photo ? 'Photo uploaded' : 'Upload employee photo'}</strong><span>Drag a file here or <b>browse</b></span></div><button className="upload-icon" title="Browse photo"><ImagePlus size={17} /></button>
              </div>
              <div className="input-fields">{fields.map(({ key, label, icon: Icon }) => {
                const style = resolveTextStyle(key, template?.objects.find((object) => object.id === mapping[key]), textStyleOverrides)
                return <div className="employee-field" key={key}>
                  <label className="field-label">{label}<span className="input-wrap"><Icon size={16} /><input className={key === 'FULL_NAME' || key === 'POSITION' ? 'uppercase-input' : undefined} value={employee[key]} onChange={(event) => updateEmployee(key, event.target.value)} onBlur={(event) => { if (key === 'FULL_NAME' || key === 'POSITION') updateEmployee(key, formatVietnameseUppercase(event.currentTarget.value)) }} placeholder={`Enter ${label.toLowerCase()}`} /></span></label>
                  <TypographyEditor fieldLabel={label} style={style} onChange={(changes) => setTextStyleOverrides((current) => ({ ...current, [key]: { ...current[key], ...changes } }))} onReset={() => setTextStyleOverrides((current) => { const next = { ...current }; delete next[key]; return next })} />
                </div>
              })}</div>
              <div className="crop-controls"><div><strong>Photo framing</strong><span>Drag in the preview to reposition</span></div><div className="crop-tools"><button title="Zoom out" onClick={() => setPhotoZoom((v) => Math.max(.8, v - .1))}><ZoomOut size={15} /></button><input aria-label="Photo zoom" type="range" min="80" max="180" value={photoZoom * 100} onChange={(event) => setPhotoZoom(Number(event.target.value) / 100)} /><button title="Zoom in" onClick={() => setPhotoZoom((v) => Math.min(1.8, v + .1))}><ZoomIn size={15} /></button></div></div>
              <div className="form-footer"><button className="button-plain" onClick={() => { setEmployee(initialEmployee); setPhotoZoom(1); setPhotoOffset({ x: 0, y: 0 }) }}><RotateCcw size={15} /> Reset</button><button className="button-secondary" onClick={() => { setEmployees((current) => [...current, { ...employee, EMPLOYEE_ID: `${employee.EMPLOYEE_ID}-COPY` }]); setNotice('Employee duplicated.') }}><Copy size={15} /> Duplicate</button><button className="button-save" onClick={() => void saveChanges()}><Save size={15} /> Save changes</button></div>
            </div>
            {pageTextFields.length > 0 && <div className="mapping-card"><div className="mapping-heading"><FileText size={16} /><div><strong>Page {previewPage} text fields</strong><span>Edit each text field and its typography; changes appear in the preview and exports.</span></div></div><div className="input-fields">{pageTextFields.map((object, index) => {
              const label = `Page ${previewPage} text ${index + 1}`
              const style = resolveTextStyle('FULL_NAME', object, textStyleOverrides, object.id)
              return <div className="employee-field" key={object.id}>
                <label className="field-label">{`Text ${index + 1} · ${object.value}`}<span className="input-wrap"><FileText size={16} /><input aria-label={label} value={pageTextValues[object.id] ?? object.value} onChange={(event) => setPageTextValues((current) => ({ ...current, [object.id]: event.target.value }))} /></span></label>
                <TypographyEditor fieldLabel={label} style={style} onChange={(changes) => setTextStyleOverrides((current) => ({ ...current, [object.id]: { ...current[object.id], ...changes } }))} onReset={() => setTextStyleOverrides((current) => { const next = { ...current }; delete next[object.id]; return next })} />
              </div>
            })}</div></div>}
            {(template?.kind === 'SVG' || (template?.kind === 'AI' && template.preview)) && <div className="mapping-card"><div className="mapping-heading"><Link2 size={16} /><div><strong>Template field mapping</strong><span>{template.kind === 'AI' ? 'Match PDF-detected text to Illustrator text frames.' : 'Connect detected text and image objects to employee fields.'}</span></div></div>{template.kind === 'SVG' && <label className="mapping-row"><span>Photo</span><select value={mapping.PHOTO} onChange={(event) => setMapping((current) => ({ ...current, PHOTO: event.target.value }))}><option value="">Not mapped</option>{template.objects.filter((object) => object.type === 'image').map((object) => <option value={object.id} key={object.id}>{object.label}</option>)}</select></label>}{fields.map(({ key, label }) => <label className="mapping-row" key={key}><span>{label}</span><select value={mapping[key]} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}><option value="">Not mapped</option>{template.objects.filter((object) => object.type === 'text').map((object) => <option value={object.id} key={object.id}>{object.label}</option>)}</select></label>)}</div>}
            <div className="bulk-card"><div className="bulk-icon"><Grid2X2 size={17} /></div><div className="bulk-copy"><strong>Working with a team?</strong><span>Import a spreadsheet to create cards in bulk.</span></div><button className="bulk-button" onClick={() => csvInput.current?.click()}>Import CSV / Excel <ChevronRight size={14} /></button></div>
          </section>

          <section className="preview-column">
            <div className="preview-heading"><div><h2>{template?.kind === 'AI' ? 'Original artwork preview' : 'Live preview'}</h2><div className="template-info"><span className="template-dot" /> {template?.name || 'Fieldnotes staff card'} <span className="template-sep">·</span> {template ? `${template.width} × ${template.height} ${template.kind === 'SVG' ? 'px' : 'pt'}` : 'Landscape · 3.5 × 2 in'}</div></div><button className="more-button" title="Preview options"><MoreHorizontal size={19} /></button></div>
            <div className={`preview-board ${isDragging ? 'dragging' : ''}`} onDragEnter={() => setIsDragging(true)} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onDoubleClick={() => fileInput.current?.click()}>
              <div className="board-topline"><span><span className="board-live-dot" /> LIVE CANVAS</span><span>100% · RGB</span></div>
              <div className="artboard-wrap" style={{ transform: `scale(${zoom / 100})`, aspectRatio: template?.preview ? `${template.width}/${template.height}` : undefined, ...cardStyleVariables, ...(template?.preview && template.height > template.width ? { width: 'auto', height: '82%' } : {}) }}>
                {template?.preview ? <img className="imported-svg-preview" src={template.pages?.[previewPage - 1] || template.preview} alt={`${template.name} page ${previewPage}`} /> : template?.kind === 'SVG' && previewSvg ? <img className="imported-svg-preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(showOriginal ? template.source : previewSvg)}`} alt={showOriginal ? 'Original template preview' : 'Edited template preview'} /> : template?.kind === 'AI' ? <div className="preview-unavailable"><FileText size={28} /><strong>No PDF-compatible preview</strong><span>This AI file is saved unchanged. Open it in Illustrator to inspect and edit its artwork.</span></div> : <div className="staff-card"><div className="card-brand"><div className="brand-line"><span>FIELDNOTES</span><span className="brand-symbol">✳</span></div><small>PEOPLE MAKE THE PLACE</small></div><div className="card-body"><div className="portrait-frame" onPointerDown={(event) => { if (!photo) return; event.currentTarget.setPointerCapture(event.pointerId); const start = { x: event.clientX - photoOffset.x, y: event.clientY - photoOffset.y }; const move = (e: PointerEvent) => setPhotoOffset({ x: e.clientX - start.x, y: e.clientY - start.y }); const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end) }} title={photo ? 'Drag photo to reposition' : 'Upload a photo to preview'}>{previewEmployee.PHOTO ? <img style={{ transform: `translate(${photoOffset.x}px, ${photoOffset.y}px) scale(${photoZoom})` }} src={previewEmployee.PHOTO} alt="Employee portrait" /> : <div className="portrait-placeholder"><UserRound size={42} strokeWidth={1.2} /><span>PHOTO</span></div>}<div className="portrait-corner" /></div><div className="card-copy"><span className="card-eyebrow">TEAM MEMBER</span><h3>{previewEmployee.FULL_NAME || 'Your Name Here'}</h3><p className="card-position">{previewEmployee.POSITION || 'Your role'}</p><div className="card-divider" /><div className="card-meta"><div><small>EMPLOYEE ID</small><span>{previewEmployee.EMPLOYEE_ID || 'EMP-0000'}</span></div><div><small>PHONE</small><span>{previewEmployee.PHONE_NUMBER || '+84 000 000 000'}</span></div></div></div></div><div className="card-bottom"><span>FIELDNOTES.STUDIO</span><span className="bottom-mark">FN / 24</span></div></div>}
                {template?.kind === 'AI' && template.preview && <svg className="ai-live-overlay" width={template.width} height={template.height} viewBox={`0 0 ${template.width} ${template.height}`} preserveAspectRatio="none" role="img" aria-label="Live employee card preview"><title>Edited employee card preview</title><g dangerouslySetInnerHTML={{ __html: createLiveOverlayMarkup(template, employee, liveTextOverlays, photoZoom, photoOffset, previewPage) }} />{employee.PHOTO && template.photoFrame?.page === previewPage && <circle cx={template.photoFrame.x + template.photoFrame.width / 2} cy={template.photoFrame.y + template.photoFrame.height / 2} r={Math.min(template.photoFrame.width, template.photoFrame.height) * 0.47} fill="transparent" pointerEvents="all" style={{ cursor: 'grab' }} onPointerDown={(event) => { const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect(); const scaleX = template.width / bounds.width; const scaleY = template.height / bounds.height; const startX = event.clientX; const startY = event.clientY; const initial = photoOffset; const move = (pointer: PointerEvent) => setPhotoOffset({ x: initial.x + (pointer.clientX - startX) * scaleX, y: initial.y - (pointer.clientY - startY) * scaleY }); const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }) }} />}</svg>}
                {isDragging && <div className="drop-overlay"><CloudUpload size={28} /><strong>Drop your template here</strong><span>SVG, PDF, or Adobe Illustrator</span></div>}
              </div>
              <div className="board-corner bottom-left">{template?.pages ? `PAGE ${previewPage} / ${template.pages.length}` : 'ARTBOARD 01'}</div><div className="board-corner bottom-right">W {template?.width || 1050} · H {template?.height || 600}</div>
            </div>
            <div className="preview-toolbar"><div className="zoom-tools"><button title="Zoom out" onClick={() => setZoom((v) => Math.max(50, v - 10))}><ZoomOut size={16} /></button><span>{zoom}%</span><button title="Zoom in" onClick={() => setZoom((v) => Math.min(140, v + 10))}><ZoomIn size={16} /></button><i /><button title="Fit to screen" onClick={() => setZoom(100)}><span className="fit-icon">□</span></button></div>{template?.pages && template.pages.length > 1 && <div className="page-switch"><button title="Previous page" disabled={previewPage <= 1} onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}><ChevronLeft size={14} /></button><span>{previewPage} / {template.pages.length}</span><button title="Next page" disabled={previewPage >= template.pages.length} onClick={() => setPreviewPage((page) => Math.min(template.pages!.length, page + 1))}><ChevronRight size={14} /></button></div>}<div className="canvas-actions"><button className={showOriginal ? 'compare-button enabled' : 'compare-button'} disabled={template?.kind === 'AI'} onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)}><ArrowLeftRight size={14} /> Hold to compare</button><button className="export-menu" disabled={exporting} onClick={() => void exportFile('PNG')}><ArrowDownToLine size={15} /> {exporting ? 'Exporting…' : 'Export'} <ChevronDown size={13} /></button></div></div>
            <div className="template-drop" onClick={() => fileInput.current?.click()}><div className="drop-icon"><FilePlus2 size={17} /></div><div><strong>{template ? template.name : 'Drop your own template'}</strong><span>{template ? template.kind === 'AI' ? 'PDF-compatible preview · text edits are applied in Illustrator' : 'Click to replace template · SVG objects are editable' : 'SVG is editable here · AI/PDF retained as source assets'}</span></div><button className="browse-button">Browse files <ChevronRight size={14} /></button></div>
            {template?.kind !== 'SVG' && template && <div className="ai-notice"><ShieldCheck size={17} /><span><strong>Original artwork is shown above.</strong> Text edits update the live preview and PNG/PDF exports. To change the native Illustrator text objects, export the JSX bridge, run it in Illustrator, confirm each detected source text, then save the edited .AI copy. Photo relinking requires a placed image named PHOTO in Illustrator.</span></div>}
          </section>
        </div>

        <section className="bottom-row"><div className="roster-panel"><div className="panel-heading"><div><h2>Roster preview</h2><span>{employees.length} employees · ready to export</span></div><div className="roster-actions"><div className="search-box"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" /></div><button className="button-secondary compact" onClick={() => csvInput.current?.click()}><Plus size={14} /> Add people</button></div></div><div className="roster-table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>POSITION</th><th>ID</th><th>PHONE</th><th>STATUS</th><th /></tr></thead><tbody>{employees.filter((person) => `${person.FULL_NAME} ${person.EMPLOYEE_ID}`.toLowerCase().includes(search.toLowerCase())).map((person, index) => <tr key={`${person.EMPLOYEE_ID}-${index}`} onClick={() => selectEmployee(person)}><td><span className="table-person"><span className="table-avatar">{person.FULL_NAME.split(' ').map((word) => word[0]).slice(-2).join('')}</span><strong>{person.FULL_NAME || 'Unnamed employee'}</strong></span></td><td>{person.POSITION || '—'}</td><td className="mono-cell">{person.EMPLOYEE_ID || '—'}</td><td>{person.PHONE_NUMBER || '—'}</td><td><span className="ready-pill"><Check size={12} /> Ready</span></td><td><button className="table-delete" title="Remove employee" onClick={(event) => { event.stopPropagation(); setEmployees((items) => items.filter((_, i) => i !== index)) }}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div><button className="roster-import" onClick={() => csvInput.current?.click()}><Plus size={14} /> Import another roster</button></div>
          <aside className="export-panel"><div className="export-panel-heading"><div className="export-orbit"><ArrowDownToLine size={18} /></div><div><h3>Ready to print</h3><span>Choose an output format</span></div></div><div className="format-list">{[{ format: 'AI', title: 'Adobe Illustrator', sub: 'Downloads .jsx; run in Illustrator to save .ai', icon: FileText, tag: 'JSX' }, { format: 'PDF', title: 'Print-ready PDF', sub: template?.kind === 'AI' ? 'Current preview page' : 'Print-sized PDF', icon: FileText }, { format: 'PNG', title: 'High-res PNG', sub: template?.kind === 'AI' ? 'Current preview page' : '2× resolution', icon: FileImage }, { format: 'SVG', title: 'Scalable vector', sub: 'Best for digital use', icon: Activity }].map(({ format, title, sub, icon: Icon, tag }) => <button className="format-option" key={format} disabled={(format === 'SVG' && (template?.kind === 'AI' || template?.kind === 'PDF')) || exporting} onClick={() => void exportFile(format)}><span className="format-icon"><Icon size={16} /></span><span className="format-copy"><strong>{title}</strong><small>{sub}</small></span>{tag && <span className="format-tag">{tag}</span>}<ChevronRight size={14} /></button>)}</div><button className="bulk-export" onClick={() => void exportFile('ZIP')}><FileArchive size={16} /> {template?.kind === 'AI' ? `Export ${employees.length} JSX bridges as ZIP` : `Export all ${employees.length} as ZIP`} <ArrowDownToLine size={15} /></button><div className="export-footnote"><ShieldCheck size={13} /> Files processed locally in your browser</div></aside>
          <aside className="history-panel"><div className="history-heading"><h3>Recent exports</h3><button title="View export history" onClick={() => setActiveNav('Export history')}><History size={15} /></button></div>{history.length ? history.slice(0, 5).map((entry, index) => <div className="history-item" key={`${entry}-${index}`}><span className="history-file"><FileText size={14} /></span><span>{entry}</span></div>) : <div className="history-empty"><History size={19} /><span>Your exports will appear here</span></div>}<button className="history-link" onClick={() => setActiveNav('Export history')}>View export history <ChevronRight size={13} /></button></aside>
        </section>
        <footer className="page-footer"><span><Activity size={13} /> FIELDNOTES STUDIO <span className="footer-sep">/</span> DESIGNED FOR PEOPLE OPS</span><span>v1.0.0 <span className="footer-sep">·</span> <button onClick={() => setNotice('Files are processed in the browser first. Stored templates can be removed from Template management.')}>Privacy & security</button></span></footer>
      </main>
      <input ref={fileInput} className="hidden-input" type="file" accept=".svg,.pdf,.ai,image/svg+xml,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveTemplate(file); event.target.value = '' }} />
      <input ref={photoInput} className="hidden-input" type="file" accept="image/jpeg,image/png" onChange={importPhoto} />
      <input ref={csvInput} className="hidden-input" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void importRoster(event)} />
      {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice('')} title="Dismiss"><X size={15} /></button></div>}
    </div>
  )
}

export default App
