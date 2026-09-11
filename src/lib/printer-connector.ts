/**
 * Warung POS - Direct Thermal Printer Connector (ESC/POS)
 * Supports:
 * 1. Web Bluetooth API (Bluetooth Thermal Receipt Printers 58mm / 80mm)
 * 2. Web Serial / USB API (USB Thermal Receipt Printers)
 * 3. System Print Dialog (Standard Fallback)
 */

import { getReceiptCustomConfig } from '@/lib/receipt-config';

export interface ConnectedPrinterInfo {
  type: 'bluetooth' | 'usb' | 'system';
  name: string;
  connectedAt: string;
}

export interface ReceiptItemData {
  name: string;
  price: number;
  quantity: number;
  container_size?: string | null;
  container_charge?: number;
  notes?: string | null;
}

export interface ReceiptOrderData {
  id: string;
  created_at: string;
  total_amount: number;
  type: string;
  customer_name?: string | null;
  table_id?: string | null;
  table_number?: string | null;
  status: string;
  delivery_fee?: number | null;
  delivery_service?: string | null;
  paid?: boolean;
  payment_method?: string | null;
}

// ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;

export const ESC_POS_COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]), // Reset / Initialize
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  EMPHASIZE_ON: new Uint8Array([ESC, 0x45, 0x01]),
  EMPHASIZE_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([ESC, 0x21, 0x10]),
  DOUBLE_WIDTH: new Uint8Array([ESC, 0x21, 0x20]),
  DOUBLE_SIZE: new Uint8Array([ESC, 0x21, 0x30]),
  NORMAL_TEXT: new Uint8Array([ESC, 0x21, 0x00]),
  FEED_3_LINES: new Uint8Array([ESC, 0x64, 0x03]),
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x41, 0x00]), // Partial cut
};

// In-memory active connections
let activeBluetoothDevice: any = null;
let activeBluetoothServer: any = null;
let activeBluetoothCharacteristic: any = null;

let activeSerialPort: any = null;

/**
 * Check if Web Bluetooth is available
 */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Check if Web Serial is available
 */
export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in (navigator as any);
}

/**
 * Common Bluetooth Service UUIDs used by Thermal Receipt Printers
 */
const PRINTER_BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common Chinese 58mm/80mm BLE Printers
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent (MTP-II, etc.)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Custom ESC/POS 1
  '0000fee7-0000-1000-8000-00805f9b34fb', // Custom ESC/POS 2
];

/**
 * Connect to Bluetooth Thermal Printer
 */
export async function connectBluetoothPrinter(): Promise<ConnectedPrinterInfo> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth tidak disokong pada pelayar ini. Sila gunakan Google Chrome atau pelayar Chromium di Android/PC.');
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_BLE_SERVICES,
    });

    if (!device) {
      throw new Error('Tiada peranti dipilih');
    }

    const server = await device.gatt.connect();

    // Discover writable characteristic
    let printerChar: any = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            printerChar = char;
            break;
          }
        }
        if (printerChar) break;
      } catch (err) {
        // continue search in next service
      }
    }

    if (!printerChar) {
      throw new Error('Gagal menemui saluran tulisan ESC/POS pada peranti ini.');
    }

    activeBluetoothDevice = device;
    activeBluetoothServer = server;
    activeBluetoothCharacteristic = printerChar;

    const info: ConnectedPrinterInfo = {
      type: 'bluetooth',
      name: device.name || 'Pencetak Bluetooth POS',
      connectedAt: new Date().toISOString(),
    };

    localStorage.setItem('warung_connected_printer', JSON.stringify(info));
    return info;
  } catch (err: any) {
    console.error('Bluetooth connection error:', err);
    throw new Error(err?.message || 'Gagal menyambung ke pencetak Bluetooth');
  }
}

/**
 * Connect to USB / Serial Thermal Printer
 */
export async function connectSerialPrinter(): Promise<ConnectedPrinterInfo> {
  if (!isSerialSupported()) {
    throw new Error('Web Serial / USB tidak disokong pada pelayar ini. Sila gunakan Google Chrome atau Microsoft Edge.');
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    activeSerialPort = port;

    const info: ConnectedPrinterInfo = {
      type: 'usb',
      name: 'USB Thermal Printer (9600 baud)',
      connectedAt: new Date().toISOString(),
    };

    localStorage.setItem('warung_connected_printer', JSON.stringify(info));
    return info;
  } catch (err: any) {
    console.error('USB Serial connection error:', err);
    throw new Error(err?.message || 'Gagal menyambung ke pencetak USB');
  }
}

/**
 * Get Saved Printer Connection Info
 */
export function getSavedPrinterInfo(): ConnectedPrinterInfo | null {
  try {
    const raw = localStorage.getItem('warung_connected_printer');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Disconnect Active Printer
 */
export async function disconnectPrinter(): Promise<void> {
  try {
    if (activeBluetoothServer && activeBluetoothServer.connected) {
      activeBluetoothServer.disconnect();
    }
    if (activeSerialPort) {
      await activeSerialPort.close();
    }
  } catch (e) {
    console.warn('Disconnect warning:', e);
  } finally {
    activeBluetoothDevice = null;
    activeBluetoothServer = null;
    activeBluetoothCharacteristic = null;
    activeSerialPort = null;
    localStorage.removeItem('warung_connected_printer');
  }
}

/**
 * Check if a physical direct printer is currently connected
 */
export function isPrinterConnected(): boolean {
  if (activeBluetoothServer?.connected && activeBluetoothCharacteristic) return true;
  if (activeSerialPort) return true;
  return false;
}

/**
 * Send raw byte buffer to connected thermal printer
 * Uses safe 64-byte chunks with delays to avoid BLE RX FIFO buffer overflow
 */
export async function sendRawBytesToPrinter(buffer: Uint8Array): Promise<boolean> {
  // 1. Direct Bluetooth
  if (activeBluetoothCharacteristic) {
    try {
      const CHUNK_SIZE = 64; // Safe size for 58mm Bluetooth thermal printers
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.slice(i, i + CHUNK_SIZE);
        if (activeBluetoothCharacteristic.properties.writeWithoutResponse) {
          await activeBluetoothCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await activeBluetoothCharacteristic.writeValue(chunk);
        }
        // Small delay between chunks to let printer buffer process
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return true;
    } catch (btErr) {
      console.error('Bluetooth write error:', btErr);
      throw btErr;
    }
  }

  // 2. Direct USB Serial
  if (activeSerialPort && activeSerialPort.writable) {
    try {
      const writer = activeSerialPort.writable.getWriter();
      await writer.write(buffer);
      writer.releaseLock();
      return true;
    } catch (serialErr) {
      console.error('Serial write error:', serialErr);
      throw serialErr;
    }
  }

  return false;
}

/**
 * Helper to encode text to UTF-8 / ASCII bytes
 */
function textToBytes(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * Format line with text on left and text on right for 32-column receipt (standard 58mm)
 */
function formatTwoColumns(left: string, right: string, width: number = 32): string {
  const leftLen = left.length;
  const rightLen = right.length;
  if (leftLen + rightLen >= width) {
    return left.slice(0, Math.max(0, width - rightLen - 1)) + ' ' + right + '\n';
  }
  const spaces = ' '.repeat(width - leftLen - rightLen);
  return left + spaces + right + '\n';
}

/**
 * Print order directly to Bluetooth or USB Thermal Printer using ESC/POS commands
 * Modeled after GrabFood's clean, high-detail structured thermal receipt format
 */
export async function printOrderDirectThermal(
  order: ReceiptOrderData,
  store: { name: string; phone_number?: string | null; phone_number_2?: string | null },
  cashierName: string = 'Staff',
  items: ReceiptItemData[]
): Promise<{ success: boolean; mode: 'bluetooth' | 'usb' | 'system' }> {
  // Check if a direct hardware printer is connected
  if (!isPrinterConnected()) {
    // Fallback to standard print dialog
    const { generateReceiptHTML } = await import('@/lib/receipt');
    const storeInfo = {
      name: store.name || 'Warung J&J',
      logo_url: typeof window !== 'undefined' ? window.location.origin + '/logo.png' : '',
      phone_number: store.phone_number || '',
      phone_number_2: store.phone_number_2 || '',
    };
    const html = generateReceiptHTML(order as any, storeInfo, cashierName, items);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    return { success: true, mode: 'system' };
  }

  const orderDate = new Date(order.created_at);
  const dateStr = orderDate.toLocaleDateString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = orderDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
  const orderIdShort = order.id.slice(0, 8).toUpperCase();
  
  // Format destination / dining type cleanly like Grab
  let typeHeader = 'TAKEAWAY / BUNGKUS';
  if (order.type === 'dine_in') {
    const tableDisplay = order.table_number || (order.table_id && order.table_id.length < 10 ? order.table_id : 'Meja');
    typeHeader = `DINE-IN [ MEJA ${tableDisplay} ]`;
  } else if (order.type === 'delivery') {
    const svc = (order.delivery_service || 'GRAB/PANDA').toUpperCase();
    typeHeader = `DELIVERY [ ${svc} ]`;
  }

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const rc = getReceiptCustomConfig();
  const storeDisplayName = rc.store_name || store.name || 'WARUNG J&J';
  const storeSubHeader = rc.store_sub_header || 'Penampang, Sabah';
  const storePhone = rc.phone_number || store.phone_number || '';
  const orderPrefix = rc.order_id_prefix || 'ORDER #';
  const cashierLabel = rc.cashier_label || 'Juruwang:';
  const footer1 = rc.footer_line_1 || 'Terima Kasih Atas Pesanan Anda!';
  const footer2 = rc.footer_line_2 || 'Sila Datang Lagi.';
  const customFooter = rc.custom_footer_note ? rc.custom_footer_note.trim() : '';

  const chunks: Uint8Array[] = [
    ESC_POS_COMMANDS.INIT,
    
    // Store Header
    ESC_POS_COMMANDS.ALIGN_CENTER,
    ESC_POS_COMMANDS.EMPHASIZE_ON,
    ESC_POS_COMMANDS.DOUBLE_SIZE,
    textToBytes(`${storeDisplayName}\n`),
    ESC_POS_COMMANDS.NORMAL_TEXT,
    ESC_POS_COMMANDS.EMPHASIZE_OFF,
    storeSubHeader ? textToBytes(`${storeSubHeader}\n`) : new Uint8Array([]),
    storePhone ? textToBytes(`Tel: ${storePhone}\n`) : new Uint8Array([]),
    textToBytes('================================\n'),
    
    // Grab Style Big Order Number & Type
    ESC_POS_COMMANDS.ALIGN_CENTER,
    ESC_POS_COMMANDS.EMPHASIZE_ON,
    ESC_POS_COMMANDS.DOUBLE_HEIGHT,
    textToBytes(`${orderPrefix}${orderIdShort}\n`),
    ESC_POS_COMMANDS.NORMAL_TEXT,
    textToBytes(`${typeHeader}\n`),
    ESC_POS_COMMANDS.EMPHASIZE_OFF,
    textToBytes('--------------------------------\n'),

    // Customer & Metadata Info
    ESC_POS_COMMANDS.ALIGN_LEFT,
    order.customer_name ? textToBytes(`Pelanggan: ${order.customer_name}\n`) : new Uint8Array([]),
    textToBytes(formatTwoColumns(`Masa: ${timeStr}`, dateStr)),
    textToBytes(formatTwoColumns(`${cashierLabel} ${cashierName}`, `${totalItemCount} Item`)),
    textToBytes('================================\n'),
  ];

  // Items List (Clean Grab-style with [1x] prefix and indented modifiers)
  items.forEach((item) => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    
    // Item Title & Price
    chunks.push(
      ESC_POS_COMMANDS.EMPHASIZE_ON,
      textToBytes(formatTwoColumns(`[${item.quantity}x] ${item.name}`, `RM ${itemTotal}`)),
      ESC_POS_COMMANDS.EMPHASIZE_OFF
    );

    // Unit Price if quantity > 1
    if (item.quantity > 1) {
      chunks.push(textToBytes(`     @ RM ${item.price.toFixed(2)} setiap satu\n`));
    }

    // Indented Notes / Customization
    if (rc.show_notes && item.notes && item.notes.trim() !== '') {
      chunks.push(textToBytes(`   * Nota: ${item.notes.trim()}\n`));
    }

    // Container charge (Tapau packaging)
    if (item.container_charge && item.container_charge > 0) {
      const cTotal = (item.container_charge * item.quantity).toFixed(2);
      const sizeLabel = item.container_size ? item.container_size.toUpperCase() : 'BEKAS';
      chunks.push(textToBytes(formatTwoColumns(`   + Caj Bungkus (${sizeLabel})`, `RM ${cTotal}`)));
    }

    // Light spacer between items
    chunks.push(textToBytes(' - - - - - - - - - - - - - - - -\n'));
  });

  // Summary / Totals Breakdown
  chunks.push(
    ESC_POS_COMMANDS.ALIGN_LEFT,
    textToBytes(formatTwoColumns('Jumlah Kuantiti', `${totalItemCount} item`))
  );

  if (order.delivery_fee && Number(order.delivery_fee) > 0) {
    const subtotal = (order.total_amount - Number(order.delivery_fee)).toFixed(2);
    chunks.push(
      textToBytes(formatTwoColumns('Subtotal', `RM ${subtotal}`)),
      textToBytes(formatTwoColumns('Caj Penghantaran', `RM ${Number(order.delivery_fee).toFixed(2)}`))
    );
  }

  chunks.push(textToBytes('--------------------------------\n'));

  // Big Prominent Grand Total
  chunks.push(
    ESC_POS_COMMANDS.EMPHASIZE_ON,
    ESC_POS_COMMANDS.DOUBLE_HEIGHT,
    textToBytes(formatTwoColumns('JUMLAH BESAR:', `RM ${order.total_amount.toFixed(2)}`)),
    ESC_POS_COMMANDS.NORMAL_TEXT,
    ESC_POS_COMMANDS.EMPHASIZE_OFF
  );

  // Payment Status & Method
  const paymentMethodStr = order.payment_method ? order.payment_method.toUpperCase() : 'TUNAI';
  const payStatusStr = order.paid ? `SUDAH BAYAR (${paymentMethodStr})` : 'BELUM DIBAYAR';
  
  chunks.push(
    textToBytes('--------------------------------\n'),
    textToBytes(formatTwoColumns('Status Bayaran:', payStatusStr)),
    textToBytes('================================\n'),
    ESC_POS_COMMANDS.ALIGN_CENTER,
    textToBytes(`${footer1}\n`),
    footer2 ? textToBytes(`${footer2}\n`) : new Uint8Array([]),
    customFooter ? textToBytes(`${customFooter}\n`) : new Uint8Array([]),
    textToBytes('\n\n\n\n'),
    ESC_POS_COMMANDS.CUT_PAPER
  );

  // Merge chunks into single Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const fullPayload = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    fullPayload.set(c, offset);
    offset += c.length;
  }

  await sendRawBytesToPrinter(fullPayload);
  const info = getSavedPrinterInfo();
  return { success: true, mode: (info?.type as any) || 'bluetooth' };
}

/**
 * Print a test receipt page to test connectivity
 */
export async function printTestReceipt(storeName: string = 'Warung J&J'): Promise<void> {
  // If no hardware printer connected, trigger standard print dialog
  if (!isPrinterConnected()) {
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ujian Cetakan</title>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body { font-family: monospace; font-size: 12px; width: 58mm; padding: 10px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 14px;">${storeName}</div>
        <div class="center">UJIAN SAMBUNGAN PENCETAK</div>
        <div class="divider"></div>
        <div>Masa: ${new Date().toLocaleTimeString()}</div>
        <div>Tarikh: ${new Date().toLocaleDateString()}</div>
        <div>Status: PENCETAK BERFUNGSI DENGAN BAIK ✓</div>
        <div class="divider"></div>
        <div class="center">Sistem POS Warung J&J</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(testHtml);
      w.document.close();
    }
    return;
  }

  // Construct ESC/POS Raw Command Sequence
  const chunks: Uint8Array[] = [
    ESC_POS_COMMANDS.INIT,
    ESC_POS_COMMANDS.ALIGN_CENTER,
    ESC_POS_COMMANDS.DOUBLE_SIZE,
    textToBytes(`${storeName}\n`),
    ESC_POS_COMMANDS.NORMAL_TEXT,
    textToBytes('UJIAN SAMBUNGAN PENCETAK\n'),
    textToBytes('--------------------------------\n'),
    ESC_POS_COMMANDS.ALIGN_LEFT,
    textToBytes(`Tarikh : ${new Date().toLocaleDateString('en-MY')}\n`),
    textToBytes(`Masa   : ${new Date().toLocaleTimeString('en-MY')}\n`),
    textToBytes('Status : SAMBUNGAN BERJAYA! ✓\n'),
    textToBytes('--------------------------------\n'),
    ESC_POS_COMMANDS.ALIGN_CENTER,
    textToBytes('Sistem POS Warung J&J Siap Sedia\n\n\n\n'),
    ESC_POS_COMMANDS.CUT_PAPER,
  ];

  // Merge chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const fullPayload = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    fullPayload.set(c, offset);
    offset += c.length;
  }

  await sendRawBytesToPrinter(fullPayload);
}
