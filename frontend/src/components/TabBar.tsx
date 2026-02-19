import InfoButton from './InfoButton';

interface Tab {
  key: string;
  label: string;
  badge?: string | number;
  infoKey?: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export default function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div className="border-b border-gray-200 mb-6 overflow-x-auto">
      <nav className="flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === tab.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {tab.badge}
              </span>
            )}
            {tab.infoKey && <InfoButton contextKey={tab.infoKey} />}
          </button>
        ))}
      </nav>
    </div>
  );
}
