import { useRef, useEffect, useState, useCallback } from 'react'
import { Scan, Loader2 } from 'lucide-react'

interface USBScannerInputProps {
  onScan: (isbn: string) => void
  loading?: boolean
  onCameraMode?: () => void
  hasCameraSupport?: boolean
}

const ISBN_REGEX = /^\d{10}(\d{3})?$/

// Timing threshold: keystrokes faster than this (ms) = scanner, not human
const SCANNER_KEYSTROKE_THRESHOLD_MS = 50
// After this much silence, auto-trigger if we have a valid ISBN (handles scanners with no Enter)
const AUTO_TRIGGER_DEBOUNCE_MS = 300

export default function USBScannerInput({
  onScan,
  loading = false,
  onCameraMode,
  hasCameraSupport = false,
}: USBScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastKeyTimeRef = useRef<number>(0)
  const isScannedInputRef = useRef<boolean>(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [value, setValue] = useState('')
  const [flashError, setFlashError] = useState(false)

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function triggerLookup(isbn: string) {
    const clean = isbn.replace(/[-\s]/g, '')
    if (!ISBN_REGEX.test(clean)) {
      setFlashError(true)
      setTimeout(() => setFlashError(false), 600)
      return
    }
    setValue('')
    onScan(clean)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()
    const gap = now - lastKeyTimeRef.current
    lastKeyTimeRef.current = now

    // If keystrokes are very fast, flag this as scanner input
    if (gap < SCANNER_KEYSTROKE_THRESHOLD_MS) {
      isScannedInputRef.current = true
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      const current = (e.target as HTMLInputElement).value
      triggerLookup(current)
      isScannedInputRef.current = false
      return
    }

    // Reset scanner flag on slow typing (human pace)
    if (gap > SCANNER_KEYSTROKE_THRESHOLD_MS * 3) {
      isScannedInputRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setValue(raw)

    // Clear any pending auto-trigger
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    // Auto-trigger after silence if it looks like scanner input
    if (isScannedInputRef.current) {
      debounceTimerRef.current = setTimeout(() => {
        const clean = raw.replace(/[-\s]/g, '')
        if (ISBN_REGEX.test(clean)) {
          triggerLookup(clean)
          isScannedInputRef.current = false
        }
      }, AUTO_TRIGGER_DEBOUNCE_MS)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto px-4 py-8">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-accent-600/20 border border-accent-600/30 flex items-center justify-center">
        <Scan size={28} className="text-accent-400" />
      </div>

      <div className="text-center">
        <h2 className="text-white font-semibold text-lg">USB Barcode Scanner</h2>
        <p className="text-ink-400 text-sm mt-1">
          Plug in your scanner, then point it at any manga barcode — it'll appear here automatically.
        </p>
      </div>

      {/* Input */}
      <div className="w-full relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Scan barcode or type ISBN…"
          disabled={loading}
          className={`input w-full pr-10 text-center tracking-widest transition-colors ${
            flashError ? 'border-red-500 bg-red-900/20' : ''
          }`}
        />
        {loading && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 animate-spin"
          />
        )}
      </div>

      <p className="text-ink-600 text-xs text-center">
        ISBN-10 or ISBN-13 · Press Enter or just scan
      </p>

      {hasCameraSupport && onCameraMode && (
        <>
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-ink-800" />
            <span className="text-ink-600 text-xs">or</span>
            <div className="flex-1 h-px bg-ink-800" />
          </div>
          <button onClick={onCameraMode} className="btn-secondary w-full text-sm">
            📷 Use Camera Instead
          </button>
        </>
      )}
    </div>
  )
}
