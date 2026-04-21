const fs = require('fs');
const path = require('path');
const axios = require('axios');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const PROVINCE_BOUNDS = {
  'dolnośląskie': { minLat: 50.2, maxLat: 51.8, minLon: 15.0, maxLon: 17.3 },
  'kujawsko-pomorskie': { minLat: 52.3, maxLat: 53.8, minLon: 17.5, maxLon: 19.7 },
  'lubelskie': { minLat: 50.2, maxLat: 52.0, minLon: 21.5, maxLon: 24.2 },
  'lubuskie': { minLat: 51.3, maxLat: 53.0, minLon: 14.1, maxLon: 16.0 },
  'łódzkie': { minLat: 51.0, maxLat: 52.3, minLon: 18.0, maxLon: 20.5 },
  'małopolskie': { minLat: 49.2, maxLat: 50.5, minLon: 19.0, maxLon: 21.5 },
  'mazowieckie': { minLat: 51.2, maxLat: 53.5, minLon: 19.5, maxLon: 22.8 },
  'opolskie': { minLat: 50.3, maxLat: 51.2, minLon: 17.3, maxLon: 18.6 },
  'podkarpackie': { minLat: 49.0, maxLat: 50.9, minLon: 21.0, maxLon: 23.0 },
  'podlaskie': { minLat: 52.5, maxLat: 54.4, minLon: 22.0, maxLon: 24.2 },
  'pomorskie': { minLat: 53.7, maxLat: 54.9, minLon: 16.8, maxLon: 19.5 },
  'śląskie': { minLat: 49.7, maxLat: 50.9, minLon: 18.4, maxLon: 19.8 },
  'świętokrzyskie': { minLat: 50.2, maxLat: 51.2, minLon: 19.7, maxLon: 21.5 },
  'warmińsko-mazurskie': { minLat: 53.3, maxLat: 54.5, minLon: 19.3, maxLon: 22.8 },
  'wielkopolskie': { minLat: 51.5, maxLat: 53.4, minLon: 15.6, maxLon: 18.8 },
  'zachodniopomorskie': { minLat: 52.8, maxLat: 54.4, minLon: 14.1, maxLon: 17.1 }
};

function isWithinBounds(lat, lon, province) {
  if (!PROVINCE_BOUNDS[province]) return true;
  const bounds = PROVINCE_BOUNDS[province];
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon;
}

function parseCacheKey(key) {
  // Format: "CONCESSION_24091_PCC_423_Jawor_dolnośląskie_ul. Moniuszki 2a_59-400"
  // lub: "Jawor_dolnośląskie_ul. Moniuszki 2a_59-400"
  const parts = key.split('_');

  let city, province;

  // Znajdź województwo (musi kończyć się na 'kie' lub 'skie')
  const provinceIndex = parts.findIndex(p => p.endsWith('kie') || p.endsWith('skie'));

  if (provinceIndex > 0) {
    province = parts[provinceIndex];
    city = parts[provinceIndex - 1];
  }

  return { city, province };
}

async function geocodeCity(city, province) {
  const bounds = PROVINCE_BOUNDS[province];
  if (!bounds) return null;

  const viewbox = `${bounds.minLon},${bounds.maxLat},${bounds.maxLon},${bounds.minLat}`;

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${city}, ${province}, Polska`,
        format: 'json',
        limit: 10,
        countrycodes: 'pl',
        viewbox: viewbox,
        bounded: 1
      },
      headers: {
        'User-Agent': 'MapaWytworcowEnergii/1.0'
      }
    });

    await delay(1100);

    if (response.data && response.data.length > 0) {
      for (const result of response.data) {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (isWithinBounds(lat, lon, province)) {
          return [lat, lon];
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`  ❌ Błąd geokodowania:`, error.message);
    return null;
  }
}

async function fixCacheEntries() {
  const cacheFile = path.join(__dirname, 'geocode-cache.json');
  const backupFile = path.join(__dirname, 'geocode-cache-backup-before-fix.json');

  if (!fs.existsSync(cacheFile)) {
    console.log('❌ Brak pliku cache');
    return;
  }

  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

  // Backup
  fs.writeFileSync(backupFile, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`✓ Backup: ${backupFile}\n`);

  console.log('🔍 Szukam błędnych wpisów w cache...\n');

  const wrongEntries = [];

  for (const [key, coords] of Object.entries(cache)) {
    if (!Array.isArray(coords) || coords.length !== 2) continue;

    const [lat, lon] = coords;
    const { city, province } = parseCacheKey(key);

    if (!city || !province) continue;

    if (!isWithinBounds(lat, lon, province)) {
      wrongEntries.push({ key, city, province, oldCoords: coords });
    }
  }

  console.log(`Znaleziono ${wrongEntries.length} błędnych wpisów\n`);

  if (wrongEntries.length === 0) {
    console.log('✅ Wszystkie wpisy w cache są poprawne!\n');
    return;
  }

  // Grupuj po mieście i województwie
  const uniquePairs = new Map();
  wrongEntries.forEach(entry => {
    const key = `${entry.city}|${entry.province}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, {
        city: entry.city,
        province: entry.province,
        keys: []
      });
    }
    uniquePairs.get(key).keys.push(entry.key);
  });

  console.log(`Do naprawienia: ${uniquePairs.size} unikalnych par miasto-województwo\n`);
  console.log(`Szacowany czas: ${Math.ceil(uniquePairs.size * 1.1 / 60)} minut\n`);

  let fixed = 0;
  let failed = 0;
  let processed = 0;

  for (const [pairKey, data] of uniquePairs) {
    processed++;
    console.log(`[${processed}/${uniquePairs.size}] ${data.city} (${data.province})`);
    console.log(`  Wpisy w cache: ${data.keys.length}`);

    const newCoords = await geocodeCity(data.city, data.province);

    if (newCoords) {
      // Zaktualizuj wszystkie wpisy dla tego miasta
      data.keys.forEach(key => {
        cache[key] = newCoords;
      });

      console.log(`  ✓ [${newCoords[0].toFixed(6)}, ${newCoords[1].toFixed(6)}]`);
      fixed += data.keys.length;
    } else {
      console.log(`  ❌ Nie udało się zgeokodować`);
      failed += data.keys.length;
    }

    // Zapisz progress co 10 miast
    if (processed % 10 === 0) {
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
      console.log(`  💾 Progress zapisany\n`);
    }
  }

  // Zapisz ostateczny cache
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Naprawiono ${fixed} wpisów w cache`);
  console.log(`❌ Nie udało się naprawić ${failed} wpisów`);
  console.log('='.repeat(70) + '\n');
  console.log('Następne kroki:');
  console.log('1. node scripts/preprocess-data.js');
  console.log('2. node scripts/find-wrong-coordinates.js\n');
}

fixCacheEntries().catch(console.error);
