import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getStores, getTemplates, createWalk, deleteWalk, verifyWalkQR, getOrgSettings } from '../../api/walks';
import type { Store, ScoringTemplate, Walk } from '../../types';
import { getOrgId } from '../../utils/org';
import LocationWarningModal from '../../components/LocationWarningModal';
import QRScanner from '../../components/QRScanner';

function captureGPS(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NewWalk() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stores, setStores] = useState<Store[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [createdWalk, setCreatedWalk] = useState<Walk | null>(null);
  const [locationDistance, setLocationDistance] = useState(0);
  const [locationStrict, setLocationStrict] = useState(false);
  const [locationRadius, setLocationRadius] = useState(500);

  // Form state
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [scheduledDate, setScheduledDate] = useState(todayString());

  // QR verification state
  const [qrToken, setQrToken] = useState('');
  const [qrVerified, setQrVerified] = useState(false);
  const [qrVerifying, setQrVerifying] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [showManualQr, setShowManualQr] = useState(false);

  const orgId = getOrgId();

  useEffect(() => {
    if (!orgId) {
      setError('No organization found. Please log in again.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        const [storeData, templateData, orgSettings] = await Promise.all([
          getStores(orgId),
          getTemplates(orgId),
          getOrgSettings(orgId).catch(() => null),
        ]);

        if (!cancelled) {
          setStores(storeData.filter((s) => s.is_active));
          setTemplates(templateData.filter((t: ScoringTemplate) => t.is_active));

          // Apply org location enforcement settings
          if (orgSettings) {
            setLocationStrict(orgSettings.location_enforcement === 'strict');
            if (orgSettings.verification_radius_meters) {
              setLocationRadius(orgSettings.verification_radius_meters);
            }
          }

          // Auto-select template if there's only one
          const activeTemplates = templateData.filter(
            (t: ScoringTemplate) => t.is_active
          );
          if (activeTemplates.length === 1) {
            setSelectedTemplate(activeTemplates[0].id);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              'Failed to load data. Please try again.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Determine if QR verification is needed for the selected store
  const selectedStoreObj = stores.find((s) => s.id === selectedStore);
  const storeRequiresQR = selectedStoreObj && (
    selectedStoreObj.verification_method === 'qr_only' ||
    selectedStoreObj.verification_method === 'gps_and_qr' ||
    selectedStoreObj.verification_method === 'either'
  );
  const qrIsRequired = selectedStoreObj?.verification_method === 'qr_only' || selectedStoreObj?.verification_method === 'gps_and_qr';

  const canSubmit =
    selectedStore && selectedTemplate && scheduledDate && !submitting && !gpsLoading &&
    (!qrIsRequired || qrVerified);

  async function handleStartWalk() {
    if (!canSubmit || !user) return;

    setError('');
    setGpsLoading(true);

    // Step 1: Capture GPS
    let coords: { latitude: number; longitude: number } | null = null;
    try { coords = await captureGPS(); } catch { /* continue without coords */ }
    setGpsLoading(false);

    // Step 2: Create walk
    setSubmitting(true);
    try {
      const payload: Parameters<typeof createWalk>[1] = {
        store: selectedStore,
        template: selectedTemplate,
        conducted_by: user.id,
        scheduled_date: scheduledDate,
        status: 'in_progress',
      };
      if (coords) {
        payload.start_latitude = coords.latitude;
        payload.start_longitude = coords.longitude;
      }

      const walk = await createWalk(orgId, payload);

      // Step 2b: Verify QR if token was provided
      if (qrVerified && qrToken) {
        try {
          await verifyWalkQR(orgId, walk.id, qrToken);
        } catch {
          // QR verification failed server-side, but walk is created — continue anyway
        }
      }

      // Step 3: Check location verification
      if (!walk.location_verified && walk.location_distance_meters !== null && walk.location_distance_meters > locationRadius) {
        setCreatedWalk(walk);
        setLocationDistance(walk.location_distance_meters);
        setShowLocationWarning(true);
        setSubmitting(false);
        return;
      }

      navigate(`/walks/${walk.id}/conduct`, { replace: true });
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Failed to create walk. Please try again.';
      setError(detail);
      setSubmitting(false);
    }
  }

  function handleWarningContinue() {
    if (createdWalk) navigate(`/walks/${createdWalk.id}/conduct`, { replace: true });
  }

  async function handleWarningCancel() {
    if (createdWalk) {
      try { await deleteWalk(orgId, createdWalk.id); } catch { /* ignore */ }
    }
    setShowLocationWarning(false);
    setCreatedWalk(null);
    setLocationDistance(0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-lg mx-auto">
      <LocationWarningModal
        isOpen={showLocationWarning}
        storeName={stores.find((s) => s.id === selectedStore)?.name || 'Unknown'}
        distanceMeters={locationDistance}
        onContinue={handleWarningContinue}
        onCancel={handleWarningCancel}
        strict={locationStrict}
        radiusMeters={locationRadius}
      />

      {/* Back button + Header */}
      <div className="mb-6">
        <Link
          to="/walks"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Walks
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Store Walk</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new store evaluation
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* Step 1: Select Store */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-bold mr-2">
              1
            </span>
            Select Store
          </label>
          {stores.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No active stores found. Please add a store first.
            </p>
          ) : (
            <select
              value={selectedStore}
              onChange={(e) => { setSelectedStore(e.target.value); setQrToken(''); setQrVerified(false); setQrError(''); }}
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors text-base"
            >
              <option value="">Choose a store...</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                  {store.store_number ? ` (#${store.store_number})` : ''}
                  {store.city ? ` - ${store.city}, ${store.state}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* QR Code Verification (shown after store selection if store requires QR) */}
        {selectedStore && storeRequiresQR && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              <h3 className="text-sm font-semibold text-gray-900">
                QR Code Verification
                {qrIsRequired && <span className="ml-1 text-xs font-normal text-red-500">(required)</span>}
                {!qrIsRequired && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
              </h3>
            </div>

            {qrVerified ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-medium text-green-700">QR code verified successfully</span>
              </div>
            ) : (
              <>
                {qrError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{qrError}</div>
                )}

                {/* Primary: Scan QR Code button */}
                <button
                  type="button"
                  onClick={() => setQrScannerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                  Scan QR Code
                </button>

                {/* Secondary: Manual entry */}
                {!showManualQr ? (
                  <button
                    type="button"
                    onClick={() => setShowManualQr(true)}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Enter code manually instead
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrToken}
                      onChange={(e) => setQrToken(e.target.value.trim())}
                      placeholder="Paste QR token (UUID)..."
                      className="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!qrToken || qrVerifying) return;
                        setQrVerifying(true);
                        setQrError('');
                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                        if (!uuidRegex.test(qrToken)) {
                          setQrError('Invalid token format. Please enter a valid UUID.');
                          setQrVerifying(false);
                          return;
                        }
                        if (selectedStoreObj && selectedStoreObj.qr_verification_token === qrToken) {
                          setQrVerified(true);
                        } else {
                          setQrError('Token does not match this store. Please check and try again.');
                        }
                        setQrVerifying(false);
                      }}
                      disabled={!qrToken || qrVerifying}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {qrVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* QR Scanner Modal */}
        <QRScanner
          isOpen={qrScannerOpen}
          onScan={(token) => {
            setQrScannerOpen(false);
            setQrToken(token);
            setQrError('');
            // Verify the scanned token
            if (selectedStoreObj && selectedStoreObj.qr_verification_token === token) {
              setQrVerified(true);
            } else {
              setQrError('Scanned QR code does not match this store. Please check you are scanning the correct store QR code.');
            }
          }}
          onClose={() => setQrScannerOpen(false)}
        />

        {/* Step 2: Select Template */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-bold mr-2">
              2
            </span>
            Evaluation Template
          </label>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No active templates found. Please create a template first.
            </p>
          ) : templates.length === 1 ? (
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-gray-50 border border-gray-200">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {templates[0].name}
                </p>
                <p className="text-xs text-gray-500">
                  {templates[0].section_count || templates[0].sections?.length || 0}{' '}
                  sections
                </p>
              </div>
            </div>
          ) : (
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors text-base"
            >
              <option value="">Choose a template...</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Step 3: Select Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-bold mr-2">
              3
            </span>
            Walk Date
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3.5 py-3 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors text-base"
          />
        </div>

        {/* Summary */}
        {selectedStore && selectedTemplate && (
          <div className="rounded-lg bg-primary-50 border border-primary-100 p-4">
            <h3 className="text-sm font-semibold text-primary-900 mb-2">
              Walk Summary
            </h3>
            <div className="space-y-1 text-sm text-primary-800">
              <p>
                <span className="font-medium">Store:</span>{' '}
                {stores.find((s) => s.id === selectedStore)?.name || 'Unknown'}
              </p>
              <p>
                <span className="font-medium">Template:</span>{' '}
                {templates.find((t) => t.id === selectedTemplate)?.name ||
                  'Unknown'}
              </p>
              <p>
                <span className="font-medium">Date:</span>{' '}
                {new Date(scheduledDate + 'T12:00:00').toLocaleDateString(
                  'en-US',
                  {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }
                )}
              </p>
              <p>
                <span className="font-medium">Evaluator:</span>{' '}
                {user?.first_name} {user?.last_name}
              </p>
              {storeRequiresQR && (
                <p>
                  <span className="font-medium">QR Verification:</span>{' '}
                  {qrVerified ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Verified
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      {qrIsRequired ? 'Required - not yet verified' : 'Not verified (optional)'}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Start Walk button */}
        <button
          onClick={handleStartWalk}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {gpsLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Capturing location...
            </>
          ) : submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Walk...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Start Walk
            </>
          )}
        </button>
      </div>
    </div>
  );
}
