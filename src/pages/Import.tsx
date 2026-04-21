import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { Upload, FileText, AlertCircle, CheckCircle, ChevronRight, X } from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { Series, CollectionEntry, ReadingStatus, Language, Format, Demographic } from '../types'

const APP_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'title', label: 'Title', required: true },
  { key: 'author', label: 'Author' },
  { key: 'volumes_owned', label: 'Volumes Owned' },
  { key: 'total_volumes', label: 'Total Volumes' },
  { key: 'reading_status', label: 'Reading Status' },
  { key: 'rating', label: 'Rating' },
  { key: 'language', label: 'Language' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'format', label: 'Format' },
  { key: 'notes', label: 'Notes' },
  { key: 'genre', label: 'Genre' },
  { key: 'demographic', label: 'Demographic' },
]

type AppFieldKey = string

const AUTO_MATCH: Record<string, AppFieldKey> = {
  title: 'title', series: 'title', name: 'title', manga: 'title',
  author: 'author', writer: 'author', creator: 'author',
  volumes: 'volumes_owned', owned: 'volumes_owned', vol_owned: 'volumes_owned', volumes_owned: 'volumes_owned',
  total: 'total_volumes', total_volumes: 'total_volumes', vol_total: 'total_volumes',
  status: 'reading_status', reading_status: 'reading_status', read_status: 'reading_status',
  rating: 'rating', score: 'rating', rank: 'rating',
  language: 'language', lang: 'language',
  publisher: 'publisher', pub: 'publisher',
  format: 'format', type: 'format', edition: 'format',
  notes: 'notes', note: 'notes', comments: 'notes',
  genre: 'genre', genres: 'genre', tags: 'genre',
  demographic: 'demographic', demo: 'demographic', audience: 'demographic',
}

const READING_STATUS_MAP: Record<string, ReadingStatus> = {
  reading: 'Reading', 'in progress': 'Reading', current: 'Reading',
  completed: 'Completed', complete: 'Completed', finished: 'Completed', done: 'Completed',
  'plan to read': 'Plan to Read', ptр: 'Plan to Read', backlog: 'Plan to Read', 'want to read': 'Plan to Read',
  dropped: 'Dropped', dnf: 'Dropped',
  'on hold': 'On Hold', paused: 'On Hold', hold: 'On Hold',
}

type Step = 'upload' | 'mapping' | 'preview' | 'done'

export default function Import() {
  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<AppFieldKey, string>>({} as Record<AppFieldKey, string>)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const { importEntries } = useCollectionStore()

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        setCsvHeaders(headers)
        setCsvData(results.data as Record<string, string>[])

        // Auto-map columns
        const autoMapping: Partial<Record<AppFieldKey, string>> = {}
        headers.forEach(h => {
          const normalized = h.toLowerCase().trim().replace(/\s+/g, '_')
          const match = AUTO_MATCH[normalized]
          if (match) autoMapping[match] = h
        })
        setMapping(autoMapping as Record<AppFieldKey, string>)
        setStep('mapping')
      }
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const handleImport = async () => {
    setImporting(true)
    const titleCol = mapping['title']
    if (!titleCol) return

    const importData = csvData.map(row => {
      const rawStatus = row[mapping['reading_status']]?.toLowerCase().trim()
      const readingStatus: ReadingStatus = READING_STATUS_MAP[rawStatus] || 'Plan to Read'
      const volsOwned = parseInt(row[mapping['volumes_owned']]) || 0
      const totalVols = parseInt(row[mapping['total_volumes']]) || null
      const rating = parseFloat(row[mapping['rating']]) || null
      const clampedRating = rating ? Math.min(10, Math.max(1, rating)) : null

      const series: Omit<Series, 'id' | 'created_at' | 'updated_at'> = {
        title: row[titleCol]?.trim() || '',
        author: row[mapping['author']]?.trim() || null,
        artist: null,
        publisher: row[mapping['publisher']]?.trim() || null,
        original_publisher: null,
        demographic: (row[mapping['demographic']]?.trim().toLowerCase() as Demographic) || null,
        genre: row[mapping['genre']] ? row[mapping['genre']].split(',').map(g => g.trim()).filter(Boolean) : [],
        total_volumes: totalVols,
        total_pages: totalVols ? totalVols * 200 : null,
        status: 'Unknown' as any,
        language: (row[mapping['language']]?.trim() as Language) || 'English',
        format: (row[mapping['format']]?.trim() as Format) || 'Single',
        isbn: null,
        upc: null,
        msrp: null,
        cover_image_url: null,
        description: null,
        mal_id: null,
      }

      const entry: Omit<CollectionEntry, 'id' | 'series_id' | 'series'> = {
        volumes_owned: volsOwned,
        volumes_read: 0,
        reading_status: readingStatus,
        rating: clampedRating,
        notes: row[mapping['notes']]?.trim() || null,
        date_added: new Date().toISOString().split('T')[0],
        wishlist: false,
        is_complete_in_collection: totalVols ? volsOwned >= totalVols : false,
      }

      return { series, entry }
    })

    const res = await importEntries(importData)
    setResult(res)
    setImporting(false)
    setStep('done')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Import CSV</h1>
        <p className="text-ink-400">Upload your existing spreadsheet data to populate your collection.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {(['upload', 'mapping', 'preview', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === s ? 'bg-accent-600 text-white' :
              (['upload', 'mapping', 'preview', 'done'].indexOf(step) > i) ? 'bg-accent-800 text-accent-400' :
              'bg-ink-800 text-ink-500'
            }`}>{i + 1}</div>
            <span className={`capitalize hidden sm:block ${step === s ? 'text-white' : 'text-ink-500'}`}>{s}</span>
            {i < 3 && <ChevronRight size={14} className="text-ink-700" />}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragOver ? 'border-accent-500 bg-accent-600/10' : 'border-ink-700 hover:border-ink-500'
          }`}
        >
          <Upload size={40} className="mx-auto mb-4 text-ink-500" />
          <p className="text-white font-semibold mb-1">Drop your CSV file here</p>
          <p className="text-ink-400 text-sm mb-6">or click to browse</p>
          <label className="btn-primary cursor-pointer">
            Choose File
            <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
          <p className="text-ink-600 text-xs mt-6">Supported: .csv files with any column names — you'll map them next</p>
        </div>
      )}

      {/* Step: Mapping */}
      {step === 'mapping' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText size={20} className="text-accent-500" />
            <div>
              <p className="text-white font-semibold">Map Your Columns</p>
              <p className="text-ink-400 text-sm">{csvData.length} rows found — match your CSV columns to the app's fields</p>
            </div>
          </div>

          <div className="grid gap-3 mb-8">
            {APP_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-36 text-sm text-ink-300 flex-shrink-0">
                  {label}{required && <span className="text-accent-500 ml-1">*</span>}
                </label>
                <select
                  value={mapping[key] || ''}
                  onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                  className="input flex-1"
                >
                  <option value="">— skip —</option>
                  {csvHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
            <button
              onClick={() => setStep('preview')}
              disabled={!mapping['title']}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview Import
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="card p-6">
          <p className="text-white font-semibold mb-4">Preview — First 5 rows</p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-800">
                  {APP_FIELDS.filter(f => mapping[f.key]).map(f => (
                    <th key={f.key} className="text-left py-2 px-3 text-ink-400 font-medium">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-ink-800/50">
                    {APP_FIELDS.filter(f => mapping[f.key]).map(f => (
                      <td key={f.key} className="py-2 px-3 text-ink-200 truncate max-w-32">{row[mapping[f.key]] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-ink-800 rounded-lg p-4 mb-6">
            <p className="text-ink-300 text-sm"><span className="text-white font-semibold">{csvData.length}</span> total rows will be imported</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('mapping')} className="btn-secondary">Back</button>
            <button onClick={handleImport} disabled={importing} className="btn-primary disabled:opacity-50">
              {importing ? 'Importing...' : `Import ${csvData.length} Series`}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result && (
        <div className="card p-8 text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-bold text-white mb-2">Import Complete!</h2>
          <p className="text-ink-300 mb-6">
            <span className="text-green-400 font-semibold">{result.imported}</span> series imported
            {result.skipped > 0 && <>, <span className="text-accent-400 font-semibold">{result.skipped}</span> skipped (missing title)</>}
          </p>
          {result.skipped > 0 && (
            <div className="flex items-center gap-2 bg-accent-900/30 border border-accent-800 rounded-lg p-3 mb-6 text-sm text-accent-300">
              <AlertCircle size={16} />
              Rows without a title were skipped.
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setCsvData([]); setCsvHeaders([]); setMapping({} as any) }} className="btn-secondary">
              Import Another File
            </button>
            <a href="/collection" className="btn-primary">View My Collection</a>
          </div>
        </div>
      )}
    </div>
  )
}
