import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import { ActionItemsContent } from './ActionItems';
import { CorrectiveActionsContent } from './CorrectiveActions';

const TABS = [
  { key: 'action-items', label: 'Action Items', infoKey: 'action-items-overview' },
  { key: 'corrective-actions', label: 'Corrective Actions', infoKey: 'corrective-actions-overview' },
];

const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function FollowUps() {
  const location = useLocation();
  const navigate = useNavigate();

  const hashTab = location.hash.replace('#', '');
  const [activeTab, setActiveTab] = useState(
    TAB_KEYS.has(hashTab) ? hashTab : 'action-items'
  );

  useEffect(() => {
    const tab = location.hash.replace('#', '');
    if (TAB_KEYS.has(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.hash]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate(`/follow-ups#${key}`, { replace: true });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Follow-ups</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track and resolve action items and corrective actions from store walks.
        </p>
      </div>

      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === 'action-items' && <ActionItemsContent />}
      {activeTab === 'corrective-actions' && <CorrectiveActionsContent />}
    </div>
  );
}
