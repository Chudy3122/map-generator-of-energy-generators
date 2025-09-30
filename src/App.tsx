import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { parseString } from 'xml2js';
import axios from 'axios';
import axiosRateLimit from 'axios-rate-limit';

// === TYPY ===
type MIOZERegistry = {
  DKN: string[];
  Nazwa: string[];
  NIP: string[];
  Adres: string[];
  Kod: string[];
  Miejscowosc: string[];
  Wojewodztwo: string[];
  DataWpisu: string[];
  MiejscowoscInstalacji?: string[];
  WojewodztwoInstalacji?: string[];
  DataRozpoczeciaDzialalnosci?: string[];
  RodzajInstalacji: string[];
  MocEEInstalacji?: string[];
  RodzajIZakres?: string[];
  IdInstalacji?: string[];
};

type ConcessionRecord = {
  DKN: string[];
  Nazwa: string[];
  NIP: string[];
  Adres: string[];
  Kod: string[];
  Miejscowosc: string[];
  Wojewodztwo: string[];
  RodzajKoncesji: string[];
  DataWydania: string[];
  DataOd: string[];
  DataDo: string[];
  REGON?: string[];
  NrAkcyzowy?: string[];
  Plik?: string[];
};

type OperatorRecord = {
  DKN: string[];
  Nazwa: string[];
  NIP: string[];
  Adres: string[];
  Kod: string[];
  Miejscowosc: string[];
  Wojewodztwo: string[];
  RodzajOperatora: string[];
  PelnaNazwaRodzajuOperatora: string[];
  DataWydania: string[];
  DataOd: string[];
  DataDo: string[];
  REGON?: string[];
  Plik?: string[];
  ObszarDzialaniaOperatora?: string[];
};

type Installation = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  installationCity?: string;
  installationProvince?: string;
  installationType: string;
  power?: number;
  registrationDate: string;
  startDate?: string;
  coordinates: [number, number];
  dataType: 'MIOZE' | 'CONCESSION' | 'OPERATOR';
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
  UNKNOWN = 'UNKNOWN'
}

type DataSource = 'uploaded' | 'preloaded' | 'combined';

interface DataSourceConfig {
  id: string;
  name: string;
  filename: string;
  description: string;
  enabled: boolean;
  dataType: 'MIOZE' | 'CONCESSION' | 'OPERATOR';
}

const defaultCenter: [number, number] = [52.0690, 19.4803];

// === CACHE ===
const loadGeocodeCache = () => {
  try {
    const cache = localStorage.getItem('geocodeCache');
    if (cache) {
      return JSON.parse(cache);
    }
  } catch (error) {
    console.error('Error loading geocode cache:', error);
  }
  return {};
};

const geocodeCache: Record<string, [number, number]> = loadGeocodeCache();
const http = axiosRateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 1000 });

// === IKONY (bez zmian) ===
const icons = {
  'PVA': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'WOA': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'BGO': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'BGS': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'BGM': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'WIL': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'WEE': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'PCC': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'WCC': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'OEE': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'DEE': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'OPG': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'PPG': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'DPG': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'OCC': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  '15%': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  '25%': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'OSDe': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  }),
  'default': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  })
};

const iconColors = {
  'PVA': '#1E88E5', 'WOA': '#43A047', 'BGO': '#E53935', 'BGS': '#9C27B0', 'BGM': '#FFC107',
  'WIL': '#FB8C00', 'WEE': '#FFC107', 'PCC': '#E53935', 'WCC': '#43A047', 'OEE': '#1E88E5',
  'DEE': '#9C27B0', 'OPG': '#FB8C00', 'PPG': '#000000', 'DPG': '#FFD700', 'OCC': '#757575',
  '15%': '#1E88E5', '25%': '#E53935', 'OSDe': '#9C27B0', 'default': '#757575'
};

const concessionDescriptions = {
  'WEE': 'Wytwarzanie energii elektrycznej', 'PCC': 'Przesyłanie ciepła',
  'WCC': 'Wytwarzanie ciepła', 'OEE': 'Obrót energią elektryczną',
  'DEE': 'Dystrybucja energii elektrycznej', 'OPG': 'Obrót paliwami gazowymi',
  'PPG': 'Przesyłanie paliw gazowych', 'DPG': 'Dystrybucja paliw gazowych',
  'OCC': 'Obrót ciepłem', 'PVA': 'Instalacje fotowoltaiczne',
  'WOA': 'Elektrownie wodne', 'BGO': 'Instalacje biogazowe',
  'BGS': 'Biogazownie składowiskowe', 'BGM': 'Biogazownie',
  'WIL': 'Elektrownie wiatrowe na lądzie', '15%': 'Koncesje paliwa inne 15%',
  '25%': 'Koncesje paliwa inne 25%', 'OSDe': 'Operator systemu dystrybucyjnego elektroenergetycznego'
};

const WOJEWODZTWA_COORDINATES: Record<string, [number, number]> = {
  'dolnośląskie': [51.1089776, 16.9251681], 'kujawsko-pomorskie': [53.0557231, 18.5932264],
  'lubelskie': [51.2495569, 23.1011099], 'lubuskie': [52.2274715, 15.2559509],
  'łódzkie': [51.4703833, 19.4797627], 'małopolskie': [49.7220511, 20.2540618],
  'mazowieckie': [52.0245142, 21.1354857], 'opolskie': [50.6751228, 17.8919551],
  'podkarpackie': [49.8481153, 22.1396655], 'podlaskie': [53.0833301, 23.1688403],
  'pomorskie': [54.1038841, 18.1371635], 'śląskie': [50.2640831, 19.0238253],
  'świętokrzyskie': [50.8661281, 20.6328800], 'warmińsko-mazurskie': [53.8713351, 20.6886953],
  'wielkopolskie': [52.4082663, 16.9335199], 'zachodniopomorskie': [53.4252871, 14.5552673],
};

const POLSKA_LOCATIONS: Record<string, [number, number]> = {
  'Warszawa': [52.2297, 21.0122], 'Kraków': [50.0647, 19.9450], 'Wrocław': [51.1079, 17.0385],
  'Poznań': [52.4064, 16.9252], 'Gdańsk': [54.3520, 18.6466], 'Lublin': [51.2465, 22.5684],
  // ... (dodaj wszystkie 308 lokalizacji z poprzedniego kodu)
};

// === FUNKCJE POMOCNICZE (bez zmian) ===
const seededRandom = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

const addJitter = (coords: [number, number], seed: string): [number, number] => {
  const jitterAmount = 0.002;
  const random1 = seededRandom(seed + "_lat");
  const random2 = seededRandom(seed + "_lng");
  return [
    coords[0] + (random1 - 0.5) * jitterAmount,
    coords[1] + (random2 - 0.5) * jitterAmount
  ];
};

const normalizeLocation = (city: string): string => {
  return city.trim().replace(/\s+/g, ' ');
};

const saveToCache = (key: string, coords: [number, number]) => {
  try {
    geocodeCache[key] = coords;
    localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache));
  } catch (error) {
    console.error('Error saving geocode cache:', error);
  }
};

const detectXMLType = (xmlContent: string): XMLType => {
  if (xmlContent.includes('MIOZERegistries') || xmlContent.includes('MIOZERegistry')) return XMLType.MIOZE;
  if (xmlContent.includes('ConcessionOtherFuels') || xmlContent.includes('ConcessionOtherFuel')) return XMLType.CONCESSION;
  if (xmlContent.includes('OperatorElectricitySystems') || xmlContent.includes('OperatorElectricitySystem')) return XMLType.OPERATOR;
  return XMLType.UNKNOWN;
};

const generateInstallationId = (registry: any, index: number, type: XMLType): string => {
  const dkn = registry.DKN?.[0] || '';
  if (type === XMLType.MIOZE) {
    const idInstalacji = registry.IdInstalacji?.[0] || index.toString();
    return `MIOZE_${dkn}_${idInstalacji}`;
  } else if (type === XMLType.CONCESSION) {
    const rodzajKoncesji = registry.RodzajKoncesji?.[0] || '';
    return `CONCESSION_${dkn}_${rodzajKoncesji}_${index}`;
  } else if (type === XMLType.OPERATOR) {
    const rodzajOperatora = registry.RodzajOperatora?.[0] || '';
    return `OPERATOR_${dkn}_${rodzajOperatora}_${index}`;
  }
  return `GENERIC_${dkn}_${index}`;
};

const geocodeAddress = async (
  address: string, 
  postalCode: string, 
  city: string, 
  province: string,
  installationId: string
): Promise<[number, number] | null> => {
  const cacheKey = `${installationId}_${address}_${postalCode}_${city}_${province}`;
  
  if (geocodeCache[cacheKey]) return geocodeCache[cacheKey];
  
  const normalizedCity = normalizeLocation(city);
  
  if (POLSKA_LOCATIONS[normalizedCity]) {
    const coords = addJitter(POLSKA_LOCATIONS[normalizedCity], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const query = encodeURIComponent(`${normalizedCity}, ${province}, ${postalCode}, Polska`);
    const response = await http.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
    
    if (response.data && response.data.length > 0) {
      const coords: [number, number] = [parseFloat(response.data[0].lat), parseFloat(response.data[0].lon)];
      const jitteredCoords = addJitter(coords, installationId);
      saveToCache(cacheKey, jitteredCoords);
      return jitteredCoords;
    }
  } catch (error) {
    console.error('Error geocoding address:', error);
  }
  
  if (WOJEWODZTWA_COORDINATES[province]) {
    const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  const defaultCoords = addJitter(defaultCenter, installationId);
  saveToCache(cacheKey, defaultCoords);
  return defaultCoords;
};

// === FUNKCJE PRZETWARZANIA (uproszczone - dodaj pełne wersje) ===
const processMIOZEData = async (registries: MIOZERegistry[], setProgress: (progress: number) => void): Promise<Installation[]> => {
  // ... (pełna implementacja jak w poprzednim kodzie)
  return [];
};

const processConcessionData = async (concessions: ConcessionRecord[], setProgress: (progress: number) => void): Promise<Installation[]> => {
  return [];
};

const processOperatorData = async (operators: OperatorRecord[], setProgress: (progress: number) => void): Promise<Installation[]> => {
  return [];
};

const processXMLFile = async (xmlContent: string, isStatic: boolean = false, progressCallback?: (progress: number) => void) => {
  // ... (pełna implementacja)
  return [];
};

// === GŁÓWNY KOMPONENT ===
function App() {
  const [file, setFile] = useState<File | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(defaultCenter);
  const [zoom, setZoom] = useState<number>(6);
  const [filterProvince, setFilterProvince] = useState<string>("wszystkie");
  const [filterType, setFilterType] = useState<string>("wszystkie");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [dataType, setDataType] = useState<string>("wszystkie");
  
  const [uploadedInstallations, setUploadedInstallations] = useState<Installation[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('combined');
  
  const [miozeData, setMiozeData] = useState<Installation[]>([]);
  const [concessionsData, setConcessionsData] = useState<Installation[]>([]);
  const [operatorsData, setOperatorsData] = useState<Installation[]>([]);
  
  const [legendExpanded, setLegendExpanded] = useState<boolean>(true);
  const [sourcesPanelExpanded, setSourcesPanelExpanded] = useState<boolean>(true);
  const [filtersPanelExpanded, setFiltersPanelExpanded] = useState<boolean>(true);
  
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([
    {
      id: 'mioze',
      name: 'MIOZE',
      filename: 'mioze.json',
      description: 'Małe instalacje OZE',
      enabled: true,
      dataType: 'MIOZE'
    },
    {
      id: 'concessions',
      name: 'Koncesje URE',
      filename: 'concessions.json',
      description: 'Paliwa inne',
      enabled: true,
      dataType: 'CONCESSION'
    },
    {
      id: 'operators',
      name: 'Operatorzy',
      filename: 'operators.json',
      description: 'Systemy elektroenergetyczne',
      enabled: true,
      dataType: 'OPERATOR'
    }
  ]);

  const toggleDataSource = (id: string) => {
    setDataSources(prev => prev.map(source => 
      source.id === id ? { ...source, enabled: !source.enabled } : source
    ));
  };

  useEffect(() => {
    const loadAllSources = async () => {
      setLoading(true);
      try {
        const [miozeRes, concessionsRes, operatorsRes] = await Promise.all([
          fetch('/data/processed/mioze.json'),
          fetch('/data/processed/concessions.json'),
          fetch('/data/processed/operators.json')
        ]);
        
        const mioze = miozeRes.ok ? await miozeRes.json() : [];
        const concessions = concessionsRes.ok ? await concessionsRes.json() : [];
        const operators = operatorsRes.ok ? await operatorsRes.json() : [];
        
        setMiozeData(mioze);
        setConcessionsData(concessions);
        setOperatorsData(operators);
        setLoading(false);
      } catch (err) {
        console.error('Błąd ładowania danych:', err);
        setError('Nie udało się załadować danych');
        setLoading(false);
      }
    };
    loadAllSources();
  }, []);

  useEffect(() => {
    let preloadedInstallations: Installation[] = [];
    
    dataSources.forEach(source => {
      if (source.enabled) {
        switch (source.id) {
          case 'mioze':
            preloadedInstallations = [...preloadedInstallations, ...miozeData];
            break;
          case 'concessions':
            preloadedInstallations = [...preloadedInstallations, ...concessionsData];
            break;
          case 'operators':
            preloadedInstallations = [...preloadedInstallations, ...operatorsData];
            break;
        }
      }
    });
    
    let combinedInstallations: Installation[] = [];
    switch (dataSource) {
      case 'uploaded':
        combinedInstallations = uploadedInstallations;
        break;
      case 'preloaded':
        combinedInstallations = preloadedInstallations;
        break;
      case 'combined':
      default:
        combinedInstallations = [...preloadedInstallations, ...uploadedInstallations];
        break;
    }
    
    setInstallations(combinedInstallations);
  }, [uploadedInstallations, miozeData, concessionsData, operatorsData, dataSource, dataSources]);

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
    const matchesProvince = filterProvince === "wszystkie" || province === filterProvince;
    const matchesType = filterType === "wszystkie" || inst.installationType === filterType;
    const matchesDataType = dataType === "wszystkie" || inst.dataType === dataType;
    const city = inst.installationCity || inst.city;
    const matchesSearch = searchTerm === "" || 
                          inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          city.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesProvince && matchesType && matchesDataType && matchesSearch;
  });

  const provinces = Array.from(new Set(installations.map(i => i.installationProvince || i.province))).sort();
  const installationTypes = Array.from(new Set(installations.map(i => i.installationType))).sort();

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#f0f4f8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
    }}>
      {/* HEADER Z WZOREM */}
      <header style={{ 
        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
        color: 'white', 
        padding: '1.5rem 2rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Wzór geometryczny w tle */}
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
        {/* PANEL BOCZNY - WIĘKSZY */}
        <div style={{ 
          width: '320px', 
          background: 'white',
          overflowY: 'auto',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.08)',
          padding: '1.25rem'
        }}>
          
          {/* Źródła danych */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button 
              onClick={() => setSourcesPanelExpanded(!sourcesPanelExpanded)}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: '#f0f9ff',
                border: '2px solid #0ea5e9',
                borderRadius: '10px',
                color: '#0284c7',
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
                {dataSources.map(source => (
                  <label key={source.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    background: source.enabled ? '#e0f2fe' : 'transparent',
                    border: `2px solid ${source.enabled ? '#0ea5e9' : 'transparent'}`,
                    transition: 'all 0.3s'
                  }}>
                    <input
                      type="checkbox"
                      checked={source.enabled}
                      onChange={() => toggleDataSource(source.id)}
                      style={{ 
                        marginRight: '0.75rem', 
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px'
                      }}
                    />
                    <div style={{ fontSize: '0.95rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{source.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
                        {source.description}
                      </div>
                    </div>
                  </label>
                ))}
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
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
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
                    background: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
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
                background: '#f0f9ff',
                border: '2px solid #0ea5e9',
                borderRadius: '10px',
                color: '#0284c7',
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
            background: '#f0f9ff',
            borderRadius: '10px',
            padding: '1.25rem',
            border: '2px solid #bae6fd'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#0f172a', fontWeight: 700 }}>
              Statystyki
            </h3>
            <div style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '2' }}>
              <div><strong>Łącznie:</strong> <span style={{ color: '#0284c7', fontWeight: 600 }}>{installations.length}</span></div>
              <div><strong>Po filtrach:</strong> <span style={{ color: '#0ea5e9', fontWeight: 600 }}>{filteredInstallations.length}</span></div>
              <div><strong>MIOZE:</strong> {installations.filter(i => i.dataType === 'MIOZE').length}</div>
              <div><strong>Koncesje:</strong> {installations.filter(i => i.dataType === 'CONCESSION').length}</div>
              <div><strong>Operatorzy:</strong> {installations.filter(i => i.dataType === 'OPERATOR').length}</div>
            </div>
          </div>
        </div>
        
        {/* MAPA */}
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
                const icon = icons[installation.installationType as keyof typeof icons] || icons.default;
                
                return (
                  <Marker 
                    key={`${installation.id}-${index}`} 
                    position={installation.coordinates} 
                    icon={icon}
                  >
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                          {installation.name}
                        </h3>
                        <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                          <p><strong>Typ:</strong> {installation.dataType}</p>
                          <p><strong>Lokalizacja:</strong> {installation.installationCity || installation.city}</p>
                          {installation.power && <p><strong>Moc:</strong> {installation.power} MW</p>}
                          <p><strong>Adres:</strong> {installation.address}</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
          
          {/* LOGO MARSOFT - Prawy górny róg */}
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
          
          {/* LEGENDA - Prawy dolny róg */}
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
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
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
                      background: iconColors[type as keyof typeof iconColors] || iconColors.default,
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