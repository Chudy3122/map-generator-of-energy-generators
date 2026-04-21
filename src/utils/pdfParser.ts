import * as pdfjsLib from 'pdfjs-dist';
import { CompanyAddress, DocumentParser, ParseResult } from '../types/documents';

// Stała z wersją PDF.js - aktualizuj zgodnie z zainstalowaną wersją
const PDFJS_VERSION = '3.4.120';

// Definiujemy prostszy interfejs dla elementów tekstowych
interface TextItem {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  dir?: string;
  fontName?: string;
}

// Interfejs dla opcji getTextContent (zgodny z PDF.js)
interface GetTextContentOptions {
  disableCombineTextItems?: boolean;
  includeMarkedContent?: boolean;
}

// Konfiguracja PDF.js z różnymi opcjami worker
const initializePDFJS = () => {
  try {
    // Próba 1: CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  } catch (error) {
    console.warn('Nie można załadować worker z CDN, używam lokalnego:', error);
    try {
      // Próba 2: Lokalny worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
    } catch (error2) {
      console.warn('Nie można załadować lokalnego worker:', error2);
      // Próba 3: Disable worker (może być wolniejsze, ale powinno działać)
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  }
};

// Inicjalizuj PDF.js
initializePDFJS();

/**
 * Helper function do klonowania ArrayBuffer
 */
function cloneArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
  const cloned = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(cloned).set(new Uint8Array(buffer));
  return cloned;
}

/**
 * Helper function do konwersji ArrayBuffer na Uint8Array
 */
function bufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  try {
    return new Uint8Array(buffer);
  } catch (error) {
    console.warn('Błąd konwersji ArrayBuffer, próbuję klonowanie:', error);
    const cloned = cloneArrayBuffer(buffer);
    return new Uint8Array(cloned);
  }
}

/**
 * Helper function do bezpiecznej konwersji wartości procentowej
 */
function parseEnergyPercentage(percentageStr: string | undefined): number | undefined {
  if (!percentageStr) return undefined;
  
  const cleanedStr = percentageStr.replace(/[^\d]/g, '').trim();
  if (cleanedStr === '') return undefined;
  
  const numericValue = parseInt(cleanedStr, 10);
  if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
    console.warn(`Nieprawidłowa wartość procentowa: "${percentageStr}"`);
    return undefined;
  }
  
  return numericValue;
}

/**
 * Helper function do czyszczenia nazw firm
 */
function cleanCompanyName(name: string): string {
  return name.trim()
    .replace(/^["']|["']$/g, '') // Usuń cudzysłowy
    .replace(/^\d+\s*/, '') // Usuń numery na początku
    .trim();
}

/**
 * Helper function do czyszczenia adresów
 */
function cleanAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ');
}

/**
 * Ulepszona funkcja do parsowania pojedynczej linii z danymi firmy
 */
function parseCompanyLine(line: string, lineNumber: number = 0): {
  companyName: string;
  zipCode: string;
  city: string;
  address: string;
  nip: string;
  percentage: string;
} | null {
  
  if (lineNumber < 10) {
    console.log(`🔍 Parsowanie linii ${lineNumber}: "${line.substring(0, 100)}..."`);
  }
  
  // Usuń nadmiarowe spacje i znaki specjalne
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  // Znajdź NIP (10 cyfr) - najważniejszy identyfikator
  const nipMatch = cleanLine.match(/(\d{10})/);
  if (!nipMatch) {
    if (lineNumber < 10) console.log(`❌ Brak NIP w linii ${lineNumber}`);
    return null;
  }
  const nip = nipMatch[1];
  
  // Znajdź procent energii
  const percentMatch = cleanLine.match(/(\d{1,2}%)/);
  if (!percentMatch) {
    if (lineNumber < 10) console.log(`❌ Brak procentu w linii ${lineNumber}`);
    return null;
  }
  const percentage = percentMatch[1];
  
  // Znajdź kod pocztowy
  const zipMatch = cleanLine.match(/(\d{2}-\d{3})/);
  if (!zipMatch) {
    if (lineNumber < 10) console.log(`❌ Brak kodu pocztowego w linii ${lineNumber}`);
    return null;
  }
  const zipCode = zipMatch[1];
  
  // Znajdź pozycje elementów
  const nipIndex = cleanLine.indexOf(nip);
  const zipIndex = cleanLine.indexOf(zipCode);
  
  if (zipIndex === -1 || nipIndex === -1 || zipIndex >= nipIndex) {
    if (lineNumber < 10) console.log(`❌ Nieprawidłowa kolejność elementów w linii ${lineNumber}`);
    return null;
  }
  
  // Wyodrębnij nazwę firmy (przed kodem pocztowym)
  let companyName = cleanLine.substring(0, zipIndex).trim();
  
  // Usuń numer pozycji z nazwy firmy jeśli istnieje
  companyName = companyName.replace(/^\d+\s+/, '').trim();
  
  // Wyodrębnij miasto i adres (między kodem pocztowym a NIP)
  const cityAndAddress = cleanLine.substring(zipIndex + zipCode.length, nipIndex).trim();
  
  // Podziel na miasto (pierwszy wyraz) i adres (reszta)
  const parts = cityAndAddress.split(/\s+/);
  const city = parts[0] || '';
  const address = parts.slice(1).join(' ') || '';
  
  // Podstawowa walidacja
  if (!companyName || companyName.length < 3 || !city) {
    if (lineNumber < 10) console.log(`❌ Niepełne dane w linii ${lineNumber}: firma="${companyName}", miasto="${city}"`);
    return null;
  }
  
  if (lineNumber < 10) {
    console.log(`✅ Sparsowano linię ${lineNumber}: ${companyName} | ${zipCode} ${city} | ${nip} | ${percentage}`);
  }
  
  return {
    companyName: cleanCompanyName(companyName),
    zipCode,
    city,
    address: cleanAddress(address),
    nip,
    percentage
  };
}

/**
 * Parser dokumentów PDF pochodzących z URE
 */
export class URE_PDFParser implements DocumentParser<ArrayBuffer> {
  /**
   * Parsuje dokument URE w formacie PDF
   */
  async parseDocument(pdfBuffer: ArrayBuffer): Promise<CompanyAddress[]> {
    try {
      console.log('🚀 Rozpoczynam parsowanie dokumentu PDF URE...');
      
      // Wyodrębnienie tekstu z PDF z rozszerzoną obsługą błędów
      const text = await this.extractTextFromPdfRobust(pdfBuffer);
      
      if (!text || text.length < 100) {
        console.error('❌ Nie udało się wyodrębnić tekstu z PDF lub tekst jest zbyt krótki');
        return [];
      }
      
      console.log(`📄 Wyodrębniono ${text.length} znaków tekstu z PDF`);
      console.log(`📋 Próbka tekstu: ${text.substring(0, 300)}...`);
      
      // Parsowanie wszystkich firm
      const addresses = this.parseAllCompanyLines(text);
      
      console.log(`🎉 Pomyślnie przetworzono ${addresses.length} adresów z dokumentu PDF`);
      return addresses;
    } catch (error) {
      console.error('💥 Błąd podczas parsowania dokumentu PDF URE:', error);
      return [];
    }
  }

  /**
   * Wzmocniona metoda ekstrakcji tekstu z różnymi strategiami
   */
  private async extractTextFromPdfRobust(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log('📖 Rozpoczynam ekstrakcję tekstu z PDF (wzmocniona wersja)...');
    
    const strategies = [
      () => this.extractWithUint8ArrayMethod(pdfBuffer),
      () => this.extractWithClonedBufferMethod(pdfBuffer),
      () => this.extractWithWorkerlessMethod(pdfBuffer),
      () => this.extractWithMinimalMethod(pdfBuffer)
    ];
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔄 Próbuję strategię ${i + 1}/${strategies.length}...`);
        const result = await strategies[i]();
        
        if (result && result.length > 50) {
          console.log(`✅ Strategia ${i + 1} zakończona sukcesem! Wyodrębniono ${result.length} znaków.`);
          return result;
        } else {
          console.log(`⚠️ Strategia ${i + 1} zwróciła zbyt mało danych (${result?.length || 0} znaków).`);
        }
      } catch (error) {
        console.warn(`❌ Strategia ${i + 1} nie powiodła się:`, error);
      }
    }
    
    throw new Error('Wszystkie strategie ekstrakcji tekstu z PDF nie powiodły się');
  }

  /**
   * Strategia 1: Metoda z Uint8Array (najczęściej działa)
   */
  private async extractWithUint8ArrayMethod(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log('📖 Strategia: Uint8Array...');
    
    const uint8Array = bufferToUint8Array(pdfBuffer);
    
    const pdf = await pdfjsLib.getDocument({ 
      data: uint8Array,
      verbosity: 0,
      disableFontFace: true,
      disableRange: true,
      disableStream: true
    }).promise;
    
    console.log(`📄 PDF załadowany: ${pdf.numPages} stron`);
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 20); // Ogranicz do 20 stron
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent({
          disableCombineTextItems: false
        } as GetTextContentOptions);
        
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .filter(str => str.trim().length > 0)
          .join(' ');
        
        fullText += pageText + '\n';
        console.log(`📄 Strona ${i}: ${pageText.length} znaków`);
      } catch (pageError) {
        console.warn(`⚠️ Błąd strony ${i}:`, pageError);
        continue;
      }
    }
    
    return fullText;
  }

  /**
   * Strategia 2: Metoda z klonowanym bufferem
   */
  private async extractWithClonedBufferMethod(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log('📖 Strategia: Klonowany buffer...');
    
    const clonedBuffer = cloneArrayBuffer(pdfBuffer);
    const uint8Array = new Uint8Array(clonedBuffer);
    
    const pdf = await pdfjsLib.getDocument({ 
      data: uint8Array,
      verbosity: 0,
      disableFontFace: true
    }).promise;
    
    return await this.extractAllPages(pdf);
  }

  /**
   * Strategia 3: Metoda z podstawowymi opcjami
   */
  private async extractWithBasicMethod(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log('📖 Strategia: Podstawowa...');
    
    const uint8Array = bufferToUint8Array(pdfBuffer);
    
    const pdf = await pdfjsLib.getDocument({ 
      data: uint8Array,
      verbosity: 0
    }).promise;
    
    return await this.extractAllPages(pdf, 10); // Tylko 10 stron
  }

  /**
   * Strategia 3: Metoda bez worker (fallback)
   */
  private async extractWithWorkerlessMethod(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log('📖 Strategia: Bez worker...');
    
    // Wyłącz worker dla tej próby
    const originalWorker = pdfjsLib.GlobalWorkerOptions.workerSrc;
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    try {
      const uint8Array = bufferToUint8Array(pdfBuffer);
      
      const pdf = await pdfjsLib.getDocument({ 
        data: uint8Array,
        verbosity: 0,
        isEvalSupported: false,
        disableFontFace: true,
        disableRange: true,
        disableStream: true
      }).promise;
      
      return await this.extractAllPages(pdf, 5); // Tylko 5 stron dla tej metody
    } finally {
      // Przywróć oryginalny worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = originalWorker;
    }
  }

  /**
   * Strategia 4: Minimalna metoda (ostatnia deska ratunku)
   */
  private async extractWithMinimalMethod(pdfBuffer: ArrayBuffer): Promise<string> {
    console.log('📖 Strategia: Minimalna...');
    
    const uint8Array = bufferToUint8Array(pdfBuffer);
    
    const pdf = await pdfjsLib.getDocument({ 
      data: uint8Array,
      verbosity: 0
    }).promise;
    
    // Tylko pierwsza strona
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    
    return textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
  }

  /**
   * Helper do ekstrakcji wszystkich stron
   */
  private async extractAllPages(pdf: pdfjsLib.PDFDocumentProxy, maxPages?: number): Promise<string> {
    let fullText = '';
    const numPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent({
          disableCombineTextItems: false
        } as GetTextContentOptions);
        
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .filter(str => str.trim().length > 0)
          .join(' ');
        
        fullText += pageText + '\n';
      } catch (error) {
        console.warn(`⚠️ Błąd strony ${i}:`, error);
        continue;
      }
    }
    
    return fullText;
  }

  /**
   * Parsowanie wszystkich linii z firmami
   */
  private parseAllCompanyLines(text: string): CompanyAddress[] {
    const addresses: CompanyAddress[] = [];
    const lines = text.split(/[\n\r]+/);
    
    console.log(`🔍 Analizuję ${lines.length} linii tekstu...`);
    
    let processedLines = 0;
    let successfullyParsed = 0;
    let linesWithNIP = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Pomiń bardzo krótkie linie
      if (!line || line.length < 30) continue;
      
      // Sprawdź czy linia zawiera NIP
      if (/\d{10}/.test(line)) {
        linesWithNIP++;
        
        // Sprawdź czy to prawdopodobnie linia z danymi firmy
        const hasPercent = /\d{1,2}%/.test(line);
        const hasZipCode = /\d{2}-\d{3}/.test(line);
        
        if (hasPercent && hasZipCode) {
          processedLines++;
          
          const parsed = parseCompanyLine(line, processedLines);
          if (parsed) {
            const companyAddress: CompanyAddress = {
              name: parsed.companyName,
              zipCode: parsed.zipCode,
              city: parsed.city,
              street: parsed.address,
              buildingNumber: '',
              taxId: parsed.nip,
              energyPercentage: parseEnergyPercentage(parsed.percentage),
              source: 'pdf'
            };
            
            addresses.push(companyAddress);
            successfullyParsed++;
          }
        }
      }
    }
    
    console.log(`📊 Statystyki parsowania:`);
    console.log(`- Wszystkich linii: ${lines.length}`);
    console.log(`- Linii z NIP: ${linesWithNIP}`);
    console.log(`- Linii z danymi firm: ${processedLines}`);
    console.log(`- Pomyślnie sparsowano: ${successfullyParsed}`);
    console.log(`- Współczynnik sukcesu: ${processedLines > 0 ? ((successfullyParsed / processedLines) * 100).toFixed(1) : 0}%`);
    
    return addresses;
  }
}

// Eksportuj instancję parsera
export const urePdfParser = new URE_PDFParser();

/**
 * Główna funkcja parsowania PDF
 */
export async function parseURE_PDF(file: File): Promise<ParseResult> {
  try {
    console.log(`🚀 Parsowanie pliku: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const buffer = await readFileAsArrayBuffer(file);
    console.log(`✅ Plik załadowany jako ArrayBuffer (${buffer.byteLength} bajtów)`);
    
    const addresses = await urePdfParser.parseDocument(buffer);
    
    if (addresses.length === 0) {
      return {
        addresses: [],
        success: false,
        message: "Nie znaleziono firm w dokumencie PDF. Sprawdź czy plik zawiera tabelę z danymi firm lub spróbuj z innym plikiem.",
        totalFound: 0
      };
    }
    
    console.log(`🎉 Sukces! Znaleziono ${addresses.length} firm`);
    
    return {
      addresses,
      success: true,
      message: `Pomyślnie wczytano ${addresses.length} firm z dokumentu PDF.`,
      totalFound: addresses.length,
      documentType: 'industrial_receivers'
    };
  } catch (error) {
    console.error('💥 Błąd parsowania PDF:', error);
    return {
      addresses: [],
      success: false,
      message: `Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}. Spróbuj z innym plikiem PDF.`,
      errors: [error instanceof Error ? error.message : 'Nieznany błąd']
    };
  }
}

/**
 * Wczytuje plik jako ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Błąd odczytu pliku'));
    reader.readAsArrayBuffer(file);
  });
}