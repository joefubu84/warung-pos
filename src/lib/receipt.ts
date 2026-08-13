export interface Store {
  name: string;
  logo_url?: string | null;
  phone_number?: string | null;
  phone_number_2?: string | null;
}

export interface OrderItem {
  name: string;
  price: number;
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
  status: string;
  delivery_fee?: number | null;
  delivery_service?: string | null;
}

export function generateReceiptHTML(
  order: Order,
  store: Store,
  cashierName: string,
  items: OrderItem[]
): string {
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleDateString('en-MY', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const formattedTime = orderDate.toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit'
  });
  const orderIdShort = order.id.split('-')[0]!.toUpperCase();

  const itemsHtml = items.map(item => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    let itemHtml = `
      <tr>
        <td class="item-name" colspan="3">${item.name}</td>
      </tr>
      <tr>
        <td class="item-qty">${item.quantity}x</td>
        <td class="item-price">RM ${item.price.toFixed(2)}</td>
        <td class="item-total">RM ${itemTotal}</td>
      </tr>
    `;

    if (item.notes) {
      itemHtml += `
        <tr>
          <td class="item-qty"></td>
          <td class="item-price indent" colspan="2" style="font-style: italic;">&rarr; ${item.notes}</td>
        </tr>
      `;
    }

    if (item.container_charge && item.container_charge > 0) {
      const containerTotal = (item.container_charge * item.quantity).toFixed(2);
      itemHtml += `
        <tr>
          <td class="item-qty"></td>
          <td class="item-price indent">Tapau (${item.container_size || 'large'})</td>
          <td class="item-total">RM ${containerTotal}</td>
        </tr>
      `;
    }
    return itemHtml;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${orderIdShort}</title>
  <style>
    @page {
      margin: 0;
      size: 58mm auto;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.2;
      color: #000;
      margin: 0;
      padding: 10px;
      width: 58mm;
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    
    .logo {
      max-width: 80%;
      height: auto;
      margin: 0 auto 5px auto;
      display: block;
      filter: grayscale(100%) contrast(1.2); /* Optimize for thermal */
    }
    
    .store-name {
      font-size: 14px;
      font-weight: bold;
      margin: 5px 0;
      text-transform: uppercase;
    }
    
    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 8px;
      margin-bottom: 8px;
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
    
    .item-qty { width: 15%; }
    .item-price { width: 50%; }
    .item-total { width: 35%; text-align: right; }
    .indent { padding-left: 10px; font-size: 11px; }
    
    .totals-table { margin-top: 10px; }
    .totals-table td { padding: 2px 0; }
    
    .grand-total {
      font-size: 14px;
      font-weight: bold;
      padding: 5px 0;
    }
    
    .footer {
      margin-top: 15px;
      font-size: 11px;
      margin-bottom: 30px; /* Space for tearing */
    }
  </style>
</head>
<body>
  <div class="text-center">
    ${store.logo_url ? `<img src="${store.logo_url}" class="logo" alt="Logo" />` : ''}
    <div class="store-name">${store.name}</div>
    ${store.phone_number ? `<div>Tel: ${store.phone_number}</div>` : ''}
    ${store.phone_number_2 ? `<div>Tel 2: ${store.phone_number_2}</div>` : ''}
  </div>

  <br/>
  <div class="info-grid">
    <div>Order:</div><div>#${orderIdShort}</div>
    <div>Date:</div><div>${formattedDate} ${formattedTime}</div>
    <div>Type:</div><div>${order.type === 'delivery' ? `Delivery (${order.delivery_service === 'foodpanda' ? 'Food Panda' : order.delivery_service === 'shopeefood' ? 'Shopee' : 'Grab'})` : order.type === 'dine_in' ? `Dine In ${order.table_id ? `(Table ${order.table_id})` : ''}` : 'Takeaway'}</div>
    ${order.customer_name ? `<div>Cust:</div><div>${order.customer_name}</div>` : ''}
    <div>Cashier:</div><div>${cashierName}</div>
  </div>

  <div class="divider"></div>

  <table>
    ${itemsHtml}
  </table>

  <div class="divider"></div>
  <table class="totals-table">
    ${order.delivery_fee && Number(order.delivery_fee) > 0 ? `
    <tr>
      <td>Subtotal</td>
      <td class="text-right">RM ${(order.total_amount - Number(order.delivery_fee)).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Delivery</td>
      <td class="text-right">RM ${Number(order.delivery_fee).toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="2"><div class="divider" style="margin: 5px 0;"></div></td>
    </tr>
    ` : ''}
    <tr class="grand-total">
      <td>TOTAL</td>
      <td class="text-right">RM ${order.total_amount.toFixed(2)}</td>
    </tr>
  </table>
  <div class="divider"></div>

  <div class="text-center footer">
    <p>Thank you for your visit!</p>
    <p>Please come again.</p>
  </div>
  
  <script>
    // Optional: Auto-print when loaded in a hidden iframe
    window.onload = function() {
      // Small delay to ensure images/fonts load
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
