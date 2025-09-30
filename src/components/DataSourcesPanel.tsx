import React from 'react';
import { StaticDataSource } from '.././config/staticDataSources';

interface DataSourcesPanelProps {
  sources: StaticDataSource[];
  onToggle: (id: string) => void;
  loading?: boolean;
}

export const DataSourcesPanel: React.FC<DataSourcesPanelProps> = ({
  sources,
  onToggle,
  loading
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4">
      <h3 className="text-lg font-semibold mb-3">Źródła danych</h3>
      
      {loading && (
        <div className="text-blue-600 mb-2">Ładowanie danych...</div>
      )}
      
      <div className="space-y-2">
        {sources.map(source => (
          <label key={source.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={() => onToggle(source.id)}
              className="rounded"
            />
            <span className="text-sm font-medium">{source.name}</span>
            {source.description && (
              <span className="text-xs text-gray-500">
                ({source.description})
              </span>
            )}
          </label>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        Włączone źródła: {sources.filter(s => s.enabled).length} / {sources.length}
      </div>
    </div>
  );
};