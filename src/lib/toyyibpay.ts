// src/lib/toyyibpay.ts
import { supabase } from '@/integrations/supabase/client';

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
}

/**
 * Creates ToyyibPay FPX Bill Checkout Session
 */
export async function createToyyibPayCheckout(params: CreateToyyibPayBillParams): Promise<ToyyibPayBillResponse> {
  try {
    const amountInCents = Math.round(params.totalAmount * 100);
    const categoryCode = "warung_jnj_delivery";

    // In production, ToyyibPay POST API request:
    // POST https://toyyibpay.com/index.php/api/createBill
    // Params: userSecretKey, categoryCode, billName, billDescription, billPriceSetting, billPayorInfo, billAmount, billReturnUrl, billCallbackUrl, billExternalReferenceNo

    const sandboxBillCode = `tb_${params.orderId.slice(0, 8)}`;
    const sandboxPaymentUrl = `https://toyyibpay.com/${sandboxBillCode}`;

    // Update order with payment reference
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
    };
  } catch (err: any) {
    console.error("Failed to create ToyyibPay checkout:", err);
    return {
      success: false,
      message: err.message || "Failed to initialize payment gateway session.",
    };
  }
}
