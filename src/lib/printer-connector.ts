/**
 * Warung POS - Direct Thermal Printer Connector (ESC/POS)
 * Supports:
 * 1. Web Bluetooth API (Bluetooth Thermal Receipt Printers 58mm / 80mm)
 * 2. Web Serial / USB API (USB Thermal Receipt Printers)
 * 3. System Print Dialog (Standard Fallback)
 */

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
  status: string;
  delivery_fee?: number | null;
  delivery_service?: string | null;
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
 * Check if Web Bluetooth is supported in current browser
 */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Check if Web Serial is supported in current browser
 */
export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Request and Connect to Bluetooth Thermal Printer
 */
export async function connectBluetoothPrinter(): Promise<ConnectedPrinterInfo> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth tidak disokong pada pelayar ini. Sila gunakan Google Chrome di Android / PC.');
  }

  try {
    // Standard Bluetooth Serial Port Profile (SPP) and Common BLE Printer Service UUIDs
    const PRINTER_SERVICES = [
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print service
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posnet / Xprinter
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
      '0000ff00-0000-1000-8000-00805f9b34fb', // Common 58mm POS printer
      '0000ffe0-0000-1000-8000-00805f9b34fb', // HMSoft / Feasycom BLE
      '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
    ];

    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { namePrefix: 'POS' },
        { namePrefix: 'MPT' },
        { namePrefix: 'RPP' },
        { namePrefix: 'MTP' },
        { namePrefix: 'XP' },
        { namePrefix: 'Printer' },
        { namePrefix: 'Thermal' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'SPP' },
      ],
      optionalServices: PRINTER_SERVICES,
    }).catch(async () => {
      // Fallback: Show all devices if filter returns none
      return await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });
    });

    if (!device) throw new Error('Peranti Bluetooth tidak dipilih');

    const server = await device.gatt.connect();
    activeBluetoothDevice = device;
    activeBluetoothServer = server;

    // Discover the writable characteristic
    let foundChar: any = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            foundChar = char;
            break;
          }
        }
        if (foundChar) break;
      } catch (e) {
        // continue search
      }
    }

    if (!foundChar) {
      throw new Error(`Pencetak Bluetooth "${device.name}" berjaya disambung, tetapi tiada writable characteristic ditemui.`);
    }

    activeBluetoothCharacteristic = foundChar;

    const info: ConnectedPrinterInfo = {
      type: 'bluetooth',
      name: device.name || 'Bluetooth POS Printer',
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
 */
export async function sendRawBytesToPrinter(buffer: Uint8Array): Promise<boolean> {
  // 1. Direct Bluetooth
  if (activeBluetoothCharacteristic) {
    try {
      const CHUNK_SIZE = 512;
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.slice(i, i + CHUNK_SIZE);
        if (activeBluetoothCharacteristic.properties.writeWithoutResponse) {
          await activeBluetoothCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await activeBluetoothCharacteristic.writeValue(chunk);
        }
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
    return left.slice(0, width - rightLen - 1) + ' ' + right + '\n';
  }
  const spaces = ' '.repeat(width - leftLen - rightLen);
  return left + spaces + right + '\n';
}

/**
 * Print order directly to Bluetooth or USB Thermal Printer using ESC/POS commands
 * If no direct printer is connected, it cleanly falls back to opening the receipt print window.
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
  const orderIdShort = order.id.split('-')[0]!.toUpperCase();
  const typeLabel = order.type === 'delivery' ? 'DELIVERY' : order.type === 'dine_in' ? 'MAKAN SINI' : 'TAPAU / TAKEAWAY';

  const chunks: Uint8Array[] = [
    ESC_POS_COMMANDS.INIT,
    ESC_POS_COMMANDS.ALIGN_CENTER,
    ESC_POS_COMMANDS.DOUBLE_SIZE,
    textToBytes(`${store.name || 'Warung J&J'}\n`),
    ESC_POS_COMMANDS.NORMAL_TEXT,
    textToBytes('Resit Rasmi Pesanan\n'),
    textToBytes('================================\n'),
    ESC_POS_COMMANDS.ALIGN_LEFT,
    textToBytes(formatTwoColumns(`No. Resit: #${orderIdShort}`, typeLabel)),
    textToBytes(formatTwoColumns(`Tarikh   : ${dateStr}`, timeStr)),
    textToBytes(formatTwoColumns(`Juruwang : ${cashierName}`, order.table_id ? `Meja: ${order.table_id}` : '')),
    textToBytes('--------------------------------\n'),
  ];

  // Print Items
  items.forEach(item => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    chunks.push(
      ESC_POS_COMMANDS.EMPHASIZE_ON,
      textToBytes(`${item.name}\n`),
      ESC_POS_COMMANDS.EMPHASIZE_OFF,
      textToBytes(formatTwoColumns(`  ${item.quantity}x @ RM${item.price.toFixed(2)}`, `RM ${itemTotal}`))
    );

    if (item.notes) {
      chunks.push(textToBytes(`  -> Nota: ${item.notes}\n`));
    }

    if (item.container_charge && item.container_charge > 0) {
      const cTotal = (item.container_charge * item.quantity).toFixed(2);
      chunks.push(textToBytes(formatTwoColumns(`  Tapau (${item.container_size || 'Bekas'})`, `RM ${cTotal}`)));
    }
  });

  chunks.push(textToBytes('--------------------------------\n'));

  // Delivery fee if applicable
  if (order.delivery_fee && Number(order.delivery_fee) > 0) {
    const subtotal = (order.total_amount - Number(order.delivery_fee)).toFixed(2);
    chunks.push(
      textToBytes(formatTwoColumns('Subtotal', `RM ${subtotal}`)),
      textToBytes(formatTwoColumns('Caj Penghantaran', `RM ${Number(order.delivery_fee).toFixed(2)}`)),
      textToBytes('--------------------------------\n')
    );
  }

  // Grand Total
  chunks.push(
    ESC_POS_COMMANDS.EMPHASIZE_ON,
    ESC_POS_COMMANDS.DOUBLE_HEIGHT,
    textToBytes(formatTwoColumns('JUMLAH BESAR:', `RM ${order.total_amount.toFixed(2)}`)),
    ESC_POS_COMMANDS.NORMAL_TEXT,
    ESC_POS_COMMANDS.EMPHASIZE_OFF,
    textToBytes('================================\n'),
    ESC_POS_COMMANDS.ALIGN_CENTER,
    textToBytes('Terima Kasih Atas Kunjungan Anda!\nSila Datang Lagi.\n\n\n\n'),
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
