// src/lib/toyyibpay.ts
import { supabase } from '@/integrations/supabase/client';

export interface ToyyibPayConfig {
  userSecretKey: string;
  categoryCode: string;
  isSandbox: boolean;
  chargeToCustomer: boolean;
}

export interface CreateToyyibPayBillParams {
  orderId: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}

export interface ToyyibPayBillResponse {
  success: boolean;
  paymentUrl?: string;
  billCode?: string;
  message?: string;
  isDemo?: boolean;
}

/**
 * Get current ToyyibPay configuration from local storage or environment
 */
export function getToyyibPayConfig(): ToyyibPayConfig {
  const secretKey = typeof window !== 'undefined' 
    ? localStorage.getItem('toyyibpay_secret_key') || (import.meta as any).env?.VITE_TOYYIBPAY_SECRET_KEY || ''
    : '';
  const categoryCode = typeof window !== 'undefined'
    ? localStorage.getItem('toyyibpay_category_code') || (import.meta as any).env?.VITE_TOYYIBPAY_CATEGORY_CODE || ''
    : '';
  const isSandbox = typeof window !== 'undefined'
    ? localStorage.getItem('toyyibpay_sandbox') === 'true'
    : false;
  const chargeToCustomer = typeof window !== 'undefined'
    ? localStorage.getItem('toyyibpay_charge_customer') !== 'false'
    : true;

  return {
    userSecretKey: secretKey.trim(),
    categoryCode: categoryCode.trim(),
    isSandbox,
    chargeToCustomer,
  };
}

/**
 * Save ToyyibPay configuration
 */
export function saveToyyibPayConfig(config: Partial<ToyyibPayConfig>) {
  if (typeof window === 'undefined') return;
  if (config.userSecretKey !== undefined) localStorage.setItem('toyyibpay_secret_key', config.userSecretKey.trim());
  if (config.categoryCode !== undefined) localStorage.setItem('toyyibpay_category_code', config.categoryCode.trim());
  if (config.isSandbox !== undefined) localStorage.setItem('toyyibpay_sandbox', String(config.isSandbox));
  if (config.chargeToCustomer !== undefined) localStorage.setItem('toyyibpay_charge_customer', String(config.chargeToCustomer));
}

/**
 * Helper to parse and humanize ToyyibPay error responses
 */
function humanizeToyyibPayError(rawText: string, isSandbox: boolean): string {
  const clean = rawText.replace(/[\[\]"']/g, '').trim();

  if (clean.includes('KEY-DID-NOT-EXIST') || clean.includes('KEY-NOT-EXIST')) {
    return isSandbox 
      ? 'Kunci [User Secret Key] tidak wujud di Sandbox (dev.toyyibpay.com). Jika anda mendaftar di toyyibpay.com (Live), sila matikan Mod Sandbox dalam Tetapan.'
      : 'Kunci [User Secret Key] tidak wujud di toyyibpay.com. Sila pastikan anda menyalin User Secret Key yang tepat dari akaun ToyyibPay anda.';
  }

  if (clean.includes('KEY-DID-NOT-MATCH') || clean.includes('KEY-NOT-MATCH')) {
    return 'Kunci [User Secret Key] tidak sepadan dengan [Category Code]. Sila pastikan Category Code tersebut dicipta di bawah akaun ToyyibPay yang sama.';
  }

  if (clean.includes('CATEGORY-NOT-EXIST') || clean.includes('CATEGORY-DOES-NOT-EXIST')) {
    return 'Kategori [Category Code] tidak wujud. Sila semak semula Kod Kategori dalam akaun ToyyibPay anda.';
  }

  if (clean.includes('INACTIVE') || clean.includes('PENDING') || clean.includes('UNDER-REVIEW')) {
    return 'Akaun ToyyibPay anda masih dalam proses semakan/kelulusan oleh pihak ToyyibPay.';
  }

  return `Maklum balas ToyyibPay: ${clean || 'Ralat tidak diketahui'}`;
}

/**
 * Creates ToyyibPay FPX Bill Checkout Session
 */
export async function createToyyibPayCheckout(params: CreateToyyibPayBillParams): Promise<ToyyibPayBillResponse> {
  try {
    const config = getToyyibPayConfig();
    const baseUrl = config.isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';
    const amountInCents = Math.round(params.totalAmount * 100);

    // Sanitize bill name: Max 30 alphanumeric and underscore only
    const cleanOrderId = params.orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const billName = `Warung_JNJ_${cleanOrderId}`.slice(0, 30);
    const billDescription = `Pesanan Makanan Warung JNJ #${cleanOrderId}`.slice(0, 100);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://warungjnj.com';
    const returnUrl = `${origin}/delivery?payment_status=return&order_id=${params.orderId}`;
    const callbackUrl = `${origin}/api/toyyibpay-webhook`;

    // If User Secret Key & Category Code are configured, make real API request to ToyyibPay
    if (config.userSecretKey && config.categoryCode) {
      const formData = new URLSearchParams();
      formData.append('userSecretKey', config.userSecretKey);
      formData.append('categoryCode', config.categoryCode);
      formData.append('billName', billName);
      formData.append('billDescription', billDescription);
      formData.append('billPriceSetting', '1'); // 1 = Fixed amount
      formData.append('billPayorInfo', '1'); // 1 = Required payer info
      formData.append('billAmount', amountInCents.toString());
      formData.append('billReturnUrl', returnUrl);
      formData.append('billCallbackUrl', callbackUrl);
      formData.append('billExternalReferenceNo', params.orderId);
      formData.append('billTo', params.customerName || 'Customer');
      formData.append('billEmail', params.customerEmail || 'customer@warungjnj.com');
      formData.append('billPhone', params.customerPhone || '0123456789');
      formData.append('billPaymentChannel', '0'); // 0 = FPX Online Banking
      formData.append('billChargeToCustomer', config.chargeToCustomer ? '0' : '1'); // 0 = charge FPX fee to customer
      formData.append('enableDuitNowQR', '1');
      formData.append('chargeDuitNowQR', '0');

      const response = await fetch(`${baseUrl}/index.php/api/createBill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const rawText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(rawText);
      } catch {
        // Plain text error from ToyyibPay
        const humanError = humanizeToyyibPayError(rawText, config.isSandbox);
        throw new Error(humanError);
      }

      if (Array.isArray(data) && data.length > 0 && data[0].BillCode) {
        const billCode = data[0].BillCode;
        const paymentUrl = `${baseUrl}/${billCode}`;

        // Save payment reference to Supabase order
        await (supabase as any)
          .from('orders')
          .update({
            payment_reference: billCode,
          })
          .eq('id', params.orderId);

        return {
          success: true,
          paymentUrl,
          billCode,
          isDemo: false,
        };
      } else {
        const rawMsg = Array.isArray(data) && data[0]?.msg ? data[0].msg : JSON.stringify(data);
        const humanError = humanizeToyyibPayError(rawMsg, config.isSandbox);
        throw new Error(humanError);
      }
    }

    // Fallback Simulation (While registration is pending review)
    const sandboxBillCode = `tb_${params.orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
    const sandboxPaymentUrl = `${baseUrl}/${sandboxBillCode}`;

    await (supabase as any)
      .from('orders')
      .update({
        payment_reference: sandboxBillCode,
      })
      .eq('id', params.orderId);

    return {
      success: true,
      paymentUrl: sandboxPaymentUrl,
      billCode: sandboxBillCode,
      isDemo: true,
      message: 'Akaun ToyyibPay masih dalam semakan. Sila masukkan User Secret Key & Category Code dalam Tetapan setelah diluluskan.',
    };
  } catch (err: any) {
    console.error("Failed to create ToyyibPay checkout:", err);
    return {
      success: false,
      message: err.message || "Gagal menyambung ke gerbang ToyyibPay FPX.",
    };
  }
}

/**
 * Check Bill Transaction Status from ToyyibPay
 */
export async function getToyyibPayBillStatus(billCode: string): Promise<any> {
  try {
    const config = getToyyibPayConfig();
    const baseUrl = config.isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';

    const formData = new URLSearchParams();
    formData.append('billCode', billCode);

    const response = await fetch(`${baseUrl}/index.php/api/getBillTransactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const rawText = await response.text();
    try {
      return JSON.parse(rawText);
    } catch {
      return { raw: rawText };
    }
  } catch (err) {
    console.error("Failed to fetch ToyyibPay transaction status:", err);
    return null;
  }
}
