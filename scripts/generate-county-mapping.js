const fs = require('fs');
const path = require('path');

// Ścieżki do plików
const PROCESSED_DATA_DIR = path.join(__dirname, '../public/data/processed');
const OUTPUT_FILE = path.join(__dirname, '../src/utils/countyMappingGenerated.ts');

// Manualne mapowanie powiatów dla najpopularniejszych miejscowości
// Ten słownik będzie rozszerzony o miejscowości z danych
const MANUAL_COUNTY_MAPPING = {
  // Tutaj możemy dodać znane mapowania
  // Format: 'Miejscowość': 'powiat'
};

// Funkcja do wyciągnięcia wszystkich unikalnych miejscowości z danych
function extractCitiesFromData() {
  const cities = new Set();

  const files = [
    'koncesje_w_zakresie_innym_niz_paliwa_ciekle.json',
    'rejestr_wytworców_energii_w_malej_instalacji.json',
    'inf_prezensa_ure_2025.json',
    'rekompensaty_2023_wykaz.json',
    'operatorzy_systemow_elektroenergetycznych.json',
    'lista_sprzedawcow_zobowiazanych.json'
  ];

  files.forEach(filename => {
    const filePath = path.join(PROCESSED_DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.forEach(item => {
          if (item.city) cities.add(item.city.trim());
          if (item.installationCity) cities.add(item.installationCity.trim());
        });
        console.log(`✓ Wczytano ${filename}`);
      } catch (err) {
        console.error(`❌ Błąd wczytywania ${filename}:`, err.message);
      }
    }
  });

  return Array.from(cities).sort();
}

// Pobierz wszystkie miejscowości
console.log('Wyciąganie miejscowości z danych...');
const cities = extractCitiesFromData();
console.log(`\n📊 Znaleziono ${cities.length} unikalnych miejscowości\n`);

// Wyświetl pierwsze 50 miejscowości
console.log('Pierwsze 50 miejscowości:');
cities.slice(0, 50).forEach((city, i) => {
  console.log(`${i + 1}. ${city}`);
});

console.log('\n...');
console.log(`\nOgółem: ${cities.length} miejscowości`);

// Zapisz listę miejscowości do pliku tekstowego
const citiesListFile = path.join(__dirname, 'cities-list.txt');
fs.writeFileSync(citiesListFile, cities.join('\n'), 'utf8');
console.log(`\n✓ Lista miejscowości zapisana do: ${citiesListFile}`);

console.log('\n⚠️  UWAGA: Automatyczne mapowanie miejscowości do powiatów wymaga:');
console.log('1. API do geokodowania (np. Nominatim)');
console.log('2. Ręcznego przeglądu i weryfikacji wyników');
console.log('3. Lub użycia zewnętrznej bazy danych miejscowości w Polsce');
console.log('\nNajlepiej uzupełnij ręcznie plik countyMapping.ts o brakujące miejscowości.');
