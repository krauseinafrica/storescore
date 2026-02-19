import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import { BrowseLibraryContent, YourTemplatesContent } from './TemplateLibrary';
import { DriverManagementContent } from './DriverManagement';
import { SOPDocumentsContent } from './SOPDocuments';
import { ReferenceImagesContent } from './ReferenceImages';
import { AssessmentTemplatesContent } from './AssessmentTemplates';

const TABS = [
  { key: 'library', label: 'Template Library', infoKey: 'templates-overview' },
  { key: 'your-templates', label: 'Your Templates' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'drivers', label: 'Scoring Drivers', infoKey: 'drivers-overview' },
  { key: 'sops', label: 'SOPs', infoKey: 'sop-documents-overview' },
  { key: 'reference-images', label: 'Reference Images' },
];

const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function Templates() {
  const location = useLocation();
  const navigate = useNavigate();

  // Read initial tab from URL hash
  const hashTab = location.hash.replace('#', '');
  const [activeTab, setActiveTab] = useState(
    TAB_KEYS.has(hashTab) ? hashTab : 'library'
  );

  // Sync tab from hash changes (e.g. browser back/forward)
  useEffect(() => {
    const tab = location.hash.replace('#', '');
    if (TAB_KEYS.has(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.hash]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate(`/templates#${key}`, { replace: true });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Templates</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage evaluation templates, scoring drivers, SOPs, and reference images.
        </p>
      </div>

      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === 'library' && <BrowseLibraryContent />}
      {activeTab === 'your-templates' && <YourTemplatesContent />}
      {activeTab === 'assessments' && <AssessmentTemplatesContent />}
      {activeTab === 'drivers' && <DriverManagementContent />}
      {activeTab === 'sops' && <SOPDocumentsContent />}
      {activeTab === 'reference-images' && <ReferenceImagesContent />}
    </div>
  );
}
