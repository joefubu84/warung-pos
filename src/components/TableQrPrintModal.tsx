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
import { Printer, X, Check, Copy, Sparkles, Layers, QrCode } from 'lucide-react';
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

export function TableQrPrintModal({
  isOpen,
  onClose,
  tables,
  selectedTable,
  appBaseUrl
}: TableQrPrintModalProps) {
  const [printMode, setPrintMode] = useState<'single' | 'all'>('single');
  const [activeTable, setActiveTable] = useState<TableItem | null>(selectedTable || (tables[0] || null));

  React.useEffect(() => {
    if (selectedTable) {
      setActiveTable(selectedTable);
      setPrintMode('single');
    } else if (tables.length > 0) {
      setActiveTable(tables[0]);
    }
  }, [selectedTable, tables]);

  const handlePrint = () => {
    window.print();
  };

  const copyUrl = (token: string) => {
    const url = `${appBaseUrl}/t/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Pautan menu meja disalin!');
  };

  const tablesToPrint = printMode === 'single' ? (activeTable ? [activeTable] : []) : tables;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200/90 rounded-3xl shadow-2xl">
        {/* MODAL HEADER (HIDDEN ON PRINT) */}
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
                Reka bentuk khas untuk meja kongsi medan selera — mesra peniaga lain & jelas untuk pelanggan Warung J&J
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print)</span>
            </button>
            <DialogClose className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </div>

        {/* CONTROLS & TAB TOGGLES (HIDDEN ON PRINT) */}
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

          {printMode === 'single' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Pilih Meja:</span>
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
        </div>

        {/* PRINTABLE PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 print:bg-white print:p-0">
          
          {/* PRINT-ONLY CSS HELPER */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #warung-table-printable-area, #warung-table-printable-area * {
                visibility: visible;
              }
              #warung-table-printable-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
            }
          `}} />

          <div id="warung-table-printable-area" className="flex flex-wrap items-center justify-center gap-6 print:gap-4 print:grid print:grid-cols-2">
            {tablesToPrint.map((table) => {
              const tableUrl = `${appBaseUrl}/t/${table.qr_token}`;

              return (
                <div
                  key={table.id}
                  className="w-[88mm] min-h-[125mm] max-w-[340px] bg-white border-2 border-orange-500 rounded-3xl p-4 flex flex-col justify-between items-center text-center shadow-md print:shadow-none print:border-2 print:border-dashed print:border-slate-400 relative overflow-hidden page-break-inside-avoid"
                  style={{ breakInside: 'avoid' }}
                >
                  {/* TOP BRAND ACCENT HEADER */}
                  <div className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-white py-1 px-3 rounded-2xl flex items-center justify-between shadow-2xs mb-2">
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="text-xs">🍲</span>
                      <span className="text-[10px] font-black uppercase tracking-wider">Warung J&J</span>
                    </div>
                    <span className="text-[9px] font-bold bg-white/20 px-2 py-0.2 rounded-full uppercase tracking-widest font-mono">
                      QR Order
                    </span>
                  </div>

                  {/* STALL LOGO & TABLE NUMBER BANNER */}
                  <div className="w-full flex items-center justify-between px-1 mb-1">
                    <div className="flex items-center gap-2 text-left">
                      <img
                        src="/logo.png"
                        alt="Warung J&J Logo"
                        className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 shadow-2xs shrink-0"
                      />
                      <div>
                        <h2 className="text-sm font-black text-slate-900 leading-tight">
                          Warung J&J
                        </h2>
                        <span className="text-[9px] font-extrabold text-orange-600 block">
                          Masakan Panas & Minuman
                        </span>
                      </div>
                    </div>

                    <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl px-3 py-1 shadow-2xs text-center">
                      <span className="text-[8px] font-black text-orange-700 block uppercase tracking-wider leading-none">
                        NOMBOR
                      </span>
                      <span className="text-lg font-black text-slate-900 font-mono leading-none">
                        MEJA {table.table_number}
                      </span>
                    </div>
                  </div>

                  {/* HIGH RESOLUTION QR CODE */}
                  <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-xs my-1 relative">
                    <QRCodeSVG
                      value={tableUrl}
                      size={155}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  {/* FRIENDLY CALL TO ACTION */}
                  <div className="w-full space-y-1 my-1">
                    <div className="bg-slate-900 text-white py-1 px-2 rounded-xl">
                      <p className="text-[11px] font-black tracking-tight leading-tight">
                        📲 IMBAS UNTUK LIHAT MENU & PESAN
                      </p>
                      <p className="text-[9px] text-orange-300 font-semibold leading-none mt-0.5">
                        Scan me to view & order at Warung J&J
                      </p>
                    </div>

                    {/* COURTEOUS SHARED TABLE NOTICE (RESPECT NEIGHBOR STALLS) */}
                    <div className="p-2 bg-amber-50/90 border border-amber-200 rounded-xl text-left">
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs leading-none shrink-0 mt-0.5">🤝</span>
                        <p className="text-[8.5px] text-amber-950 font-medium leading-snug">
                          <strong className="text-amber-900 font-black">Meja Kongsi:</strong> Anda dialu-alukan menikmati makanan daripada mana-mana gerai pilihan anda. Pesanan menu <strong>Warung J&J</strong> akan terus dihantar ke meja ini oleh kru kami!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3 STEPS INSTRUCTIONS */}
                  <div className="w-full grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 text-[8px] text-slate-600 font-bold">
                    <div className="bg-slate-50 py-1 px-1 rounded-lg">1. Buka Kamera</div>
                    <div className="bg-slate-50 py-1 px-1 rounded-lg">2. Imbas QR</div>
                    <div className="bg-slate-50 py-1 px-1 rounded-lg">3. Pilih & Pesan</div>
                  </div>

                  {/* FOOTER CUTTING GUIDE NOTE */}
                  <div className="w-full pt-1.5 flex justify-between items-center text-[8px] text-slate-400 font-mono">
                    <span className="truncate max-w-[170px]">{tableUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyUrl(table.qr_token)}
                      className="text-orange-600 hover:text-orange-700 font-bold underline print:hidden cursor-pointer"
                    >
                      Salin Link
                    </button>
                    <span className="hidden print:inline text-slate-400">Gunting ikut garisan</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL FOOTER ACTIONS (HIDDEN ON PRINT) */}
        <div className="p-3.5 border-t border-slate-100 bg-[#fbfbfa] flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium px-5 print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>Format siap cetak: Sesuai untuk kertas pelekat (*Sticker Paper* A4) atau kertas tebal berlaminasi (*Laminated Card*).</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang (Print)</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
