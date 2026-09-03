'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Camera, Flag, Cpu, Layers } from 'lucide-react';
import SheetPickerModal from '../components/SheetPickerModal';
import { extractSheetPreview, extractRowsFromGrid } from '@/lib/spreadsheet-parser';
import { detectSpreadsheetProfile } from '@/lib/format-adapters/registry';

export default function UploadPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [sheetPicker, setSheetPicker] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSheetSelect(sheetName) {
    if (sheetPicker?.resolve) {
      sheetPicker.resolve(sheetName);
    }
    setSheetPicker(null);
  }

  function handleSheetCancel() {
    if (sheetPicker?.reject) {
      sheetPicker.reject(new Error('Sheet selection cancelled'));
    }
    setSheetPicker(null);
    setUploading(false);
    setProgress('');
  }

  async function pickSheet(workbook, XLSX) {
    const previews = workbook.SheetNames.map((name) => {
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
      return extractSheetPreview(raw, name);
    });

    if (previews.length === 1) return { sheetName: previews[0].name, previews };

    setProgress('Analyzing worksheets...');

    let analyzedSheets = previews.map(p => ({
      name: p.name,
      headers: p.headers,
      rowCount: p.rowCount,
      dataRowCount: p.dataRowCount,
      hasDuration: p.hasDuration,
      hasDistance: p.hasDistance,
      hasStatus: p.hasStatus,
      sampleRows: p.sampleRows,
      recommended: false,
    }));

    try {
      const res = await fetch('/api/analyze-workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets: previews }),
      });
      if (res.ok) {
        const data = await res.json();
        analyzedSheets = data.sheets;
      }
    } catch (e) {
      console.warn('Workbook analysis failed, using local scoring', e);
    }

    const sheetName = await new Promise((resolve, reject) => {
      setSheetPicker({ sheets: analyzedSheets, resolve, reject });
    });

    return { sheetName, previews };
  }

  async function parseSpreadsheet(file, sheetName = null) {
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

    let selectedSheet = sheetName;
    let previews = [];

    if (!selectedSheet) {
      const picked = await pickSheet(workbook, XLSX);
      selectedSheet = picked.sheetName;
      previews = picked.previews;
    }

    const sheet = workbook.Sheets[selectedSheet];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const preview = previews.find(p => p.name === selectedSheet) || extractSheetPreview(rawRows, selectedSheet);

    setProgress('🧠 AI is analyzing the grid structure...');

    const sampleRows = rawRows.slice(0, 30);
    let structure = null;

    try {
      const aiRes = await fetch('/api/analyze-file-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: sampleRows }),
      });
      if (aiRes.ok) structure = await aiRes.json();
    } catch (e) {
      console.warn('AI structure analysis failed', e);
    }

    setProgress('Extracting data...');

    let columnHeaders = [];
    let rows = [];

    if (structure && !structure.fallback && typeof structure.header_row_index === 'number') {
      ({ columnHeaders, rows } = extractRowsFromGrid(rawRows, structure));
    } else {
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (jsonData.length === 0) throw new Error('Selected sheet is empty or has no data rows.');
      columnHeaders = Object.keys(jsonData[0]);
      rows = jsonData.map(row => {
        const cleaned = {};
        for (const key of columnHeaders) {
          let val = row[key];
          if (val instanceof Date) val = val.toISOString().split('T')[0];
          cleaned[key] = val;
        }
        return cleaned;
      });
    }

    const formatProfile = detectSpreadsheetProfile(selectedSheet, columnHeaders);

    return { columnHeaders, rows, sourceSheet: selectedSheet, formatProfile };
  }

  async function processFile(file) {
    setUploading(true);
    setProgress('Reading file...');

    try {
      const ext = file.name.split('.').pop().toLowerCase();

      if (!['xlsx', 'xls', 'csv', 'pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
        throw new Error('Unsupported file type. Please upload .xlsx, .csv, .pdf, or image files.');
      }

      let rows = [];
      let columnHeaders = [];
      let sourceSheet = null;
      let formatProfile = null;

      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        setProgress('Parsing spreadsheet...');
        const parsed = await parseSpreadsheet(file);
        columnHeaders = parsed.columnHeaders;
        rows = parsed.rows;
        sourceSheet = parsed.sourceSheet;
        formatProfile = parsed.formatProfile;
        setProgress(`Found ${rows.length} rows in "${sourceSheet}".`);
      } else if (ext === 'pdf') {
        setProgress('Extracting text from PDF...');
        const pdfText = await extractTextFromPdf(file);

        if (pdfText.length > 50) {
          setProgress('Parsing PDF table...');
          const res = await fetch('/api/parse-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: pdfText }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to extract data from PDF');
          }

          const result = await res.json();
          columnHeaders = result.headers;
          rows = result.rows;
          formatProfile = result.formatProfile || 'generic_pdf';

          if (result.parser === 'adapter') {
            setProgress(`Parsed ${rows.length} rows (Fleet Edge format).`);
          }
        } else {
          setProgress('Converting scanned PDF pages to images...');
          const images = await convertPdfPagesToBase64(file);

          setProgress('Extracting data via AI (OCR)...');
          let allRows = [];
          let headers = [];

          for (let i = 0; i < images.length; i++) {
            setProgress(`OCR page ${i + 1} of ${images.length}...`);
            const { headers: h, rows: r } = await doOCR(images[i]);
            if (i === 0) headers = h;
            allRows = allRows.concat(r);
          }

          columnHeaders = headers;
          rows = allRows;
          formatProfile = 'generic_pdf';
        }

        if (rows.length === 0) throw new Error('AI could not extract rows from PDF.');
        setProgress(`Extracted ${rows.length} rows from PDF.`);
      } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
        setProgress('Extracting data via AI (OCR)...');
        const base64 = await readFileAsBase64(file);
        const { headers, rows: ocrRows } = await doOCR(base64);
        columnHeaders = headers;
        rows = ocrRows;
        formatProfile = 'generic_image';

        if (rows.length === 0) throw new Error('AI could not extract rows from Image.');
        setProgress(`Extracted ${rows.length} rows from Image.`);
      }

      setProgress(`Uploading ${rows.length} rows to database...`);

      const tripName = file.name.replace(/\.[^/.]+$/, '');
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tripName,
          original_filename: file.name,
          file_type: ext,
          column_headers: columnHeaders,
          rows,
          source_sheet: sourceSheet,
          format_profile: formatProfile,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save trip data.');
      }

      const trip = await res.json();

      setProgress('Running flagging rules...');

      await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: trip.id }),
      });

      setProgress('Done! Redirecting to review...');

      setTimeout(() => {
        router.push(`/review/${trip.id}`);
      }, 600);
    } catch (err) {
      if (err.message === 'Sheet selection cancelled') return;

      console.error('Upload error:', err);

      let friendlyError = 'We encountered an issue processing your file. Please ensure it contains a valid table.';

      if (err.message) {
        if (err.message.includes('Unsupported file type') || err.message.includes('empty')) {
          friendlyError = err.message;
        } else if (err.message.includes('AI could not extract') || err.message.includes('Failed to extract')) {
          friendlyError = 'Our AI could not read the table. Please ensure the file is clear and contains readable data.';
        } else if (err.message.includes('fetch') || err.message.includes('Network')) {
          friendlyError = 'Network error. Please check your internet connection and try again.';
        } else if (err.message.includes('Failed to save')) {
          friendlyError = 'There was a problem saving your file to the database. Please try again.';
        }
      }

      toast.error(friendlyError);
      setUploading(false);
      setProgress('');
    }
  }

  return (
    <>
      {sheetPicker && (
        <SheetPickerModal
          sheets={sheetPicker.sheets}
          recommended={sheetPicker.sheets?.find(s => s.recommended)?.name}
          onSelect={handleSheetSelect}
          onCancel={handleSheetCancel}
        />
      )}

      <div className="page-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <img src="/Logo.png" alt="TripFlag" className="logo" style={{ width: '48px', height: '48px' }} />
        <div className="header-text">
          <h1 style={{ fontSize: '1.4rem' }}>Upload Trip File</h1>
          <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>Upload a Spreadsheet, PDF, or Image</p>
        </div>
      </div>

      {!uploading ? (
        <>
          <div
            className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            id="file-drop-zone"
          >
            <svg className="drop-zone-icon" xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 'var(--space-md)' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Drop your file here</h3>
            <p style={{ fontSize: '0.9rem' }}>or tap to browse files</p>
            <p style={{ marginTop: 'var(--space-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Supports: .xlsx, .csv, .pdf, .jpg, .png
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-input"
          />
        </>
      ) : (
        <div className="loading-overlay" style={{ minHeight: '300px' }}>
          <div className="spinner" />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>{progress}</p>
        </div>
      )}

      <div className="info-grid">
        <div className="info-card">
          <div className="icon"><Layers size={24} color="var(--primary)" /></div>
          <h3>Multi-Sheet</h3>
          <p>Pick the right worksheet from Excel files</p>
        </div>
        <div className="info-card">
          <div className="icon"><Camera size={24} color="var(--primary)" /></div>
          <h3>AI OCR</h3>
          <p>Extracts rows from images and scanned PDFs</p>
        </div>
        <div className="info-card">
          <div className="icon"><Flag size={24} color="var(--flag-critical)" /></div>
          <h3>Auto-Flag</h3>
          <p>Your rules are applied instantly</p>
        </div>
        <div className="info-card">
          <div className="icon"><Cpu size={24} color="var(--accent)" /></div>
          <h3>Smart Match</h3>
          <p>Works across all file formats</p>
        </div>
      </div>
    </>
  );
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
  }

  return fullText.trim();
}

async function convertPdfPagesToBase64(file, maxPages = 5) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const images = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.9));
  }

  return images;
}

async function doOCR(base64) {
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to extract data via AI');
  }
  return res.json();
}
