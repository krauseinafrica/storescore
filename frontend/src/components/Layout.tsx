import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

function MasqueradeBar() {
  const [masqName, setMasqName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setMasqName(localStorage.getItem('masquerading'));
  }, []);

  if (!masqName) return null;

  const handleExit = () => {
    localStorage.removeItem('masquerading');
    localStorage.removeItem('selectedOrgId');
    navigate('/admin');
    window.location.reload();
  };

  return (
    <div className="bg-violet-600 text-white px-4 py-2 text-sm flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>Viewing as <strong>{masqName}</strong></span>
      </div>
      <button
        onClick={handleExit}
        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
      >
        Exit View
      </button>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Masquerade indicator */}
        <MasqueradeBar />

        {/* Mobile header with menu toggle */}
        <div className="lg:hidden flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center">
            <img
              src="https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/SS%20Long.png"
              alt="StoreScore"
              className="h-7 w-auto"
            />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
