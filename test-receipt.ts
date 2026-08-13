import { generateReceiptHTML } from './src/lib/receipt';

const order = {
  id: "e5254f2d-3006-4b0f-adfa-eaafc5e223fd",
  created_at: "2026-08-12T04:37:04.169282+00:00",
  total_amount: 16.00,
  type: "takeaway",
  customer_name: null,
  status: "completed"
};

const store = {
  name: "Warung J&J",
  logo_url: "https://ilvbuhinmasmdsjcxfbn.supabase.co/storage/v1/object/public/logos/1094d737-8104-4a55-b678-0fe9097beba0/logo.png",
  phone_number: "60172221784",
  phone_number_2: "60178284578"
};

const items = [{
  name: "BASUNGAN IKAN TAUSI(ori)",
  price: 15,
  quantity: 1,
  container_size: "large",
  container_charge: 1
}];

const html = generateReceiptHTML(order as any, store, "Staff A", items as any);
console.log("HTML generation successful. Length:", html.length);
console.log(html.slice(0, 150) + "...");
