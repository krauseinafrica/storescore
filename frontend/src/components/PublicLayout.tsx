import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import ChatWidget from './ChatWidget';

const navLinks = [
  { label: 'Tour', path: '/tour' },
  { label: 'Features', path: '/features' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Enterprise', path: '/enterprise' },
  { label: 'Request Demo', path: '/request-demo' },
];

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || (path === '/compare' && location.pathname.startsWith('/compare'));

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img
                src="https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/SS%20Store.png"
                alt="StoreScore"
                className="h-8 w-auto"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-bold">
                  <span className="text-gray-700">Store</span><span className="text-primary-600">Score</span>
                </span>
                <span className="text-[10px] font-medium tracking-wider text-gray-400">Evaluate. Analyze. Excel.</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-primary-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                Sign Up Free
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-semibold text-center text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                >
                  Sign Up Free
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-3">
                <img
                  src="https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/SS%20Store.png"
                  alt="StoreScore"
                  className="h-7 w-auto"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-bold">
                    <span className="text-gray-700">Store</span><span className="text-primary-600">Score</span>
                  </span>
                  <span className="text-[9px] font-medium tracking-wider text-gray-400">Evaluate. Analyze. Excel.</span>
                </div>
              </Link>
              <p className="text-sm text-gray-500 max-w-sm">
                StoreScore — Store Quality Management. Streamline evaluations, drive consistency,
                and improve performance across all your locations.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Product</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/tour" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Product Tour
                  </Link>
                </li>
                <li>
                  <Link to="/features" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/enterprise" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Enterprise
                  </Link>
                </li>
                <li>
                  <Link to="/request-demo" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Request Demo
                  </Link>
                </li>
                <li>
                  <Link to="/compare/bindy" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    StoreScore vs Bindy
                  </Link>
                </li>
                <li>
                  <Link to="/compare/safetyculture" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    StoreScore vs SafetyCulture
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Account</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Login
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Sign Up Free
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              &copy; 2026 StoreScore. All rights reserved.
            </p>
            <p className="text-sm text-gray-400">
              StoreScore — Store Quality Management
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
