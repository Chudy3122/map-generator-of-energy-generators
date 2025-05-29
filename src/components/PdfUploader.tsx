import React, { useState } from 'react';
import { parseURE_PDF } from '../utils/pdfParser';
import { CompanyAddress, ParseResult } from '../types/documents';

interface PdfUploaderProps {
  onAddresses: (addresses: CompanyAddress[]) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

// Funkcje geokodowania (skopiowane z App.tsx)
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

// Słownik większych miast w Polsce (usunięte duplikaty)
const POLSKA_LOCATIONS: Record<string, [number, number]> = {
  // Główne miasta
  'Warszawa': [52.2297, 21.0122],
  'Kraków': [50.0647, 19.9450],
  'Wrocław': [51.1079, 17.0385],
  'Poznań': [52.4064, 16.9252],
  'Gdańsk': [54.3520, 18.6466],
  'Szczecin': [53.4285, 14.5528],
  'Bydgoszcz': [53.1235, 18.0084],
  'Lublin': [51.2465, 22.5684],
  'Białystok': [53.1325, 23.1688],
  'Katowice': [50.2649, 19.0238],
  'Częstochowa': [50.7964, 19.1201],
  'Radom': [51.4027, 21.1471],
  'Sosnowiec': [50.2862, 19.1041],
  'Toruń': [53.0137, 18.5981],
  'Kielce': [50.8661, 20.6286],
  'Rzeszów': [50.0413, 21.9990],
  'Gliwice': [50.2945, 18.6714],
  'Zabrze': [50.3249, 18.7859],
  'Olsztyn': [53.7784, 20.4801],
  'Bielsko-Biała': [49.8225, 19.0444],
  'Bytom': [50.3482, 18.9344],
  'Zielona Góra': [51.9356, 15.5062],
  'Rybnik': [50.0971, 18.5410],
  'Ruda Śląska': [50.2593, 18.8567],
  'Opole': [50.6751, 17.9213],
  'Tychy': [50.1357, 18.9985],
  'Gorzów Wielkopolski': [52.7368, 15.2288],
  'Dąbrowa Górnicza': [50.3249, 19.2001],
  'Elbląg': [54.1560, 19.4044],
  'Tarnów': [50.0121, 20.9855],
  'Chorzów': [50.2964, 18.9574],
  'Koszalin': [54.1943, 16.1714],
  'Kalisz': [51.7687, 18.0881],
  'Legnica': [51.2070, 16.1619],
  'Grudziądz': [53.4837, 18.7536],
  'Słupsk': [54.4641, 17.0285],
  'Jaworzno': [50.2052, 19.2745],
  'Jastrzębie-Zdrój': [49.9629, 18.6003],
  'Nowy Sącz': [49.6245, 20.7151],
  'Jelenia Góra': [50.9044, 15.7197],
  'Siedlce': [52.1676, 22.2902],
  'Mysłowice': [50.2081, 19.1327],
  'Piła': [53.1515, 16.7476],
  'Ostrów Wielkopolski': [51.6524, 18.1948],
  'Siemianowice Śląskie': [50.3067, 19.0351],
  'Stargard': [53.3358, 15.0503],
  'Piekary Śląskie': [50.3829, 18.9489],
  'Zamość': [50.7229, 23.2520],
  'Żory': [50.0449, 18.7047],
  'Świnoujście': [53.9118, 14.2478],
  'Tomaszów Mazowiecki': [51.5307, 20.0084],
  'Przemyśl': [49.7838, 22.7681],
  'Stalowa Wola': [50.5823, 22.0531],
  'Łomża': [53.1781, 22.0581],
  'Mielec': [50.2873, 21.4238],
  'Żywiec': [49.6850, 19.1936],
  'Gniezno': [52.5348, 17.5828],
  'Suwałki': [54.1116, 22.9309],
  'Chełm': [51.1431, 23.4716],
  'Pabianice': [51.6647, 19.3544],
  'Leszno': [51.8406, 16.5750],
  'Oświęcim': [50.0347, 19.2085],
  'Inowrocław': [52.7982, 18.2584],
  'Lubin': [51.4000, 16.2019],
  'Skierniewice': [51.9549, 20.1568],
  'Konin': [52.2230, 18.2513],
  'Puławy': [51.4166, 21.9686],
  'Świdnica': [50.8460, 16.4903],
  'Zawiercie': [50.4847, 19.4122],
  'Bolesławiec': [51.2621, 15.5697],
  'Wałbrzych': [50.7714, 16.2845],
  'Tczew': [54.0920, 18.7799],
  'Biała Podlaska': [52.0325, 23.1149],
  'Biłgoraj': [50.5413, 22.7224],
  'Racibórz': [50.0917, 18.2186],
  'Ciechanów': [52.8811, 20.6220],
  'Świdnik': [51.2254, 22.6969],
  'Nysa': [50.4739, 17.3336],
  'Kraśnik': [50.9243, 22.2205],
  'Łuków': [51.9308, 22.3817],
  'Łask': [51.5906, 19.1372],
  'Wieluń': [51.2196, 18.5702],
  'Tarnobrzeg': [50.5734, 21.6794],
  'Radzyń Podlaski': [51.7834, 22.6236],
  'Kostrzyn nad Odrą': [52.5883, 14.6464],
  'Żagań': [51.6198, 15.3175],
  'Wieruszów': [51.2893, 18.1636],
  'Trzebinia': [50.1621, 19.4635],
  'Lubartów': [51.4590, 22.6021],
  'Parczew': [51.6373, 22.9075],
  'Dębica': [50.0514, 21.4117],
  'Jarosław': [49.9968, 22.6777],
  'Ostrowiec Świętokrzyski': [50.9294, 21.3859],
  'Działoszyn': [51.0500, 18.9167],
  'Trzemeszno': [52.5628, 17.8234],
  'Kęty': [49.8833, 19.2333],
  'Skawina': [50.0667, 19.8333],
  'Nowy Tomyśl': [52.3167, 16.1333],
  'Ciechocinek': [52.8774, 18.7951],
  'Obrowo': [53.1234, 18.0456],
  'Kąty Wrocławskie': [51.0567, 16.7834],
  'Żary': [51.6414, 15.1381],
  'Kamyk': [50.5333, 19.4167],
  'Kamieńsk': [51.2667, 19.4667],
  'Ozorków': [51.9667, 19.2833],
  'Raciąż': [52.7333, 20.2167],
  'Sieradz': [51.5961, 18.7308],
  'Klucze': [50.3667, 19.3167],
  'Bukowno': [50.2832, 19.4563],
  'Nowa Sarzyna': [50.3167, 22.3333],
  'Myślenice': [49.8333, 19.9333],
  'Żegocina': [49.8667, 20.2167],
  'Sobienie Jeziory': [51.7500, 21.4167],
  'Aleksandrów Kujawski': [52.8833, 18.7000],
  'Brodnica': [53.2548, 19.3989],
  'Kowalewo Pomorskie': [53.1833, 18.9000],
  'Strzebielino': [54.5167, 18.0500],
  'Ujazd': [50.8500, 17.7333],
  'Maków Podhalański': [49.7167, 19.7333],
  'Lidzbark Warmiński': [54.1224, 20.5869],
  'Czerwonak': [52.5167, 16.9833],
  'Kaczory': [52.6167, 16.9500],
  'Murowana Goślina': [52.5667, 17.0167],
  'Końskie': [51.0900, 20.4167],
  'Zduńska Wola': [51.5993, 18.9392],
  'Malborsk': [54.0333, 19.0167],
  'Skarszewy': [54.1500, 18.4500],
  'Kościan': [52.0833, 16.6500],
  'Pilawa': [51.9000, 21.4667],
  'Zator': [50.0167, 19.4333],
  'Białobrzegi': [51.6333, 20.9500],
  'Kutno': [52.2333, 19.3667],
  'Koło': [52.2000, 18.6333],
  'Krupski Młyn': [50.4833, 19.1667],
  'Głuchołazy': [50.3167, 17.3833],
  'Pińczów': [50.5167, 20.5167],
  'Teresin': [52.0833, 20.4167],
  'Niedomice': [49.8833, 20.4167],
  'Staszów': [50.5667, 21.1667],
  'Wiśniew': [52.2000, 21.8500],
  'Kołbiel': [52.0667, 21.5000],
  'Oleśnica': [51.2097, 17.3803],
  'Kotunia': [52.0833, 18.0000],
  'Krosno Odrzańskie': [51.8833, 15.1000],
  'Karlino': [54.0333, 16.0167],
  'Leżajsk': [50.2667, 22.4167],
  'Łódź': [51.7592, 19.4560],
  'Miasteczko Śląskie': [50.4167, 19.1833],
  'Jasło': [49.7500, 21.4667],
  'Trzcianka': [53.0333, 16.4500],
  'Ziębice': [50.6167, 17.0500],
  'Strzelin': [50.7833, 17.0667],
  'Krapkowice': [50.4833, 17.9667],
  'Turek': [52.0167, 18.5000],
  'Karczmiska': [51.4167, 21.8000],
  'Dopiewo': [52.3667, 16.7167],
  'Baniocha': [52.0833, 21.0333],
  'Ustka': [54.5833, 16.8667],
  'Pęcz': [50.7667, 17.2333],
  // Dodatkowe miasta z dokumentu URE
  'Włocławek': [52.6483, 19.0677],
  'Płock': [52.5463, 19.7065],
  'Szczecinek': [53.7108, 16.6923],
  'Brzesko': [50.1000, 20.6167],
  'Gostyń': [51.8833, 17.0167],
  'Szamotuły': [52.6167, 16.5833],
  'Budzyń': [52.6833, 16.5167],
  'Chodzież': [52.9833, 16.9167],
  'Podanin': [52.9833, 16.9000],
  'Giżycko': [54.0333, 21.7667],
  'Kolonowskie': [50.6500, 18.3167],
  'Krzyż Wielkopolski': [52.9000, 16.1167],
  'Tymbark': [49.7333, 20.3667],
  'Radziemice': [50.1167, 19.7500],
  'Wadowice': [49.8833, 19.5000],
  'Przeźmierowo': [52.4167, 16.8000],
  'Tarnogród': [50.3628, 22.7419],
  'Łasin': [53.5167, 19.0833],
  'Drzewce': [51.2333, 22.1000],
  'Głogów Małopolski': [50.1667, 21.9667],
  'Czarnożyły': [51.6333, 18.6000],
  'Środa Śląska': [51.1667, 16.6333],
  'Mniszków': [51.1833, 20.1167],
  'Tarnów Opolski': [50.6000, 17.9833]
};

// Funkcja do normalizacji nazwy miasta
const normalizeLocation = (city: string): string => {
  return city.trim().replace(/\s+/g, ' ');
};

// Deterministyczny generator liczby pseudolosowej
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

// Dodaj deterministyczne losowe przesunięcie do współrzędnych
const addJitter = (coords: [number, number], seed: string): [number, number] => {
  const jitterAmount = 0.002; // około 100-200 metrów
  const random1 = seededRandom(seed + "_lat");
  const random2 = seededRandom(seed + "_lng");
  
  return [
    coords[0] + (random1 - 0.5) * jitterAmount,
    coords[1] + (random2 - 0.5) * jitterAmount
  ];
};

// Funkcja geokodowania dla adresów z PDF
const geocodeAddress = (
  address: CompanyAddress,
  index: number
): [number, number] | null => {
  const normalizedCity = normalizeLocation(address.city);
  const seed = `pdf_${address.taxId}_${index}`;
  
  console.log(`Geokodowanie dla: ${normalizedCity}`);
  
  // 1. Sprawdź w słowniku głównych lokalizacji
  if (POLSKA_LOCATIONS[normalizedCity]) {
    console.log(`Znaleziono w POLSKA_LOCATIONS: ${normalizedCity}`);
    return addJitter(POLSKA_LOCATIONS[normalizedCity], seed);
  }
  
  // 2. Próba częściowego dopasowania
  const partialMatch = Object.keys(POLSKA_LOCATIONS).find(key => 
    normalizedCity.includes(key) || key.includes(normalizedCity)
  );
  
  if (partialMatch) {
    console.log(`Częściowe dopasowanie: ${normalizedCity} -> ${partialMatch}`);
    return addJitter(POLSKA_LOCATIONS[partialMatch], seed);
  }
  
  // 3. Sprawdź województwo na podstawie kodu pocztowego
  const zipPrefix = address.zipCode.substring(0, 2);
  const provinceByZip = getProvinceByZipCode(zipPrefix);
  
  if (provinceByZip && WOJEWODZTWA_COORDINATES[provinceByZip]) {
    console.log(`Używam województwa ${provinceByZip} dla kodu ${address.zipCode}`);
    return addJitter(WOJEWODZTWA_COORDINATES[provinceByZip], seed);
  }
  
  // 4. Fallback - środek Polski
  console.log(`Fallback - środek Polski dla: ${normalizedCity}`);
  return addJitter([52.0690, 19.4803], seed);
};

// Pomocnicza funkcja do określenia województwa na podstawie kodu pocztowego
const getProvinceByZipCode = (zipPrefix: string): string | null => {
  const zipToProvince: Record<string, string> = {
    '00': 'mazowieckie', '01': 'mazowieckie', '02': 'mazowieckie', '03': 'mazowieckie',
    '04': 'mazowieckie', '05': 'mazowieckie', '06': 'mazowieckie', '07': 'mazowieckie',
    '08': 'mazowieckie', '09': 'mazowieckie',
    '10': 'warmińsko-mazurskie', '11': 'warmińsko-mazurskie', '12': 'warmińsko-mazurskie',
    '13': 'warmińsko-mazurskie', '14': 'warmińsko-mazurskie',
    '15': 'podlaskie', '16': 'podlaskie', '17': 'podlaskie', '18': 'podlaskie', '19': 'podlaskie',
    '20': 'lubelskie', '21': 'lubelskie', '22': 'lubelskie', '23': 'lubelskie', '24': 'lubelskie',
    '25': 'świętokrzyskie', '26': 'świętokrzyskie', '27': 'świętokrzyskie', '28': 'świętokrzyskie',
    '29': 'świętokrzyskie',
    '30': 'małopolskie', '31': 'małopolskie', '32': 'małopolskie', '33': 'małopolskie',
    '34': 'małopolskie',
    '35': 'podkarpackie', '36': 'podkarpackie', '37': 'podkarpackie', '38': 'podkarpackie',
    '39': 'podkarpackie',
    '40': 'śląskie', '41': 'śląskie', '42': 'śląskie', '43': 'śląskie', '44': 'śląskie',
    '45': 'opolskie', '46': 'opolskie', '47': 'opolskie', '48': 'opolskie', '49': 'opolskie',
    '50': 'dolnośląskie', '51': 'dolnośląskie', '52': 'dolnośląskie', '53': 'dolnośląskie',
    '54': 'dolnośląskie', '55': 'dolnośląskie', '56': 'dolnośląskie', '57': 'dolnośląskie',
    '58': 'dolnośląskie', '59': 'dolnośląskie',
    '60': 'wielkopolskie', '61': 'wielkopolskie', '62': 'wielkopolskie', '63': 'wielkopolskie',
    '64': 'wielkopolskie',
    '65': 'lubuskie', '66': 'lubuskie', '67': 'lubuskie', '68': 'lubuskie', '69': 'lubuskie',
    '70': 'zachodniopomorskie', '71': 'zachodniopomorskie', '72': 'zachodniopomorskie',
    '73': 'zachodniopomorskie', '74': 'zachodniopomorskie', '75': 'zachodniopomorskie',
    '76': 'zachodniopomorskie', '77': 'zachodniopomorskie', '78': 'zachodniopomorskie',
    '80': 'pomorskie', '81': 'pomorskie', '82': 'pomorskie', '83': 'pomorskie', '84': 'pomorskie',
    '85': 'kujawsko-pomorskie', '86': 'kujawsko-pomorskie', '87': 'kujawsko-pomorskie',
    '88': 'kujawsko-pomorskie', '89': 'kujawsko-pomorskie',
    '90': 'łódzkie', '91': 'łódzkie', '92': 'łódzkie', '93': 'łódzkie', '94': 'łódzkie',
    '95': 'łódzkie', '96': 'łódzkie', '97': 'łódzkie', '98': 'łódzkie', '99': 'łódzkie'
  };
  
  return zipToProvince[zipPrefix] || null;
};

const PdfUploader: React.FC<PdfUploaderProps> = ({
  onAddresses,
  onError,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Sprawdź typ pliku
    if (file.type !== 'application/pdf') {
      onError?.('Wybrany plik nie jest dokumentem PDF.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result: ParseResult = await parseURE_PDF(file);
      
      if (result.success && result.addresses.length > 0) {
        console.log(`Rozpoczynam geokodowanie ${result.addresses.length} adresów z PDF...`);
        
        // Dodaj geokodowanie do każdego adresu
        const addressesWithCoordinates = result.addresses.map((address, index) => {
          const coordinates = geocodeAddress(address, index);
          
          return {
            ...address,
            location: coordinates // Dodaj współrzędne do obiektu adresu
          };
        });
        
        // Przefiltruj adresy, które mają współrzędne
        const addressesWithValidCoordinates = addressesWithCoordinates.filter(
          address => address.location !== null
        );
        
        console.log(
          `Geokodowanie zakończone. ${addressesWithValidCoordinates.length}/${result.addresses.length} adresów ma współrzędne.`
        );
        
        onAddresses(addressesWithValidCoordinates);
        onSuccess?.(
          result.message || 
          `Pomyślnie wczytano ${addressesWithValidCoordinates.length} adresów z pliku PDF (${addressesWithValidCoordinates.length} z lokalizacją na mapie).`
        );
      } else {
        onError?.(result.message || 'Nie udało się wczytać adresów z pliku PDF.');
      }
    } catch (error) {
      console.error('Błąd podczas wczytywania pliku PDF:', error);
      onError?.(`Wystąpił błąd podczas wczytywania pliku: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsLoading(false);
      
      // Resetowanie inputa, aby można było wczytać ten sam plik ponownie
      event.target.value = '';
    }
  };
  
  return (
    <div className="pdf-uploader">
      <div className="upload-button-container">
        <label htmlFor="pdf-file-input" className="btn btn-primary upload-button">
          {isLoading ? 'Wczytywanie i mapowanie...' : 'Wczytaj dokument URE (PDF)'}
        </label>
        <input
          type="file"
          id="pdf-file-input"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
      </div>
      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Przetwarzanie dokumentu PDF i geokodowanie adresów...</p>
        </div>
      )}
      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        <p>📍 Adresy z PDF będą automatycznie umieszczone na mapie</p>
        <p>🔍 Geokodowanie odbywa się na podstawie miasta i kodu pocztowego</p>
      </div>
    </div>
  );
};

export default PdfUploader;