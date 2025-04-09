import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { parseString } from 'xml2js';
import axios from 'axios';
import axiosRateLimit from 'axios-rate-limit';

// Wczytaj cache z localStorage
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

// Początkowe dane cache
const geocodeCache: Record<string, [number, number]> = loadGeocodeCache();

// Axios z limitem zapytań (1 zapytanie na sekundę)
const http = axiosRateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 1000 });

// Ikony dla różnych typów instalacji
const icons = {
  'PVA': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'WOA': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'BGO': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'WIL': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'default': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
};

// Słownik kolorów dla legendy
const iconColors = {
  'PVA': '#1E88E5', // niebieski
  'WOA': '#43A047', // zielony
  'BGO': '#E53935', // czerwony
  'WIL': '#FB8C00', // pomarańczowy
  'default': '#757575' // szary
};

// Słownik współrzędnych województw Polski
const WOJEWODZTWA_COORDINATES: Record<string, [number, number]> = {
  'dolnośląskie': [51.1089776, 16.9251681],
  'kujawsko-pomorskie': [53.0557231, 18.5932264],
  'lubelskie': [51.2495569, 23.1011099],
  'lubuskie': [52.2274715, 15.2559509],
  'łódzkie': [51.4703833, 19.4797627],
  'małopolskie': [49.7220511, 20.2540618],
  'mazowieckie': [52.0245142, 21.1354857],
  'opolskie': [50.6751228, 17.8919551],
  'podkarpackie': [49.8481153, 22.1396655],
  'podlaskie': [53.0833301, 23.1688403],
  'pomorskie': [54.1038841, 18.1371635],
  'śląskie': [50.2640831, 19.0238253],
  'świętokrzyskie': [50.8661281, 20.6328800],
  'warmińsko-mazurskie': [53.8713351, 20.6886953],
  'wielkopolskie': [52.4082663, 16.9335199],
  'zachodniopomorskie': [53.4252871, 14.5552673],
};

// Słownik większych miast i lokalizacji w Polsce
const POLSKA_LOCATIONS: Record<string, [number, number]> = {
  // Województwo dolnośląskie
  'Wrocław': [51.1079, 17.0385],
  'Legnica': [51.2070, 16.1619],
  'Wałbrzych': [50.7714, 16.2845],
  'Jelenia Góra': [50.9044, 15.7197],
  
  // Województwo kujawsko-pomorskie
  'Bydgoszcz': [53.1235, 18.0084],
  'Toruń': [53.0137, 18.5981],
  'Włocławek': [52.6483, 19.0677],
  'Grudziądz': [53.4837, 18.7536],
  
  // Województwo lubelskie
  'Biała Podlaska': [52.0325, 23.1149],
  'Biłgoraj': [50.5413, 22.7224],
  'Chełm': [51.1431, 23.4716],
  'Dęblin': [51.5640, 21.8470],
  'Hrubieszów': [50.8093, 23.8917],
  'Janów Lubelski': [50.7079, 22.4162],
  'Krasnystaw': [50.9833, 23.1667],
  'Kraśnik': [50.9243, 22.2205],
  'Lubartów': [51.4590, 22.6021],
  'Lublin': [51.2465, 22.5684],
  'Łuków': [51.9308, 22.3817],
  'Opole Lubelskie': [51.1473, 21.9649],
  'Parczew': [51.6373, 22.9075],
  'Puławy': [51.4166, 21.9686],
  'Radzyń Podlaski': [51.7834, 22.6236],
  'Ryki': [51.6250, 21.9311],
  'Świdnik': [51.2254, 22.6969],
  'Tomaszów Lubelski': [50.4474, 23.4193],
  'Włodawa': [51.5465, 23.5725],
  'Zamość': [50.7229, 23.2520],
  'Rejowiec Fabryczny': [51.1226, 23.1982],
  'Józefów': [50.4821, 23.0505],
  'Bełżyce': [51.1746, 22.2861],
  'Zwierzyniec': [50.6157, 22.9766],
  'Bychawa': [51.0162, 22.5308],
  'Łaszczów': [50.5333, 23.7333],
  'Nałęczów': [51.2860, 22.2154],
  'Cyców': [51.2883, 23.0422],
  'Gościeradów': [50.8708, 22.0239],
  'Tarnawatka': [50.5366, 23.3740],
  'Urszulin': [51.3569, 23.2272],
  'Łęczna': [51.3018, 22.8874],
  'Krasnobród': [50.5459, 23.2130],
  'Modliborzyce': [50.7535, 22.3272],
  'Łabunie': [50.6488, 23.3893],
  'Werbkowice': [50.7536, 23.7672],
  'Frampol': [50.6742, 22.6696],
  'Księżpol': [50.5083, 22.9245],
  'Wola Uhruska': [51.3231, 23.6213], // Dodano dokładne współrzędne
  'Dobryń-Kolonia': [52.0654, 23.3131], // Dodano dokładne współrzędne
  'Horbów-Kolonia': [52.0326, 23.3798], // Dodano dokładne współrzędne
  'Jeziernia': [50.4235, 23.5210], // Dodano dokładne współrzędne
  'Kaliłów': [52.0520, 23.0764], // Dodano dokładne współrzędne
  'Sół': [50.4612, 22.7345], // Dodano dokładne współrzędne
  'Ratoszyn Pierwszy': [51.0546, 22.2874], // Dodano dokładne współrzędne
  'Piotrowice': [51.0780, 22.4720], // Dodano dokładne współrzędne
  'Połoski Stare': [51.9012, 23.3516], // Dodano dokładne współrzędne
  
  // Województwo łódzkie
  'Łódź': [51.7592, 19.4560],
  'Piotrków Trybunalski': [51.4047, 19.7032],
  'Skierniewice': [51.9550, 20.1470],
  
  // Województwo małopolskie
  'Kraków': [50.0647, 19.9450],
  'Tarnów': [50.0121, 20.9858],
  'Nowy Sącz': [49.6225, 20.6911],
  
  // Województwo mazowieckie
  'Warszawa': [52.2297, 21.0122],
  'Radom': [51.4027, 21.1470],
  'Płock': [52.5464, 19.7005],
  'Siedlce': [52.1676, 22.2903],
  
  // Województwo opolskie
  'Opole': [50.6751, 17.9213],
  'Kędzierzyn-Koźle': [50.3487, 18.2123],
  
  // Województwo podkarpackie
  'Rzeszów': [50.0412, 21.9991],
  'Przemyśl': [49.7838, 22.7683],
  'Stalowa Wola': [50.5825, 22.0530],
  
  // Województwo podlaskie
  'Białystok': [53.1325, 23.1688],
  'Suwałki': [54.1028, 22.9314],
  'Łomża': [53.1618, 22.0777],
  
  // Województwo pomorskie
  'Gdańsk': [54.3520, 18.6466],
  'Gdynia': [54.5189, 18.5305],
  'Słupsk': [54.4641, 17.0287],
  
  // Województwo śląskie
  'Katowice': [50.2649, 19.0238],
  'Częstochowa': [50.8118, 19.1203],
  'Sosnowiec': [50.2863, 19.1041],
  
  // Województwo świętokrzyskie
  'Kielce': [50.8661, 20.6286],
  'Ostrowiec Świętokrzyski': [50.9297, 21.3857],
  
  // Województwo warmińsko-mazurskie
  'Olsztyn': [53.7784, 20.4801],
  'Elbląg': [54.1522, 19.4075],
  
  // Województwo wielkopolskie
  'Poznań': [52.4064, 16.9252],
  'Kalisz': [51.7624, 18.0895],
  'Konin': [52.2230, 18.2511],
  
  // Województwo zachodniopomorskie
  'Szczecin': [53.4289, 14.5530],
  'Koszalin': [54.1943, 16.1714],
};

// Dodatkowe lokalizacje mniejszych miejscowości, które pojawiają się w danych
const ADDITIONAL_LOCATIONS: Record<string, [number, number]> = {
  'Zwierzyniec - Rudka': [50.6226, 22.9838],
  'Modryniec': [50.7348, 23.8954],
  'Woroniec': [52.0623, 23.0726],
  'Sitaniec': [50.7486, 23.2122],
  'Przypisówka': [51.5227, 22.5844],
  'Lubycza Królewska': [50.3400, 23.5177],
  'Białobrzegi': [50.0383, 21.7669],
  'Maćkowice': [49.8335, 22.8028],
  'Żarnowo Pierwsze': [53.7035, 22.8433],
  'Czyżew-Sutki': [52.8049, 22.3165],
  'Podgórze-Gazdy': [52.6793, 21.9174],
  'Guty': [52.8743, 21.8851],
  'Michałów': [50.6461, 23.2548],
  'Nienowice': [49.9118, 22.9816],
  'Bliskowice': [50.8901, 21.9244],
  'Wieprzów Ordynacki': [50.4734, 23.3516],
  'Wisznice': [51.7875, 23.1996],
  'Ruda Wołoska': [50.3822, 23.5537]
};

type MIOZERegistry = {
  DKN: string[];
  Nazwa: string[];
  NIP: string[];
  Adres: string[];
  Kod: string[];
  Miejscowosc: string[];
  Wojewodztwo: string[];
  DataWpisu: string[];
  MiejscowoscInstalacji: string[];
  WojewodztwoInstalacji: string[];
  DataRozpoczeciaDzialalnosci: string[];
  RodzajInstalacji: string[];
  MocEEInstalacji: string[];
  RodzajIZakres: string[];
  IdInstalacji?: string[]; // Opcjonalne pole IdInstalacji
};

type Installation = {
  id: string; // Dodano unikalny identyfikator instalacji
  name: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  installationCity: string;
  installationProvince: string;
  installationType: string;
  power: number;
  registrationDate: string;
  startDate: string;
  coordinates: [number, number];
};

const defaultCenter: [number, number] = [52.0690, 19.4803]; // Środek Polski

// Funkcja do generowania unikalnego identyfikatora instalacji
const generateInstallationId = (registry: MIOZERegistry, index: number): string => {
  const dkn = registry.DKN?.[0] || '';
  // Sprawdź czy IdInstalacji istnieje w rejestrze
  const idInstalacji = registry.IdInstalacji && registry.IdInstalacji.length > 0 
    ? registry.IdInstalacji[0] 
    : index.toString();
  return `${dkn}_${idInstalacji}`;
};

// Funkcja do geokodowania adresu - poprawiona
const geocodeAddress = async (
  address: string, 
  postalCode: string, 
  city: string, 
  province: string,
  installationId: string // Dodano identyfikator instalacji
): Promise<[number, number] | null> => {
  // Tworzymy bardziej specyficzny klucz cache, uwzględniający identyfikator instalacji
  const cacheKey = `${installationId}_${address}_${postalCode}_${city}_${province}`;
  
  // Sprawdź cache
  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }
  
  // Hierarchia wyszukiwania:
  
  // 1. Najpierw sprawdź w słowniku dodatkowych lokalizacji
  if (ADDITIONAL_LOCATIONS[city]) {
    const coords = addJitter(ADDITIONAL_LOCATIONS[city], installationId);
    geocodeCache[cacheKey] = coords;
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  // 2. Następnie sprawdź w słowniku głównych lokalizacji
  if (POLSKA_LOCATIONS[city]) {
    const coords = addJitter(POLSKA_LOCATIONS[city], installationId);
    geocodeCache[cacheKey] = coords;
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  // 3. Próba geokodowania za pomocą OpenStreetMap
  try {
    // Przygotuj zapytanie geokodujące, łącząc wszystkie dostępne informacje
    const query = encodeURIComponent(`${city}, ${province}, ${postalCode}, Polska`);
    const response = await http.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
    
    if (response.data && response.data.length > 0) {
      const coords: [number, number] = [parseFloat(response.data[0].lat), parseFloat(response.data[0].lon)];
      
      // Dodaj jitter do współrzędnych, aby instalacje nie nakładały się dokładnie
      const jitteredCoords = addJitter(coords, installationId);
      geocodeCache[cacheKey] = jitteredCoords;
      saveToCache(cacheKey, jitteredCoords);
      
      return jitteredCoords;
    }
    
    // 4. Jeśli wszystko inne zawiedzie, użyj współrzędnych województwa
    if (WOJEWODZTWA_COORDINATES[province]) {
      const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
      geocodeCache[cacheKey] = coords;
      saveToCache(cacheKey, coords);
      return coords;
    }
    
    // 5. Jeśli nie mamy żadnych współrzędnych, użyj domyślnych (środek Polski)
    const defaultCoords = addJitter(defaultCenter, installationId);
    geocodeCache[cacheKey] = defaultCoords;
    saveToCache(cacheKey, defaultCoords);
    return defaultCoords;
    
  } catch (error) {
    console.error('Error geocoding address:', error);
    
    // W przypadku błędu, spróbuj użyć współrzędnych województwa
    if (WOJEWODZTWA_COORDINATES[province]) {
      const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
      geocodeCache[cacheKey] = coords;
      saveToCache(cacheKey, coords);
      return coords;
    }
    
    return null;
  }
};

// Pomocnicza funkcja do zapisywania w cache
const saveToCache = (key: string, coords: [number, number]) => {
  try {
    localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache));
  } catch (error) {
    console.error('Error saving geocode cache:', error);
  }
};

// Deterministyczny generator liczby pseudolosowej na podstawie stringa
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Zainicjuj generator
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

// Dodaj deterministyczne losowe przesunięcie do współrzędnych
const addJitter = (coords: [number, number], seed: string): [number, number] => {
  const jitterAmount = 0.002; // około 100-200 metrów
  
  // Używamy deterministycznej funkcji losowej zamiast Math.random()
  const random1 = seededRandom(seed + "_lat");
  const random2 = seededRandom(seed + "_lng");
  
  return [
    coords[0] + (random1 - 0.5) * jitterAmount,
    coords[1] + (random2 - 0.5) * jitterAmount
  ];
};

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
    }
  };

  const processXMLFile = async (xmlContent: string) => {
    parseString(xmlContent, async (err, result) => {
      if (err) {
        setError('Błąd podczas parsowania pliku XML');
        setLoading(false);
        return;
      }
  
      try {
        const registries = result.MIOZERegistries.MIOZERegistry;
        const totalItems = registries.length;
        const processedInstallations: Installation[] = [];
  
        // Zwiększamy liczbę elementów w partii
        const batchSize = 15;
        
        for (let i = 0; i < totalItems; i += batchSize) {
          const batch = registries.slice(i, Math.min(i + batchSize, totalItems));
          
          const batchPromises = batch.map(async (registry: MIOZERegistry, index: number) => {
            const installationCity = registry.MiejscowoscInstalacji[0];
            const installationProvince = registry.WojewodztwoInstalacji[0];
            const postalCode = registry.Kod[0];
            const address = registry.Adres[0];
            const city = registry.Miejscowosc[0];
            const installationId = generateInstallationId(registry, i + index);
            
            // Użyj ulepszonej funkcji geokodowania
            const coordinates = await geocodeAddress(
              address, 
              postalCode, 
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
              power: parseFloat(registry.MocEEInstalacji[0]),
              registrationDate: registry.DataWpisu[0],
              startDate: registry.DataRozpoczeciaDzialalnosci[0],
              coordinates: coordinates || defaultCenter,
            };
          });
          
          const batchResults = await Promise.all(batchPromises);
          processedInstallations.push(...batchResults);
          
          // Aktualizacja postępu
          setProgress(Math.min(100, Math.round((i + batchSize) / totalItems * 100)));
          
          // Krótsze opóźnienie między partiami zapytań
          if (i + batchSize < totalItems) {
            // Tylko 300 ms zamiast 500 ms dla szybszego ładowania
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
  
        setInstallations(processedInstallations);
        
        // Ustaw widok mapy na podstawie danych
        if (processedInstallations.length > 0) {
          // Znajdź najczęściej występujące województwo
          const provinceCounts: Record<string, number> = {};
          processedInstallations.forEach(inst => {
            provinceCounts[inst.installationProvince] = (provinceCounts[inst.installationProvince] || 0) + 1;
          });
          
          let maxCount = 0;
          let dominantProvince = '';
          Object.entries(provinceCounts).forEach(([province, count]) => {
            if (count > maxCount) {
              maxCount = count;
              dominantProvince = province;
            }
          });
          
          // Jeśli dominujące województwo stanowi ponad 50% danych, ustaw widok na nie
          if (maxCount > processedInstallations.length * 0.5 && WOJEWODZTWA_COORDINATES[dominantProvince]) {
            setCenter(WOJEWODZTWA_COORDINATES[dominantProvince]);
            setZoom(8);
          }
        }
        
        setLoading(false);
        setProgress(100);
      } catch (error) {
        console.error('Error processing XML:', error);
        setError('Błąd podczas przetwarzania danych z pliku XML');
        setLoading(false);
      }
    });
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
      reader.onload = (e) => {
        if (e.target?.result) {
          processXMLFile(e.target.result as string);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading file:', error);
      setError('Błąd podczas odczytu pliku');
      setLoading(false);
    }
  };

  // Filtruj instalacje
  const filteredInstallations = installations.filter(inst => {
    // Filtrowanie po województwie
    const matchesProvince = filterProvince === "wszystkie" || inst.installationProvince === filterProvince;
    
    // Filtrowanie po typie instalacji
    const matchesType = filterType === "wszystkie" || inst.installationType === filterType;
    
    // Filtrowanie po wyszukiwanym tekście (w nazwie lub mieście)
    const matchesSearch = searchTerm === "" || 
                          inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inst.installationCity.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesProvince && matchesType && matchesSearch;
  });

  // Przygotuj unikalne województwa do filtrowania
  const provinces = Array.from(new Set(installations.map(i => i.installationProvince))).sort();
  
  // Przygotuj unikalne typy instalacji do filtrowania
  const installationTypes = Array.from(new Set(installations.map(i => i.installationType))).sort();

  // Grupowanie po województwach
  const provinceGroups: Record<string, number> = {};
  provinces.forEach(province => {
    provinceGroups[province] = installations.filter(i => i.installationProvince === province).length;
  });

  // Usunięty kod automatycznego wczytywania danych przy uruchomieniu
  // useEffect(() => {...}, []);

  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ backgroundColor: '#2196F3', color: 'white', padding: '1rem' }}>
        <h1 style={{ margin: 0 }}>Mapa Wytwórców Energii w Małych Instalacjach</h1>
      </header>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Panel kontrolny */}
        <div style={{ 
          width: '300px', 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          overflowY: 'auto',
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Wczytaj plik XML</h2>
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
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Typ instalacji:</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie typy</option>
                {installationTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
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
            <p>Liczba instalacji: {installations.length}</p>
            <p>Liczba filtrowanych: {filteredInstallations.length}</p>
            <p>Suma mocy: {filteredInstallations.reduce((sum, inst) => sum + inst.power, 0).toFixed(2)} MW</p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Legenda</h2>
            <div style={{ fontSize: '0.9rem' }}>
              {Object.entries({
                'PVA': 'instalacje fotowoltaiczne',
                'WOA': 'elektrownie wodne',
                'BGO': 'instalacje biogazowe',
                'WIL': 'elektrownie wiatrowe na lądzie'
              }).map(([type, description]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    backgroundColor: iconColors[type as keyof typeof icons] || iconColors.default,
                    marginRight: '0.5rem'
                  }}></div>
                  <span><strong>{type}</strong> - {description}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Logo firmy */}
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
        
        {/* Mapa */}
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
            
            <LayerGroup>
              {filteredInstallations.map((installation, index) => (
                <Marker 
                  key={index} 
                  position={installation.coordinates} 
                  icon={icons[installation.installationType as keyof typeof icons] || icons.default}
                >
                  <Popup>
                    <div>
                      <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{installation.name}</h3>
                      <p><strong>Lokalizacja instalacji:</strong> {installation.installationCity}, woj. {installation.installationProvince}</p>
                      <p><strong>Typ instalacji:</strong> {installation.installationType}</p>
                      <p><strong>Moc:</strong> {installation.power} MW</p>
                      <p><strong>Data rozpoczęcia działalności:</strong> {installation.startDate}</p>
                      <p><strong>Adres siedziby:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default App;