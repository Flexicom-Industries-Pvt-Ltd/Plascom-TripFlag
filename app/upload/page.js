'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    // We will initialize PDF worker dynamically inside the conversion function
  }, []);

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

  async function processFile(file) {
    setUploading(true);
    setError('');
    setProgress('Reading file...');

    try {
      const ext = file.name.split('.').pop().toLowerCase();

      if (!['xlsx', 'xls', 'csv', 'pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
        throw new Error('Unsupported file type. Please upload .xlsx, .csv, .pdf, or image files.');
      }

      let rows = [];
      let columnHeaders = [];

      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        setProgress('Parsing spreadsheet...');

        const XLSX = (await import('xlsx')).default || (await import('xlsx'));
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (jsonData.length === 0) {
          throw new Error('File is empty or has no data rows.');
        }

        columnHeaders = Object.keys(jsonData[0]);
        rows = jsonData.map(row => {
          const cleaned = {};
          for (const key of columnHeaders) {
            let val = row[key];
            if (val instanceof Date) {
              val = val.toISOString().split('T')[0];
            }
            cleaned[key] = val;
          }
          return cleaned;
        });

        setProgress(`Found ${rows.length} rows with ${columnHeaders.length} columns.`);
      } else if (ext === 'pdf') {
        setProgress('Converting PDF to image...');
        const base64 = await convertPdfToBase64(file);
        
        setProgress('Extracting data via AI (OCR)...');
        const { headers, rows: ocrRows } = await doOCR(base64);
        columnHeaders = headers;
        rows = ocrRows;
        
        if (rows.length === 0) throw new Error('AI could not extract rows from PDF.');
        setProgress(`Extracted ${rows.length} rows from PDF.`);
      } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
        setProgress('Extracting data via AI (OCR)...');
        const base64 = await readFileAsBase64(file);
        
        const { headers, rows: ocrRows } = await doOCR(base64);
        columnHeaders = headers;
        rows = ocrRows;
        
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
      console.error('Upload error:', err);
      
      let friendlyError = 'We encountered an issue processing your file. Please ensure it contains a valid table.';
      
      if (err.message) {
        if (err.message.includes('Unsupported file type') || err.message.includes('File is empty')) {
          friendlyError = err.message;
        } else if (err.message.includes('AI could not extract')) {
          friendlyError = 'Our AI could not read the table. Please ensure the image is clear and contains readable columns.';
        } else if (err.message.includes('fetch') || err.message.includes('Network')) {
          friendlyError = 'Network error. Please check your internet connection and try again.';
        } else if (err.message.includes('Failed to save trip data')) {
          friendlyError = 'There was a problem saving your file to the database. Please try again.';
        }
      }
      
      setError(friendlyError);
      setUploading(false);
      setProgress('');
    }
  }

  return (
    <>
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

          {error && (
            <div className="card" style={{ marginTop: 'var(--space-lg)', borderColor: 'var(--flag-critical-border)', background: 'var(--flag-critical-bg)' }}>
              <p style={{ color: 'var(--flag-critical)', fontWeight: 600 }}>❌ {error}</p>
            </div>
          )}
        </>
      ) : (
        <div className="loading-overlay" style={{ minHeight: '300px' }}>
          <div className="spinner" />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>{progress}</p>
        </div>
      )}

      {/* Info cards */}
      <div className="info-grid">
        <div className="info-card">
          <div className="icon">📸</div>
          <h3>AI OCR</h3>
          <p>Extracts rows perfectly from images</p>
        </div>
        <div className="info-card">
          <div className="icon">🚩</div>
          <h3>Auto-Flag</h3>
          <p>Your rules are applied instantly</p>
        </div>
        <div className="info-card">
          <div className="icon">🤖</div>
          <h3>Smart Match</h3>
          <p>Fuzzy matching for column names</p>
        </div>
      </div>
    </>
  );
}

// Helpers
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function convertPdfToBase64(file) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  
  // Render at 2x scale for clear OCR
  const viewport = page.getViewport({ scale: 2.0 }); 
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
  
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function doOCR(base64) {
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to extract data via AI');
  }
  return res.json();
}
