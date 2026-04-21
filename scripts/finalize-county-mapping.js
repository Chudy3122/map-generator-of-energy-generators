const { execSync } = require('child_process');
const path = require('path');

console.log('🎯 Finalizacja mapowania powiatów\n');
console.log('Ten skrypt wykona następujące kroki:');
console.log('1. Aktualizuje countyMapping.ts z wynikami geocodowania');
console.log('2. Przetwarza dane ponownie (preprocess-data.js)');
console.log('3. Wyświetla podsumowanie\n');

try {
  // Krok 1: Aktualizuj county mapping
  console.log('📝 Krok 1/2: Aktualizowanie countyMapping.ts...\n');
  execSync('node scripts/update-county-mapping.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('\n✓ countyMapping.ts zaktualizowany\n');

  // Krok 2: Przetwórz dane ponownie
  console.log('⚙️  Krok 2/2: Przetwarzanie danych...\n');
  execSync('node scripts/preprocess-data.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('\n\n✅ ========================================');
  console.log('✅ FINALIZACJA ZAKOŃCZONA POMYŚLNIE!');
  console.log('✅ ========================================\n');
  console.log('📊 Wszystkie miejscowości zostały zmapowane do powiatów');
  console.log('📊 Dane JSON zostały przetworzone z informacjami o powiatach');
  console.log('📊 Aplikacja jest gotowa do użycia!\n');
  console.log('🚀 Możesz teraz uruchomić aplikację i używać filtra powiatów');
  console.log('   Uruchom: npm start\n');

} catch (error) {
  console.error('\n❌ Błąd podczas finalizacji:', error.message);
  process.exit(1);
}
