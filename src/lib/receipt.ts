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
      <tr style="border-top: 1px dashed #e2e8f0;">
        <td class="item-name bold" colspan="2" style="padding-top: 6px;">[${item.quantity}x] ${item.name}</td>
        <td class="item-total bold" style="padding-top: 6px;">RM ${itemTotal}</td>
      </tr>
    `;

    if (item.quantity > 1) {
      itemHtml += `
        <tr>
          <td colspan="3" style="font-size: 10px; color: #555; padding-left: 12px;">@ RM ${item.price.toFixed(2)} setiap satu</td>
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
      <td>JUMLAH BESAR</td>
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

/**
 * Generates the receipt, attempts to convert it to an image (for user to manually attach),
 * and automatically triggers WhatsApp to open with a pre-filled summary message.
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
  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let whatsappWindow: Window | null = null;
    
    // On desktop, open a window immediately to bypass popup blockers
    if (!isMobile) {
      whatsappWindow = window.open('about:blank', '_blank');
      if (!whatsappWindow) {
        alert("Please allow popups for this site to share via WhatsApp.");
        return;
      }
      whatsappWindow.document.write("Generating receipt image, please wait...");
    }

    // 1. Get the HTML string
    const htmlString = generateReceiptHTML(order, store, cashierName, items);

    // 2. Generate the PNG Blob
    const imageBlob = await convertReceiptToPNG(htmlString);
    
    // 3. Format Date/Time
    const orderDate = new Date(order.created_at);
    const dateStr = orderDate.toLocaleDateString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = orderDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

    // 4. Create Pre-filled Message Summary
    const typeLabel = order.type === 'delivery' ? 'Delivery' : order.type === 'dine_in' ? 'Dine-In' : 'Takeaway';
    const deliveryFeeStr = order.type === 'delivery' && order.delivery_fee ? `Subtotal: RM ${(order.total_amount - Number(order.delivery_fee)).toFixed(2)}\nDelivery: RM ${Number(order.delivery_fee).toFixed(2)}\n────────────────────\n` : '';
    const message = `*Order Summary*\nStore: ${store.name}\nOrder ID: #${order.id.split('-')[0]!.toUpperCase()}\nDate: ${dateStr} ${timeStr}\nType: ${typeLabel}\n\n${deliveryFeeStr}*Total: RM ${order.total_amount.toFixed(2)}*\n\nThank you for your visit!`;

    // 5. Try Native Web Share API first (Perfect for Mobile)
    if (isMobile && navigator.share) {
      const file = new File([imageBlob], `Receipt_${order.id.split('-')[0]!.toUpperCase()}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Receipt for Order #${order.id.split('-')[0]!.toUpperCase()}`,
            text: message
          });
          return; // Native share successful, we are done!
        } catch (shareError) {
          console.log("Native share cancelled or failed, falling back to URL", shareError);
        }
      }
    }

    // 6. Trigger a download (Fallback if native share didn't work, usually desktop)
    const downloadUrl = URL.createObjectURL(imageBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = `Receipt_${order.id.split('-')[0]!.toUpperCase()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    // 7. Build WhatsApp URL
    const encodedMessage = encodeURIComponent(message);
    const phone = store.phone_number ? store.phone_number.replace(/\D/g, '') : '';
    let whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    if (!phone) {
      whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    }

    // 8. Redirect to WhatsApp
    if (isMobile) {
      // On mobile, navigate in the SAME tab so intents aren't blocked by Safari/Chrome
      window.location.href = whatsappUrl;
    } else if (whatsappWindow) {
      // On desktop, redirect the previously opened tab
      whatsappWindow.location.href = whatsappUrl;
    }

  } catch (error: any) {
    console.error("Failed to share receipt via WhatsApp:", error);
    if (error?.name !== 'AbortError') {
      alert("Failed to generate receipt image. Error: " + (error?.message || String(error)));
    }
  }
}
