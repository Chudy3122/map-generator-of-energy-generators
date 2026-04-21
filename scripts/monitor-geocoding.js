const fs = require('fs');
const path = require('path');

const GEOCODED_FILE = path.join(__dirname, 'geocoded-mappings.json');

function checkProgress() {
  if (!fs.existsSync(GEOCODED_FILE)) {
    console.log('⏳ Geocodowanie jeszcze się nie zakończyło...');
    console.log('   Plik geocoded-mappings.json nie został jeszcze utworzony');
    return false;
  }

  try {
    const data = JSON.parse(fs.readFileSync(GEOCODED_FILE, 'utf8'));
    const successCount = Object.keys(data.success).length;
    const failedCount = data.failed.length;
    const total = successCount + failedCount;

    console.log('\n📊 Status geocodowania:');
    console.log(`✓ Pomyślnie zmapowano: ${successCount}`);
    console.log(`✗ Nie udało się zmapować: ${failedCount}`);
    console.log(`📍 Razem przetworzono: ${total}`);
    console.log(`✅ Skuteczność: ${Math.round(successCount / total * 100)}%\n`);

    if (failedCount > 0) {
      console.log('Przykłady niezmapowanych miejscowości:');
      data.failed.slice(0, 10).forEach(city => console.log(`  - ${city}`));
      if (failedCount > 10) {
        console.log(`  ... i ${failedCount - 10} więcej\n`);
      }
    }

    console.log('✅ Geocodowanie zakończone!');
    console.log('\n📝 Następny krok: Uruchom finalizację');
    console.log('   node scripts/finalize-county-mapping.js\n');
    return true;
  } catch (err) {
    console.log('⚠️  Błąd odczytu pliku:', err.message);
    return false;
  }
}

// Sprawdź czy geocodowanie się zakończyło
const isDone = checkProgress();

if (!isDone) {
  console.log('\n💡 Uruchom ten skrypt ponownie, aby sprawdzić postęp');
  console.log('   node scripts/monitor-geocoding.js');
}

process.exit(isDone ? 0 : 1);
