import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import multer from 'multer'

type TemplateRecord = { id: string; name: string; file: string; size: number; createdAt: string }
type ExportRecord = { id: string; employee: string; format: string; createdAt: string }
type Store = { templates: TemplateRecord[]; employees: Record<string, unknown>[]; exports: ExportRecord[] }

const app = express()
const port = Number(process.env.PORT || 3001)
const dataDir = path.resolve(process.env.DATA_DIR || './data')
const uploadDir = path.join(dataDir, 'templates')
const storePath = path.join(dataDir, 'store.json')
const allowedExtensions = new Set(['.svg', '.pdf', '.ai'])

await fs.mkdir(uploadDir, { recursive: true })
let store: Store = { templates: [], employees: [], exports: [] }
try {
  store = { ...store, ...JSON.parse(await fs.readFile(storePath, 'utf8')) as Partial<Store> }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

async function persist() {
  const temporary = `${storePath}.tmp`
  await fs.writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 })
  await fs.rename(temporary, storePath)
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDir),
    filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    if (!allowedExtensions.has(extension)) return callback(new Error('Only SVG, PDF, and AI files are accepted.'))
    callback(null, true)
  },
})

app.disable('x-powered-by')
app.use(express.json({ limit: '15mb' }))
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/templates', (_request, response) => response.json(store.templates))
app.post('/api/templates', upload.single('template'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'Template file is required.' })
    const record = { id: path.parse(request.file.filename).name, name: path.basename(request.file.originalname), file: request.file.filename, size: request.file.size, createdAt: new Date().toISOString() }
    store.templates.unshift(record)
    await persist()
    response.status(201).json(record)
  } catch (error) { next(error) }
})
app.get('/api/templates/:id/file', (request, response) => {
  const record = store.templates.find((item) => item.id === request.params.id)
  if (!record) return response.sendStatus(404)
  response.type(path.extname(record.file) === '.svg' ? 'image/svg+xml' : 'application/octet-stream')
  response.attachment(record.name)
  response.sendFile(path.join(uploadDir, record.file))
})
app.delete('/api/templates/:id', async (request, response, next) => {
  try {
    const record = store.templates.find((item) => item.id === request.params.id)
    if (!record) return response.sendStatus(404)
    store.templates = store.templates.filter((item) => item.id !== record.id)
    await fs.rm(path.join(uploadDir, record.file), { force: true })
    await persist()
    response.sendStatus(204)
  } catch (error) { next(error) }
})
app.post('/api/employees', async (request, response, next) => {
  try {
    const employee = request.body as Record<string, unknown>
    const fields = ['FULL_NAME', 'POSITION', 'EMPLOYEE_ID', 'PHONE_NUMBER']
    if (!employee || fields.some((field) => typeof employee[field] !== 'string')) return response.status(400).json({ error: 'Employee fields must be strings.' })
    if (typeof employee.PHOTO !== 'string' || employee.PHOTO.length > 14 * 1024 * 1024 || (employee.PHOTO && !/^data:image\/(png|jpeg);base64,/i.test(employee.PHOTO))) return response.status(400).json({ error: 'Photo must be a PNG/JPEG data URL under 10 MB.' })
    const id = String(employee.EMPLOYEE_ID || '')
    const index = store.employees.findIndex((item) => item.EMPLOYEE_ID === id)
    if (index >= 0) store.employees[index] = employee
    else store.employees.unshift(employee)
    await persist()
    response.status(201).json({ saved: true })
  } catch (error) { next(error) }
})
app.get('/api/employees', (_request, response) => response.json(store.employees))
app.delete('/api/employees/:id', async (request, response, next) => {
  try {
    store.employees = store.employees.filter((employee) => employee.EMPLOYEE_ID !== request.params.id)
    await persist()
    response.sendStatus(204)
  } catch (error) { next(error) }
})
app.post('/api/exports', async (request, response, next) => {
  try {
    const { employee, format } = request.body as { employee?: unknown; format?: unknown }
    if (typeof employee !== 'string' || typeof format !== 'string' || !['AI', 'PDF', 'PNG', 'SVG', 'ZIP'].includes(format)) return response.status(400).json({ error: 'Invalid export record.' })
    const record = { id: crypto.randomUUID(), employee: employee.slice(0, 120), format, createdAt: new Date().toISOString() }
    store.exports.unshift(record)
    store.exports = store.exports.slice(0, 100)
    await persist()
    response.status(201).json(record)
  } catch (error) { next(error) }
})
app.get('/api/exports', (_request, response) => response.json(store.exports))
app.delete('/api/exports', async (_request, response, next) => {
  try { store.exports = []; await persist(); response.sendStatus(204) } catch (error) { next(error) }
})

if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve('./dist')
  app.use(express.static(distDir, { index: false, dotfiles: 'deny' }))
  app.get('*path', (_request, response) => response.sendFile(path.join(distDir, 'index.html')))
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error.'
  const status = error instanceof multer.MulterError ? 400 : 400
  response.status(status).json({ error: message })
})

app.listen(port, '0.0.0.0', () => console.log(`Staff card API listening on ${port}`))
