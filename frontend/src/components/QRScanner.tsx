import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  isOpen: boolean;
  onScan: (token: string) => void;
  onClose: () => void;
}

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractUUID(data: string): string | null {
  const match = data.match(UUID_REGEX);
  return match ? match[0] : null;
}

export default function QRScanner({ isOpen, onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const scannerId = 'qr-scanner-region';

    // Small delay to ensure DOM is ready
    const timer = setTimeout(async () => {
      if (!mounted) return;

      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const uuid = extractUUID(decodedText);
            if (uuid) {
              scanner.stop().catch(() => {});
              onScan(uuid);
            }
          },
          () => {
            // Ignore scan failures (no QR in frame)
          },
        );
      } catch (err: any) {
        if (!mounted) return;
        if (err?.toString?.().includes('NotAllowedError') || err?.toString?.().includes('Permission')) {
          setError('Camera access denied. Please allow camera permissions in your browser settings, then try again.');
        } else if (err?.toString?.().includes('NotFoundError')) {
          setError('No camera found on this device. Use the manual entry option below.');
          setShowManual(true);
        } else {
          setError('Could not start camera. Use the manual entry option below.');
          setShowManual(true);
        }
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  const handleManualSubmit = () => {
    const uuid = extractUUID(manualToken);
    if (uuid) {
      onScan(uuid);
    } else {
      setError('Invalid format. Please enter a valid QR token (UUID).');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <h2 className="text-white text-sm font-semibold">Scan Store QR Code</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4" ref={containerRef}>
        <div
          id="qr-scanner-region"
          className="w-full max-w-sm rounded-xl overflow-hidden"
          style={{ minHeight: 300 }}
        />

        {error && (
          <div className="mt-4 mx-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 max-w-sm">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <p className="mt-4 text-white/50 text-xs text-center max-w-xs">
          Point your camera at the QR code posted at the store entrance
        </p>
      </div>

      {/* Manual entry fallback */}
      <div className="px-4 pb-6 pt-3">
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            className="w-full text-center text-sm text-white/50 hover:text-white/80 transition-colors py-2"
          >
            Enter code manually instead
          </button>
        ) : (
          <div className="max-w-sm mx-auto space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => { setManualToken(e.target.value.trim()); setError(''); }}
                placeholder="Paste QR token (UUID)..."
                className="flex-1 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualToken}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                Verify
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
