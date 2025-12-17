const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cliProgress = require('cli-progress');

const PROCESSED_DATA_DIR = path.join(__dirname, '../public/data/processed');
const OUTPUT_FILE = path.join(__dirname, 'city-to-municipality-mapping.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function buildCityToMunicipalityMapping() {
  console.log('\n🏘️  Budowanie mapowania miasto→gmina...\n');

  // Wczytaj wszystkie przetworzone pliki JSON
  const files = fs.readdirSync(PROCESSED_DATA_DIR).filter(f => f.endsWith('.json') && f !== 'metadata.json');

  console.log(`📂 Znaleziono ${files.length} plików JSON\n`);

  let allInstallations = [];
  for (const file of files) {
    const filePath = path.join(PROCESSED_DATA_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    allInstallations = allInstallations.concat(data);
  }

  console.log(`📊 Łącznie ${allInstallations.length} instalacji\n`);

  // Zbierz unikalne kombinacje miasto + koordynaty
  const cityCoordinatesMap = new Map();

  for (const inst of allInstallations) {
    const city = inst.city || inst.installationCity;
    const coords = inst.coordinates;

    if (city && coords && coords.length === 2) {
      const key = city.toLowerCase().trim();
      if (!cityCoordinatesMap.has(key)) {
        cityCoordinatesMap.set(key, {
          city: city,
          coordinates: coords,
          count: 1
        });
      } else {
        cityCoordinatesMap.get(key).count++;
      }
    }
  }

  const uniqueCities = Array.from(cityCoordinatesMap.values());
  console.log(`🌍 Znaleziono ${uniqueCities.length} unikalnych miast\n`);

  // Sortuj według liczby wystąpień (malejąco) - najpierw te najczęstsze
  uniqueCities.sort((a, b) => b.count - a.count);

  const cityToMunicipality = {};
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(uniqueCities.length, 0);

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < uniqueCities.length; i++) {
    const cityData = uniqueCities[i];
    const [lat, lon] = cityData.coordinates;

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

        cityToMunicipality[cityData.city] = municipality;
        fetched++;
      } else {
        cityToMunicipality[cityData.city] = 'nieznana';
        failed++;
      }
    } catch (error) {
      cityToMunicipality[cityData.city] = 'nieznana';
      failed++;
    }

    progressBar.update(i + 1);

    // Zapisuj co 50 wpisów
    if (i % 50 === 0 && i > 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cityToMunicipality, null, 2));
    }
  }

  progressBar.stop();

  // Zapisz finalny plik
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cityToMunicipality, null, 2));

  console.log('\n✅ Mapowanie zapisane!\n');
  console.log(`📊 Statystyki:`);
  console.log(`   Pobranych z API: ${fetched}`);
  console.log(`   Nie udało się: ${failed}`);
  console.log(`   Łącznie miast: ${uniqueCities.length}`);
  console.log(`\n📁 Plik: ${OUTPUT_FILE}\n`);
}

buildCityToMunicipalityMapping().catch(console.error);
