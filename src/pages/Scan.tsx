import { lazy, Suspense, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ScanLine as ScanIcon, Loader2, AlertCircle } from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { GoogleBooksVolume } from '../types'
import USBScannerInput from '../components/BarcodeScanner/USBScannerInput'
import ScanResultModal from '../components/BarcodeScanner/ScanResultModal'

// Lazy-load the camera components so ZXing (~120kb) doesn't bloat initial bundle
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner/BarcodeScanner'))
const ScanOverlay = lazy(() => import('../components/BarcodeScanner/ScanOverlay'))

type ScanMode = 'usb' | 'camera'
type PageState = 'idle' | 'scanning' | 'looking-up' | 'confirm' | 'error'

// Detect if device likely has a usable rear camera (mobile/tablet)
function detectMobileCamera(): boolean {
  if (typeof navigator === 'undefined') return false
  const hasTouchscreen = navigator.maxTouchPoints > 0
  const isNarrow = window.innerWidth < 1024
  return hasTouchscreen && isNarrow
}

export default function Scan() {
  const navigate = useNavigate()
  const { lookupByISBN } = useCollectionStore()

  const isMobile = detectMobileCamera()
  const [mode, setMode] = useState<ScanMode>(isMobile ? 'camera' : 'usb')
  const [pageState, setPageState] = useState<PageState>(isMobile ? 'scanning' : 'idle')
  const [result, setResult] = useState<GoogleBooksVolume | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const handleScan = useCallback(async (isbn: string) => {
    setPageState('looking-up')
    setLookupError(null)

    const book = await lookupByISBN(isbn)

    if (book) {
      setResult(book)
      setPageState('confirm')
    } else {
      setLookupError(`No book found for ISBN ${isbn}. Try scanning again or enter the title manually.`)
      setPageState('error')
    }
  }, [lookupByISBN])

  function handleRescan() {
    setResult(null)
    setLookupError(null)
    setPageState(mode === 'camera' ? 'scanning' : 'idle')
  }

  function handleAdded() {
    navigate('/collection')
  }

  function switchToCamera() {
    setMode('camera')
    setPageState('scanning')
    setLookupError(null)
  }

  function switchToUSB() {
    setMode('usb')
    setPageState('idle')
    setLookupError(null)
  }

  const isLookingUp = pageState === 'looking-up'

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Camera mode ──────────────────────────────────────────────── */}
      {mode === 'camera' && (
        <div className="relative flex-1 bg-black" style={{ minHeight: '100dvh' }}>
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={32} className="text-accent-400 animate-spin" />
              </div>
            }
          >
            {pageState === 'scanning' && (
              <BarcodeScanner
                active={pageState === 'scanning'}
                onScan={handleScan}
              />
            )}
            <ScanOverlay
              onCancel={() => navigate(-1)}
            />
          </Suspense>

          {/* Looking-up overlay */}
          {isLookingUp && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-20">
              <Loader2 size={36} className="text-accent-400 animate-spin" />
              <p className="text-white font-medium">Looking up book…</p>
            </div>
          )}

          {/* Error banner */}
          {pageState === 'error' && lookupError && (
            <div className="absolute bottom-24 left-4 right-4 bg-red-900/90 border border-red-700 rounded-xl p-4 z-20 flex gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium">Book not found</p>
                <p className="text-red-200 text-xs mt-0.5">{lookupError}</p>
                <div className="flex gap-3 mt-2">
                  <button onClick={handleRescan} className="text-red-300 hover:text-white text-xs underline">
                    Try again
                  </button>
                  <button onClick={switchToUSB} className="text-red-300 hover:text-white text-xs underline">
                    Enter ISBN manually
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mode toggle — bottom bar */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
            <button
              onClick={switchToUSB}
              className="bg-black/60 text-white/80 hover:text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 transition-colors"
            >
              <ScanIcon size={14} />
              Switch to USB / manual entry
            </button>
          </div>
        </div>
      )}

      {/* ── USB / desktop mode ────────────────────────────────────────── */}
      {mode === 'usb' && (
        <div className="flex-1 flex flex-col">
          {/* Page header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-ink-800">
            <div>
              <h1 className="text-2xl font-bold text-white">Scan a Book</h1>
              <p className="text-ink-400 text-sm mt-0.5">Add a volume to your collection by barcode</p>
            </div>
            {isMobile && (
              <button
                onClick={switchToCamera}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Camera size={15} />
                Camera
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <USBScannerInput
              onScan={handleScan}
              loading={isLookingUp}
              hasCameraSupport={isMobile}
              onCameraMode={isMobile ? switchToCamera : undefined}
            />

            {/* Error display */}
            {pageState === 'error' && lookupError && (
              <div className="mt-4 max-w-sm mx-auto px-4 w-full">
                <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 flex gap-3">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm">{lookupError}</p>
                    <button
                      onClick={handleRescan}
                      className="text-red-400 hover:text-red-300 text-xs underline mt-1"
                    >
                      Try a different ISBN
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop tip */}
            {!isMobile && (
              <div className="mt-8 max-w-sm mx-auto px-4 w-full">
                <div className="bg-ink-800/50 border border-ink-700 rounded-xl p-4 text-sm text-ink-400">
                  <p className="font-medium text-ink-300 mb-1">💡 How it works</p>
                  <p>USB barcode scanners plug in like a keyboard. With this box focused, pull the trigger on your scanner — the ISBN digits will type in automatically and the lookup fires instantly.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Result modal (both modes) ─────────────────────────────────── */}
      {pageState === 'confirm' && result && (
        <ScanResultModal
          result={result}
          onClose={handleRescan}
          onRescan={handleRescan}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
