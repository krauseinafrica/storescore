import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import { ManualEntryContent, CSVImportContent } from './DataEntry';
import { IntegrationSettingsContent } from './IntegrationSettings';

const TABS = [
  { key: 'manual', label: 'Manual Entry' },
  { key: 'csv', label: 'CSV Import' },
  { key: 'integrations', label: 'Integrations' },
];

const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function DataIntegrations() {
  const location = useLocation();
  const navigate = useNavigate();

  const hashTab = location.hash.replace('#', '');
  const [activeTab, setActiveTab] = useState(
    TAB_KEYS.has(hashTab) ? hashTab : 'manual'
  );

  useEffect(() => {
    const tab = location.hash.replace('#', '');
    if (TAB_KEYS.has(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.hash]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate(`/data-integrations#${key}`, { replace: true });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Data & Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Enter store metrics manually, import from CSV, or manage data integrations.
        </p>
      </div>

      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === 'manual' && <ManualEntryContent />}
      {activeTab === 'csv' && <CSVImportContent />}
      {activeTab === 'integrations' && <IntegrationSettingsContent />}
    </div>
  );
}
