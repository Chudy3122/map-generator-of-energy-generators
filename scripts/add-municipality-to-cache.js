const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ora = require('ora');
const cliProgress = require('cli-progress');

const CACHE_FILE = path.join(__dirname, 'geocode-cache.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function addMunicipalityToCache() {
  console.log('\n🏘️  Dodawanie informacji o gminach do cache...\n');

  if (!fs.existsSync(CACHE_FILE)) {
    console.error('❌ Nie znaleziono pliku geocode-cache.json');
    return;
  }

  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const entries = Object.entries(cache);

  console.log(`📊 Znaleziono ${entries.length} wpisów w cache\n`);

  // Filtruj wpisy które nie mają gminy (stary format - tablica zamiast obiektu)
  const entriesToUpdate = entries.filter(([key, value]) => Array.isArray(value));

  console.log(`🔄 Do zaktualizowania: ${entriesToUpdate.length} wpisów\n`);

  if (entriesToUpdate.length === 0) {
    console.log('✅ Wszystkie wpisy już mają informację o gminach!');
    return;
  }

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(entriesToUpdate.length, 0);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < entriesToUpdate.length; i++) {
    const [key, coords] = entriesToUpdate[i];

    // Wyciągnij miasto i województwo z klucza cache
    // Format: INSTALLATION_ID_CITY_PROVINCE_ADDRESS_POSTALCODE
    const parts = key.split('_');
    let city = 'nieznana';
    let province = '';

    // Próbujemy wyciągnąć miasto i województwo z klucza
    // To może być trudne bo nazwy mogą zawierać podkreślniki
    // Najprostsze: użyjemy współrzędnych do reverse geocoding
    const [lat, lon] = coords;

    try {
      await sleep(2000); // Rate limiting dla Nominatim (1 req/sec)

      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MapaWytworcowEnergii/1.0 (preprocessing)'
          },
          timeout: 5000
        }
      );

      if (response.data && response.data.address) {
        const address = response.data.address;
        let municipality = address.municipality || address.town || address.city || address.village || 'nieznana';

        // Usuń prefix "gmina " jeśli występuje
        if (municipality.startsWith('gmina ')) {
          municipality = municipality.substring(6);
        }

        // Zaktualizuj cache - nowy format z obiektem
        cache[key] = {
          coordinates: coords,
          municipality: municipality
        };

        updated++;
      } else {
        // Nie udało się pobrać - zachowaj współrzędne, dodaj 'nieznana'
        cache[key] = {
          coordinates: coords,
          municipality: 'nieznana'
        };
        failed++;
      }
    } catch (error) {
      // W przypadku błędu - zachowaj współrzędne, dodaj 'nieznana'
      cache[key] = {
        coordinates: coords,
        municipality: 'nieznana'
      };
      failed++;
    }

    progressBar.update(i + 1);

    // Zapisuj co 50 wpisów
    if (i % 50 === 0 && i > 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }
  }

  progressBar.stop();

  // Zapisz finalny cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  console.log('\n✅ Zaktualizowano cache!\n');
  console.log(`📊 Statystyki:`);
  console.log(`   Zaktualizowano z API: ${updated}`);
  console.log(`   Nie udało się pobrać: ${failed}`);
  console.log(`   Łącznie przetworzonych: ${entriesToUpdate.length}\n`);
}

addMunicipalityToCache().catch(console.error);
