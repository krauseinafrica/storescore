import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import TabBar from '../components/TabBar';
import InfoButton from '../components/InfoButton';
import type { Period } from '../api/analytics';
import { PERIOD_OPTIONS } from './reports/reportHelpers';
import { OverviewContent } from './reports/OverviewContent';
import { StoreDeepDiveContent } from './reports/StoreDeepDiveContent';
import { SectionAnalysisContent } from './reports/SectionAnalysisContent';
import { EvaluatorInsightsContent } from './reports/EvaluatorInsightsContent';
import { ActionItemsDriversContent } from './reports/ActionItemsDriversContent';

export default function Reports() {
  const { hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = hasRole('admin');

  // Shared state
  const [period, setPeriod] = useState<Period>('90d');

  // Drill-down state
  const [drillStoreId, setDrillStoreId] = useState<string | null>(null);
  const [drillSectionName, setDrillSectionName] = useState<string | null>(null);
  const [drillEvaluatorId, setDrillEvaluatorId] = useState<string | null>(null);

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'store-deep-dive', label: 'Store Deep Dive' },
    { key: 'section-analysis', label: 'Section Analysis' },
    ...(isAdmin ? [{ key: 'evaluator-insights', label: 'Evaluator Insights' }] : []),
    { key: 'action-items-drivers', label: 'Action Items & Drivers' },
  ];

  const hashTab = location.hash.replace('#', '');
  const validKeys = new Set(TABS.map(t => t.key));
  const [activeTab, setActiveTab] = useState(validKeys.has(hashTab) ? hashTab : 'overview');

  useEffect(() => {
    const tab = location.hash.replace('#', '');
    if (validKeys.has(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.hash]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    navigate(`/reports#${key}`, { replace: true });
  }, [navigate]);

  // Drill-down callbacks
  const drillToStore = useCallback((storeId: string) => {
    setDrillStoreId(storeId);
    handleTabChange('store-deep-dive');
  }, [handleTabChange]);

  const drillToSection = useCallback((sectionName: string) => {
    setDrillSectionName(sectionName);
    handleTabChange('section-analysis');
  }, [handleTabChange]);

  const drillToEvaluator = useCallback((evaluatorId: string) => {
    setDrillEvaluatorId(evaluatorId);
    handleTabChange('evaluator-insights');
  }, [handleTabChange]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Reports & Analytics <InfoButton contextKey="reports-overview" />
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Insights across all evaluations and stores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewContent
          period={period}
          onDrillToStore={drillToStore}
          onDrillToSection={drillToSection}
        />
      )}
      {activeTab === 'store-deep-dive' && (
        <StoreDeepDiveContent
          period={period}
          initialStoreId={drillStoreId}
          onStoreSelected={() => setDrillStoreId(null)}
        />
      )}
      {activeTab === 'section-analysis' && (
        <SectionAnalysisContent
          period={period}
          initialSectionName={drillSectionName}
          onSectionSelected={() => setDrillSectionName(null)}
        />
      )}
      {activeTab === 'evaluator-insights' && isAdmin && (
        <EvaluatorInsightsContent
          period={period}
          initialEvaluatorId={drillEvaluatorId}
          onEvaluatorSelected={() => setDrillEvaluatorId(null)}
        />
      )}
      {activeTab === 'action-items-drivers' && (
        <ActionItemsDriversContent period={period} />
      )}
    </div>
  );
}
