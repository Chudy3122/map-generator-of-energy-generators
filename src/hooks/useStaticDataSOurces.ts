import { useState, useEffect } from 'react';
import { STATIC_DATA_SOURCES, StaticDataSource } from '.././config/staticDataSources';

export const useStaticDataSources = () => {
  const [sources, setSources] = useState(STATIC_DATA_SOURCES);
  const [loadedData, setLoadedData] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);

  const toggleSource = (id: string) => {
    setSources(prev => prev.map(source => 
      source.id === id ? { ...source, enabled: !source.enabled } : source
    ));
  };

  const loadEnabledSources = async () => {
    setLoading(true);
    const newLoadedData = new Map();

    for (const source of sources.filter(s => s.enabled)) {
      try {
        const response = await fetch(`/data/${source.filename}`);
        const text = await response.text();
        
        if (source.type === 'xml') {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          newLoadedData.set(source.id, xmlDoc);
        } else {
          newLoadedData.set(source.id, text);
        }
      } catch (error) {
        console.error(`Failed to load ${source.filename}:`, error);
      }
    }

    setLoadedData(newLoadedData);
    setLoading(false);
  };

  useEffect(() => {
    loadEnabledSources();
  }, [sources]);

  return {
    sources,
    loadedData,
    loading,
    toggleSource,
    refreshData: loadEnabledSources
  };
};