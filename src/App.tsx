import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { parseString } from 'xml2js';
import axios from 'axios';
import axiosRateLimit from 'axios-rate-limit';

interface AppState {
  loading: boolean;
  error: string | null;
  successMessage: string | null;
}

// Wczytaj cache z localStorage
const loadGeocodeCache = () => {
  try {
    const cache = localStorage.getItem('geocodeCache');
    if (cache) {
      return JSON.parse(cache);
    }
  } catch (error) {
    console.error('Error loading geocode cache:', error);
  }
  return {};
};

// Początkowe dane cache
const geocodeCache: Record<string, [number, number]> = loadGeocodeCache();

// Axios z limitem zapytań (1 zapytanie na sekundę)
const http = axiosRateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 1000 });

// Ikony dla różnych typów instalacji
const icons = {
  'PVA': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'WOA': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'BGO': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'BGS': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'BGM': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'WIL': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  // Dodane ikony dla koncesji
  'WEE': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'PCC': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'WCC': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'OEE': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'DEE': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'OPG': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'PPG': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'DPG': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'OCC': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  'default': new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
};

// Słownik kolorów dla legendy - rozszerzony
const iconColors = {
  'PVA': '#1E88E5', // niebieski
  'WOA': '#43A047', // zielony
  'BGO': '#E53935', // czerwony
  'BGS': '#9C27B0', // fioletowy
  'BGM': '#FFC107', // żółty
  'WIL': '#FB8C00', // pomarańczowy
  // Kolory dla koncesji
  'WEE': '#FFC107', // żółty - wytwarzanie energii elektrycznej
  'PCC': '#E53935', // czerwony - przesyłanie ciepła
  'WCC': '#43A047', // zielony - wytwarzanie ciepła
  'OEE': '#1E88E5', // niebieski - obrót energią elektryczną
  'DEE': '#9C27B0', // fioletowy - dystrybucja energii elektrycznej
  'OPG': '#FB8C00', // pomarańczowy - obrót paliwami gazowymi
  'PPG': '#000000', // czarny - przesyłanie paliw gazowych
  'DPG': '#FFD700', // złoty - dystrybucja paliw gazowych
  'OCC': '#757575', // szary - obrót ciepłem
  'default': '#757575' // szary
};

// Słownik opisów typów koncesji
const concessionDescriptions = {
  'WEE': 'Wytwarzanie energii elektrycznej',
  'PCC': 'Przesyłanie ciepła',
  'WCC': 'Wytwarzanie ciepła',
  'OEE': 'Obrót energią elektryczną',
  'DEE': 'Dystrybucja energii elektrycznej',
  'OPG': 'Obrót paliwami gazowymi',
  'PPG': 'Przesyłanie paliw gazowych',
  'DPG': 'Dystrybucja paliw gazowych',
  'OCC': 'Obrót ciepłem',
  'PVA': 'Instalacje fotowoltaiczne',
  'WOA': 'Elektrownie wodne',
  'BGO': 'Instalacje biogazowe',
  'BGS': 'Biogazownie składowiskowe',
  'BGM': 'Biogazownie',
  'WIL': 'Elektrownie wiatrowe na lądzie'
};

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

// Słownik większych miast i lokalizacji w Polsce
const POLSKA_LOCATIONS: Record<string, [number, number]> = {
  // Województwo dolnośląskie
  'Wrocław': [51.1079, 17.0385],
  'Legnica': [51.2070, 16.1619],
  'Wałbrzych': [50.7714, 16.2845],
  'Jelenia Góra': [50.9044, 15.7197],
  
  // Województwo kujawsko-pomorskie
  'Bydgoszcz': [53.1235, 18.0084],
  'Toruń': [53.0137, 18.5981],
  'Włocławek': [52.6483, 19.0677],
  'Grudziądz': [53.4837, 18.7536],
  
  // Województwo lubelskie
  'Biała Podlaska': [52.0325, 23.1149],
  'Biłgoraj': [50.5413, 22.7224],
  'Chełm': [51.1431, 23.4716],
  'Dęblin': [51.5640, 21.8470],
  'Hrubieszów': [50.8093, 23.8917],
  'Janów Lubelski': [50.7079, 22.4162],
  'Krasnystaw': [50.9833, 23.1667],
  'Kraśnik': [50.9243, 22.2205],
  'Lubartów': [51.4590, 22.6021],
  'Lublin': [51.2465, 22.5684],
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
  'Dobryń-Kolonia': [52.0654, 23.3131],
  'Horbów-Kolonia': [52.0326, 23.3798],
  'Jeziernia': [50.4117, 23.4139],
  'Kaliłów': [52.0520, 23.0764],
  'Sół': [50.4612, 22.7345],
  'Ratoszyn Pierwszy': [51.0546, 22.2874],
  'Piotrowice': [51.0780, 22.4720],
  'Połoski Stare': [51.9012, 23.3516],
  'Puchaczów': [51.3978, 23.0851],
  'Bogdanka': [51.4020, 23.0245],
  'Dys': [51.4125, 22.8956],
  'Wąwolnica': [51.1736, 22.0824],
  'Łopatki': [51.2012, 22.1345],
  'Lubycza Królewska': [50.3400, 23.5177],
  'Ciechocinek': [52.8774, 18.7951],
  'Tarnogród': [50.3628, 22.7419],
  'Firlej': [51.5227, 22.5844],
  'Przypisówka': [51.5227, 22.5844],
  'Koczergi': [51.6451, 22.8876],
  'Gościeradów Ukazowy': [50.8708, 22.0239],
  'Gościeradów-Folwark': [50.8669, 22.0323]
  // UWAGA: Dys zostało przeniesione do VERIFIED_LOCATIONS
};

// Dodatkowe lokalizacje mniejszych miejscowości
const ADDITIONAL_LOCATIONS: Record<string, [number, number]> = {
  'Zwierzyniec - Rudka': [50.6226, 22.9838],
  'Modryniec': [50.7348, 23.8954],
  'Woroniec': [52.0623, 23.0726],
  'Sitaniec': [50.7486, 23.2122],
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
  'Szerokie': [51.250945, 22.475226],
  'Łópatki': [51.2012, 22.1345],
  'Obrowo': [53.1234, 18.0456],
  'Kąty Wrocławskie': [51.0567, 16.7834],
  'Grabanów': [52.0456, 23.1123],
  'Płoskie': [50.7345, 23.2678],
  // UWAGA: Dys, Gościeradów-Folwark, Przypisówka, Stężyca, Dobryń-Kolonia 
  // zostały przeniesione do VERIFIED_LOCATIONS z POPRAWNYMI współrzędnymi (2025)
  'Koczergi': [51.6451, 22.8876],
  'Firlej': [51.5227, 22.5844],
  'Poniatowa': [51.1833, 21.9833],
  'Horbów-Kolonia': [52.0326, 23.3798],
  // Dodane miejscowości lubelskie (unikalne, bez duplikatów)
  'Łęczna': [51.3018, 22.8874],
  'Łaszczów': [50.5333, 23.7333],
  'Nałęczów': [51.2860, 22.2154],
  'Cyców': [51.2883, 23.0422],
  'Gościeradów': [50.8708, 22.0239],
  'Tarnawatka': [50.5366, 23.3740],
  'Urszulin': [51.3569, 23.2272],
  'Krasnobród': [50.5459, 23.2130],
  'Modliborzyce': [50.7535, 22.3272],
  'Łabunie': [50.6488, 23.3893],
  'Werbkowice': [50.7536, 23.7672],
  'Frampol': [50.6742, 22.6696],
  'Księżpol': [50.5083, 22.9245],
  'Wola Uhruska': [51.3231, 23.6213],
  'Wąwolnica': [51.1736, 22.0824]
};

const LOCATION_NORMALIZATION: Record<string, string> = {
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
  'Horbów - Kolonia': 'Horbów-Kolonia',
  'Puchaczów': 'Puchaczów',
  'Bogdanka -': 'Bogdanka',
  // Dodane normalizacje dla koncesji URE
  'Gościeradów Ukazowy': 'Gościeradów-Folwark',
  'Gościeradów-Ukazowy': 'Gościeradów-Folwark',
  'Białobrzegi': 'Białobrzegi',
  'Biała Podlaska': 'Biała Podlaska',
  'Biala Podlaska': 'Biała Podlaska'
};

const VERIFIED_LOCATIONS: Record<string, [number, number]> = {
  'Brzeźnica Leśna': [51.5623, 22.6862],
  'Brzeźnica Leśna Kolonia': [51.5623, 22.6862],
  'Bonów Kolonia': [51.1767, 22.9467],
  'Jeziernia': [50.4117, 23.4139],
  'Kock Rolny': [51.6413, 22.4480],
  'Górka Kocka': [51.6345, 22.4872],
  'Górka Kocka Kolonia': [51.6345, 22.4872],
  'Górka': [51.6345, 22.4872],
  'Górka Kocka Rolna': [51.6345, 22.4872],
  'Łysołaje Kolonia': [51.2215, 22.9872],
  'Łysołaje-Kolonia': [51.2215, 22.9872],
  'Bogdanka': [51.4020, 23.0245],
  'Puchaczów': [51.3978, 23.0851],
  
  // POPRAWIONE współrzędne (2025) - główne problemy:
  'Dys': [51.312222, 22.575556], // POPRAWIONE z [51.313519, 22.563002]
  'Szerokie': [51.251111, 22.475000],
  'Gościeradów-Folwark': [50.869167, 22.007500], // POPRAWIONE z [50.867224, 21.992552]
  'Przypisówka': [51.545000, 22.563611], // POPRAWIONE kolejność z [51.545000, 22.563611]
  'Stężyca': [51.580278, 21.776667], // POPRAWIONE z [51.912000, 21.845000] - to było dla innej Stężycy
  'Dobryń-Kolonia': [52.073889, 23.483056], // POPRAWIONE kolejność z [52.073889, 23.483056]
  
  'Koczergi': [51.6451, 22.8876],
  'Firlej': [51.5227, 22.5844],
  'Grabanów': [52.0456, 23.1123],
  'Płoskie': [50.7345, 23.2678],
  'Poniatowa': [51.1833, 21.9833],
  'Łopatki': [51.2012, 22.1345]
};

// Typy dla różnych formatów XML
type MIOZERegistry = {
  DKN: string[];
  Nazwa: string[];
  NIP: string[];
  Adres: string[];
  Kod: string[];
  Miejscowosc: string[];
  Wojewodztwo: string[];
  DataWpisu: string[];
  MiejscowoscInstalacji: string[];
  WojewodztwoInstalacji: string[];
  DataRozpoczeciaDzialalnosci: string[];
  RodzajInstalacji: string[];
  MocEEInstalacji: string[];
  RodzajIZakres: string[];
  IdInstalacji?: string[];
};

type ConcessionRecord = {
  DKN: string[];
  Nazwa: string[];
  NIP: string[];
  Adres: string[];
  Kod: string[];
  Miejscowosc: string[];
  Wojewodztwo: string[];
  RodzajKoncesji: string[];
  DataWydania: string[];
  DataOd: string[];
  DataDo: string[];
  REGON?: string[];
  NrAkcyzowy?: string[];
  Plik?: string[];
};

type Installation = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  installationCity?: string;
  installationProvince?: string;
  installationType: string;
  power?: number;
  registrationDate: string;
  startDate?: string;
  coordinates: [number, number];
  dataType: 'MIOZE' | 'CONCESSION'; // Dodane pole typu danych
  validFrom?: string;
  validTo?: string;
  regon?: string;
  exciseNumber?: string;
  fileUrl?: string;
};

// Enum dla typu XML
enum XMLType {
  MIOZE = 'MIOZE',
  CONCESSION = 'CONCESSION',
  UNKNOWN = 'UNKNOWN'
}

const defaultCenter: [number, number] = [52.0690, 19.4803];

// Funkcja do generowania unikalnego identyfikatora instalacji
const generateInstallationId = (
  registry: MIOZERegistry | ConcessionRecord, 
  index: number, 
  type: XMLType
): string => {
  const dkn = registry.DKN?.[0] || '';
  
  if (type === XMLType.MIOZE) {
    const miozeRegistry = registry as MIOZERegistry;
    const idInstalacji = miozeRegistry.IdInstalacji && miozeRegistry.IdInstalacji.length > 0 
      ? miozeRegistry.IdInstalacji[0] 
      : index.toString();
    return `MIOZE_${dkn}_${idInstalacji}`;
  } else {
    const concessionRegistry = registry as ConcessionRecord;
    const rodzajKoncesji = concessionRegistry.RodzajKoncesji?.[0] || '';
    return `CONCESSION_${dkn}_${rodzajKoncesji}_${index}`;
  }
};

// Funkcja normalizująca nazwę miejscowości
const normalizeLocation = (city: string): string => {
  const trimmedCity = city.trim().replace(/\s+/g, ' ');
  return LOCATION_NORMALIZATION[trimmedCity] || trimmedCity;
};

// Pomocnicza funkcja do zapisywania w cache
const saveToCache = (key: string, coords: [number, number]) => {
  try {
    geocodeCache[key] = coords;
    localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache));
  } catch (error) {
    console.error('Error saving geocode cache:', error);
  }
};

// Deterministyczny generator liczby pseudolosowej na podstawie stringa
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
  const jitterAmount = 0.002;
  
  const random1 = seededRandom(seed + "_lat");
  const random2 = seededRandom(seed + "_lng");
  
  return [
    coords[0] + (random1 - 0.5) * jitterAmount,
    coords[1] + (random2 - 0.5) * jitterAmount
  ];
};

const geocodeAddress = async (
  address: string, 
  postalCode: string, 
  city: string, 
  province: string,
  installationId: string
): Promise<[number, number] | null> => {
  const cacheKey = `${installationId}_${address}_${postalCode}_${city}_${province}`;
  
  if (geocodeCache[cacheKey]) {
    console.log(`🔄 Cache hit dla ${city}: [${geocodeCache[cacheKey][0]}, ${geocodeCache[cacheKey][1]}]`);
    return geocodeCache[cacheKey];
  }
  
  const normalizedCity = normalizeLocation(city);
  console.log(`🔍 Geokodowanie dla: ${city} -> ${normalizedCity}`);
  
  if (VERIFIED_LOCATIONS[normalizedCity]) {
    console.log(`✅ VERIFIED_LOCATIONS: ${normalizedCity} -> [${VERIFIED_LOCATIONS[normalizedCity][0]}, ${VERIFIED_LOCATIONS[normalizedCity][1]}]`);
    const coords = addJitter(VERIFIED_LOCATIONS[normalizedCity], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  if (ADDITIONAL_LOCATIONS[normalizedCity]) {
    console.log(`⚠️ ADDITIONAL_LOCATIONS: ${normalizedCity} -> [${ADDITIONAL_LOCATIONS[normalizedCity][0]}, ${ADDITIONAL_LOCATIONS[normalizedCity][1]}]`);
    const coords = addJitter(ADDITIONAL_LOCATIONS[normalizedCity], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  if (POLSKA_LOCATIONS[normalizedCity]) {
    console.log(`📍 POLSKA_LOCATIONS: ${normalizedCity} -> [${POLSKA_LOCATIONS[normalizedCity][0]}, ${POLSKA_LOCATIONS[normalizedCity][1]}]`);
    const coords = addJitter(POLSKA_LOCATIONS[normalizedCity], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  const KNOWN_COORDINATES: Record<string, [number, number]> = {
    'Górka': [51.6345, 22.4872],
    'Brzeźnica Leśna': [51.5623, 22.6862],
    'Bonów': [51.1767, 22.9467],
    'Jeziernia': [50.4117, 23.4139],
    'Kock Rolny': [51.6413, 22.4480],
    'Łysołaje': [51.2215, 22.9872],
  };
  
  if (KNOWN_COORDINATES[normalizedCity]) {
    console.log(`Używam znanych współrzędnych dla ${normalizedCity}`);
    const coords = addJitter(KNOWN_COORDINATES[normalizedCity], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  const additionalLocationKey = Object.keys(ADDITIONAL_LOCATIONS).find(key => 
    normalizedCity.includes(key) || key.includes(normalizedCity)
  );
  
  if (additionalLocationKey) {
    console.log(`Używam częściowego dopasowania z ADDITIONAL_LOCATIONS: ${normalizedCity} -> ${additionalLocationKey}`);
    const coords = addJitter(ADDITIONAL_LOCATIONS[additionalLocationKey], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  const polskaLocationKey = Object.keys(POLSKA_LOCATIONS).find(key => 
    normalizedCity.includes(key) || key.includes(normalizedCity)
  );
  
  if (polskaLocationKey) {
    console.log(`Używam częściowego dopasowania z POLSKA_LOCATIONS: ${normalizedCity} -> ${polskaLocationKey}`);
    const coords = addJitter(POLSKA_LOCATIONS[polskaLocationKey], installationId);
    saveToCache(cacheKey, coords);
    return coords;
  }
  
  try {
    console.log(`Próba geokodowania przez OSM dla ${normalizedCity}`);
    const query = encodeURIComponent(`${normalizedCity}, ${province}, ${postalCode}, Polska`);
    const response = await http.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
    
    if (response.data && response.data.length > 0) {
      const coords: [number, number] = [parseFloat(response.data[0].lat), parseFloat(response.data[0].lon)];
      console.log(`Znaleziono przez OSM: ${normalizedCity} -> [${coords[0]}, ${coords[1]}]`);
      
      const jitteredCoords = addJitter(coords, installationId);
      saveToCache(cacheKey, jitteredCoords);
      return jitteredCoords;
    }
    
    if (WOJEWODZTWA_COORDINATES[province]) {
      console.log(`Używam współrzędnych województwa dla ${normalizedCity} (${province})`);
      const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
      saveToCache(cacheKey, coords);
      return coords;
    }
    
    console.log(`Używam środka Polski dla ${normalizedCity}`);
    const defaultCoords = addJitter(defaultCenter, installationId);
    saveToCache(cacheKey, defaultCoords);
    return defaultCoords;
    
  } catch (error) {
    console.error('Error geocoding address:', error);
    
    if (WOJEWODZTWA_COORDINATES[province]) {
      console.log(`Używam współrzędnych województwa po błędzie dla ${normalizedCity} (${province})`);
      const coords = addJitter(WOJEWODZTWA_COORDINATES[province], installationId);
      saveToCache(cacheKey, coords);
      return coords;
    }
    
    return null;
  }
};

// Funkcja do określenia typu XML
const detectXMLType = (xmlContent: string): XMLType => {
  if (xmlContent.includes('<MIOZERegistries') && xmlContent.includes('<MIOZERegistry>')) {
    return XMLType.MIOZE;
  } else if (xmlContent.includes('<ConcessionOtherFuels') && xmlContent.includes('<ConcessionOtherFuel>')) {
    return XMLType.CONCESSION;
  }
  return XMLType.UNKNOWN;
};

// Funkcja przetwarzająca dane MIOZE
const processMIOZEData = async (
  registries: MIOZERegistry[], 
  setProgress: (progress: number) => void
): Promise<Installation[]> => {
  const totalItems = registries.length;
  const processedInstallations: Installation[] = [];
  const batchSize = 15;
  
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = registries.slice(i, Math.min(i + batchSize, totalItems));
    
    const batchPromises = batch.map(async (registry: MIOZERegistry, index: number) => {
      const installationCity = registry.MiejscowoscInstalacji[0];
      const installationProvince = registry.WojewodztwoInstalacji[0];
      const postalCode = registry.Kod[0];
      const address = registry.Adres[0];
      const city = registry.Miejscowosc[0];
      const installationId = generateInstallationId(registry, i + index, XMLType.MIOZE);
      
      const coordinates = await geocodeAddress(
        address, 
        postalCode, 
        installationCity, 
        installationProvince,
        installationId
      );
      
      return {
        id: installationId,
        name: registry.Nazwa[0],
        address: registry.Adres[0],
        postalCode: registry.Kod[0],
        city: registry.Miejscowosc[0],
        province: registry.Wojewodztwo[0],
        installationCity,
        installationProvince,
        installationType: registry.RodzajInstalacji[0],
        power: parseFloat(registry.MocEEInstalacji[0]),
        registrationDate: registry.DataWpisu[0],
        startDate: registry.DataRozpoczeciaDzialalnosci[0],
        coordinates: coordinates || defaultCenter,
        dataType: 'MIOZE' as const
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    processedInstallations.push(...batchResults);
    
    setProgress(Math.min(100, Math.round((i + batchSize) / totalItems * 100)));
    
    if (i + batchSize < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return processedInstallations;
};

// Funkcja przetwarzająca dane koncesji
const processConcessionData = async (
  concessions: ConcessionRecord[], 
  setProgress: (progress: number) => void
): Promise<Installation[]> => {
  const totalItems = concessions.length;
  const processedInstallations: Installation[] = [];
  const batchSize = 15;
  
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = concessions.slice(i, Math.min(i + batchSize, totalItems));
    
    const batchPromises = batch.map(async (concession: ConcessionRecord, index: number) => {
      const city = concession.Miejscowosc[0];
      const province = concession.Wojewodztwo[0];
      const postalCode = concession.Kod[0];
      const address = concession.Adres[0];
      const installationId = generateInstallationId(concession, i + index, XMLType.CONCESSION);
      
      const coordinates = await geocodeAddress(
        address, 
        postalCode, 
        city, 
        province,
        installationId
      );
      
      return {
        id: installationId,
        name: concession.Nazwa[0],
        address: concession.Adres[0],
        postalCode: concession.Kod[0],
        city: concession.Miejscowosc[0],
        province: concession.Wojewodztwo[0],
        installationType: concession.RodzajKoncesji[0],
        registrationDate: concession.DataWydania[0],
        validFrom: concession.DataOd[0],
        validTo: concession.DataDo[0],
        regon: concession.REGON?.[0],
        exciseNumber: concession.NrAkcyzowy?.[0],
        fileUrl: concession.Plik?.[0],
        coordinates: coordinates || defaultCenter,
        dataType: 'CONCESSION' as const
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    processedInstallations.push(...batchResults);
    
    setProgress(Math.min(100, Math.round((i + batchSize) / totalItems * 100)));
    
    if (i + batchSize < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return processedInstallations;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(defaultCenter);
  const [zoom, setZoom] = useState<number>(6);
  const [filterProvince, setFilterProvince] = useState<string>("wszystkie");
  const [filterType, setFilterType] = useState<string>("wszystkie");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [dataType, setDataType] = useState<string>("wszystkie"); // Nowy filtr

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
    }
  };

  const processXMLFile = async (xmlContent: string) => {
    const xmlType = detectXMLType(xmlContent);
    
    if (xmlType === XMLType.UNKNOWN) {
      setError('Nierozpoznany format pliku XML');
      setLoading(false);
      return;
    }

    parseString(xmlContent, async (err, result) => {
      if (err) {
        setError('Błąd podczas parsowania pliku XML');
        setLoading(false);
        return;
      }
  
      try {
        let processedInstallations: Installation[] = [];
        
        if (xmlType === XMLType.MIOZE) {
          console.log('Przetwarzanie danych MIOZE...');
          const registries = result.MIOZERegistries.MIOZERegistry;
          processedInstallations = await processMIOZEData(registries, setProgress);
        } else if (xmlType === XMLType.CONCESSION) {
          console.log('Przetwarzanie danych koncesji...');
          const concessions = result.ConcessionOtherFuels.ConcessionOtherFuel;
          processedInstallations = await processConcessionData(concessions, setProgress);
        }

        setInstallations(processedInstallations);
        
        // Ustaw widok mapy na podstawie danych
        if (processedInstallations.length > 0) {
          const provinceCounts: Record<string, number> = {};
          processedInstallations.forEach(inst => {
            const province = inst.installationProvince || inst.province;
            provinceCounts[province] = (provinceCounts[province] || 0) + 1;
          });
          
          let maxCount = 0;
          let dominantProvince = '';
          Object.entries(provinceCounts).forEach(([province, count]) => {
            if (count > maxCount) {
              maxCount = count;
              dominantProvince = province;
            }
          });
          
          if (maxCount > processedInstallations.length * 0.5 && WOJEWODZTWA_COORDINATES[dominantProvince]) {
            setCenter(WOJEWODZTWA_COORDINATES[dominantProvince]);
            setZoom(8);
          }
        }
        
        setLoading(false);
        setProgress(100);
      } catch (error) {
        console.error('Error processing XML:', error);
        setError('Błąd podczas przetwarzania danych z pliku XML');
        setLoading(false);
      }
    });
  };

  const parseUploadedFile = async () => {
    if (!file) {
      setError('Proszę wybrać plik');
      return;
    }
  
    clearGeocodeCache();
    console.log("Cache wyczyszczony przed ładowaniem");
    
    setLoading(true);
    setError(null);
    setProgress(0);
  
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processXMLFile(e.target.result as string);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading file:', error);
      setError('Błąd podczas odczytu pliku');
      setLoading(false);
    }
  };

  // Rozszerzone filtrowanie instalacji
  const filteredInstallations = installations.filter(inst => {
    const province = inst.installationProvince || inst.province;
    const matchesProvince = filterProvince === "wszystkie" || province === filterProvince;
    
    const matchesType = filterType === "wszystkie" || inst.installationType === filterType;
    
    const matchesDataType = dataType === "wszystkie" || inst.dataType === dataType;
    
    const city = inst.installationCity || inst.city;
    const matchesSearch = searchTerm === "" || 
                          inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          city.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesProvince && matchesType && matchesDataType && matchesSearch;
  });

  // Przygotuj unikalne województwa do filtrowania
  const provinces = Array.from(new Set(installations.map(i => i.installationProvince || i.province))).sort();
  
  // Przygotuj unikalne typy instalacji do filtrowania
  const installationTypes = Array.from(new Set(installations.map(i => i.installationType))).sort();

  // Grupowanie po województwach
  const provinceGroups: Record<string, number> = {};
  provinces.forEach(province => {
    provinceGroups[province] = installations.filter(i => 
      (i.installationProvince || i.province) === province
    ).length;
  });

  const clearGeocodeCache = () => {
    localStorage.removeItem('geocodeCache');
    console.log("Cache został całkowicie wyczyszczony");
    
    // Wymuś odświeżenie lokalizacji
    setInstallations([]);
    setError(null);
    setProgress(0);
    
    // Resetuj mapę do domyślnego widoku
    setCenter(defaultCenter);
    setZoom(6);
    
    return {};
  };

  const forceLocationUpdate = () => {
    // Wyczyść cache
    clearGeocodeCache();
    
    // Przeładuj dane jeśli są załadowane
    if (installations.length > 0 && file) {
      console.log("Wymuszam ponowne przetwarzanie pliku z nowymi współrzędnymi...");
      parseUploadedFile();
    } else {
      alert('Cache wyczyszczony! Wczytaj plik XML ponownie, aby zastosować nowe współrzędne.');
    }
  };

  return (
    <div className="app-container">
    <div className="App" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ backgroundColor: '#2196F3', color: 'white', padding: '1rem' }}>
        <h1 style={{ margin: 0 }}>Mapa Wytwórców Energii i Koncesji URE</h1>
      </header>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ 
          width: '300px', 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          overflowY: 'auto',
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Wczytaj plik XML</h2>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Obsługiwane formaty: MIOZE Registry, Koncesje URE
            </p>
            <input 
              type="file" 
              onChange={handleFileChange} 
              accept=".xml" 
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <button 
              onClick={parseUploadedFile} 
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: loading ? '#90CAF9' : '#2196F3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: loading ? 'default' : 'pointer'
              }}
            >
              {loading ? 'Wczytywanie...' : 'Wczytaj'}
            </button>

            <button 
              onClick={forceLocationUpdate} 
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: '#FF9800', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              🔄 Aktualizuj współrzędne
            </button>

            <button 
              onClick={() => {
                clearGeocodeCache();
                setInstallations([]);
                alert('Cache został wyczyszczony. Wczytaj plik ponownie.');
              }} 
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: '#f44336', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              Wyczyść cache i reset
            </button>
            
            {loading && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                  Ładowanie: {progress}%
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '10px', 
                  backgroundColor: '#e0e0e0', 
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${progress}%`, 
                    height: '100%', 
                    backgroundColor: '#2196F3',
                    transition: 'width 0.3s ease-in-out'
                  }}></div>
                </div>
              </div>
            )}
            
            {error && <p style={{ marginTop: '0.5rem', color: '#f44336' }}>{error}</p>}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Filtry</h2>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Typ danych:</label>
              <select 
                value={dataType} 
                onChange={(e) => setDataType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie typy danych</option>
                <option value="MIOZE">MIOZE (Małe Instalacje)</option>
                <option value="CONCESSION">Koncesje URE</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Województwo:</label>
              <select 
                value={filterProvince} 
                onChange={(e) => setFilterProvince(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie województwa</option>
                {provinces.map(province => (
                  <option key={province} value={province}>
                    {province} ({provinceGroups[province]})
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Typ instalacji/koncesji:</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="wszystkie">Wszystkie typy</option>
                {installationTypes.map(type => (
                  <option key={type} value={type}>
                    {type} - {concessionDescriptions[type as keyof typeof concessionDescriptions] || 'Nieznany typ'}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Szukaj:</label>
              <input 
                type="text" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Wyszukaj nazwę lub miasto..." 
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Statystyki</h2>
            <p>Liczba rekordów: {installations.length}</p>
            <p>Liczba filtrowanych: {filteredInstallations.length}</p>
            <p>MIOZE: {installations.filter(i => i.dataType === 'MIOZE').length}</p>
            <p>Koncesje: {installations.filter(i => i.dataType === 'CONCESSION').length}</p>
            <p>Suma mocy MIOZE: {filteredInstallations
              .filter(i => i.dataType === 'MIOZE' && i.power)
              .reduce((sum, inst) => sum + (inst.power || 0), 0).toFixed(2)} MW</p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Legenda</h2>
            <div style={{ fontSize: '0.9rem' }}>
              {Object.entries(concessionDescriptions).map(([type, description]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    backgroundColor: iconColors[type as keyof typeof iconColors] || iconColors.default,
                    marginRight: '0.5rem'
                  }}></div>
                  <span><strong>{type}</strong> - {description}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ 
            marginTop: 'auto', 
            padding: '1rem', 
            textAlign: 'center'
          }}>
            <img 
              src="/marsoft.png" 
              alt="MarSoft" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '150px',
                marginTop: '1rem'
              }}
            />
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <MapContainer 
            center={center} 
            zoom={zoom} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            <LayerGroup>
              {/* Markery dla instalacji z XML (MIOZE i koncesje) */}
              {filteredInstallations.map((installation, index) => (
                <Marker 
                  key={index} 
                  position={installation.coordinates} 
                  icon={icons[installation.installationType as keyof typeof icons] || icons.default}
                >
                  <Popup>
                    <div>
                      <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{installation.name}</h3>
                      <p><strong>Typ danych:</strong> {installation.dataType}</p>
                      
                      {installation.dataType === 'MIOZE' ? (
                        <>
                          <p><strong>Lokalizacja instalacji:</strong> {installation.installationCity}, woj. {installation.installationProvince}</p>
                          <p><strong>Typ instalacji:</strong> {installation.installationType}</p>
                          <p><strong>Moc:</strong> {installation.power} MW</p>
                          <p><strong>Data rozpoczęcia działalności:</strong> {installation.startDate}</p>
                          <p><strong>Adres siedziby:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                        </>
                      ) : (
                        <>
                          <p><strong>Lokalizacja:</strong> {installation.city}, woj. {installation.province}</p>
                          <p><strong>Rodzaj koncesji:</strong> {installation.installationType} - {concessionDescriptions[installation.installationType as keyof typeof concessionDescriptions]}</p>
                          <p><strong>Data wydania:</strong> {installation.registrationDate}</p>
                          <p><strong>Ważność:</strong> {installation.validFrom} - {installation.validTo}</p>
                          <p><strong>Adres:</strong> {installation.postalCode} {installation.city}, {installation.address}</p>
                          {installation.regon && <p><strong>REGON:</strong> {installation.regon}</p>}
                          {installation.exciseNumber && <p><strong>Nr akcyzowy:</strong> {installation.exciseNumber}</p>}
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </MapContainer>
        </div>
      </div>
    </div>
    </div>
  );
};

export default App;