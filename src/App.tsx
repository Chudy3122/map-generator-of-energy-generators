import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
// === TYPY ===

type Installation = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  county?: string;
  municipality?: string;
  installationCity?: string;
  installationProvince?: string;
  installationCounty?: string;
  installationType: string;
  power?: number;
  registrationDate: string;
  startDate?: string;
  coordinates: [number, number];
  dataType: 'MIOZE' | 'CONCESSION' | 'OPERATOR' | 'CONSUMER' | 'SELLER';
  category: 'supplier' | 'consumer' | 'intermediary';
  subcategory: string;
  validFrom?: string;
  validTo?: string;
  regon?: string;
  nip?: string;
  exciseNumber?: string;
  fileUrl?: string;
  operatorTypeDesc?: string;
  operatingArea?: string;
};

enum XMLType {
  MIOZE = 'MIOZE',
  CONCESSION = 'CONCESSION',
  OPERATOR = 'OPERATOR',
  CONSUMER = 'CONSUMER',
  SELLER = 'SELLER',
  UNKNOWN = 'UNKNOWN'
}

type DataCategory = 'supplier' | 'consumer' | 'intermediary';

interface DataSourceConfig {
  id: string;
  name: string;
  filename: string;
  description: string;
  enabled: boolean;
  category: DataCategory;
  subcategory: string;
  dataType: 'MIOZE' | 'CONCESSION' | 'OPERATOR' | 'CONSUMER' | 'SELLER';
}

const defaultCenter: [number, number] = [52.0690, 19.4803];

// === FUNKCJA TWORZENIA CUSTOM IKON Z ETYKIETĄ ===
const createCustomIconWithLabel = (color: string, label: string): L.DivIcon => {
  const iconHtml = `
    <div style="position: relative; width: 25px; height: 41px;">
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
              fill="${color}" 
              stroke="#fff" 
              stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="6" fill="#fff" opacity="0.9"/>
      </svg>
      <div style="
        position: absolute;
        top: -22px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 1px solid white;
      ">${label}</div>
    </div>
  `;
  
  return new L.DivIcon({
    html: iconHtml,
    className: 'custom-marker-label',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
};


// === KOLORY - PALETA PAUL TOL (PRZYJAZNA DLA DALTONISTÓW) ===
// Każdy typ ma unikalny kolor, który dobrze się odróżnia
const iconColors: Record<string, string> = {
  'PVA': '#4477AA',      // Niebieski
  'WOA': '#66CCEE',      // Cyan
  'BGO': '#228833',      // Zielony
  'BGS': '#CCBB44',      // Żółty
  'BGM': '#EE6677',      // Czerwony
  'WIL': '#AA3377',      // Purpurowy
  'WEE': '#BBBBBB',      // Jasnoszary
  'PCC': '#EE7733',      // Pomarańczowy
  'WCC': '#009988',      // Teal
  'OEE': '#0077BB',      // Ciemnoniebieski
  'DEE': '#CC3311',      // Ciemnoczerwony
  'OPG': '#33BBEE',      // Jasny cyan
  'PPG': '#000000',      // Czarny
  'DPG': '#DDAA33',      // Złoty
  'OCC': '#999933',      // Oliwkowy
  '15%': '#882255',      // Wino
  '25%': '#44AA99',      // Morski
  'OSDe': '#117733',     // Ciemnozielony
  'CONSUMER': '#88CCEE', // Błękitny
  'SELLER': '#DDCC77',   // Beżowy
  'default': '#777777'   // Szary
};

// === FUNKCJA TWORZENIA IKON Z ETYKIETAMI ===
const createIconsWithLabels = (colorMap: Record<string, string>): Record<string, L.DivIcon> => {
  const icons: Record<string, L.DivIcon> = {};
  
  Object.entries(colorMap).forEach(([type, color]) => {
    icons[type] = createCustomIconWithLabel(color, type);
  });
  
  return icons;
};

// === PALETA KOLORÓW UI ===
const theme = {
  headerGradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
  primary: '#0ea5e9',
  primaryDark: '#0284c7',
  primaryLight: '#38bdf8',
  accent: '#0ea5e9',
  background: '#f0f9ff',
  border: '#0ea5e9',
  borderLight: '#e2e8f0',
  buttonGradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
  selectedBg: '#e0f2fe',
  lightBg: '#f0f9ff',
  progressBar: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
};

const concessionDescriptions: Record<string, string> = {
  'WEE': 'Wytwarzanie energii elektrycznej',
  'PCC': 'Przesyłanie ciepła',
  'WCC': 'Wytwarzanie ciepła',
  'OEE': 'Obrót energią elektryczną',
  'DEE': 'Dystrybucja energii elektrycznej',
  'OPG': 'Obrót paliwami gazowymi',
  'PPG': 'Przesyłanie paliw gazowych',
  'DPG': 'Dystrybucja paliw gazowych',
  'OCC': 'Obrót ciepłem',
  'PVA': 'Instalacje fotowoltaiczne',
  'WOA': 'Elektrownie wodne',
  'BGO': 'Instalacje biogazowe',
  'BGS': 'Biogazownie składowiskowe',
  'BGM': 'Biogazownie',
  'WIL': 'Elektrownie wiatrowe na lądzie',
  '15%': 'Koncesje paliwa inne 15%',
  '25%': 'Koncesje paliwa inne 25%',
  'OSDe': 'Operator systemu dystrybucyjnego elektroenergetycznego',
  'CONSUMER': 'Odbiorca energii',
  'SELLER': 'Sprzedawca zobowiązany'
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const processXMLFile = async (_xmlContent: string, _isStatic: boolean = false, _progressCallback?: (progress: number) => void) => {
  return [];
};

// === GŁÓWNY KOMPONENT ===
function App() {
  const [file, setFile] = useState<File | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [center] = useState<[number, number]>(defaultCenter);
  const [zoom] = useState<number>(6);
  const [filterProvince, setFilterProvince] = useState<string>("wszystkie");
  const [filterCounty, setFilterCounty] = useState<string>("wszystkie");
  const [filterMunicipality, setFilterMunicipality] = useState<string>("wszystkie");
  const [filterType, setFilterType] = useState<string>("wszystkie");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [dataType, setDataType] = useState<string>("wszystkie");
  const [filterCategory, setFilterCategory] = useState<string>("wszystkie");

  const [uploadedInstallations, setUploadedInstallations] = useState<Installation[]>([]);

  const [allData, setAllData] = useState<Installation[]>([]);

  const [legendExpanded, setLegendExpanded] = useState<boolean>(true);
  const [sourcesPanelExpanded, setSourcesPanelExpanded] = useState<boolean>(true);
  const [filtersPanelExpanded, setFiltersPanelExpanded] = useState<boolean>(true);

  const [supplierExpanded, setSupplierExpanded] = useState<boolean>(true);
  const [consumerExpanded, setConsumerExpanded] = useState<boolean>(true);
  const [intermediaryExpanded, setIntermediaryExpanded] = useState<boolean>(true);

  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([
    {
      id: 'supplier-large-koncesje',
      name: 'Koncesje URE',
      filename: 'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
      description: 'Duzi dostawcy - koncesje',
      enabled: true,
      category: 'supplier',
      subcategory: 'Duzi dostawcy',
      dataType: 'CONCESSION'
    },
    {
      id: 'supplier-small-mioze',
      name: 'MIOZE',
      filename: 'rejestr_wytworców_energii_w_malej_instalacji.json',
      description: 'Mali dostawcy - mikro instalacje',
      enabled: true,
      category: 'supplier',
      subcategory: 'Mali dostawcy',
      dataType: 'MIOZE'
    },
    {
      id: 'consumer-large',
      name: 'Duzi odbiorcy',
      filename: 'inf_prezensa_ure_2025.json',
      description: 'Informacja Prezesa URE 2025',
      enabled: true,
      category: 'consumer',
      subcategory: 'Duzi odbiorcy',
      dataType: 'CONSUMER'
    },
    {
      id: 'consumer-compensation',
      name: 'Odbiorcy wg rekompensat',
      filename: 'rekompensaty_2023_wykaz.json',
      description: 'Wykaz rekompensat 2023',
      enabled: true,
      category: 'consumer',
      subcategory: 'Odbiorcy wg rekompensat',
      dataType: 'CONSUMER'
    },
    {
      id: 'intermediary-operators',
      name: 'Operatorzy systemów',
      filename: 'operatorzy_systemow_elektroenergetycznych.json',
      description: 'Operatorzy systemów elektroenergetycznych',
      enabled: true,
      category: 'intermediary',
      subcategory: 'Operatorzy systemów',
      dataType: 'OPERATOR'
    },
    {
      id: 'intermediary-sellers',
      name: 'Sprzedawcy zobowiązani',
      filename: 'lista_sprzedawcow_zobowiazanych.json',
      description: 'Lista sprzedawców zobowiązanych',
      enabled: true,
      category: 'intermediary',
      subcategory: 'Sprzedawcy zobowiązani',
      dataType: 'SELLER'
    }
  ]);

  // USUNIĘTO: colorblindMode, toggleColorblindMode
  // Tworzymy ikony z etykietami raz przy montowaniu
  const currentIcons = React.useMemo(() => {
    return createIconsWithLabels(iconColors);
  }, []);

  const toggleDataSource = (id: string) => {
    setDataSources(prev => prev.map(source =>
      source.id === id ? { ...source, enabled: !source.enabled } : source
    ));
  };

  useEffect(() => {
    const loadAllSources = async () => {
      setLoading(true);
      try {
        const promises = dataSources.map(async (source) => {
          try {
            const response = await fetch(`/data/processed/${source.filename}`);
            if (response.ok) {
              const data = await response.json();
              return data.map((item: Installation) => ({
                ...item,
                category: source.category,
                subcategory: source.subcategory
              }));
            }
          } catch (err) {
            console.error(`Błąd ładowania ${source.filename}:`, err);
          }
          return [];
        });

        const results = await Promise.all(promises);
        const combined = results.flat();
        setAllData(combined);
        setLoading(false);
      } catch (err) {
        console.error('Błąd ładowania danych:', err);
        setError('Nie udało się załadować danych');
        setLoading(false);
      }
    };
    loadAllSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let filteredBySource: Installation[] = [];
    
    dataSources.forEach(source => {
      if (source.enabled) {
        const sourceData = allData.filter(inst => 
          inst.category === source.category && 
          inst.subcategory === source.subcategory
        );
        filteredBySource = [...filteredBySource, ...sourceData];
      }
    });

    const combinedInstallations = [...filteredBySource, ...uploadedInstallations];
    setInstallations(combinedInstallations);
  }, [uploadedInstallations, allData, dataSources]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
    }
  };

  const parseUploadedFile = async () => {
    if (!file) {
      setError('Proszę wybrać plik');
      return;
    }
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const processedInstallations = await processXMLFile(e.target.result as string, false, setProgress);
            setUploadedInstallations(processedInstallations);
            setLoading(false);
            setProgress(100);
          } catch (error) {
            console.error('Error processing uploaded file:', error);
            setError('Błąd podczas przetwarzania pliku');
            setLoading(false);
          }
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading file:', error);
      setError('Błąd podczas odczytu pliku');
      setLoading(false);
    }
  };

  const filteredInstallations = installations.filter(inst => {
    const province = inst.installationProvince || inst.province;
    const county = inst.installationCounty || inst.county;
    const municipality = inst.municipality || 'nieznana';
    const matchesProvince = filterProvince === "wszystkie" || province === filterProvince;
    const matchesCounty = filterCounty === "wszystkie" || county === filterCounty;
    const matchesMunicipality = filterMunicipality === "wszystkie" || municipality === filterMunicipality;
    const matchesType = filterType === "wszystkie" || inst.installationType === filterType;
    const matchesDataType = dataType === "wszystkie" || inst.dataType === dataType;
    const matchesCategory = filterCategory === "wszystkie" || inst.category === filterCategory;
    const city = inst.installationCity || inst.city;
    const matchesSearch = searchTerm === "" ||
      inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProvince && matchesCounty && matchesMunicipality && matchesType && matchesDataType && matchesCategory && matchesSearch;
  });

  const provinces = Array.from(new Set(installations.map(i => i.installationProvince || i.province))).sort();
  const countiesSet = Array.from(new Set(installations.map(i => i.installationCounty || i.county).filter(c => c !== undefined)));
  const nieznanyCounties = countiesSet.filter(c => c === 'nieznany');
  const knownCounties = countiesSet.filter(c => c !== 'nieznany').sort();
  const counties = [...nieznanyCounties, ...knownCounties];
  const municipalitiesSet = Array.from(new Set(installations.map(i => i.municipality || 'nieznana').filter(m => m !== undefined)));
  const nieznaneMunicipalities = municipalitiesSet.filter(m => m === 'nieznana');
  const knownMunicipalities = municipalitiesSet.filter(m => m !== 'nieznana').sort();
  const municipalities = [...nieznaneMunicipalities, ...knownMunicipalities];
  const installationTypes = Array.from(new Set(installations.map(i => i.installationType))).sort();

  const supplierSources = dataSources.filter(s => s.category === 'supplier');
  const consumerSources = dataSources.filter(s => s.category === 'consumer');
  const intermediarySources = dataSources.filter(s => s.category === 'intermediary');

  const supplierBySubcategory = supplierSources.reduce((acc, source) => {
    if (!acc[source.subcategory]) acc[source.subcategory] = [];
    acc[source.subcategory].push(source);
    return acc;
  }, {} as Record<string, DataSourceConfig[]>);

  const consumerBySubcategory = consumerSources.reduce((acc, source) => {
    if (!acc[source.subcategory]) acc[source.subcategory] = [];
    acc[source.subcategory].push(source);
    return acc;
  }, {} as Record<string, DataSourceConfig[]>);

  const intermediaryBySubcategory = intermediarySources.reduce((acc, source) => {
    if (!acc[source.subcategory]) acc[source.subcategory] = [];
    acc[source.subcategory].push(source);
    return acc;
  }, {} as Record<string, DataSourceConfig[]>);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f0f4f8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
    }}>
      <header style={{
        background: theme.headerGradient,
        color: 'white',
        padding: '1.5rem 2rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          backgroundImage: `
            linear-gradient(45deg, transparent 48%, white 48%, white 52%, transparent 52%),
            linear-gradient(-45deg, transparent 48%, white 48%, white 52%, transparent 52%)
          `,
          backgroundSize: '30px 30px',
          pointerEvents: 'none'
        }}></div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Mapa Wytwórców Energii i Koncesji URE
          </h1>
          <div style={{ fontSize: '0.95rem', marginTop: '0.5rem', opacity: 0.95, fontWeight: 500 }}>
            {loading ? 'Ładowanie danych...' : `${installations.length} instalacji • ${filteredInstallations.length} wyświetlonych`}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: '350px',
          background: 'white',
          overflowY: 'auto',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.08)',
          padding: '1.25rem'
        }}>

          {/* PANEL ŹRÓDEŁ DANYCH */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              onClick={() => setSourcesPanelExpanded(!sourcesPanelExpanded)}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: theme.background,
                border: `2px solid ${theme.border}`,
                borderRadius: '10px',
                color: theme.primaryDark,
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.3s'
              }}
            >
              <span>Źródła danych</span>
              <span style={{ fontSize: '1.1rem' }}>{sourcesPanelExpanded ? '▼' : '▶'}</span>
            </button>

            {sourcesPanelExpanded && (
              <div style={{
                marginTop: '0.75rem',
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid #e2e8f0'
              }}>
                
                {/* DOSTAWCY */}
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setSupplierExpanded(!supplierExpanded)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.3s'
                    }}
                  >
                    <span>🏭 Dostawcy</span>
                    <span style={{ fontSize: '0.9rem' }}>{supplierExpanded ? '▼' : '▶'}</span>
                  </button>

                  {supplierExpanded && (
                    <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                      {Object.entries(supplierBySubcategory).map(([subcategory, sources]) => (
                        <div key={subcategory} style={{ marginBottom: '0.75rem' }}>
                          <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#64748b',
                            marginBottom: '0.5rem',
                            paddingLeft: '0.5rem'
                          }}>
                            {subcategory}
                          </div>
                          {sources.map(source => (
                            <label key={source.id} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              marginBottom: '0.5rem',
                              padding: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              background: source.enabled ? theme.selectedBg : 'transparent',
                              border: `1px solid ${source.enabled ? theme.border : 'transparent'}`,
                              transition: 'all 0.3s'
                            }}>
                              <input
                                type="checkbox"
                                checked={source.enabled}
                                onChange={() => toggleDataSource(source.id)}
                                style={{
                                  marginRight: '0.5rem',
                                  marginTop: '0.25rem',
                                  cursor: 'pointer',
                                  width: '16px',
                                  height: '16px',
                                  flexShrink: 0
                                }}
                              />
                              <div style={{ fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{source.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                                  {source.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ODBIORCY */}
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setConsumerExpanded(!consumerExpanded)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.3s'
                    }}
                  >
                    <span>🏢 Odbiorcy</span>
                    <span style={{ fontSize: '0.9rem' }}>{consumerExpanded ? '▼' : '▶'}</span>
                  </button>

                  {consumerExpanded && (
                    <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                      {Object.entries(consumerBySubcategory).map(([subcategory, sources]) => (
                        <div key={subcategory} style={{ marginBottom: '0.75rem' }}>
                          <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#64748b',
                            marginBottom: '0.5rem',
                            paddingLeft: '0.5rem'
                          }}>
                            {subcategory}
                          </div>
                          {sources.map(source => (
                            <label key={source.id} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              marginBottom: '0.5rem',
                              padding: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              background: source.enabled ? theme.selectedBg : 'transparent',
                              border: `1px solid ${source.enabled ? theme.border : 'transparent'}`,
                              transition: 'all 0.3s'
                            }}>
                              <input
                                type="checkbox"
                                checked={source.enabled}
                                onChange={() => toggleDataSource(source.id)}
                                style={{
                                  marginRight: '0.5rem',
                                  marginTop: '0.25rem',
                                  cursor: 'pointer',
                                  width: '16px',
                                  height: '16px',
                                  flexShrink: 0
                                }}
                              />
                              <div style={{ fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{source.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                                  {source.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* POŚREDNICY */}
                <div>
                  <button
                    onClick={() => setIntermediaryExpanded(!intermediaryExpanded)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.3s'
                    }}
                  >
                    <span>🔄 Pośrednicy</span>
                    <span style={{ fontSize: '0.9rem' }}>{intermediaryExpanded ? '▼' : '▶'}</span>
                  </button>

                  {intermediaryExpanded && (
                    <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                      {Object.entries(intermediaryBySubcategory).map(([subcategory, sources]) => (
                        <div key={subcategory} style={{ marginBottom: '0.75rem' }}>
                          <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#64748b',
                            marginBottom: '0.5rem',
                            paddingLeft: '0.5rem'
                          }}>
                            {subcategory}
                          </div>
                          {sources.map(source => (
                            <label key={source.id} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              marginBottom: '0.5rem',
                              padding: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              background: source.enabled ? theme.selectedBg : 'transparent',
                              border: `1px solid ${source.enabled ? theme.border : 'transparent'}`,
                              transition: 'all 0.3s'
                            }}>
                              <input
                                type="checkbox"
                                checked={source.enabled}
                                onChange={() => toggleDataSource(source.id)}
                                style={{
                                  marginRight: '0.5rem',
                                  marginTop: '0.25rem',
                                  cursor: 'pointer',
                                  width: '16px',
                                  height: '16px',
                                  flexShrink: 0
                                }}
                              />
                              <div style={{ fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{source.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                                  {source.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Upload pliku */}
          <div style={{
            marginBottom: '1.25rem',
            background: '#f8fafc',
            borderRadius: '10px',
            padding: '1.25rem',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#0f172a', fontWeight: 700 }}>
              Wczytaj plik XML
            </h3>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".xml"
              style={{
                width: '100%',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: 'white',
                border: '2px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.95rem',
                color: '#0f172a'
              }}
            />
            <button
              onClick={parseUploadedFile}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: loading ? '#94a3b8' : theme.buttonGradient,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'default' : 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                transition: 'all 0.3s',
                boxShadow: loading ? 'none' : '0 4px 6px rgba(14, 165, 233, 0.3)'
              }}
            >
              {loading ? 'Wczytywanie...' : 'Wczytaj plik'}
            </button>

            {loading && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#64748b', fontWeight: 500 }}>
                  Postęp: {progress}%
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: theme.progressBar,
                    transition: 'width 0.3s'
                  }}></div>
                </div>
              </div>
            )}

            {error && <p style={{ marginTop: '0.75rem', color: '#ef4444', fontSize: '0.9rem', fontWeight: 500 }}>{error}</p>}
          </div>

          {/* Filtry */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              onClick={() => setFiltersPanelExpanded(!filtersPanelExpanded)}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: theme.background,
                border: `2px solid ${theme.border}`,
                borderRadius: '10px',
                color: theme.primaryDark,
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.3s'
              }}
            >
              <span>Filtry</span>
              <span style={{ fontSize: '1.1rem' }}>{filtersPanelExpanded ? '▼' : '▶'}</span>
            </button>

            {filtersPanelExpanded && (
              <div style={{
                marginTop: '0.75rem',
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Kategoria:
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  >
                    <option value="wszystkie">Wszystkie</option>
                    <option value="supplier">Dostawcy</option>
                    <option value="consumer">Odbiorcy</option>
                    <option value="intermediary">Pośrednicy</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Typ danych:
                  </label>
                  <select
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  >
                    <option value="wszystkie">Wszystkie</option>
                    <option value="MIOZE">MIOZE</option>
                    <option value="CONCESSION">Koncesje</option>
                    <option value="OPERATOR">Operatorzy</option>
                    <option value="CONSUMER">Odbiorcy</option>
                    <option value="SELLER">Sprzedawcy</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Województwo:
                  </label>
                  <select
                    value={filterProvince}
                    onChange={(e) => setFilterProvince(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  >
                    <option value="wszystkie">Wszystkie</option>
                    {provinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Powiat:
                  </label>
                  <select
                    value={filterCounty}
                    onChange={(e) => setFilterCounty(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  >
                    <option value="wszystkie">Wszystkie</option>
                    {counties.map(county => (
                      <option key={county} value={county}>
                        {county === 'nieznany' ? '(nieznany)' : county}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Gmina:
                  </label>
                  <select
                    value={filterMunicipality}
                    onChange={(e) => setFilterMunicipality(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  >
                    <option value="wszystkie">Wszystkie</option>
                    {municipalities.map(municipality => (
                      <option key={municipality} value={municipality}>
                        {municipality === 'nieznana' ? '(nieznana)' : municipality}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Typ instalacji:
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  >
                    <option value="wszystkie">Wszystkie</option>
                    {installationTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Szukaj:
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nazwa lub miasto..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'white',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Statystyki */}
          <div style={{
            background: theme.lightBg,
            borderRadius: '10px',
            padding: '1.25rem',
            border: `2px solid ${theme.borderLight}`
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#0f172a', fontWeight: 700 }}>
              Statystyki
            </h3>
            <div style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '2' }}>
              <div><strong>Łącznie:</strong> <span style={{ color: theme.primaryDark, fontWeight: 600 }}>{installations.length}</span></div>
              <div><strong>Po filtrach:</strong> <span style={{ color: theme.accent, fontWeight: 600 }}>{filteredInstallations.length}</span></div>
              <div><strong>Dostawcy:</strong> {installations.filter(i => i.category === 'supplier').length}</div>
              <div><strong>Odbiorcy:</strong> {installations.filter(i => i.category === 'consumer').length}</div>
              <div><strong>Pośrednicy:</strong> {installations.filter(i => i.category === 'intermediary').length}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />

            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
            >
              {filteredInstallations.map((installation, index) => {
                const icon = currentIcons[installation.installationType] || currentIcons['default'];
                return (
                  <Marker
                    key={`${installation.id}-${index}`}
                    position={installation.coordinates}
                    icon={icon}
                  >
                    <Popup>
                      <div style={{ minWidth: '220px' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#0f172a', fontSize: '1.05rem' }}>
                          {installation.name}
                        </h3>
                        <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.8' }}>
                          <p style={{ margin: '0.3rem 0' }}>
                            <strong>Kategoria:</strong> {installation.category === 'supplier' ? 'Dostawca' : installation.category === 'consumer' ? 'Odbiorca' : 'Pośrednik'}
                          </p>
                          <p style={{ margin: '0.3rem 0' }}>
                            <strong>Podkategoria:</strong> {installation.subcategory}
                          </p>
                          <p style={{ margin: '0.3rem 0' }}>
                            <strong>Typ danych:</strong> {installation.dataType}
                          </p>
                          <p style={{ margin: '0.3rem 0' }}>
                            <strong>Typ instalacji:</strong> {installation.installationType}
                            {concessionDescriptions[installation.installationType] &&
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                                {concessionDescriptions[installation.installationType]}
                              </span>
                            }
                          </p>
                          <p style={{ margin: '0.3rem 0' }}>
                            <strong>Lokalizacja:</strong> {installation.installationCity || installation.city}, woj. {installation.installationProvince || installation.province}
                            {(installation.installationCounty || installation.county) && (
                              <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginTop: '0.1rem' }}>
                                Powiat: {(installation.installationCounty || installation.county) === 'nieznany' ? '(nieznany)' : (installation.installationCounty || installation.county)}
                              </span>
                            )}
                            {installation.municipality && installation.municipality !== 'nieznana' && (
                              <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginTop: '0.1rem' }}>
                                Gmina: {installation.municipality}
                              </span>
                            )}
                          </p>
                          {installation.power && (
                            <p style={{ margin: '0.3rem 0' }}>
                              <strong>Moc:</strong> {installation.power} MW
                            </p>
                          )}
                          <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                            <strong>Adres:</strong> {installation.postalCode} {installation.city}, {installation.address}
                          </p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>

          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(8px)',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.8)'
          }}>
            <img
              src="/marsoft.png"
              alt="MarSoft"
              style={{
                height: '45px',
                display: 'block'
              }}
            />
          </div>

          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
            maxWidth: '380px',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setLegendExpanded(!legendExpanded)}
              style={{
                width: '100%',
                padding: '1rem 1.25rem',
                background: theme.buttonGradient,
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>Legenda typów instalacji</span>
              <span style={{ fontSize: '1.1rem' }}>{legendExpanded ? '▼' : '▲'}</span>
            </button>

            {legendExpanded && (
              <div style={{
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '0.75rem',
                maxHeight: '250px',
                overflowY: 'auto'
              }}>
                {Object.entries(concessionDescriptions).map(([type, description]) => (
                  <div key={type} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.95rem'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: iconColors[type] || iconColors['default'],
                      flexShrink: 0,
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}></div>
                    <span style={{ color: '#0f172a' }}>
                      <strong>{type}</strong> - {description}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;