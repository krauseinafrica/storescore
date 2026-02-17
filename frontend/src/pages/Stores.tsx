import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { getOrgId } from '../utils/org';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import {
  getStores,
  getRegions,
  getRegionTree,
  createStore,
  updateStore,
  createRegion,
  updateRegion,
  deleteRegion,
  geocodeStore,
  assignRegionManager,
  getStoreQRCode,
  regenerateStoreQR,
  getDepartments,
} from '../api/walks';
import { getMembers } from '../api/members';
import type { StoreData } from '../api/walks';
import type { Store, Region, OrgMember, VerificationMethod, Department } from '../types';

type Tab = 'stores' | 'regions';
type StoreView = 'list' | 'map';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const REGION_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#84CC16', '#F43F5E', '#0EA5E9', '#D946EF', '#FB923C',
];

const MAP_CONTAINER = { width: '100%', height: 'calc(100vh - 280px)', minHeight: '300px' };
const DEFAULT_CENTER = { lat: 37.0, lng: -80.0 }; // Virginia area

// ---------- Store Form Modal ----------

interface StoreFormProps {
  store: Store | null;
  regions: Region[];
  onClose: () => void;
  onSaved: (store: Store) => void;
}

function StoreFormModal({ store, regions, onClose, onSaved }: StoreFormProps) {
  const orgId = getOrgId();
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [downloadingQR, setDownloadingQR] = useState(false);
  const [regeneratingQR, setRegeneratingQR] = useState(false);
  const [currentToken, setCurrentToken] = useState(store?.qr_verification_token || '');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(store?.department_ids || []);
  const [form, setForm] = useState<StoreData>({
    name: store?.name || '',
    store_number: store?.store_number || '',
    region: store?.region || null,
    address: store?.address || '',
    city: store?.city || '',
    state: store?.state || '',
    zip_code: store?.zip_code || '',
    is_active: store?.is_active ?? true,
    latitude: store?.latitude ?? null,
    longitude: store?.longitude ?? null,
    verification_method: store?.verification_method || 'gps_only',
  });

  useEffect(() => {
    if (!orgId) return;
    getDepartments(orgId).then(setDepartments).catch(() => {});
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || saving) return;
    if (!form.name.trim()) { setError('Store name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const data: StoreData = { ...form, region: form.region || undefined, department_ids: selectedDeptIds };
      const result = store
        ? await updateStore(orgId, store.id, data)
        : await createStore(orgId, data);
      onSaved(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  const handleGeocode = async () => {
    if (!orgId || !store || geocoding) return;
    setGeocoding(true);
    setError('');
    try {
      const updated = await geocodeStore(orgId, store.id);
      setForm((prev) => ({ ...prev, latitude: updated.latitude, longitude: updated.longitude }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to geocode address');
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{store ? 'Edit Store' : 'Add Store'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="e.g. Downtown Portland" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Number</label>
              <input type="text" value={form.store_number} onChange={(e) => setForm({ ...form, store_number: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="e.g. 12345" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value || null })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">No Region</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="OR" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input type="text" value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="97201" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input type="number" step="any" value={form.latitude ?? ''} onChange={(e) => setForm({ ...form, latitude: e.target.value ? parseFloat(e.target.value) : null })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="e.g. 45.5231" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input type="number" step="any" value={form.longitude ?? ''} onChange={(e) => setForm({ ...form, longitude: e.target.value ? parseFloat(e.target.value) : null })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" placeholder="e.g. -122.6765" />
            </div>
          </div>
          <div>
            <button type="button" onClick={handleGeocode} disabled={!store || geocoding} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title={!store ? 'Save store first, then geocode' : 'Auto-fill coordinates from address'}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {geocoding ? 'Geocoding...' : 'Auto-fill from Address'}
            </button>
            {!store && <p className="text-xs text-gray-400 mt-1">Save store first, then geocode</p>}
          </div>
          {store && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Method</label>
              <select value={form.verification_method || 'gps_only'} onChange={(e) => setForm({ ...form, verification_method: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option value="gps_only">GPS Only</option>
                <option value="qr_only">QR Only</option>
                <option value="gps_and_qr">GPS and QR</option>
                <option value="either">Either</option>
              </select>
            </div>
          )}
          {store && (form.verification_method === 'qr_only' || form.verification_method === 'gps_and_qr' || form.verification_method === 'either') && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">QR Code Verification</h3>
              <div className="text-xs text-gray-500">
                Token: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">{currentToken ? currentToken.slice(0, 8) + '...' + currentToken.slice(-4) : 'N/A'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!orgId || downloadingQR) return;
                    setDownloadingQR(true);
                    setError('');
                    try {
                      const blob = await getStoreQRCode(orgId, store.id);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `qr-${store.store_number || store.name}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Failed to download QR code');
                    } finally {
                      setDownloadingQR(false);
                    }
                  }}
                  disabled={downloadingQR}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  {downloadingQR ? 'Downloading...' : 'Download QR Code'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!orgId || regeneratingQR) return;
                    if (!window.confirm('Regenerate QR token? The current QR code will stop working and you will need to print a new one.')) return;
                    setRegeneratingQR(true);
                    setError('');
                    try {
                      const updated = await regenerateStoreQR(orgId, store.id);
                      setCurrentToken(updated.qr_verification_token);
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Failed to regenerate token');
                    } finally {
                      setRegeneratingQR(false);
                    }
                  }}
                  disabled={regeneratingQR}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {regeneratingQR ? 'Regenerating...' : 'Regenerate Token'}
                </button>
              </div>
              <p className="text-xs text-gray-400">Download and print this QR code to post at the store entrance. Walkers will scan it to verify their presence.</p>
            </div>
          )}
          {departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departments</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {departments.filter(d => d.is_active).map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDeptIds.includes(dept.id)}
                      onChange={(e) => {
                        setSelectedDeptIds((prev) =>
                          e.target.checked ? [...prev, dept.id] : prev.filter((id) => id !== dept.id)
                        );
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {dept.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Select departments available at this store for department evaluations.</p>
            </div>
          )}
          {store && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Active
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : store ? 'Save Changes' : 'Add Store'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Map Pin SVG Generator ----------

function createMarkerIcon(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ---------- Store Map View ----------

interface StoreMapProps {
  stores: Store[];
  regions: Region[];
  onStoreClick: (store: Store) => void;
  isAdmin: boolean;
}

function StoreMap({ stores, regions, onStoreClick, isAdmin }: StoreMapProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const regionColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    regions.forEach((r) => { map[r.id] = r.color || '#3B82F6'; });
    return map;
  }, [regions]);

  const mappableStores = useMemo(
    () => stores
      .filter((s) => s.latitude != null && s.longitude != null && s.is_active)
      .map((s) => ({ ...s, latitude: Number(s.latitude), longitude: Number(s.longitude) }))
      .filter((s) => !isNaN(s.latitude) && !isNaN(s.longitude)),
    [stores]
  );

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (mappableStores.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      mappableStores.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
      map.fitBounds(bounds, 60);
      if (mappableStores.length === 1) map.setZoom(12);
    }
  }, [mappableStores]);

  const getStoreColor = (store: Store) => {
    if (store.region && regionColorMap[store.region]) return regionColorMap[store.region];
    return '#9CA3AF'; // gray for unassigned
  };

  if (mappableStores.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-12 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-sm text-gray-500 mb-1">No stores with coordinates.</p>
        <p className="text-xs text-gray-400">Add latitude/longitude to stores to view them on the map.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-sm ring-1 ring-gray-900/5">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER}
        center={DEFAULT_CENTER}
        zoom={7}
        onLoad={onLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        }}
      >
        {mappableStores.map((store) => (
          <MarkerF
            key={store.id}
            position={{ lat: store.latitude, lng: store.longitude }}
            icon={{
              url: createMarkerIcon(getStoreColor(store)),
              scaledSize: new google.maps.Size(28, 40),
              anchor: new google.maps.Point(14, 40),
            }}
            onClick={() => setSelectedStore(store)}
            title={store.name}
          />
        ))}

        {selectedStore && selectedStore.latitude != null && selectedStore.longitude != null && (
          <InfoWindowF
            position={{ lat: Number(selectedStore.latitude), lng: Number(selectedStore.longitude) }}
            onCloseClick={() => setSelectedStore(null)}
            options={{ pixelOffset: new google.maps.Size(0, -40) }}
          >
            <div className="min-w-[180px] max-w-[240px] p-1">
              <div className="flex items-center gap-2 mb-1">
                {selectedStore.region && (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getStoreColor(selectedStore) }} />
                )}
                <h3 className="text-sm font-semibold text-gray-900">{selectedStore.name}</h3>
              </div>
              {selectedStore.store_number && <p className="text-xs text-gray-400 mb-1">#{selectedStore.store_number}</p>}
              {selectedStore.region_name && <p className="text-xs text-gray-500 mb-1">{selectedStore.region_name}</p>}
              {(selectedStore.address || selectedStore.city) && (
                <p className="text-xs text-gray-500 mb-2">
                  {[selectedStore.address, selectedStore.city, selectedStore.state].filter(Boolean).join(', ')}
                  {selectedStore.zip_code ? ` ${selectedStore.zip_code}` : ''}
                </p>
              )}
              {isAdmin && (
                <button
                  onClick={() => { onStoreClick(selectedStore); setSelectedStore(null); }}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Edit Store
                </button>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="bg-white px-4 py-3 border-t border-gray-100 flex flex-wrap gap-3">
        {regions.filter((r) => !r.parent).map((r) => (
          <div key={r.id} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-gray-200" style={{ backgroundColor: r.color || '#3B82F6' }} />
            {r.name}
          </div>
        ))}
        {stores.some((s) => !s.region && s.is_active && s.latitude && s.longitude) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400 ring-1 ring-gray-200" />
            Unassigned
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main Stores Page ----------

export default function Stores() {
  const orgId = getOrgId();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>('stores');
  const [storeView, setStoreView] = useState<StoreView>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modals
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  // Region management state
  const [newRegionName, setNewRegionName] = useState('');
  const [savingRegion, setSavingRegion] = useState(false);
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editRegionName, setEditRegionName] = useState('');
  const [editRegionColor, setEditRegionColor] = useState('');
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [subRegionName, setSubRegionName] = useState('');
  const [regionError, setRegionError] = useState('');
  const [regionSuccess, setRegionSuccess] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [draggingStoreId, setDraggingStoreId] = useState<string | null>(null);
  const [dragOverRegion, setDragOverRegion] = useState<string | null>(null);

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    if (searchParams.has('manage-regions') && isAdmin) {
      setTab('regions');
      searchParams.delete('manage-regions');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, isAdmin, setSearchParams]);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [storeData, regionData, memberData] = await Promise.all([
        getStores(orgId).catch(() => []),
        getRegions(orgId).catch(() => []),
        isAdmin ? getMembers(orgId).catch(() => []) : Promise.resolve([]),
      ]);
      setStores(storeData);
      setRegions(regionData);
      setMembers(memberData);
    } finally {
      setLoading(false);
    }
  }, [orgId, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredStores = stores.filter((s) => {
    if (!showInactive && !s.is_active) return false;
    if (regionFilter && s.region !== regionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.store_number.toLowerCase().includes(q) || s.city.toLowerCase().includes(q);
    }
    return true;
  });

  const getInitials = useCallback((name: string) => {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }, []);

  const regionColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    regions.forEach((r) => { map[r.id] = r.color || '#3B82F6'; });
    return map;
  }, [regions]);

  const handleStoreSaved = (saved: Store) => {
    setStores((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) { const updated = [...prev]; updated[idx] = saved; return updated; }
      return [saved, ...prev];
    });
    setShowStoreForm(false);
    setEditingStore(null);
  };

  // --- Region helpers ---
  const topLevelRegions = regions.filter((r) => !r.parent);
  const unassignedStores = stores.filter((s) => !s.region && s.is_active);
  const getStoresForRegion = (regionId: string) => stores.filter((s) => s.region === regionId && s.is_active);

  const toggleRegionExpand = (regionId: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId); else next.add(regionId);
      return next;
    });
  };

  const handleMoveStore = async (storeId: string, regionId: string | null) => {
    if (!orgId) return;
    const store = stores.find((s) => s.id === storeId);
    if (!store || store.region === regionId) return;
    try {
      const updated = await updateStore(orgId, storeId, { region: regionId || undefined });
      setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, ...updated } : s)));
      setRegionSuccess(`Moved "${store.name}" to ${regionId ? regions.find((r) => r.id === regionId)?.name || 'region' : 'Unassigned'}`);
      setTimeout(() => setRegionSuccess(''), 3000);
      loadData();
    } catch {
      setRegionError(`Failed to move "${store.name}"`);
    }
    setDraggingStoreId(null); setDragOverRegion(null);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, storeId: string) => { e.stopPropagation(); setDraggingStoreId(storeId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', storeId); };
  const handleDragOver = (e: React.DragEvent, regionId: string | null) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverRegion(regionId); };
  const handleDragLeave = () => { setDragOverRegion(null); };
  const handleDrop = (e: React.DragEvent, regionId: string | null) => { e.preventDefault(); const storeId = e.dataTransfer.getData('text/plain'); if (storeId) handleMoveStore(storeId, regionId); setDragOverRegion(null); setDraggingStoreId(null); };
  const handleDragEnd = () => { setDraggingStoreId(null); setDragOverRegion(null); };

  const handleAddRegion = async (parentId?: string) => {
    const name = parentId ? subRegionName : newRegionName;
    if (!orgId || !name.trim() || savingRegion) return;
    setSavingRegion(true); setRegionError('');
    try {
      await createRegion(orgId, { name: name.trim(), parent: parentId || null });
      if (parentId) { setSubRegionName(''); setAddingSubTo(null); }
      else { setNewRegionName(''); }
      loadData();
    } catch { setRegionError('Failed to create region'); }
    finally { setSavingRegion(false); }
  };

  const handleUpdateRegion = async (regionId: string) => {
    if (!orgId || !editRegionName.trim() || savingRegion) return;
    setSavingRegion(true); setRegionError('');
    try {
      await updateRegion(orgId, regionId, { name: editRegionName.trim(), color: editRegionColor });
      setEditingRegionId(null);
      loadData();
    } catch { setRegionError('Failed to update region'); }
    finally { setSavingRegion(false); }
  };

  const handleRegionColorChange = async (regionId: string, color: string) => {
    if (!orgId) return;
    try {
      await updateRegion(orgId, regionId, { name: regions.find((r) => r.id === regionId)?.name || '', color });
      setRegions((prev) => prev.map((r) => r.id === regionId ? { ...r, color } : r));
    } catch { /* silent */ }
  };

  const handleAssignManager = async (regionId: string, memberId: string | null) => {
    if (!orgId) return;
    try {
      await assignRegionManager(orgId, regionId, memberId || '');
      setRegionSuccess('Manager updated');
      setTimeout(() => setRegionSuccess(''), 2000);
      loadData();
    } catch { setRegionError('Failed to assign manager'); }
  };

  const handleDeleteRegion = async (regionId: string, regionName: string) => {
    if (!orgId || savingRegion) return;
    const region = regions.find((r) => r.id === regionId);
    if (region && region.store_count > 0) {
      setRegionError(`Cannot delete "${regionName}" — it has ${region.store_count} store(s) assigned`);
      return;
    }
    if (region && region.children && region.children.length > 0) {
      const childWithStores = region.children.find((c) => c.store_count > 0);
      if (childWithStores) {
        setRegionError(`Cannot delete "${regionName}" — child region "${childWithStores.name}" has ${childWithStores.store_count} store(s)`);
        return;
      }
    }
    setSavingRegion(true); setRegionError('');
    try { await deleteRegion(orgId, regionId); loadData(); }
    catch { setRegionError('Failed to delete region. Remove all stores from this region first.'); }
    finally { setSavingRegion(false); }
  };

  const managementMembers = members.filter((m) =>
    ['owner', 'admin', 'regional_manager', 'store_manager', 'manager'].includes(m.role)
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Stores & Regions <InfoButton contextKey="stores-overview" />
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? 'Loading...' : `${stores.filter((s) => s.is_active).length} active stores across ${regions.length} regions`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'stores' && (
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setStoreView('list')}
                className={`p-1.5 rounded-md transition-colors ${storeView === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </button>
              <button
                onClick={() => setStoreView('map')}
                className={`p-1.5 rounded-md transition-colors ${storeView === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="Map view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </button>
            </div>
          )}
          {isAdmin && tab === 'stores' && (
            <button
              onClick={() => { setEditingStore(null); setShowStoreForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Store
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-xs">
        {([
          { key: 'stores' as Tab, label: 'Stores' },
          { key: 'regions' as Tab, label: 'Regions' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 animate-pulse">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gray-200" /><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div></div>
            </div>
          ))}
        </div>
      ) : tab === 'stores' ? (
        /* ---------- Stores Tab ---------- */
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search stores..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border-gray-300 bg-white text-sm py-2 pl-9 pr-3 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500">
              <option value="">All Regions</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Show inactive
            </label>
          </div>

          {/* Map View */}
          {storeView === 'map' ? (
            mapsLoaded ? (
              <StoreMap
                stores={filteredStores}
                regions={regions}
                onStoreClick={(store) => { setEditingStore(store); setShowStoreForm(true); }}
                isAdmin={isAdmin}
              />
            ) : GOOGLE_MAPS_API_KEY ? (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading map...</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                <p className="text-sm text-gray-500 mb-1">Google Maps API key not configured.</p>
                <p className="text-xs text-gray-400">Add VITE_GOOGLE_MAPS_API_KEY to enable map view.</p>
              </div>
            )
          ) : (
            /* List View */
            <>
              {filteredStores.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-12 text-center">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  <p className="text-sm text-gray-500 mb-3">No stores found.</p>
                  {isAdmin && (
                    <button onClick={() => { setEditingStore(null); setShowStoreForm(true); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add your first store
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredStores.map((store) => {
                    const storeColor = store.region ? regionColorMap[store.region] : null;
                    return (
                      <div
                        key={store.id}
                        className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 transition-shadow hover:shadow-md ${!store.is_active ? 'opacity-60' : ''}`}
                        style={storeColor ? { borderLeft: `3px solid ${storeColor}` } : undefined}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex items-center justify-center w-10 h-10 rounded-lg text-white text-sm font-bold flex-shrink-0"
                            style={{ backgroundColor: storeColor || '#6366F1' }}
                          >
                            {getInitials(store.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{store.name}</h3>
                              {!store.is_active && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Inactive</span>}
                            </div>
                            {store.store_number && <p className="text-xs text-gray-400">#{store.store_number}</p>}
                          </div>
                          {isAdmin && (
                            <button onClick={() => { setEditingStore(store); setShowStoreForm(true); }} className="text-gray-400 hover:text-gray-600 flex-shrink-0" title="Edit store">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          )}
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {store.region_name && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: storeColor || '#9CA3AF' }} />
                              <span className="truncate">{store.region_name}</span>
                            </div>
                          )}
                          {(store.address || store.city) && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                              <span className="truncate">{[store.address, store.city, store.state].filter(Boolean).join(', ')}{store.zip_code ? ` ${store.zip_code}` : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ---------- Regions Tab ---------- */
        <div>
          {regionError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{regionError}</div>}
          {regionSuccess && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{regionSuccess}</div>}

          {/* Add new top-level region */}
          {isAdmin && (
            <div className="mb-6 rounded-xl bg-white shadow-sm border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Add Region</h2>
              <div className="flex gap-2">
                <input type="text" value={newRegionName} onChange={(e) => setNewRegionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRegion()} placeholder="New region name..." className="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                <button onClick={() => handleAddRegion()} disabled={savingRegion || !newRegionName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">Add</button>
              </div>
            </div>
          )}

          {/* Regions list */}
          {topLevelRegions.length === 0 && unassignedStores.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-sm text-gray-500 mb-1">No regions yet.</p>
              <p className="text-xs text-gray-400">Create your first region using the form above to organize your stores.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topLevelRegions.map((region) => {
                const regionStores = getStoresForRegion(region.id);
                const childCount = region.children?.length || 0;
                const isExpanded = expandedRegions.has(region.id);
                const isDragTarget = dragOverRegion === region.id;

                return (
                  <div
                    key={region.id}
                    className={`bg-white rounded-xl shadow-sm ring-1 transition-all ${isDragTarget ? 'ring-2 ring-primary-400 shadow-md bg-primary-50/30' : 'ring-gray-900/5 hover:shadow-md'}`}
                    style={{ borderLeft: `4px solid ${region.color || '#3B82F6'}` }}
                    onDragOver={(e) => handleDragOver(e, region.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, region.id)}
                  >
                    {/* Region header */}
                    <button onClick={() => toggleRegionExpand(region.id)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                      <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ backgroundColor: `${region.color || '#3B82F6'}20`, color: region.color || '#3B82F6' }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          {region.name}
                          {region.manager_name && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">{region.manager_name}</span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-400">
                          {regionStores.length} store{regionStores.length !== 1 ? 's' : ''}
                          {childCount > 0 && ` · ${childCount} sub-region${childCount !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Color picker */}
                          <label className="relative p-1.5 cursor-pointer" title="Change color">
                            <span className="block w-4 h-4 rounded-full ring-1 ring-gray-300" style={{ backgroundColor: region.color || '#3B82F6' }} />
                            <input
                              type="color"
                              value={region.color || '#3B82F6'}
                              onChange={(e) => handleRegionColorChange(region.id, e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </label>
                          <button onClick={() => { setAddingSubTo(addingSubTo === region.id ? null : region.id); setSubRegionName(''); }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 transition-colors" title="Add Sub-Region">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          </button>
                          <button onClick={() => { setEditingRegionId(region.id); setEditRegionName(region.name); setEditRegionColor(region.color || '#3B82F6'); }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteRegion(region.id, region.name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50 transition-colors" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </button>

                    {/* Edit region inline */}
                    {editingRegionId === region.id && (
                      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex gap-2 flex-1">
                            <input type="text" value={editRegionName} onChange={(e) => setEditRegionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateRegion(region.id); if (e.key === 'Escape') setEditingRegionId(null); }} className="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" autoFocus />
                            <input type="color" value={editRegionColor} onChange={(e) => setEditRegionColor(e.target.value)} className="w-10 h-9 rounded-lg border-gray-300 cursor-pointer" />
                          </div>
                          {/* Manager assignment */}
                          <select
                            value={region.manager || ''}
                            onChange={(e) => handleAssignManager(region.id, e.target.value || null)}
                            className="rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          >
                            <option value="">No Manager</option>
                            {managementMembers.map((m) => (
                              <option key={m.id} value={m.id}>{m.user.first_name} {m.user.last_name} ({m.role})</option>
                            ))}
                          </select>
                          <div className="flex gap-2 items-center">
                            <button onClick={() => handleUpdateRegion(region.id)} className="text-sm text-primary-600 font-medium">Save</button>
                            <button onClick={() => setEditingRegionId(null)} className="text-sm text-gray-400">Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expanded: stores + children + sub-region input */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {/* Child regions */}
                        {region.children && region.children.length > 0 && (
                          <div>
                            {region.children.map((child) => {
                              const childStores = getStoresForRegion(child.id);
                              const isChildDragTarget = dragOverRegion === child.id;
                              return (
                                <div key={child.id} className={`border-b border-gray-50 ${isChildDragTarget ? 'bg-primary-50/40' : ''}`} onDragOver={(e) => handleDragOver(e, child.id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, child.id)}>
                                  <div className="flex items-center gap-2 pl-12 pr-5 py-2.5 bg-gray-50/50">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: child.color || region.color || '#3B82F6' }} />
                                    <span className="text-sm font-medium text-gray-700 flex-1">{child.name}</span>
                                    <span className="text-xs text-gray-400">{childStores.length} stores</span>
                                    {isAdmin && (
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => { setEditingRegionId(child.id); setEditRegionName(child.name); setEditRegionColor(child.color || region.color || '#3B82F6'); }} className="p-1 text-gray-400 hover:text-gray-600" title="Edit">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => handleDeleteRegion(child.id, child.name)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {editingRegionId === child.id && (
                                    <div className="px-5 py-2 pl-12 bg-gray-50">
                                      <div className="flex gap-2">
                                        <input type="text" value={editRegionName} onChange={(e) => setEditRegionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateRegion(child.id); if (e.key === 'Escape') setEditingRegionId(null); }} className="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" autoFocus />
                                        <input type="color" value={editRegionColor} onChange={(e) => setEditRegionColor(e.target.value)} className="w-10 h-8 rounded border-gray-300 cursor-pointer" />
                                        <button onClick={() => handleUpdateRegion(child.id)} className="text-xs text-primary-600 font-medium">Save</button>
                                        <button onClick={() => setEditingRegionId(null)} className="text-xs text-gray-400">Cancel</button>
                                      </div>
                                    </div>
                                  )}
                                  {childStores.length > 0 && childStores.map((store) => (
                                    <div key={store.id} className="flex items-center gap-2 pl-16 pr-5 py-2 text-sm">
                                      <div className="w-6 h-6 rounded text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: child.color || region.color || '#3B82F6' }}>{getInitials(store.name)}</div>
                                      <span className="text-gray-700 flex-1 truncate">{store.name}</span>
                                      {store.store_number && <span className="text-xs text-gray-400 hidden sm:inline">#{store.store_number}</span>}
                                      {isAdmin && (
                                        <select
                                          value={store.region || ''}
                                          onChange={(e) => { const val = e.target.value; handleMoveStore(store.id, val || null); }}
                                          className="rounded border-gray-300 text-xs py-1 pl-2 pr-6 bg-white flex-shrink-0"
                                        >
                                          <option value="">Unassigned</option>
                                          {regions.filter((r) => !r.parent).map((r) => (
                                            <optgroup key={r.id} label={r.name}>
                                              <option value={r.id}>{r.name}</option>
                                              {r.children?.map((c) => <option key={c.id} value={c.id}>&nbsp;&nbsp;{c.name}</option>)}
                                            </optgroup>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Stores directly in parent region */}
                        {regionStores.length > 0 && (
                          <div>
                            {regionStores.map((store) => (
                              <div key={store.id} className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-50 text-sm hover:bg-gray-50/50">
                                <div className="w-7 h-7 rounded-md text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: region.color || '#3B82F6' }}>{getInitials(store.name)}</div>
                                <span className="text-gray-700 flex-1 truncate">{store.name}</span>
                                {store.store_number && <span className="text-xs text-gray-400 hidden sm:inline">#{store.store_number}</span>}
                                {store.city && <span className="text-xs text-gray-400 hidden sm:inline">{store.city}</span>}
                                {isAdmin && (
                                  <select
                                    value={store.region || ''}
                                    onChange={(e) => { const val = e.target.value; handleMoveStore(store.id, val || null); }}
                                    className="rounded border-gray-300 text-xs py-1 pl-2 pr-6 bg-white flex-shrink-0"
                                  >
                                    <option value="">Unassigned</option>
                                    {regions.filter((r) => !r.parent).map((r) => (
                                      <optgroup key={r.id} label={r.name}>
                                        <option value={r.id}>{r.name}</option>
                                        {r.children?.map((c) => <option key={c.id} value={c.id}>&nbsp;&nbsp;{c.name}</option>)}
                                      </optgroup>
                                    ))}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {regionStores.length === 0 && (!region.children || region.children.length === 0) && (
                          <div className="px-5 py-4 text-xs text-gray-400 italic">No stores in this region. Use the dropdown on each store to assign it here.</div>
                        )}

                        {/* Add sub-region input */}
                        {addingSubTo === region.id && (
                          <div className="px-5 py-3 bg-gray-50/30">
                            <div className="flex gap-2 pl-7">
                              <input type="text" value={subRegionName} onChange={(e) => setSubRegionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRegion(region.id)} placeholder="Sub-region name..." className="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500" autoFocus />
                              <button onClick={() => handleAddRegion(region.id)} disabled={savingRegion || !subRegionName.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">Add</button>
                              <button onClick={() => { setAddingSubTo(null); setSubRegionName(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unassigned Stores */}
              {unassignedStores.length > 0 && (
                <div
                  className={`bg-white rounded-xl shadow-sm ring-1 overflow-hidden transition-all ${dragOverRegion === '__unassigned' ? 'ring-2 ring-amber-400 shadow-md bg-amber-50/30' : 'ring-amber-200/60'}`}
                  onDragOver={(e) => handleDragOver(e, '__unassigned')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => { e.preventDefault(); const storeId = e.dataTransfer.getData('text/plain'); if (storeId) handleMoveStore(storeId, null); setDragOverRegion(null); setDraggingStoreId(null); }}
                >
                  <div className="flex items-center gap-3 px-5 py-4 bg-amber-50/50">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-amber-900">Unassigned Stores</h3>
                      <p className="text-xs text-amber-600">{unassignedStores.length} store{unassignedStores.length !== 1 ? 's' : ''} not assigned to any region</p>
                    </div>
                  </div>
                  <div className="border-t border-amber-100">
                    {unassignedStores.map((store) => (
                      <div key={store.id} className="flex items-center gap-2 px-5 py-2.5 border-b border-amber-50 text-sm hover:bg-amber-50/30">
                        <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{getInitials(store.name)}</div>
                        <span className="text-gray-700 flex-1 truncate">{store.name}</span>
                        {store.store_number && <span className="text-xs text-gray-400 hidden sm:inline">#{store.store_number}</span>}
                        {store.city && <span className="text-xs text-gray-400 hidden sm:inline">{store.city}</span>}
                        {isAdmin && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) handleMoveStore(store.id, e.target.value); }}
                            className="rounded border-gray-300 text-xs py-1 pl-2 pr-6 bg-white flex-shrink-0"
                          >
                            <option value="">Unassigned</option>
                            {regions.filter((r) => !r.parent).map((r) => (
                              <optgroup key={r.id} label={r.name}>
                                <option value={r.id}>{r.name}</option>
                                {r.children?.map((c) => <option key={c.id} value={c.id}>&nbsp;&nbsp;{c.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Store Form Modal */}
      {showStoreForm && (
        <StoreFormModal
          store={editingStore}
          regions={regions}
          onClose={() => { setShowStoreForm(false); setEditingStore(null); }}
          onSaved={handleStoreSaved}
        />
      )}
    </div>
  );
}
