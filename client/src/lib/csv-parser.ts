export interface CSVData {
  headers: string[];
  rows: any[][];
}

export function parseCSV(file: File): Promise<CSVData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length === 0) {
          reject(new Error('Empty CSV file'));
          return;
        }
        
        // Parse headers
        const headers = parseCSVLine(lines[0]);
        
        // Parse data rows
        const rows: any[][] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          if (row.length > 0) {
            // Pad row to match header length
            while (row.length < headers.length) {
              row.push('');
            }
            rows.push(row.slice(0, headers.length));
          }
        }
        
        resolve({ headers, rows });
      } catch (error) {
        reject(new Error('Failed to parse CSV file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}
