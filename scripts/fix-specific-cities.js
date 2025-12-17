const fs = require('fs');
const path = require('path');
const axios = require('axios');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Miasta które wymagają precyzyjnej naprawy
const SPECIFIC_FIXES = {
  'Gruszów': {
    correctProvince: 'dolnośląskie',
    correctCounty: 'świdnicki',
    searchQuery: 'Gruszów, powiat świdnicki, dolnośląskie, Polska'
  },
  'Strzegom': {
    correctProvince: 'dolnośląskie',
    correctCounty: 'świdnicki',
    searchQuery: 'Strzegom, powiat świdnicki, dolnośląskie, Polska'
  },
  'Żarów': {
    correctProvince: 'dolnośląskie',
    correctCounty: 'świdnicki',
    searchQuery: 'Żarów, dolnośląskie, Polska'
  },
  'Grodziszcze': {
    correctProvince: 'dolnośląskie',
    correctCounty: 'polkowicki',
    searchQuery: 'Grodziszcze, powiat polkowicki, dolnośląskie, Polska'
  },
  'Podbrzezie Dolne': {
    correctProvince: 'lubuskie',
    correctCounty: 'nowosolski',
    searchQuery: 'Podbrzezie Dolne, powiat nowosolski, lubuskie, Polska'
  }
};

async function geocodeCity(query) {
  try {
    console.log(`  Geokodowanie: ${query}`);
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
        countrycodes: 'pl'
      },
      headers: {
        'User-Agent': 'MapaWytworcowEnergii/1.0'
      }
    });

    await delay(1100);

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      console.log(`  ✓ [${lat.toFixed(6)}, ${lon.toFixed(6)}]`);
      return [lat, lon];
    }

    console.log(`  ❌ Nie znaleziono`);
    return null;
  } catch (error) {
    console.error(`  ❌ Błąd:`, error.message);
    return null;
  }
}

async function fixSpecificCities() {
  const processedDir = path.join(__dirname, '../public/data/processed');
  const cacheFilePath = path.join(__dirname, 'geocache.json');

  const files = [
    'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    'rejestr_wytworców_energii_w_malej_instalacji.json',
    'inf_prezensa_ure_2025.json',
    'rekompensaty_2023_wykaz.json',
    'operatorzy_systemow_elektroenergetycznych.json',
    'lista_sprzedawcow_zobowiazanych.json'
  ];

  // Wczytaj cache
  let cache = {};
  if (fs.existsSync(cacheFilePath)) {
    cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
  }

  console.log('\n🔧 Naprawa konkretnych miast z błędnymi współrzędnymi\n');

  // Dla każdego miasta do naprawy
  for (const [cityName, fix] of Object.entries(SPECIFIC_FIXES)) {
    console.log(`\n📍 ${cityName} (${fix.correctProvince}, ${fix.correctCounty})`);

    // Geokoduj ponownie
    const newCoords = await geocodeCity(fix.searchQuery);

    if (!newCoords) {
      console.log(`  ⚠️  Pominięto - nie udało się zgeokodować\n`);
      continue;
    }

    // Zaktualizuj cache
    cache[cityName] = newCoords;

    // Zaktualizuj wszystkie pliki
    let totalUpdated = 0;

    files.forEach(file => {
      const fullPath = path.join(processedDir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      let updatedInFile = 0;

      data.forEach(item => {
        const city = item.installationCity || item.city;

        if (city === cityName) {
          // Zaktualizuj współrzędne
          item.coordinates = newCoords;

          // Zaktualizuj województwo
          if (item.installationProvince) item.installationProvince = fix.correctProvince;
          if (item.province) item.province = fix.correctProvince;

          // Zaktualizuj powiat
          if (item.installationCounty) item.installationCounty = fix.correctCounty;
          if (item.county) item.county = fix.correctCounty;

          updatedInFile++;
        }
      });

      if (updatedInFile > 0) {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
        totalUpdated += updatedInFile;
      }
    });

    console.log(`  ✓ Zaktualizowano ${totalUpdated} instalacji`);
  }

  // Zapisz zaktualizowany cache
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');

  console.log('\n' + '='.repeat(70));
  console.log('✅ Naprawa zakończona!');
  console.log('='.repeat(70) + '\n');
  console.log('Następny krok: node scripts/find-wrong-coordinates.js\n');
}

fixSpecificCities().catch(console.error);
