const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');
const axios = require('axios');
const ora = require('ora');
const cliProgress = require('cli-progress');

// === ŚCIEŻKI ===
const RAW_DATA_DIR = path.join(__dirname, '../public/data/raw');
const PROCESSED_DATA_DIR = path.join(__dirname, '../public/data/processed');
const CACHE_FILE = path.join(__dirname, 'geocode-cache.json');

// Upewnij się że foldery istnieją
if (!fs.existsSync(PROCESSED_DATA_DIR)) {
  fs.mkdirSync(PROCESSED_DATA_DIR, { recursive: true });
}

// Rate limiter dla OSM
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let geocodeCache = {};

// Wczytaj cache
if (fs.existsSync(CACHE_FILE)) {
  geocodeCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  console.log(`✓ Wczytano cache: ${Object.keys(geocodeCache).length} wpisów`);
}

// === DETERMINISTYCZNE FUNKCJE ===
const seededRandom = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

const addJitter = (coords, seed) => {
  const jitterAmount = 0.002;
  const random1 = seededRandom(seed + "_lat");
  const random2 = seededRandom(seed + "_lng");
  return [
    coords[0] + (random1 - 0.5) * jitterAmount,
    coords[1] + (random2 - 0.5) * jitterAmount
  ];
};

// === SŁOWNIKI LOKALIZACJI - PEŁNE ===
const WOJEWODZTWA_COORDINATES = {
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

// === MAPOWANIE POWIATÓW DO WOJEWÓDZTW ===
const COUNTY_TO_PROVINCE = require('./county-to-province-mapping.js');

// === IMPORT MAPOWANIA MIEJSCOWOŚCI DO POWIATÓW ===
// Importujemy funkcję z countyMapping.ts (konwertujemy z TS do JS)
const countyMappingPath = path.join(__dirname, '../src/utils/countyMapping.ts');
let CITY_TO_COUNTY = {};
let getCountyForCity = () => 'nieznany';

try {
  const countyMappingContent = fs.readFileSync(countyMappingPath, 'utf8');

  // Wyciągnij obiekt CITY_TO_COUNTY z pliku TS
  const match = countyMappingContent.match(/export const CITY_TO_COUNTY: Record<string, string> = \{([\s\S]*?)\};/);
  if (match) {
    // Parsuj zawartość obiektu
    const objectContent = match[1];
    const lines = objectContent.split('\n');

    for (const line of lines) {
      const cityMatch = line.match(/'([^']+)':\s*'([^']+)'/);
      if (cityMatch) {
        CITY_TO_COUNTY[cityMatch[1]] = cityMatch[2];
      }
    }

    console.log(`📍 Lokalizacji w słowniku: ${Object.keys(CITY_TO_COUNTY).length}\n`);
  }

  // Funkcja do pobierania powiatu
  getCountyForCity = (city) => {
    if (!city) return 'nieznany';
    const normalizedCity = city.trim();

    if (CITY_TO_COUNTY[normalizedCity]) {
      return CITY_TO_COUNTY[normalizedCity];
    }

    // Case-insensitive fallback
    const lowerCity = normalizedCity.toLowerCase();
    const entry = Object.entries(CITY_TO_COUNTY).find(
      ([key]) => key.toLowerCase() === lowerCity
    );

    return entry ? entry[1] : 'nieznany';
  };
} catch (err) {
  console.error('⚠️  Nie można wczytać countyMapping.ts:', err.message);
  console.log('   Kontynuuję bez mapowania powiatów\n');
}

// Funkcja do korygowania województwa na podstawie powiatu
function correctProvinceByCounty(province, county) {
  if (!county || county === 'nieznany') return province;
  const correctProvince = COUNTY_TO_PROVINCE[county];
  return correctProvince || province;
}

// SŁOWNIK TYLKO DLA DUŻYCH MIAST (bez duplikatów nazw)
// Małe miejscowości będą geokodowane przez API z województwem
const POLSKA_LOCATIONS = {
  'Warszawa': [52.2297, 21.0122],
  'Kraków': [50.0647, 19.9450],
  'Łódź': [51.7592, 19.4560],
  'Wrocław': [51.1079, 17.0385],
  'Poznań': [52.4064, 16.9252],
  'Gdańsk': [54.3520, 18.6466],
  'Szczecin': [53.4285, 14.5528],
  'Bydgoszcz': [53.1235, 18.0084],
  'Lublin': [51.2465, 22.5684],
  'Katowice': [50.2649, 19.0238],
  'Białystok': [53.1325, 23.1688],
  'Gdynia': [54.5189, 18.5305],
  'Częstochowa': [50.8118, 19.1203],
  'Radom': [51.4027, 21.1471],
  'Sosnowiec': [50.2863, 19.1040],
  'Toruń': [53.0138, 18.5984],
  'Kielce': [50.8661, 20.6286],
  'Gliwice': [50.2945, 18.6714],
  'Zabrze': [50.3249, 18.7858],
  'Bytom': [50.3483, 18.9162],
  'Olsztyn': [53.7781, 20.4942],
  'Bielsko-Biała': [49.8224, 19.0444],
  'Rzeszów': [50.0412, 21.9991],
  'Ruda Śląska': [50.2584, 18.8561],
  'Rybnik': [50.0971, 18.5463],
  'Tychy': [50.1355, 19.0118],
  'Gorzów Wielkopolski': [52.7325, 15.2369],
  'Zielona Góra': [51.9356, 15.5062],
  'Piotrków Trybunalski': [51.4048, 19.7029],
  'Nowa Sól': [51.8028, 15.7058],
  'Żary': [51.6424, 15.1380],
  'Żagań': [51.6172, 15.3153],
  'Tomaszów Mazowiecki': [51.5316, 20.0087],
  'Tarnów': [50.0127, 20.9886],
  'Nowy Sącz': [49.6246, 20.6940],
  'Płock': [52.5463, 19.7065],
  'Siedlce': [52.1676, 22.2902],
  'Krosno': [49.6889, 21.7706],
  'Przemyśl': [49.7838, 22.7678],
  'Stalowa Wola': [50.5697, 22.0536],
  'Tarnobrzeg': [50.5734, 21.6791],
  'Mielec': [50.2875, 21.4240],
  'Suwałki': [54.1117, 22.9306],
  'Łomża': [53.1783, 22.0582],
  'Słupsk': [54.4641, 17.0285],
  'Elbląg': [54.1564, 19.4086],
  'Kalisz': [51.7611, 18.0911],
  'Konin': [52.2231, 18.2511],
  'Piła': [53.1508, 16.7383],
  'Koszalin': [54.1942, 16.1714],
  'Legnica': [51.2070, 16.1619],
  'Wałbrzych': [50.7714, 16.2845],
  'Jelenia Góra': [50.9044, 15.7197],
  'Grudziądz': [53.4837, 18.7536],
  'Włocławek': [52.6483, 19.0677],
  'Biała Podlaska': [52.0325, 23.1149],
  'Chełm': [51.1431, 23.4716],
  'Zamość': [50.7229, 23.2520]
};

// Mapowanie wariantów nazw
const LOCATION_NORMALIZATION = {
  'Kock Rolny': 'Kock Rolny',
  'Górka': 'Górka',
  'Górka Kocka': 'Górka',
  'Górka Kocka Kolonia': 'Górka',
  'Bonów Kolonia': 'Bonów',
  'Brzeźnica Leśna': 'Brzeźnica Leśna',
  'Brzeźnica Leśna Kolonia': 'Brzeźnica Leśna',
  'Łysołaje Kolonia': 'Łysołaje',
  'Łysołaje-Kolonia': 'Łysołaje',
  'Kraśnika': 'Kraśnik',
  'Łuków ': 'Łuków',
  'Dobryń - Kolonia': 'Dobryń-Kolonia',
  'Horbów - Kolonia': 'Horbów-Kolonia'
};

const normalizeLocation = (city) => {
  const trimmedCity = city.trim().replace(/\s+/g, ' ');
  return LOCATION_NORMALIZATION[trimmedCity] || trimmedCity;
};

async function geocodeAddress(city, province, address, postalCode, installationId) {
  const cacheKey = `${installationId}_${city}_${province}_${address}_${postalCode}`;
  
  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }
  
  const normalizedCity = normalizeLocation(city);

  if (POLSKA_LOCATIONS[normalizedCity]) {
    console.log(`✓ ${normalizedCity} znaleziono w słowniku lokalnym`);
    const coords = addJitter(POLSKA_LOCATIONS[normalizedCity], installationId);
    geocodeCache[cacheKey] = coords;
    return coords;
  }

  const locationKey = Object.keys(POLSKA_LOCATIONS).find(key =>
    normalizedCity.includes(key) || key.includes(normalizedCity)
  );

  if (locationKey) {
    console.log(`✓ Częściowe dopasowanie: ${normalizedCity} -> ${locationKey}`);
    const coords = addJitter(POLSKA_LOCATIONS[locationKey], installationId);
    geocodeCache[cacheKey] = coords;
    return coords;
  }

  try {
    console.log(`🌐 Zapytanie OSM dla: ${normalizedCity}`);
    await sleep(2000);
    const query = encodeURIComponent(`${normalizedCity}, ${province || ''}, Polska`);
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
      { 
        headers: { 
          'User-Agent': 'MapaWytworcowEnergii/1.0 (preprocessing)'
        },
        timeout: 5000
      }
    );
    
    if (response.data && response.data.length > 0) {
      const coords = [parseFloat(response.data[0].lat), parseFloat(response.data[0].lon)];
      console.log(`✓ OSM: ${normalizedCity} -> [${coords[0]}, ${coords[1]}]`);
      const jitteredCoords = addJitter(coords, installationId);
      geocodeCache[cacheKey] = jitteredCoords;
      return jitteredCoords;
    }
  } catch (error) {
    console.error(`❌ Błąd geokodowania ${normalizedCity}:`, error.message);
  }
  
  if (province && WOJEWODZTWA_COORDINATES[province]) {
    console.log(`⚠ ${normalizedCity} - używam województwa: ${province}`);
    const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
    geocodeCache[cacheKey] = coords;
    return coords;
  }
  
  console.log(`⚠ ${normalizedCity} - używam domyślnych współrzędnych`);
  const defaultCoords = [52.0690, 19.4803];
  const jitteredDefault = addJitter(defaultCoords, installationId);
  geocodeCache[cacheKey] = jitteredDefault;
  return jitteredDefault;
}

function parseXML(xmlContent) {
  return new Promise((resolve, reject) => {
    parseString(xmlContent, {
      explicitArray: true,
      ignoreAttrs: false,
      normalize: true,
      normalizeTags: false,
      trim: true,
      explicitRoot: true,
      xmlns: false,
    }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function processMIOZE(xmlPath, category, subcategory) {
  const spinner = ora(`Przetwarzam MIOZE (${subcategory})...`).start();
  
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const result = await parseXML(xmlContent);
  
  let registries = [];
  if (result.MIOZERegistries?.MIOZERegistry) {
    registries = result.MIOZERegistries.MIOZERegistry;
  }
  
  spinner.text = `Geokodowanie ${registries.length} rekordów MIOZE (${subcategory})...`;
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(registries.length, 0);
  
  const processed = [];
  for (let i = 0; i < registries.length; i++) {
    const reg = registries[i];
    const city = reg.MiejscowoscInstalacji?.[0] || reg.Miejscowosc[0];
    const province = reg.WojewodztwoInstalacji?.[0] || reg.Wojewodztwo[0];
    const installationId = `MIOZE_${reg.DKN[0]}_${reg.IdInstalacji?.[0] || i}`;
    
    const coordinates = await geocodeAddress(
      city,
      province,
      reg.Adres[0],
      reg.Kod[0],
      installationId
    );
    
    const companyCity = reg.Miejscowosc[0];
    const installationCity = city;

    processed.push({
      id: installationId,
      name: reg.Nazwa[0].trim(),
      address: reg.Adres[0],
      postalCode: reg.Kod[0],
      city: companyCity,
      province: correctProvinceByCounty(reg.Wojewodztwo[0], getCountyForCity(companyCity)),
      county: getCountyForCity(companyCity),
      installationCity: installationCity,
      installationProvince: correctProvinceByCounty(province, getCountyForCity(installationCity)),
      installationCounty: getCountyForCity(installationCity),
      installationType: reg.RodzajInstalacji[0],
      power: reg.MocEEInstalacji ? parseFloat(reg.MocEEInstalacji[0]) : null,
      registrationDate: reg.DataWpisu[0],
      startDate: reg.DataRozpoczeciaDzialalnosci?.[0] || null,
      coordinates,
      dataType: 'MIOZE',
      category,
      subcategory
    });
    
    progressBar.update(i + 1);
    
    if (i % 100 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
    }
  }
  
  progressBar.stop();
  spinner.succeed(`Przetworzono ${processed.length} rekordów MIOZE (${subcategory})`);
  
  return processed;
}

async function processConcessions(xmlPath, category, subcategory) {
  const spinner = ora(`Przetwarzam koncesje (${subcategory})...`).start();
  
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const result = await parseXML(xmlContent);
  
  let concessions = [];
  if (result.ConcessionOtherFuels?.ConcessionOtherFuel) {
    concessions = result.ConcessionOtherFuels.ConcessionOtherFuel;
  }
  
  spinner.text = `Geokodowanie ${concessions.length} koncesji (${subcategory})...`;
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(concessions.length, 0);
  
  const processed = [];
  for (let i = 0; i < concessions.length; i++) {
    const con = concessions[i];
    const city = con.Miejscowosc?.[0] || con.Poczta?.[0] || 'Nieznane';
    const province = con.Wojewodztwo?.[0] || 'mazowieckie';
    const installationId = `CONCESSION_${con.DKN[0]}_${con.RodzajKoncesji?.[0] || 'UNKNOWN'}_${i}`;
    
    const coordinates = await geocodeAddress(
      city,
      province,
      con.Adres?.[0] || '',
      con.Kod?.[0] || '',
      installationId
    );
    
    processed.push({
      id: installationId,
      name: con.Nazwa[0].trim(),
      address: con.Adres?.[0] || '',
      postalCode: con.Kod?.[0] || '',
      city: city,
      province: correctProvinceByCounty(province, getCountyForCity(city)),
      county: getCountyForCity(city),
      installationType: con.RodzajKoncesji?.[0] || 'UNKNOWN',
      registrationDate: con.DataWydania?.[0] || '',
      validFrom: con.DataOd?.[0] || '',
      validTo: con.DataDo?.[0] || '',
      regon: con.REGON?.[0] || '',
      nip: con.NIP?.[0] || '',
      exciseNumber: con.NrAkcyzowy?.[0] || '',
      fileUrl: con.Plik?.[0] || '',
      coordinates,
      dataType: 'CONCESSION',
      category,
      subcategory
    });
    
    progressBar.update(i + 1);
    
    if (i % 100 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
    }
  }
  
  progressBar.stop();
  spinner.succeed(`Przetworzono ${processed.length} koncesji (${subcategory})`);
  
  return processed;
}

async function processOperators(xmlPath, category, subcategory) {
  const spinner = ora(`Przetwarzam operatorów (${subcategory})...`).start();
  
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const result = await parseXML(xmlContent);
  
  let operators = [];
  if (result.OperatorElectricitySystems?.OperatorElectricitySystem) {
    operators = result.OperatorElectricitySystems.OperatorElectricitySystem;
  }
  
  spinner.text = `Geokodowanie ${operators.length} operatorów (${subcategory})...`;
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(operators.length, 0);
  
  const processed = [];
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const city = op.Miejscowosc[0];
    const province = op.Wojewodztwo[0];
    const installationId = `OPERATOR_${op.DKN[0]}_${i}`;
    
    const coordinates = await geocodeAddress(
      city,
      province,
      op.Adres[0],
      op.Kod[0],
      installationId
    );
    
    processed.push({
      id: installationId,
      name: op.Nazwa[0].trim(),
      address: op.Adres[0],
      postalCode: op.Kod[0],
      city: city,
      province: correctProvinceByCounty(province, getCountyForCity(city)),
      county: getCountyForCity(city),
      installationType: op.RodzajOperatora[0],
      operatorTypeDesc: op.PelnaNazwaRodzajuOperatora[0],
      registrationDate: op.DataWydania[0],
      validFrom: op.DataOd[0],
      validTo: op.DataDo[0],
      regon: op.REGON?.[0] || '',
      nip: op.NIP?.[0] || '',
      fileUrl: op.Plik?.[0] || '',
      operatingArea: op.ObszarDzialaniaOperatora?.[0] || '',
      coordinates,
      dataType: 'OPERATOR',
      category,
      subcategory
    });
    
    progressBar.update(i + 1);
    
    if (i % 100 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
    }
  }
  
  progressBar.stop();
  spinner.succeed(`Przetworzono ${processed.length} operatorów (${subcategory})`);
  
  return processed;
}

async function processConsumers(xmlPath, category, subcategory) {
  const spinner = ora(`Przetwarzam odbiorców (${subcategory})...`).start();
  
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const result = await parseXML(xmlContent);
  
  let consumers = [];
  if (result.WykazPodmiotow?.Podmiot) {
    consumers = result.WykazPodmiotow.Podmiot;
  }
  
  spinner.text = `Geokodowanie ${consumers.length} odbiorców (${subcategory})...`;
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(consumers.length, 0);
  
  const processed = [];
  for (let i = 0; i < consumers.length; i++) {
    const con = consumers[i];
    const city = con.Miejscowosc[0];
    const installationId = `CONSUMER_${con.Lp[0]}_${i}`;
    
    let province = 'mazowieckie';
    
    const coordinates = await geocodeAddress(
      city,
      province,
      con.UlicaNr?.[0] || '',
      con.KodPocztowy?.[0] || '',
      installationId
    );
    
    processed.push({
      id: installationId,
      name: con.Nazwa[0].trim(),
      address: con.UlicaNr?.[0] || '',
      postalCode: con.KodPocztowy?.[0] || '',
      city: city,
      province: correctProvinceByCounty(province, getCountyForCity(city)),
      county: getCountyForCity(city),
      installationType: 'CONSUMER',
      nip: con.NIP?.[0] || '',
      coordinates,
      dataType: 'CONSUMER',
      category,
      subcategory
    });
    
    progressBar.update(i + 1);
    
    if (i % 100 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
    }
  }
  
  progressBar.stop();
  spinner.succeed(`Przetworzono ${processed.length} odbiorców (${subcategory})`);
  
  return processed;
}

async function processSellers(xmlPath, category, subcategory) {
  const spinner = ora(`Przetwarzam sprzedawców (${subcategory})...`).start();
  
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const result = await parseXML(xmlContent);
  
  let sellers = [];
  if (result.ConcessionOtherFuels?.ConcessionOtherFuel) {
    sellers = result.ConcessionOtherFuels.ConcessionOtherFuel;
  }
  
  spinner.text = `Geokodowanie ${sellers.length} sprzedawców (${subcategory})...`;
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(sellers.length, 0);
  
  const processed = [];
  for (let i = 0; i < sellers.length; i++) {
    const sel = sellers[i];
    
    let city = sel.Miejscowosc?.[0] || 'Nieznane';
    let province = sel.Wojewodztwo?.[0] || 'mazowieckie';
    let postalCode = sel.Kod?.[0] || '';
    let address = sel.Adres?.[0] || '';
    
    if (address && address.includes(',')) {
      const parts = address.split(',');
      if (parts.length >= 2) {
        const locationPart = parts[parts.length - 1].trim();
        const match = locationPart.match(/(\d{2}-\d{3})\s+(.+)/);
        if (match) {
          postalCode = match[1];
          city = match[2];
        }
      }
    }
    
    const installationId = `SELLER_${sel.DKN[0]}_${i}`;
    
    const coordinates = await geocodeAddress(
      city,
      province,
      address,
      postalCode,
      installationId
    );
    
    processed.push({
      id: installationId,
      name: sel.Nazwa[0].trim(),
      address: address,
      postalCode: postalCode,
      city: city,
      province: correctProvinceByCounty(province, getCountyForCity(city)),
      county: getCountyForCity(city),
      installationType: 'SELLER',
      coordinates,
      dataType: 'SELLER',
      category,
      subcategory
    });
    
    progressBar.update(i + 1);
    
    if (i % 100 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
    }
  }
  
  progressBar.stop();
  spinner.succeed(`Przetworzono ${processed.length} sprzedawców (${subcategory})`);
  
  return processed;
}

// === GŁÓWNA FUNKCJA - WSZYSTKIE PLIKI ===
async function main() {
  console.log('\n🚀 Preprocessing danych XML → JSON\n');
  console.log(`📍 Lokalizacji w słowniku: ${Object.keys(POLSKA_LOCATIONS).length}\n`);
  
  const startTime = Date.now();
  const results = {};
  
  // === WSZYSTKIE PLIKI ZGODNIE Z TWOJĄ STRUKTURĄ ===
  const filesToProcess = [
  // DOSTAWCY - Duzi dostawcy - KONCESJE
  {
    path: path.join(RAW_DATA_DIR, 'Dostawcy/Duży dostawcy/koncesje_w_zakresie_innym_niz_paliwa_ciekle.xml'),
    outputName: 'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    processor: processConcessions,
    category: 'supplier',
    subcategory: 'Duzi dostawcy'
  },
  
  // DOSTAWCY - Mali dostawcy - REJESTR WYTWÓRCÓW
  {
    path: path.join(RAW_DATA_DIR, 'Dostawcy/Mali Dostawcy/rejestr wytwórców energii w małej instalacji.xml'),
    outputName: 'rejestr_wytworców_energii_w_malej_instalacji.json',
    processor: processMIOZE,
    category: 'supplier',
    subcategory: 'Mali dostawcy'
  },
  
  // ODBIORCY - Duzi odbiorcy (UWAGA: dokładna nazwa pliku!)
  {
    path: path.join(RAW_DATA_DIR, 'Odbiorcy/Duży Odbiorcy/inf prezensa ure 2025.xml'),
    outputName: 'inf_prezensa_ure_2025.json',
    processor: processConcessions, // używamy processConcessions bo struktura jest identyczna!
    category: 'consumer',
    subcategory: 'Duzi odbiorcy'
  },
  
  // ODBIORCY - Odbiorcy wg rekompensat
  {
    path: path.join(RAW_DATA_DIR, 'Odbiorcy/Duży Odbiorcy wg przyznanych rekompensat/rekompensaty_2023_wykaz.xml'),
    outputName: 'rekompensaty_2023_wykaz.json',
    processor: processConsumers,
    category: 'consumer',
    subcategory: 'Odbiorcy wg rekompensat'
  },
  
  // POŚREDNICY - Operatorzy systemów
  {
    path: path.join(RAW_DATA_DIR, 'Pośrednicy/Operatorzy systemów elektroenergetycznych/operatorzy_systemow_elektroenergetycznych.xml'),
    outputName: 'operatorzy_systemow_elektroenergetycznych.json',
    processor: processOperators,
    category: 'intermediary',
    subcategory: 'Operatorzy systemów'
  },
  
  // POŚREDNICY - Sprzedawcy zobowiązani
  {
    path: path.join(RAW_DATA_DIR, 'Pośrednicy/Sprzedawcy zobowiązani/lista_sprzedawcow_zobowiazanych.xml'),
    outputName: 'lista_sprzedawcow_zobowiazanych.json',
    processor: processConcessions, // używamy processConcessions bo struktura jest identyczna!
    category: 'intermediary',
    subcategory: 'Sprzedawcy zobowiązani'
  }
];

console.log('\n📂 Sprawdzanie plików...\n');
filesToProcess.forEach(file => {
  const exists = fs.existsSync(file.path);
  console.log(`${exists ? '✅' : '❌'} ${file.path}`);
  if (!exists) {
    // Sprawdź czy folder istnieje
    const dir = path.dirname(file.path);
    if (fs.existsSync(dir)) {
      console.log(`   📁 Folder istnieje, zawartość:`);
      const files = fs.readdirSync(dir);
      files.forEach(f => console.log(`      - ${f}`));
    }
  }
});
console.log('\n');
  
  // Przetwarzanie wszystkich plików
  for (const file of filesToProcess) {
    if (fs.existsSync(file.path)) {
      try {
        const data = await file.processor(file.path, file.category, file.subcategory);
        results[file.outputName] = data;
        
        fs.writeFileSync(
          path.join(PROCESSED_DATA_DIR, file.outputName),
          JSON.stringify(data, null, 2)
        );
      } catch (error) {
        console.error(`❌ Błąd przetwarzania ${file.outputName}:`, error);
      }
    } else {
      console.log(`⚠ Brak pliku: ${file.path}`);
    }
  }
  
  // Metadata
  const totalRecords = Object.values(results).reduce((sum, data) => sum + data.length, 0);
  const metadata = {
    generatedAt: new Date().toISOString(),
    totalRecords,
    counts: Object.fromEntries(
      Object.entries(results).map(([name, data]) => [name, data.length])
    ),
    cacheSize: Object.keys(geocodeCache).length,
    processingTimeSeconds: Math.round((Date.now() - startTime) / 1000),
    locationDictionarySize: Object.keys(POLSKA_LOCATIONS).length
  };
  
  fs.writeFileSync(
    path.join(PROCESSED_DATA_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
  
  console.log('\n✅ Preprocessing zakończony!\n');
  console.log(`📊 Statystyki:`);
  Object.entries(results).forEach(([name, data]) => {
    console.log(`   ${name}: ${data.length}`);
  });
  console.log(`   Łącznie: ${metadata.totalRecords}`);
  console.log(`   Cache: ${metadata.cacheSize} wpisów`);
  console.log(`   Słownik lokalizacji: ${metadata.locationDictionarySize} miejsc`);
  console.log(`   Czas: ${metadata.processingTimeSeconds}s`);
  console.log(`\n📁 Pliki zapisane w: ${PROCESSED_DATA_DIR}\n`);
}

main().catch(console.error);