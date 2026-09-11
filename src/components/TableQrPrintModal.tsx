import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogClose 
} from '@/components/ui/dialog';
import { 
  Printer, 
  X, 
  Copy, 
  ExternalLink, 
  Download, 
  Layers, 
  QrCode, 
  Check, 
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

export interface TableItem {
  id: string;
  table_number: string;
  qr_token: string;
  status: string;
}

interface TableQrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableItem[];
  selectedTable: TableItem | null;
  appBaseUrl: string;
}

/**
 * Builds standalone, fully self-contained HTML for reliable printing
 * completely isolated from parent modal dialog transforms and overflow constraints.
 */
function buildPrintDocumentHtml(
  cardsHtml: string,
  title: string,
  showToolbar: boolean = false
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/logo.png`;

  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <title>Pelekat Meja Warung J&J - ${title}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      margin: 0;
      padding: 0;
    }
    .no-print {
      display: none !important;
    }
    @media screen {
      body {
        background-color: #f1f5f9;
        padding: 24px 16px;
      }
      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 9999;
        background: #0f172a;
        color: #ffffff;
        padding: 14px 24px;
        margin: -24px -16px 24px -16px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.18);
      }
      .toolbar-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
      }
      .toolbar-brand img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid #f97316;
        object-fit: cover;
      }
      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .toolbar-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 800;
        padding: 8px 18px;
        border-radius: 12px;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
      }
      .btn-print {
        background-color: #ea580c;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(234, 88, 12, 0.4);
      }
      .btn-print:hover {
        background-color: #c2410c;
      }
      .btn-close {
        background-color: #334155;
        color: #f8fafc;
      }
      .btn-close:hover {
        background-color: #475569;
      }
      .print-container-screen {
        max-width: 210mm;
        margin: 0 auto;
        background: #ffffff;
        padding: 8mm;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        border-radius: 16px;
      }
    }
    @media print {
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
      }
      .print-toolbar {
        display: none !important;
      }
      .print-container-screen {
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
    .sticker-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5mm;
      justify-content: center;
      align-items: start;
      width: 100%;
    }
    .sticker-card {
      width: 90mm;
      min-height: 128mm;
      background: #ffffff !important;
      border: 2px dashed #94a3b8 !important;
      border-radius: 20px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      position: relative;
      page-break-inside: avoid;
      break-inside: avoid;
      box-sizing: border-box;
      margin: 0 auto;
    }
    .sticker-brand-bar {
      width: 100%;
      background: linear-gradient(90deg, #ea580c, #d97706, #ea580c) !important;
      color: #ffffff !important;
      padding: 4px 10px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .sticker-brand-title {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sticker-brand-badge {
      font-size: 9px;
      font-weight: 800;
      background: rgba(255,255,255,0.25) !important;
      padding: 2px 6px;
      border-radius: 9999px;
      text-transform: uppercase;
      font-family: monospace;
    }
    .sticker-header-row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .sticker-logo-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: left;
    }
    .sticker-logo-img {
      width: 38px;
      height: 38px;
      border-radius: 9999px;
      border: 2px solid #ea580c;
      object-fit: cover;
    }
    .sticker-stall-name {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.1;
    }
    .sticker-stall-sub {
      font-size: 9px;
      font-weight: 800;
      color: #ea580c;
      display: block;
    }
    .sticker-table-badge {
      background: #fff7ed !important;
      border: 2px solid #fb923c !important;
      border-radius: 12px;
      padding: 4px 10px;
      text-align: center;
    }
    .sticker-table-label {
      font-size: 8px;
      font-weight: 900;
      color: #c2410c;
      text-transform: uppercase;
      display: block;
      line-height: 1;
    }
    .sticker-table-number {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace;
      line-height: 1;
    }
    .sticker-qr-box {
      background: #ffffff !important;
      border: 2px solid #0f172a !important;
      border-radius: 14px;
      padding: 8px;
      margin: 4px 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sticker-qr-box svg {
      display: block;
      width: 140px;
      height: 140px;
    }
    .sticker-cta-box {
      width: 100%;
      background: #0f172a !important;
      color: #ffffff !important;
      padding: 5px 8px;
      border-radius: 10px;
      margin-bottom: 4px;
    }
    .sticker-cta-title {
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: -0.01em;
    }
    .sticker-cta-sub {
      font-size: 8.5px;
      color: #fdba74;
      font-weight: 600;
    }
    .sticker-notice-box {
      width: 100%;
      background: #fffbeb !important;
      border: 1px solid #fde68a !important;
      border-radius: 10px;
      padding: 5px 8px;
      text-align: left;
      margin-bottom: 4px;
    }
    .sticker-notice-text {
      font-size: 8.5px;
      color: #451a03;
      line-height: 1.35;
    }
    .sticker-notice-strong {
      color: #78350f;
      font-weight: 900;
    }
    .sticker-steps-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding-top: 4px;
      border-top: 1px solid #f1f5f9;
      font-size: 8px;
      font-weight: 800;
      color: #475569;
    }
    .sticker-step-item {
      background: #f8fafc !important;
      padding: 3px 2px;
      border-radius: 6px;
      text-align: center;
    }
    .sticker-footer-row {
      width: 100%;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5px;
      color: #94a3b8;
      font-family: monospace;
    }
  </style>
</head>
<body>
  ${showToolbar ? `
  <div class="print-toolbar">
    <div class="toolbar-brand">
      <img src="${logoUrl}" alt="Warung J&J" />
      <div>
        <span>Warung J&amp;J — Pelekat Meja Kod QR</span>
        <span style="font-size: 12px; color: #cbd5e1; margin-left: 8px; font-weight: normal;">(${title})</span>
      </div>
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="toolbar-btn btn-print">
        🖨️ Cetak / Simpan PDF
      </button>
      <button onclick="window.close()" class="toolbar-btn btn-close">
        ✕ Tutup Tab
      </button>
    </div>
  </div>
  ` : ''}
  <div class="print-container-screen">
    <div class="sticker-grid">
      ${cardsHtml}
    </div>
  </div>
</body>
</html>`;
}

export function TableQrPrintModal({
  isOpen,
  onClose,
  tables,
  selectedTable,
  appBaseUrl
}: TableQrPrintModalProps) {
  const [printMode, setPrintMode] = useState<'single' | 'all'>('single');
  const [activeTable, setActiveTable] = useState<TableItem | null>(selectedTable || (tables[0] || null));
  const [isPrinting, setIsPrinting] = useState(false);

  React.useEffect(() => {
    if (selectedTable) {
      setActiveTable(selectedTable);
      setPrintMode('single');
    } else if (tables.length > 0 && !activeTable) {
      setActiveTable(tables[0]);
    }
  }, [selectedTable, tables, activeTable]);

  const copyUrl = (token: string) => {
    const url = `${appBaseUrl}/t/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Pautan menu meja disalin!');
  };

  /**
   * Download high-resolution PNG of the QR code for a specific table
   */
  const downloadQrPng = (table: TableItem) => {
    const card = document.getElementById(`sticker-card-${table.id}`);
    const svgElement = card ? card.querySelector('svg') : document.getElementById(`qr-svg-${table.id}`);
    
    if (!svgElement) {
      toast.error('Gagal menjumpai kod QR untuk dimuat turun.');
      return;
    }

    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = 600;
        canvas.height = 600;
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 600, 600);
          ctx.drawImage(img, 30, 30, 540, 540);
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `QR-Meja-${table.table_number}-WarungJnJ.png`;
          link.click();
          toast.success(`Kod QR Meja ${table.table_number} berjaya dimuat turun!`);
        }
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (e) {
      console.error('Error downloading QR PNG:', e);
      toast.error('Ralat ketika memproses muat turun imej QR.');
    }
  };

  const getCleanCardsHtml = (): string => {
    const container = document.getElementById('warung-table-printable-area');
    if (!container) return '';

    // Clone to ensure absolute image paths
    const clone = container.cloneNode(true) as HTMLElement;
    const imgs = clone.querySelectorAll('img');
    const origin = window.location.origin;

    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('/')) {
        img.setAttribute('src', `${origin}${src}`);
      }
    });

    // Remove buttons from printed stickers
    const copyBtns = clone.querySelectorAll('.sticker-copy-btn');
    copyBtns.forEach(btn => btn.remove());

    return clone.innerHTML;
  };

  /**
   * Instant reliable iframe print (never blank, never clipped by modal)
   */
  const handlePrint = () => {
    setIsPrinting(true);
    const cardsHtml = getCleanCardsHtml();

    if (!cardsHtml) {
      toast.error('Kandungan pelekat tidak dijumpai.');
      setIsPrinting(false);
      return;
    }

    const title = printMode === 'single' ? `Meja ${activeTable?.table_number}` : `Semua Meja (${tables.length})`;
    const fullHtml = buildPrintDocumentHtml(cardsHtml, title, false);

    // Create or reuse hidden iframe
    let iframe = document.getElementById('warung-print-iframe') as HTMLIFrameElement | null;
    if (iframe) {
      iframe.remove();
    }

    iframe = document.createElement('iframe');
    iframe.id = 'warung-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      // Fallback to new window if iframe access is restricted
      handleOpenNewTab();
      setIsPrinting(false);
      return;
    }

    doc.open();
    doc.write(fullHtml);
    doc.close();

    const doPrint = () => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, opening print window:', err);
        handleOpenNewTab();
      } finally {
        setIsPrinting(false);
      }
    };

    const imgs = Array.from(doc.images);
    if (imgs.length === 0) {
      setTimeout(doPrint, 250);
    } else {
      let loaded = 0;
      const onDone = () => {
        loaded++;
        if (loaded >= imgs.length) {
          setTimeout(doPrint, 250);
        }
      };
      imgs.forEach(img => {
        if (img.complete) {
          onDone();
        } else {
          img.onload = onDone;
          img.onerror = onDone;
        }
      });
      // Safety timeout in case image never fires
      setTimeout(doPrint, 1200);
    }
  };

  /**
   * Standalone full-tab print view
   */
  const handleOpenNewTab = () => {
    const cardsHtml = getCleanCardsHtml();
    if (!cardsHtml) {
      toast.error('Kandungan pelekat tidak dijumpai.');
      return;
    }

    const title = printMode === 'single' ? `Meja ${activeTable?.table_number}` : `Semua Meja (${tables.length})`;
    const fullHtml = buildPrintDocumentHtml(cardsHtml, title, true);

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(fullHtml);
      w.document.close();
      toast.success('Halaman cetak dibuka dalam tab baharu.');
    } else {
      toast.error('Pop-up disekat. Sila benarkan pop-up pada pelayar anda.');
    }
  };

  const tablesToPrint = printMode === 'single' ? (activeTable ? [activeTable] : []) : tables;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200/90 rounded-3xl shadow-2xl">
        
        {/* MODAL TOP HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-[#fbfbfa] flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center font-black shadow-2xs shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Pelekat Meja Kod QR (Table Standee / Sticker)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                Reka bentuk khas medan selera — mesra gerai lain, jelas untuk pelanggan Warung J&J
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
              title="Buka paparan cetak dalam tab baharu pelayar"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Buka Tab Cetak</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Menyiapkan...' : 'Cetak Sekarang'}</span>
            </button>
            <DialogClose className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </div>

        {/* CONTROLS & PRINT MODE TOGGLES */}
        <div className="p-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintMode('single')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                printMode === 'single'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              Cetak 1 Meja Sahaja
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                printMode === 'all'
                  ? 'bg-orange-500 text-white shadow-2xs'
                  : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1" />
              Cetak Semua ({tables.length} Meja) Sekaligus (A4)
            </button>
          </div>

          <div className="flex items-center gap-3">
            {printMode === 'single' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Pilih:</span>
                <select
                  value={activeTable?.id || ''}
                  onChange={(e) => {
                    const t = tables.find(item => item.id === e.target.value);
                    if (t) setActiveTable(t);
                  }}
                  className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                >
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>
                      Meja {t.table_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeTable && (
              <button
                type="button"
                onClick={() => downloadQrPng(activeTable)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                title={`Muat turun kod QR Meja ${activeTable.table_number} sebagai imej PNG resolusi tinggi`}
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Muat Turun PNG</span>
              </button>
            )}
          </div>
        </div>

        {/* PRINTABLE PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
          
          {/* INLINE STYLES FOR THE MODAL PREVIEW & CARD COMPONENTS */}
          <style dangerouslySetInnerHTML={{ __html: `
            .sticker-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(280px, 320px));
              gap: 20px;
              justify-content: center;
              align-items: start;
              width: 100%;
            }
            .sticker-card {
              width: 100%;
              max-width: 320px;
              background: #ffffff;
              border: 2px dashed #cbd5e1;
              border-radius: 20px;
              padding: 14px 16px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              position: relative;
              box-shadow: 0 4px 12px rgba(0,0,0,0.04);
              box-sizing: border-box;
              margin: 0 auto;
            }
            .sticker-brand-bar {
              width: 100%;
              background: linear-gradient(90deg, #ea580c, #d97706, #ea580c);
              color: #ffffff;
              padding: 4px 10px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .sticker-brand-title {
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .sticker-brand-badge {
              font-size: 9px;
              font-weight: 800;
              background: rgba(255,255,255,0.25);
              padding: 2px 6px;
              border-radius: 9999px;
              text-transform: uppercase;
              font-family: monospace;
            }
            .sticker-header-row {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .sticker-logo-wrap {
              display: flex;
              align-items: center;
              gap: 8px;
              text-align: left;
            }
            .sticker-logo-img {
              width: 40px;
              height: 40px;
              border-radius: 9999px;
              border: 2px solid #ea580c;
              object-fit: cover;
            }
            .sticker-stall-name {
              font-size: 13px;
              font-weight: 900;
              color: #0f172a;
              line-height: 1.1;
            }
            .sticker-stall-sub {
              font-size: 9px;
              font-weight: 800;
              color: #ea580c;
              display: block;
            }
            .sticker-table-badge {
              background: #fff7ed;
              border: 2px solid #fb923c;
              border-radius: 12px;
              padding: 4px 12px;
              text-align: center;
            }
            .sticker-table-label {
              font-size: 8px;
              font-weight: 900;
              color: #c2410c;
              text-transform: uppercase;
              display: block;
              line-height: 1;
            }
            .sticker-table-number {
              font-size: 18px;
              font-weight: 900;
              color: #0f172a;
              font-family: monospace;
              line-height: 1;
            }
            .sticker-qr-box {
              background: #ffffff;
              border: 2px solid #0f172a;
              border-radius: 14px;
              padding: 10px;
              margin: 6px 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .sticker-qr-box svg {
              display: block;
              width: 140px;
              height: 140px;
            }
            .sticker-cta-box {
              width: 100%;
              background: #0f172a;
              color: #ffffff;
              padding: 6px 8px;
              border-radius: 10px;
              margin-bottom: 6px;
            }
            .sticker-cta-title {
              font-size: 11px;
              font-weight: 900;
              letter-spacing: -0.01em;
            }
            .sticker-cta-sub {
              font-size: 8.5px;
              color: #fdba74;
              font-weight: 600;
            }
            .sticker-notice-box {
              width: 100%;
              background: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 10px;
              padding: 6px 8px;
              text-align: left;
              margin-bottom: 6px;
            }
            .sticker-notice-text {
              font-size: 8.5px;
              color: #451a03;
              line-height: 1.35;
            }
            .sticker-notice-strong {
              color: #78350f;
              font-weight: 900;
            }
            .sticker-steps-grid {
              width: 100%;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 4px;
              padding-top: 4px;
              border-top: 1px solid #f1f5f9;
              font-size: 8px;
              font-weight: 800;
              color: #475569;
            }
            .sticker-step-item {
              background: #f8fafc;
              padding: 3px 2px;
              border-radius: 6px;
              text-align: center;
            }
            .sticker-footer-row {
              width: 100%;
              padding-top: 6px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              color: #94a3b8;
              font-family: monospace;
            }
          `}} />

          {/* MAIN PREVIEW CONTAINER */}
          <div id="warung-table-printable-area" className="sticker-grid">
            {tablesToPrint.map((table) => {
              const tableUrl = `${appBaseUrl}/t/${table.qr_token}`;

              return (
                <div
                  key={table.id}
                  id={`sticker-card-${table.id}`}
                  className="sticker-card"
                >
                  {/* TOP BRAND ACCENT HEADER */}
                  <div className="sticker-brand-bar">
                    <div className="sticker-brand-title">
                      <span>🍲</span>
                      <span>Warung J&amp;J</span>
                    </div>
                    <span className="sticker-brand-badge">
                      QR ORDER
                    </span>
                  </div>

                  {/* STALL LOGO & TABLE NUMBER BANNER */}
                  <div className="sticker-header-row">
                    <div className="sticker-logo-wrap">
                      <img
                        src="/logo.png"
                        alt="Warung J&J"
                        className="sticker-logo-img"
                      />
                      <div>
                        <div className="sticker-stall-name">
                          Warung J&amp;J
                        </div>
                        <span className="sticker-stall-sub">
                          Masakan Panas &amp; Minuman
                        </span>
                      </div>
                    </div>

                    <div className="sticker-table-badge">
                      <span className="sticker-table-label">
                        NOMBOR
                      </span>
                      <span className="sticker-table-number">
                        MEJA {table.table_number}
                      </span>
                    </div>
                  </div>

                  {/* HIGH RESOLUTION QR CODE */}
                  <div className="sticker-qr-box">
                    <QRCodeSVG
                      id={`qr-svg-${table.id}`}
                      value={tableUrl}
                      size={140}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  {/* FRIENDLY CALL TO ACTION */}
                  <div className="sticker-cta-box">
                    <p className="sticker-cta-title">
                      📲 IMBAS UNTUK LIHAT MENU &amp; PESAN
                    </p>
                    <p className="sticker-cta-sub">
                      Scan me to view &amp; order at Warung J&amp;J
                    </p>
                  </div>

                  {/* COURTEOUS SHARED TABLE NOTICE (RESPECT NEIGHBOR STALLS) */}
                  <div className="sticker-notice-box">
                    <p className="sticker-notice-text">
                      🤝 <strong className="sticker-notice-strong">Meja Kongsi:</strong> Anda dialu-alukan menikmati makanan daripada mana-mana gerai pilihan anda. Pesanan menu <strong>Warung J&amp;J</strong> akan terus dihantar ke meja ini oleh kru kami!
                    </p>
                  </div>

                  {/* 3 STEPS INSTRUCTIONS */}
                  <div className="sticker-steps-grid">
                    <div className="sticker-step-item">1. Buka Kamera</div>
                    <div className="sticker-step-item">2. Imbas QR</div>
                    <div className="sticker-step-item">3. Pilih &amp; Pesan</div>
                  </div>

                  {/* FOOTER CUTTING GUIDE NOTE */}
                  <div className="sticker-footer-row">
                    <span className="truncate max-w-[170px]">{tableUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyUrl(table.qr_token)}
                      className="sticker-copy-btn text-orange-600 hover:text-orange-700 font-bold underline cursor-pointer"
                    >
                      Salin Link
                    </button>
                    <span>✂️ Gunting ikut garisan</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="p-3.5 border-t border-slate-100 bg-[#fbfbfa] flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium px-5 print:hidden gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>Format pelekat bersaiz A4 (muat 4 pelekat per halaman A4). Sesuai untuk Sticker Paper atau Laminating.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Tab Cetak Penuh ↗</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? 'Menyiapkan...' : 'Cetak Sekarang (Print)'}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
