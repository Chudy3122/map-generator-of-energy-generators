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

// PEŁNY SŁOWNIK LOKALIZACJI
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
  'Legnica': [51.2070, 16.1619],
  'Wałbrzych': [50.7714, 16.2845],
  'Jelenia Góra': [50.9044, 15.7197],
  'Lubin': [51.4005, 16.2011],
  'Świdnica': [50.8456, 16.4895],
  'Głogów': [51.6640, 16.0845],
  'Bolesławiec': [51.2627, 15.5689],
  'Dzierżoniów': [50.7284, 16.6518],
  'Zgorzelec': [51.1481, 15.0065],
  'Oleśnica': [51.2098, 17.3820],
  'Kłodzko': [50.4351, 16.6544],
  'Oława': [50.9447, 17.2914],
  'Kąty Wrocławskie': [51.0667, 16.7833],
  'Włocławek': [52.6483, 19.0677],
  'Grudziądz': [53.4837, 18.7536],
  'Inowrocław': [52.7978, 18.2597],
  'Brodnica': [53.2629, 19.3978],
  'Świecie': [53.4104, 18.4477],
  'Chełmno': [53.3483, 18.4256],
  'Nakło nad Notecią': [53.1431, 17.5989],
  'Tuchola': [53.5862, 17.8592],
  'Biała Podlaska': [52.0325, 23.1149],
  'Biłgoraj': [50.5413, 22.7224],
  'Chełm': [51.1431, 23.4716],
  'Dęblin': [51.5640, 21.8470],
  'Hrubieszów': [50.8093, 23.8917],
  'Janów Lubelski': [50.7079, 22.4162],
  'Krasnystaw': [50.9833, 23.1667],
  'Kraśnik': [50.9243, 22.2205],
  'Lubartów': [51.4590, 22.6021],
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
  'Wola Uhruska': [51.3231, 23.6213],
  'Kock': [51.6413, 22.4480],
  'Kock Rolny': [51.6413, 22.4480],
  'Górka': [51.6345, 22.4872],
  'Górka Kocka': [51.6345, 22.4872],
  'Górka Kocka Kolonia': [51.6278, 22.4920],
  'Bonów Kolonia': [51.1767, 22.9467],
  'Bonów': [51.1767, 22.9467],
  'Brzeźnica Leśna': [51.5623, 22.6862],
  'Brzeźnica Leśna Kolonia': [51.5590, 22.6801],
  'Łysołaje Kolonia': [51.2215, 22.9872],
  'Łysołaje-Kolonia': [51.2215, 22.9872],
  'Łysołaje': [51.2215, 22.9872],
  'Kraśnika': [50.9243, 22.2205],
  'Dobryń-Kolonia': [52.0654, 23.3131],
  'Horbów-Kolonia': [52.0326, 23.3798],
  'Wólka Świątkowa': [51.3240, 23.5813],
  'Wólka Rokicka': [51.4756, 22.5932],
  'Wólka Gościeradowska': [50.8669, 22.0323],
  'Wólka Plebańska': [52.0557, 23.2891],
  'Wola Bystrzycka': [51.6109, 22.3276],
  'Wola Dubowska': [51.7431, 23.2138],
  'Wola Okrzejska': [51.7552, 21.9649],
  'Długi Kąt - Osada': [50.5091, 22.9833],
  'Terpentyna': [50.9113, 22.0824],
  'Skrzyniec Kolonia': [51.1563, 22.3043],
  'Starościn Kolonia': [51.4888, 22.3865],
  'Michałki Kolonia': [51.5580, 23.5711],
  'Kolonia Zamek': [50.7490, 22.3215],
  'Jeziernia': [50.4117, 23.4139],
  'Kaliłów': [52.0520, 23.0764],
  'Sól': [50.4612, 22.7345],
  'Ratoszyn Pierwszy': [51.0546, 22.2874],
  'Piotrowice': [51.0780, 22.4720],
  'Połoski Stare': [51.9012, 23.3516],
  'Dys': [51.3125, 22.5756],
  'Stężyca': [51.5803, 21.7767],
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
  'Ruda Wołoska': [50.3822, 23.5537],
  'Gorzów Wielkopolski': [52.7325, 15.2369],
  'Zielona Góra': [51.9356, 15.5062],
  'Nowa Sól': [51.8028, 15.7058],
  'Żary': [51.6424, 15.1380],
  'Żagań': [51.6172, 15.3153],
  'Świebodzin': [52.2481, 15.5333],
  'Międzyrzecz': [52.4432, 15.5863],
  'Piotrków Trybunalski': [51.4048, 19.7029],
  'Tomaszów Mazowiecki': [51.5316, 20.0087],
  'Zgierz': [51.8564, 19.4066],
  'Pabianice': [51.6645, 19.3544],
  'Bełchatów': [51.3667, 19.3667],
  'Kutno': [52.2318, 19.3631],
  'Łowicz': [52.1076, 19.9447],
  'Skierniewice': [51.9539, 20.1512],
  'Zduńska Wola': [51.5993, 18.9397],
  'Radomsko': [51.0694, 19.4503],
  'Tarnów': [50.0127, 20.9886],
  'Nowy Sącz': [49.6246, 20.6940],
  'Oświęcim': [50.0387, 19.2312],
  'Chrzanów': [50.1355, 19.4023],
  'Olkusz': [50.2796, 19.5618],
  'Wieliczka': [49.9875, 20.0647],
  'Wadowice': [49.8832, 19.4942],
  'Gorlice': [49.6556, 21.1605],
  'Limanowa': [49.7049, 20.4257],
  'Zakopane': [49.2992, 19.9496],
  'Nowy Targ': [49.4774, 20.0326],
  'Myślenice': [49.8356, 19.9343],
  'Płock': [52.5463, 19.7065],
  'Ostrołęka': [53.0855, 21.5650],
  'Siedlce': [52.1676, 22.2902],
  'Ciechanów': [52.8814, 20.6193],
  'Pruszków': [52.1706, 20.8125],
  'Legionowo': [52.4046, 20.9293],
  'Piaseczno': [52.0808, 21.0235],
  'Mińsk Mazowiecki': [52.1793, 21.5724],
  'Otwock': [52.1059, 21.2614],
  'Wołomin': [52.3406, 21.2421],
  'Grodzisk Mazowiecki': [52.1097, 20.6353],
  'Marki': [52.3260, 21.1017],
  'Ząbki': [52.2925, 21.1122],
  'Mława': [53.1167, 20.3833],
  'Żyrardów': [52.0495, 20.4459],
  'Opole': [50.6751, 17.9213],
  'Kędzierzyn-Koźle': [50.3492, 18.2250],
  'Nysa': [50.4739, 17.3345],
  'Brzeg': [50.8612, 17.4717],
  'Kluczbork': [50.9722, 18.2181],
  'Prudnik': [50.3243, 17.5776],
  'Strzelce Opolskie': [50.5106, 18.2961],
  'Krapkowice': [50.4747, 17.9647],
  'Krosno': [49.6889, 21.7706],
  'Przemyśl': [49.7838, 22.7678],
  'Stalowa Wola': [50.5697, 22.0536],
  'Tarnobrzeg': [50.5734, 21.6791],
  'Mielec': [50.2875, 21.4240],
  'Dębica': [50.0513, 21.4110],
  'Sanok': [49.5553, 22.2047],
  'Jarosław': [50.0170, 22.6772],
  'Jasło': [49.7448, 21.4730],
  'Leżajsk': [50.2598, 22.4181],
  'Łańcut': [50.0675, 22.2294],
  'Przeworsk': [50.0591, 22.4937],
  'Ustrzyki Dolne': [49.4310, 22.5943],
  'Lubaczów': [50.1566, 23.1236],
  'Suwałki': [54.1117, 22.9306],
  'Łomża': [53.1783, 22.0582],
  'Augustów': [53.8433, 22.9800],
  'Zambrów': [52.9858, 22.2431],
  'Grajewo': [53.6478, 22.4547],
  'Bielsk Podlaski': [52.7686, 23.1904],
  'Sokółka': [53.4049, 23.5039],
  'Mońki': [53.4024, 22.8039],
  'Hajnówka': [52.7433, 23.5812],
  'Siemiatycze': [52.4283, 22.8636],
  'Wysokie Mazowieckie': [52.9167, 22.5167],
  'Słupsk': [54.4641, 17.0285],
  'Tczew': [54.0922, 18.7766],
  'Starogard Gdański': [53.9653, 18.5309],
  'Wejherowo': [54.6061, 18.2367],
  'Rumia': [54.5722, 18.3898],
  'Sopot': [54.4419, 18.5602],
  'Kościerzyna': [54.1214, 17.9808],
  'Chojnice': [53.6975, 17.5586],
  'Lębork': [54.5452, 17.7461],
  'Malbork': [54.0364, 19.0347],
  'Pruszcz Gdański': [54.2592, 18.6314],
  'Kartuzy': [54.3336, 18.1942],
  'Reda': [54.6031, 18.3472],
  'Puck': [54.7217, 18.4103],
  'Jaworzno': [50.2049, 19.2747],
  'Mysłowice': [50.2075, 19.1658],
  'Będzin': [50.3277, 19.1280],
  'Piekary Śląskie': [50.3822, 18.9447],
  'Tarnowskie Góry': [50.4450, 18.8647],
  'Racibórz': [50.0914, 18.2186],
  'Jastrzębie-Zdrój': [49.9541, 18.5936],
  'Żory': [50.0450, 18.6997],
  'Chorzów': [50.2964, 18.9536],
  'Świętochłowice': [50.2922, 18.9181],
  'Mikołów': [50.1728, 18.9053],
  'Siemianowice Śląskie': [50.3239, 19.0294],
  'Wodzisław Śląski': [50.0053, 18.4611],
  'Cieszyn': [49.7494, 18.6319],
  'Pszczyna': [49.9811, 18.9547],
  'Czechowice-Dziedzice': [49.9144, 19.0111],
  'Dąbrowa Górnicza': [50.3278, 19.1947],
  'Żywiec': [49.6852, 19.1944],
  'Ostrowiec Świętokrzyski': [50.9292, 21.3886],
  'Starachowice': [51.0372, 21.0697],
  'Skarżysko-Kamienna': [51.1169, 20.8703],
  'Sandomierz': [50.6820, 21.7494],
  'Końskie': [51.1956, 20.4078],
  'Busko-Zdrój': [50.4708, 20.7189],
  'Jędrzejów': [50.6394, 20.3047],
  'Kazimierza Wielka': [50.2658, 20.5050],
  'Włoszczowa': [50.8514, 19.9669],
  'Elbląg': [54.1564, 19.4086],
  'Ełk': [53.8278, 22.3672],
  'Iława': [53.5958, 19.5694],
  'Giżycko': [54.0408, 21.7653],
  'Mrągowo': [53.8653, 21.3011],
  'Kętrzyn': [54.0769, 21.3761],
  'Szczytno': [53.5622, 20.9881],
  'Nidzica': [53.3583, 20.4258],
  'Działdowo': [53.2344, 20.1858],
  'Bartoszyce': [54.2553, 20.8094],
  'Pisz': [53.6289, 21.8078],
  'Lidzbark Warmiński': [54.1258, 20.5819],
  'Ostróda': [53.6958, 19.9661],
  'Nowe Miasto Lubawskie': [53.4167, 19.5833],
  'Kalisz': [51.7611, 18.0911],
  'Konin': [52.2231, 18.2511],
  'Piła': [53.1508, 16.7383],
  'Ostrów Wielkopolski': [51.6528, 17.8103],
  'Gniezno': [52.5350, 17.5828],
  'Leszno': [51.8406, 16.5747],
  'Śrem': [52.0894, 17.0147],
  'Jarocin': [51.9731, 17.5028],
  'Krotoszyn': [51.6978, 17.4372],
  'Turek': [52.0156, 18.5017],
  'Koło': [52.2006, 18.6378],
  'Września': [52.3256, 17.5650],
  'Szamotuły': [52.6119, 16.5778],
  'Swarzędz': [52.4136, 17.0789],
  'Luboń': [52.3478, 16.8889],
  'Kościan': [52.0858, 16.6450],
  'Gostyń': [51.8822, 17.0119],
  'Chodzież': [52.9958, 16.9189],
  'Czarnków': [52.9028, 16.5642],
  'Oborniki': [52.6489, 16.8172],
  'Pleszew': [51.8917, 17.7867],
  'Rawicz': [51.6094, 16.8583],
  'Sieradz': [51.5956, 18.7296],
  'Koszalin': [54.1942, 16.1714],
  'Stargard': [53.3369, 15.0503],
  'Kołobrzeg': [54.1758, 15.5833],
  'Świnoujście': [53.9103, 14.2475],
  'Gryfino': [53.2517, 14.4883],
  'Police': [53.5583, 14.5714],
  'Goleniów': [53.5647, 14.8272],
  'Świdwin': [53.7753, 15.7803],
  'Wałcz': [53.2744, 16.4739],
  'Pyrzyce': [53.1447, 14.8914],
  'Białogard': [54.0092, 15.9906],
  'Szczecinek': [53.7097, 16.6997],
  'Myślibórz': [52.9239, 14.8694],
  'Kamień Pomorski': [53.9686, 14.7739],
  'Drawsko Pomorskie': [53.5333, 15.8000],
  'Chodecz': [52.4047, 19.0353],
  'Kostrzyn nad Odrą': [52.5892, 14.6471],
  'Kolonowskie': [50.6378, 18.3328],
  'Drezdenko': [52.8425, 15.8314],
  'Żołynia': [50.0558, 22.1881]
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
    
    processed.push({
      id: installationId,
      name: reg.Nazwa[0].trim(),
      address: reg.Adres[0],
      postalCode: reg.Kod[0],
      city: reg.Miejscowosc[0],
      province: reg.Wojewodztwo[0],
      installationCity: city,
      installationProvince: province,
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
      province: province,
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
      province: province,
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
      province: province,
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
      province: province,
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