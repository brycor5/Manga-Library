import { useRef, useState } from 'react'
import { X, Zap, ZapOff } from 'lucide-react'

interface ScanOverlayProps {
  onCancel: () => void
  videoElement?: HTMLVideoElement | null
}

export default function ScanOverlay({ onCancel, videoElement }: ScanOverlayProps) {
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(true)
  const torchCheckedRef = useRef(false)

  async function toggleTorch() {
    if (!videoElement) return
    const stream = (videoElement as any).srcObject as MediaStream | null
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    if (!track) return

    // Check torch support on first use
    if (!torchCheckedRef.current) {
      torchCheckedRef.current = true
      const caps = track.getCapabilities?.() as any
      if (!caps?.torch) {
        setTorchSupported(false)
        return
      }
    }

    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] })
      setTorchOn(t => !t)
    } catch {
      setTorchSupported(false)
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dark vignette outside the scan window */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Cutout — clear centre rectangle */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 260, height: 160 }}
      >
        {/* Semi-transparent clear area */}
        <div className="absolute inset-0 bg-transparent border-2 border-transparent" />

        {/* Corner brackets */}
        {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
          <svg
            key={corner}
            width="28"
            height="28"
            viewBox="0 0 28 28"
            className={`absolute text-accent-400 ${
              corner === 'tl' ? 'top-0 left-0' :
              corner === 'tr' ? 'top-0 right-0 rotate-90' :
              corner === 'bl' ? 'bottom-0 left-0 -rotate-90' :
              'bottom-0 right-0 rotate-180'
            }`}
          >
            <path d="M2 26 L2 2 L26 2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ))}

        {/* Animated scan line */}
        <div className="absolute left-2 right-2 h-0.5 bg-accent-400/80 rounded animate-scan-line" />
      </div>

      {/* Hint text */}
      <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none">
        <p className="text-white/70 text-sm bg-black/40 px-4 py-1.5 rounded-full">
          Align barcode within the frame
        </p>
      </div>

      {/* Buttons — pointer-events back on */}
      <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-auto">
        <button
          onClick={onCancel}
          className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <X size={20} />
        </button>

        {torchSupported && (
          <button
            onClick={toggleTorch}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              torchOn ? 'bg-yellow-400 text-black' : 'bg-black/60 text-white hover:bg-black/80'
            }`}
          >
            {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
          </button>
        )}
      </div>
    </div>
  )
}
