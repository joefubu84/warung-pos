export interface Store {
  name: string;
  logo_url?: string | null;
  phone_number?: string | null;
  phone_number_2?: string | null;
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  container_size?: string | null;
  container_charge?: number;
  notes?: string | null;
  addons?: { name: string; price: number }[] | null;
  selectedAddons?: { name: string; price: number }[] | null;
}

export interface Order {
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

import { getReceiptCustomConfig, ReceiptCustomConfig } from '@/lib/receipt-config';

export function generateReceiptHTML(
  order: Order,
  store: Store,
  cashierName: string,
  items: OrderItem[],
  customConfig?: ReceiptCustomConfig
): string {
  const rc = customConfig || getReceiptCustomConfig();
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleDateString('en-MY', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const formattedTime = orderDate.toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit'
  });
  const orderIdShort = order.id.slice(0, 8).toUpperCase();
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  let typeDisplay = 'TAKEAWAY / BUNGKUS';
  if (order.type === 'dine_in') {
    const tbl = order.table_number || (order.table_id && order.table_id.length < 10 ? order.table_id : 'Meja');
    typeDisplay = `DINE-IN [ MEJA ${tbl} ]`;
  } else if (order.type === 'delivery') {
    const svc = (order.delivery_service || 'GRAB/PANDA').toUpperCase();
    typeDisplay = `DELIVERY [ ${svc} ]`;
  }

  const itemsHtml = items.map(item => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    let itemHtml = `
      <tr style="border-top: 1px dashed #000;">
        <td class="item-name bold" colspan="2" style="padding-top: 6px;">[${item.quantity}x] ${item.name}</td>
        <td class="item-total bold" style="padding-top: 6px;">RM ${itemTotal}</td>
      </tr>
    `;

    if (item.quantity > 1) {
      itemHtml += `
        <tr>
          <td colspan="3" style="font-size: 10px; color: #444; padding-left: 12px;">@ RM ${item.price.toFixed(2)} setiap satu</td>
        </tr>
      `;
    }

    if (item.notes && item.notes.trim() !== '') {
      itemHtml += `
        <tr>
          <td colspan="3" class="indent" style="font-style: italic; color: #333;">&bull; Nota: ${item.notes.trim()}</td>
        </tr>
      `;
    }

    // Explicit Add-on breakdown (e.g. Sambal, Telur, Extra Cheese)
    const itemAddons = item.addons || item.selectedAddons || [];
    if (Array.isArray(itemAddons) && itemAddons.length > 0) {
      itemAddons.forEach((addon: any) => {
        const addonTotal = (Number(addon.price || 0) * item.quantity).toFixed(2);
        itemHtml += `
          <tr>
            <td colspan="2" class="indent" style="font-weight: 600; color: #222;">+ [Add-on] ${addon.name}</td>
            <td class="item-total" style="font-weight: 600;">RM ${addonTotal}</td>
          </tr>
        `;
      });
    }

    if (item.container_charge && item.container_charge > 0) {
      const containerTotal = (item.container_charge * item.quantity).toFixed(2);
      const sizeName = item.container_size ? item.container_size.toUpperCase() : 'BEKAS';
      itemHtml += `
        <tr>
          <td colspan="2" class="indent">+ Caj Bungkus (${sizeName})</td>
          <td class="item-total">RM ${containerTotal}</td>
        </tr>
      `;
    }
    return itemHtml;
  }).join('');

  const paymentMethod = order.payment_method ? order.payment_method.toUpperCase() : 'TUNAI';
  const payStatus = order.paid ? `SUDAH BAYAR (${paymentMethod})` : 'BELUM DIBAYAR';

  const storeDisplayName = rc.store_name || store.name || 'WARUNG J&J';
  const storeSubHeader = rc.store_sub_header || 'Penampang, Sabah';
  const storePhone = rc.phone_number || store.phone_number || '';
  const orderPrefix = rc.order_id_prefix || 'ORDER #';
  const cashierLabel = rc.cashier_label || 'Juruwang:';
  const footer1 = rc.footer_line_1 || 'Terima Kasih Atas Pesanan Anda!';
  const footer2 = rc.footer_line_2 || 'Sila Datang Lagi.';
  const customFooter = rc.custom_footer_note ? rc.custom_footer_note.trim() : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - #${orderIdShort}</title>
  <style>
    @page {
      margin: 0;
      size: 58mm auto;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.25;
      color: #000;
      margin: 0;
      padding: 10px 8px;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    
    .logo {
      max-width: 80px;
      height: auto;
      margin: 0 auto 6px;
      display: block;
      filter: grayscale(100%) contrast(150%);
    }
    
    .store-name {
      font-size: 16px;
      font-weight: 900;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }
    
    .order-banner {
      margin: 8px 0;
      padding: 6px 4px;
      border: 1.5px solid #000;
      text-align: center;
    }
    .order-id {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .order-type {
      font-size: 12px;
      font-weight: 800;
      margin-top: 2px;
    }
    
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }

    .divider-double {
      border-top: 2px solid #000;
      margin: 8px 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 8px;
      margin-bottom: 6px;
      font-size: 11px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 5px 0;
      table-layout: fixed;
    }
    
    .item-name {
      padding-top: 4px;
      word-wrap: break-word;
    }
    
    .item-total { width: 35%; text-align: right; }
    .indent { padding-left: 12px; font-size: 11px; }
    
    .totals-table { margin-top: 6px; }
    .totals-table td { padding: 2px 0; font-size: 11px; }
    
    .grand-total {
      font-size: 15px;
      font-weight: 900;
      padding: 6px 0;
    }
    
    .footer {
      margin-top: 15px;
      font-size: 11px;
      margin-bottom: 30px;
    }
  </style>
</head>
<body>
  <div class="text-center">
    ${rc.show_logo && store.logo_url ? `<img src="${store.logo_url}" class="logo" alt="Logo" />` : ''}
    <div class="store-name">${storeDisplayName}</div>
    ${storeSubHeader ? `<div style="font-size: 10px;">${storeSubHeader}</div>` : ''}
    ${storePhone ? `<div style="font-size: 10px;">Tel: ${storePhone}</div>` : ''}
  </div>

  <div class="order-banner">
    <div class="order-id">${orderPrefix}${orderIdShort}</div>
    <div class="order-type">${typeDisplay}</div>
  </div>

  <div class="info-grid">
    <div>Masa:</div><div>${formattedTime} &nbsp;&nbsp; ${formattedDate}</div>
    ${order.customer_name ? `<div>Pelanggan:</div><div>${order.customer_name}</div>` : ''}
    <div>${cashierLabel}</div><div>${cashierName} (${totalItemCount} Item)</div>
  </div>

  <div class="divider-double"></div>

  <table>
    ${itemsHtml}
  </table>

  <div class="divider-double"></div>
  <table class="totals-table">
    <tr>
      <td>Jumlah Kuantiti</td>
      <td class="text-right">${totalItemCount} item</td>
    </tr>
    ${order.delivery_fee && Number(order.delivery_fee) > 0 ? `
    <tr>
      <td>Subtotal</td>
      <td class="text-right">RM ${(order.total_amount - Number(order.delivery_fee)).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Caj Penghantaran</td>
      <td class="text-right">RM ${Number(order.delivery_fee).toFixed(2)}</td>
    </tr>
    ` : ''}
    <tr>
      <td colspan="2"><div class="divider"></div></td>
    </tr>
    <tr class="grand-total">
      <td>Total</td>
      <td class="text-right">RM ${order.total_amount.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Status Bayaran</td>
      <td class="text-right bold">${payStatus}</td>
    </tr>
  </table>
  <div class="divider"></div>

  <div class="text-center footer">
    <p class="bold">${footer1}</p>
    ${footer2 ? `<p>${footer2}</p>` : ''}
    ${customFooter ? `<p style="margin-top: 6px; font-size: 10px; font-weight: bold;">${customFooter}</p>` : ''}
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>
  `;
}

import html2canvas from 'html2canvas';

/**
 * Converts an HTML receipt string into a high-quality PNG Blob.
 * 
 * @param htmlString The raw HTML string representing the receipt
 * @returns A Promise that resolves to a Blob containing the PNG image
 */
export async function convertReceiptToPNG(htmlString: string): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Create a hidden iframe sandbox to correctly parse the full HTML document
      // and completely avoid global oklch CSS stylesheets
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '300px'; 
      // Set a generous height so the receipt isn't cut off
      iframe.style.height = '1500px'; 
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");

      // 2. Inject the HTML into the pristine iframe
      iframeDoc.open();
      iframeDoc.write(htmlString);
      iframeDoc.close();

      // Wait for fonts/images inside the iframe HTML to render
      await new Promise(res => setTimeout(res, 500));

      const container = iframeDoc.body;
      container.style.backgroundColor = '#FFFFFF';
      container.style.width = '280px'; // Give a little more width
      container.style.padding = '15px'; // Add padding to avoid cramping
      container.style.margin = '0';
      container.style.boxSizing = 'border-box';

      // Adjust the iframe height to exactly match the content height
      // This prevents the massive white space at the bottom of the PNG
      iframe.style.height = container.scrollHeight + 'px';

      // 3. Use html2canvas inside the isolated iframe
      const canvas = await html2canvas(container, {
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#FFFFFF',
        height: container.scrollHeight,
        windowHeight: container.scrollHeight,
        logging: false
      });

      // 4. Clean up the DOM
      document.body.removeChild(iframe);

      // 5. Convert canvas to Blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to Blob"));
        }
      }, 'image/png', 1.0);
      
    } catch (error) {
      console.error("Error converting receipt to PNG:", error);
      reject(error);
    }
  });
}

import { jsPDF } from 'jspdf';

/**
 * Converts an HTML receipt string into a crisp, non-truncated single continuous PDF Blob
 * sized precisely for thermal receipts (58mm width, dynamic height matching content).
 * 
 * @param htmlString The raw HTML string representing the receipt
 * @returns A Promise that resolves to a Blob containing the PDF
 */
export async function convertReceiptToPDF(htmlString: string): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '300px';
      iframe.style.height = '1800px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");

      iframeDoc.open();
      iframeDoc.write(htmlString);
      iframeDoc.close();

      // Wait for rendering
      await new Promise(res => setTimeout(res, 500));

      const container = iframeDoc.body;
      container.style.backgroundColor = '#FFFFFF';
      container.style.width = '280px';
      container.style.padding = '15px';
      container.style.margin = '0';
      container.style.boxSizing = 'border-box';

      const contentHeight = container.scrollHeight;
      iframe.style.height = contentHeight + 'px';

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        height: contentHeight,
        windowHeight: contentHeight,
        logging: false
      });

      document.body.removeChild(iframe);

      // Create continuous PDF: width 58mm, height proportional to content + 10mm margin
      // 1px canvas ~= 0.264583 mm
      const imgWidthMm = 58;
      const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
      const pdfHeightMm = Math.max(80, imgHeightMm + 8); // Extra safety padding so never cut off

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidthMm, pdfHeightMm]
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      // Center and fit precisely
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidthMm, imgHeightMm);

      const pdfBlob = pdf.output('blob');
      resolve(pdfBlob);
    } catch (error) {
      console.error("Error converting receipt to PDF:", error);
      reject(error);
    }
  });
}

/**
 * Generates the receipt as a clean, continuous PDF file and shares it via WhatsApp.
 * On mobile, it triggers Web Share API with the PDF file directly.
 * On desktop, it downloads the PDF and opens WhatsApp with the order summary.
 */
export async function shareReceiptWhatsAppPDF(
  order: Order,
  store: Store,
  cashierName: string,
  items: OrderItem[]
): Promise<void> {
  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let whatsappWindow: Window | null = null;

    if (!isMobile) {
      whatsappWindow = window.open('about:blank', '_blank');
      if (whatsappWindow) {
        whatsappWindow.document.write("Menjana fail PDF resit, sila tunggu...");
      }
    }

    // 1. Get HTML
    const htmlString = generateReceiptHTML(order, store, cashierName, items);

    // 2. Generate PDF Blob
    const pdfBlob = await convertReceiptToPDF(htmlString);

    // 3. Format Date/Time
    const orderDate = new Date(order.created_at);
    const dateStr = orderDate.toLocaleDateString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = orderDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    const orderShort = order.id.slice(0, 8).toUpperCase();

    // 4. Create Message
    const typeLabel = order.type === 'delivery' ? 'Delivery' : order.type === 'dine_in' ? 'Dine-In' : 'Takeaway';
    const deliveryFeeStr = order.type === 'delivery' && order.delivery_fee ? `Subtotal: RM ${(order.total_amount - Number(order.delivery_fee)).toFixed(2)}\nDelivery: RM ${Number(order.delivery_fee).toFixed(2)}\n────────────────────\n` : '';
    const message = `*Resit Pesanan Rasmi (PDF)*\nKedai: ${store.name}\nNo. Pesanan: #${orderShort}\nTarikh: ${dateStr} ${timeStr}\nJuruwang: ${cashierName}\nJenis: ${typeLabel}\n\n${deliveryFeeStr}*Total: RM ${order.total_amount.toFixed(2)}*\n\nTerima kasih atas kunjungan anda!`;

    const fileName = `Resit_Warung_JJ_${orderShort}.pdf`;

    // 5. Try Native Web Share API first (Native on Mobile/Tablet)
    if (isMobile && navigator.share) {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Resit Pesanan #${orderShort}`,
            text: message
          });
          return;
        } catch (shareError) {
          console.log("Native PDF share cancelled or failed, falling back to download & URL", shareError);
        }
      }
    }

    // 6. Trigger PDF download
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);

    // 7. Open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const phone = store.phone_number ? store.phone_number.replace(/\D/g, '') : '';
    let whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    if (!phone) {
      whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    }

    if (isMobile) {
      window.location.href = whatsappUrl;
    } else if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    }
  } catch (error: any) {
    console.error("Failed to share PDF receipt via WhatsApp:", error);
    if (error?.name !== 'AbortError') {
      alert("Gagal menjana PDF resit: " + (error?.message || String(error)));
    }
  }
}

/**
 * Generates the receipt, attempts to convert it to an image (for user to manually attach),
 * and automatically triggers WhatsApp to open with a pre-filled summary message.
 * Also defaults to PDF when requested.
 * 
 * @param order The order data object
 * @param store The store config object
 * @param cashierName Name of the cashier
 * @param items Array of order items
 */
export async function shareReceiptWhatsApp(
  order: Order, 
  store: Store, 
  cashierName: string, 
  items: OrderItem[]
): Promise<void> {
  // Directly use the superior PDF sharing so receipt is never truncated
  return shareReceiptWhatsAppPDF(order, store, cashierName, items);
}
