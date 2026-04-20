import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface BarcodeScannerProps {
  onScan: (isbn: string) => void
  onError?: (err: string) => void
  active: boolean
}

// ISBN-10 or ISBN-13 digits only
function isValidISBN(value: string): boolean {
  const digits = value.replace(/[-\s]/g, '')
  return /^\d{10}$/.test(digits) || /^\d{13}$/.test(digits)
}

export default function BarcodeScanner({ onScan, onError, active }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef<number>(0)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (!active || !videoRef.current) return

    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(
        undefined, // let ZXing pick the environment (rear) camera
        videoRef.current,
        (result, err) => {
          if (result) {
            const raw = result.getText().replace(/[-\s]/g, '')
            if (!isValidISBN(raw)) return

            // Debounce: ignore same barcode within 2 seconds
            const now = Date.now()
            if (raw === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) return
            lastScannedRef.current = raw
            lastScannedTimeRef.current = now

            onScan(raw)
          }
          if (err) {
            // "No MultiFormat Readers were able to detect the code" fires continuously
            // while no barcode is in frame — this is normal and expected, suppress it.
            const msg = (err as Error).message || ''
            if (!msg.includes('No MultiFormat') && !msg.includes('NotFoundException')) {
              console.warn('ZXing scan error:', err)
            }
          }
        }
      )
      .catch((err: Error) => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionDenied(true)
        } else {
          onError?.(err.message)
        }
      })

    return () => {
      // reset() exists at runtime but TypeScript types lag — cast to silence the error
      ;(reader as any).reset?.()
    }
  }, [active, onScan, onError])

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
        <p className="text-red-400 font-semibold">Camera access denied</p>
        <p className="text-ink-400 text-sm">
          Allow camera access in your browser settings, then reload this page.
        </p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      autoPlay
      muted
      playsInline
    />
  )
}
