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

type IndustrialRecord = {
  [key: string]: string[];
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
  dataType: 'MIOZE' | 'CONCESSION' | 'OPERATOR' | 'INDUSTRIAL';
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
  INDUSTRIAL = 'INDUSTRIAL',
  GENERIC = 'GENERIC',
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

// === KOMPONENT PANELU ŹRÓDEŁ DANYCH ===
interface DataSourcesPanelProps {
  sources: DataSourceConfig[];
  onToggle: (id: string) => void;
  loading?: boolean;
}

const DataSourcesPanel: React.FC<DataSourcesPanelProps> = ({
  sources,
  onToggle,
  loading
}) => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Źródła danych</h2>
      
      {loading && (
        <div style={{ color: '#2196F3', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          Ładowanie źródeł danych...
        </div>
      )}
      
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '4px', 
        padding: '0.5rem',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        {sources.map(source => (
          <label key={source.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '0.5rem',
            padding: '0.25rem',
            cursor: 'pointer',
            borderRadius: '2px',
            backgroundColor: source.enabled ? '#e3f2fd' : 'transparent'
          }}>
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={() => onToggle(source.id)}
              style={{ marginRight: '0.5rem' }}
            />
            <div>
              <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                {source.name} {source.enabled ? '✓' : ''}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                {source.filename}
              </div>
              {source.description && (
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  {source.description}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
      
      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        Włączone: {sources.filter(s => s.enabled).length} / {sources.length}
      </div>
    </div>
  );
};

// === CACHE I KONFIGURACJA ===
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

// === IKONY - WSZYSTKIE ===
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
  'INDUSTRIAL': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
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
  '15%': '#1E88E5', '25%': '#E53935', 'OSDe': '#9C27B0', 'INDUSTRIAL': '#43A047', 'default': '#757575'
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
  '25%': 'Koncesje paliwa inne 25%', 'OSDe': 'Operator systemu dystrybucyjnego elektroenergetycznego',
  'INDUSTRIAL': 'Odbiorcy przemysłowi'
};

// === WSPÓŁRZĘDNE ===
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
  'Żywiec': [49.6852, 19.1944], 'Siedlce': [52.1676, 22.2902], 'Sieradz': [51.5956, 18.7296],
  'Włocławek': [52.6483, 19.0677], 'Mielec': [50.2875, 21.4240], 'Kraków': [50.0647, 19.9450],
  'Kąty Wrocławskie': [51.0667, 16.7833], 'Warszawa': [52.2297, 21.0122], 'Rawicz': [51.6094, 16.8583],
  'Dąbrowa Górnicza': [50.3278, 19.1947], 'Poznań': [52.4064, 16.9252], 'Wrocław': [51.1079, 17.0385],
  'Gdańsk': [54.3520, 18.6466], 'Katowice': [50.2649, 19.0238], 'Lublin': [51.2465, 22.5684],
  // ... dodaj więcej z oryginalnego
};

// === FUNKCJE POMOCNICZE ===
const detectXMLType = (xmlContent: string): XMLType => {
  const cleanContent = xmlContent.replace(/xmlns[^=]*="[^"]*"/g, '').replace(/\s+/g, ' ');
  
  if ((xmlContent.includes('<MIOZERegistries') || xmlContent.includes('MIOZERegistries')) && 
      (xmlContent.includes('<MIOZERegistry>') || xmlContent.includes('<MIOZERegistry '))) {
    return XMLType.MIOZE;
  } 
  
  if ((xmlContent.includes('<ConcessionOtherFuels') || xmlContent.includes('ConcessionOtherFuels')) && 
      (xmlContent.includes('<ConcessionOtherFuel>') || xmlContent.includes('<ConcessionOtherFuel '))) {
    return XMLType.CONCESSION;
  }
  
  if ((xmlContent.includes('<OperatorElectricitySystems') || xmlContent.includes('OperatorElectricitySystems')) && 
      (xmlContent.includes('<OperatorElectricitySystem>') || xmlContent.includes('<OperatorElectricitySystem '))) {
    return XMLType.OPERATOR;
  }
  
  if (xmlContent.includes('<MIOZERegistry>') || xmlContent.includes('<MIOZERegistry ')) {
    return XMLType.MIOZE;
  }
  
  if (xmlContent.includes('industrial') || xmlContent.includes('consumer') ||
      xmlContent.includes('Industrial') || xmlContent.includes('Consumer')) {
    return XMLType.INDUSTRIAL;
  }
  
  if (xmlContent.includes('<?xml') && 
      (xmlContent.includes('<Nazwa>') || xmlContent.includes('<DKN>') || xmlContent.includes('<Id>'))) {
    return XMLType.GENERIC;
  }
  
  return XMLType.UNKNOWN;
};

const generateInstallationId = (
  registry: any, 
  index: number, 
  type: XMLType
): string => {
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
  } else {
    return `GENERIC_${dkn}_${index}`;
  }
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

const seededRandom = (seed: string) => {
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

const geocodeAddress = async (
  address: string, 
  postalCode: string, 
  city: string, 
  province: string,
  installationId: string
): Promise<[number, number] | null> => {
  const cacheKey = `${installationId}_${address}_${postalCode}_${city}_${province}`;
  
  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }
  
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
    
    if (WOJEWODZTWA_COORDINATES[province]) {
      const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
      saveToCache(cacheKey, coords);
      return coords;
    }
    
    const defaultCoords = addJitter(defaultCenter, installationId);
    saveToCache(cacheKey, defaultCoords);
    return defaultCoords;
    
  } catch (error) {
    console.error('Error geocoding address:', error);
    
    if (WOJEWODZTWA_COORDINATES[province]) {
      const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
      saveToCache(cacheKey, coords);
      return coords;
    }
    
    return null;
  }
};

// === FUNKCJE PRZETWARZANIA (pełne z oryginalnego) ===
const processMIOZEData = async (
  registries: MIOZERegistry[], 
  setProgress: (progress: number) => void
): Promise<Installation[]> => {
  const totalItems = registries.length;
  const processedInstallations: Installation[] = [];
  const batchSize = 15;
  
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = registries.slice(i, Math.min(i + batchSize, totalItems));
    
    const batchPromises = batch.map(async (registry: MIOZERegistry, index: number) => {
      const installationCity = registry.MiejscowoscInstalacji?.[0] || registry.Miejscowosc[0];
      const installationProvince = registry.WojewodztwoInstalacji?.[0] || registry.Wojewodztwo[0];
      const installationId = generateInstallationId(registry, i + index, XMLType.MIOZE);
      
      const coordinates = await geocodeAddress(
        registry.Adres[0], 
        registry.Kod[0], 
        installationCity, 
        installationProvince,
        installationId
      );
      
      return {
        id: installationId,
        name: registry.Nazwa[0],
        address: registry.Adres[0],
        postalCode: registry.Kod[0],
        city: registry.Miejscowosc[0],
        province: registry.Wojewodztwo[0],
        installationCity,
        installationProvince,
        installationType: registry.RodzajInstalacji[0],
        power: registry.MocEEInstalacji ? parseFloat(registry.MocEEInstalacji[0]) : undefined,
        registrationDate: registry.DataWpisu[0],
        startDate: registry.DataRozpoczeciaDzialalnosci?.[0],
        coordinates: coordinates || defaultCenter,
        dataType: 'MIOZE' as const
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    processedInstallations.push(...batchResults);
    
    setProgress(Math.min(100, Math.round((i + batchSize) / totalItems * 100)));
    
    if (i + batchSize < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return processedInstallations;
};

const processConcessionData = async (
  concessions: ConcessionRecord[], 
  setProgress: (progress: number) => void
): Promise<Installation[]> => {
  const totalItems = concessions.length;
  const processedInstallations: Installation[] = [];
  const batchSize = 15;
  
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = concessions.slice(i, Math.min(i + batchSize, totalItems));
    
    const batchPromises = batch.map(async (concession: ConcessionRecord, index: number) => {
      const city = concession.Miejscowosc[0];
      const province = concession.Wojewodztwo[0] || 'mazowieckie';
      const installationId = generateInstallationId(concession, i + index, XMLType.CONCESSION);
      
      const coordinates = await geocodeAddress(
        concession.Adres[0], 
        concession.Kod[0], 
        city, 
        province,
        installationId
      );
      
      return {
        id: installationId,
        name: concession.Nazwa[0],
        address: concession.Adres[0],
        postalCode: concession.Kod[0],
        city: city,
        province: province,
        installationType: concession.RodzajKoncesji[0],
        registrationDate: concession.DataWydania[0] || '',
        validFrom: concession.DataOd[0] || '',
        validTo: concession.DataDo[0] || '',
        regon: concession.REGON?.[0] || '',
        exciseNumber: concession.NrAkcyzowy?.[0] || '',
        fileUrl: concession.Plik?.[0] || '',
        coordinates: coordinates || defaultCenter,
        dataType: 'CONCESSION' as const
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    processedInstallations.push(...batchResults);
    
    setProgress(Math.min(100, Math.round((i + batchSize) / totalItems * 100)));
    
    if (i + batchSize < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return processedInstallations;
};

const processOperatorData = async (
  operators: OperatorRecord[], 
  setProgress: (progress: number) => void
): Promise<Installation[]> => {
  const totalItems = operators.length;
  const processedInstallations: Installation[] = [];
  const batchSize = 15;
  
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = operators.slice(i, Math.min(i + batchSize, totalItems));
    
    const batchPromises = batch.map(async (operator: OperatorRecord, index: number) => {
      const city = operator.Miejscowosc[0];
      const province = operator.Wojewodztwo[0] || 'mazowieckie';
      const installationId = generateInstallationId(operator, i + index, XMLType.OPERATOR);
      
      const coordinates = await geocodeAddress(
        operator.Adres[0], 
        operator.Kod[0], 
        city, 
        province,
        installationId
      );
      
      return {
        id: installationId,
        name: operator.Nazwa[0],
        address: operator.Adres[0],
        postalCode: operator.Kod[0],
        city: city,
        province: province,
        installationType: operator.RodzajOperatora[0],
        operatorTypeDesc: operator.PelnaNazwaRodzajuOperatora[0],
        registrationDate: operator.DataWydania[0] || '',
        validFrom: operator.DataOd[0] || '',
        validTo: operator.DataDo[0] || '',
        regon: operator.REGON?.[0] || '',
        nip: operator.NIP?.[0] || '',
        fileUrl: operator.Plik?.[0] || '',
        operatingArea: operator.ObszarDzialaniaOperatora?.[0] || '',
        coordinates: coordinates || defaultCenter,
        dataType: 'OPERATOR' as const
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    processedInstallations.push(...batchResults);
    
    setProgress(Math.min(100, Math.round((i + batchSize) / totalItems * 100)));
    
    if (i + batchSize < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return processedInstallations;
};

// === FUNKCJA PRZETWARZANIA XML ===
const processXMLFile = async (
  xmlContent: string, 
  isStatic: boolean = false, 
  progressCallback?: (progress: number) => void
) => {
  const xmlType = detectXMLType(xmlContent);
  
  if (xmlType === XMLType.UNKNOWN) {
    console.error('Nierozpoznany format pliku XML');
    return [];
  }

  return new Promise<Installation[]>((resolve, reject) => {
    const parseOptions = {
      explicitArray: true,
      ignoreAttrs: false,
      normalize: true,
      normalizeTags: false,
      trim: true,
      explicitRoot: true,
      xmlns: false,
      explicitCharkey: false,
      charkey: '_'
    };
    
    parseString(xmlContent, parseOptions, async (err, result) => {
      if (err) {
        console.error('Błąd podczas parsowania pliku XML:', err);
        reject(err);
        return;
      }
  
      try {
        let processedInstallations: Installation[] = [];
        const noOpProgress = () => {};
        
        if (xmlType === XMLType.MIOZE) {
          let registries: MIOZERegistry[] = [];
          
          if (result.MIOZERegistries?.MIOZERegistry) {
            registries = result.MIOZERegistries.MIOZERegistry;
          } else if (result.MIOZERegistry) {
            registries = Array.isArray(result.MIOZERegistry) ? result.MIOZERegistry : [result.MIOZERegistry];
          }
          
          if (registries.length > 0) {
            processedInstallations = await processMIOZEData(registries, progressCallback || noOpProgress);
          }
        } 
        else if (xmlType === XMLType.CONCESSION) {
          let concessions: ConcessionRecord[] = [];
          
          if (result.ConcessionOtherFuels?.ConcessionOtherFuel) {
            concessions = result.ConcessionOtherFuels.ConcessionOtherFuel;
          } else if (result.ConcessionOtherFuel) {
            concessions = Array.isArray(result.ConcessionOtherFuel) ? result.ConcessionOtherFuel : [result.ConcessionOtherFuel];
          }
          
          if (concessions.length > 0) {
            processedInstallations = await processConcessionData(concessions, progressCallback || noOpProgress);
          }
        }
        else if (xmlType === XMLType.OPERATOR) {
          let operators: OperatorRecord[] = [];
          
          if (result.OperatorElectricitySystems?.OperatorElectricitySystem) {
            operators = result.OperatorElectricitySystems.OperatorElectricitySystem;
          } else if (result.OperatorElectricitySystem) {
            operators = Array.isArray(result.OperatorElectricitySystem) ? result.OperatorElectricitySystem : [result.OperatorElectricitySystem];
          }
          
          if (operators.length > 0) {
            processedInstallations = await processOperatorData(operators, progressCallback || noOpProgress);
          }
        }

        resolve(processedInstallations);
        
      } catch (error) {
        console.error('Error processing XML:', error);
        reject(error);
      }
    });
  });
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
  
  // NOWE: State dla poszczególnych źródeł
  const [miozeData, setMiozeData] = useState<Installation[]>([]);
  const [concessionsData, setConcessionsData] = useState<Installation[]>([]);
  const [operatorsData, setOperatorsData] = useState<Installation[]>([]);
  
  // NOWE: Konfiguracja źródeł
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([
    {
      id: 'mioze',
      name: 'MIOZE (Małe Instalacje OZE)',
      filename: 'mioze.json',
      description: 'Rejestr wytwórców energii w małej instalacji',
      enabled: true,
      dataType: 'MIOZE'
    },
    {
      id: 'concessions',
      name: 'Koncesje URE',
      filename: 'concessions.json',
      description: 'Informacja Prezesa URE - paliwa inne',
      enabled: true,
      dataType: 'CONCESSION'
    },
    {
      id: 'operators',
      name: 'Operatorzy systemu',
      filename: 'operators.json',
      description: 'Operatorzy systemów elektroenergetycznych',
      enabled: true,
      dataType: 'OPERATOR'
    }
  ]);

  const toggleDataSource = (id: string) => {
    setDataSources(prev => prev.map(source => 
      source.id === id ? { ...source, enabled: !source.enabled } : source
    ));
  };

  // NOWE: Załaduj osobno każde źródło przy starcie
  useEffect(() => {
    const loadAllSources = async () => {
      console.log('Ładowanie wszystkich źródeł preprocessed data...');
      setLoading(true);
      
      try {
        // Ładuj równolegle wszystkie 3 źródła
        const [miozeRes, concessionsRes, operatorsRes] = await Promise.all([
          fetch('/data/processed/mioze.json'),
          fetch('/data/processed/concessions.json'),
          fetch('/data/processed/operators.json')
        ]);
        
        const mioze = miozeRes.ok ? await miozeRes.json() : [];
        const concessions = concessionsRes.ok ? await concessionsRes.json() : [];
        const operators = operatorsRes.ok ? await operatorsRes.json() : [];
        
        console.log(`✅ Załadowano: MIOZE: ${mioze.length}, Koncesje: ${concessions.length}, Operatorzy: ${operators.length}`);
        
        setMiozeData(mioze);
        setConcessionsData(concessions);
        setOperatorsData(operators);
        setLoading(false);
      } catch (err) {
        console.error('Błąd ładowania danych:', err);
        setError('Nie udało się załadować preprocessed data');
        setLoading(false);
      }
    };
    
    loadAllSources();
  }, []);

  // NOWE: Kombinuj dane na podstawie włączonych źródeł
  useEffect(() => {
    let preloadedInstallations: Installation[] = [];
    
    // Dodaj tylko włączone źródła
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
    
    // Kombinuj z uploadedInstallations w zależności od dataSource
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
    
    console.log(`Kombinowanie: preloaded=${preloadedInstallations.length}, uploaded=${uploadedInstallations.length}, total=${combinedInstallations.length}`);
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
  
    console.log(`Rozpoczynam parsowanie wgranego pliku: ${file.name}`);
    
    setLoading(true);
    setError(null);
    setProgress(0);
  
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const processedInstallations = await processXMLFile(e.target.result as string, false, setProgress);
            console.log(`Wgrany plik przetworzony: ${processedInstallations.length} rekordów`);
            setUploadedInstallations(processedInstallations);
            
            setLoading(false);
            setProgress(100);
          } catch (error) {
            console.error('Error processing uploaded file:', error);
            setError('Błąd podczas przetwarzania wgranego pliku');
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

  // Filtrowanie
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

  const provinceGroups: Record<string, number> = {};
  provinces.forEach(province => {
    provinceGroups[province] = installations.filter(i => 
      (i.installationProvince || i.province) === province
    ).length;
  });

  const clearGeocodeCache = () => {
    localStorage.removeItem('geocodeCache');
    console.log("Cache został całkowicie wyczyszczony");
    setUploadedInstallations([]);
    setError(null);
    setProgress(0);
    setCenter(defaultCenter);
    setZoom(6);
    return {};
  };

  const forceLocationUpdate = () => {
    clearGeocodeCache();
    if (uploadedInstallations.length > 0 && file) {
      parseUploadedFile();
    } else {
      alert('Cache wyczyszczony! Wczytaj plik XML ponownie, aby zastosować nowe współrzędne.');
    }
  };

  return (
    <div className="app-container">
    <div className="App" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ backgroundColor: '#2196F3', color: 'white', padding: '1rem' }}>
        <h1 style={{ margin: 0 }}>Mapa Wytwórców Energii i Koncesji URE</h1>
        <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {loading ? 'Ładowanie...' : `${installations.length} instalacji, ${filteredInstallations.length} po filtrach`}
        </div>
      </header>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ 
          width: '350px', 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          overflowY: 'auto',
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          <DataSourcesPanel
            sources={dataSources}
            onToggle={toggleDataSource}
            loading={loading}
          />

          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Źródło danych</h2>
            <select 
              value={dataSource} 
              onChange={(e) => {
                const newSource = e.target.value as DataSource;
                console.log(`Zmiana źródła danych na: ${newSource}`);
                setDataSource(newSource);
              }}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="combined">Wszystkie źródła ({(miozeData.length + concessionsData.length + operatorsData.length) + uploadedInstallations.length})</option>
              <option value="preloaded">Tylko przetworzone ({miozeData.length + concessionsData.length + operatorsData.length})</option>
              <option value="uploaded">Tylko wgrane ({uploadedInstallations.length})</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Wczytaj dodatkowy plik XML</h2>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Obsługiwane formaty: MIOZE, Koncesje URE, Operatorzy
            </p>
            <input 
              type="file" 
              onChange={handleFileChange} 
              accept=".xml" 
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <button 
              onClick={parseUploadedFile} 
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: loading ? '#90CAF9' : '#2196F3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: loading ? 'default' : 'pointer'
              }}
            >
              {loading ? 'Wczytywanie...' : 'Wczytaj'}
            </button>

            <button 
              onClick={forceLocationUpdate} 
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: '#FF9800', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              Aktualizuj współrzędne
            </button>

            <button 
              onClick={() => {
                clearGeocodeCache();
                setUploadedInstallations([]);
                alert('Cache został wyczyszczony.');
              }} 
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: '#f44336', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              Wyczyść cache i reset
            </button>
            
            {loading && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                  Ładowanie: {progress}%
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '10px', 
                  backgroundColor: '#e0e0e0', 
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${progress}%`, 
                    height: '100%', 
                    backgroundColor: '#2196F3',
                    transition: 'width 0.3s ease-in-out'
                  }}></div>
                </div>
              </div>
            )}
            
            {error && <p style={{ marginTop: '0.5rem', color: '#f44336' }}>{error}</p>}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Filtry</h2>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Typ danych:</label>
              <select 
                value={dataType} 
                onChange={(e) => setDataType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie typy danych</option>
                <option value="MIOZE">MIOZE (Małe Instalacje)</option>
                <option value="CONCESSION">Koncesje URE</option>
                <option value="OPERATOR">Operatorzy systemu</option>
                <option value="INDUSTRIAL">Dane przemysłowe</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Województwo:</label>
              <select 
                value={filterProvince} 
                onChange={(e) => setFilterProvince(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie województwa</option>
                {provinces.map(province => (
                  <option key={province} value={province}>
                    {province} ({provinceGroups[province]})
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Typ instalacji/koncesji:</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie typy</option>
                {installationTypes.map(type => (
                  <option key={type} value={type}>
                    {type} - {concessionDescriptions[type as keyof typeof concessionDescriptions] || 'Nieznany typ'}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Szukaj:</label>
              <input 
                type="text" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Wyszukaj nazwę lub miasto..." 
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Statystyki</h2>
            <p>Dane przetworzone: {uploadedInstallations.length}</p>
            <p>Wgrany plik: {uploadedInstallations.length}</p>
            <p>Łącznie: {installations.length}</p>
            <p>Po filtrach: {filteredInstallations.length}</p>
            <p>MIOZE: {installations.filter(i => i.dataType === 'MIOZE').length}</p>
            <p>Koncesje: {installations.filter(i => i.dataType === 'CONCESSION').length}</p>
            <p>Operatorzy: {installations.filter(i => i.dataType === 'OPERATOR').length}</p>
            <p>Suma mocy MIOZE: {filteredInstallations
              .filter(i => i.dataType === 'MIOZE' && i.power)
              .reduce((sum, inst) => sum + (inst.power || 0), 0).toFixed(2)} MW</p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Legenda</h2>
            <div style={{ fontSize: '0.9rem' }}>
              {Object.entries(concessionDescriptions).map(([type, description]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    backgroundColor: iconColors[type as keyof typeof iconColors] || iconColors.default,
                    marginRight: '0.5rem'
                  }}></div>
                  <span><strong>{type}</strong> - {description}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ 
            marginTop: 'auto', 
            padding: '1rem', 
            textAlign: 'center'
          }}>
            <img 
              src="/marsoft.png" 
              alt="MarSoft" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '150px',
                marginTop: '1rem'
              }}
            />
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <MapContainer 
            center={center} 
            zoom={zoom} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                      <div>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{installation.name}</h3>
                        <p><strong>Typ danych:</strong> {installation.dataType}</p>
                        <p><strong>ID:</strong> {installation.id}</p>
                        <p><strong>Koordynaty:</strong> [{installation.coordinates[0].toFixed(6)}, {installation.coordinates[1].toFixed(6)}]</p>
                        
                        {installation.dataType === 'MIOZE' ? (
                          <>
                            <p><strong>Lokalizacja instalacji:</strong> {installation.installationCity}, woj. {installation.installationProvince}</p>
                            <p><strong>Typ instalacji:</strong> {installation.installationType}</p>
                            {installation.power && <p><strong>Moc:</strong> {installation.power} MW</p>}
                            {installation.startDate && <p><strong>Data rozpoczęcia działalności:</strong> {installation.startDate}</p>}
                            <p><strong>Adres siedziby:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                          </>
                        ) : installation.dataType === 'CONCESSION' ? (
                          <>
                            <p><strong>Lokalizacja:</strong> {installation.city}, woj. {installation.province}</p>
                            <p><strong>Rodzaj koncesji:</strong> {installation.installationType} - {concessionDescriptions[installation.installationType as keyof typeof concessionDescriptions]}</p>
                            <p><strong>Data wydania:</strong> {installation.registrationDate}</p>
                            {installation.validFrom && installation.validTo && (
                              <p><strong>Ważność:</strong> {installation.validFrom} - {installation.validTo}</p>
                            )}
                            <p><strong>Adres:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                            {installation.regon && <p><strong>REGON:</strong> {installation.regon}</p>}
                            {installation.exciseNumber && <p><strong>Nr akcyzowy:</strong> {installation.exciseNumber}</p>}
                          </>
                        ) : installation.dataType === 'OPERATOR' ? (
                          <>
                            <p><strong>Lokalizacja:</strong> {installation.city}, woj. {installation.province}</p>
                            <p><strong>Rodzaj operatora:</strong> {installation.installationType}</p>
                            {installation.operatorTypeDesc && <p><strong>Pełna nazwa:</strong> {installation.operatorTypeDesc}</p>}
                            <p><strong>Data wydania:</strong> {installation.registrationDate}</p>
                            {installation.validFrom && installation.validTo && (
                              <p><strong>Ważność:</strong> {installation.validFrom} - {installation.validTo}</p>
                            )}
                            <p><strong>Adres:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                            {installation.regon && <p><strong>REGON:</strong> {installation.regon}</p>}
                            {installation.nip && <p><strong>NIP:</strong> {installation.nip}</p>}
                            {installation.operatingArea && <p><strong>Obszar działania:</strong> {installation.operatingArea}</p>}
                          </>
                        ) : (
                          <>
                            <p><strong>Lokalizacja:</strong> {installation.city}, woj. {installation.province}</p>
                            <p><strong>Typ:</strong> {installation.installationType}</p>
                            {installation.registrationDate && <p><strong>Data:</strong> {installation.registrationDate}</p>}
                            <p><strong>Adres:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>
    </div>
    </div>
  );
}

export default App;