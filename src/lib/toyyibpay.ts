import { getFriendlyErrorMessage } from '@/lib/error-utils';

export interface ToyyibPayConfig {
  categoryCode: string;
  isSandbox: boolean;
  chargeToCustomer: boolean;
}

export interface ToyyibPayGatewayStatus {
  configured: boolean;
  categoryConfigured: boolean;
  sandbox: boolean;
}

export interface CreateToyyibPayBillParams {
  orderId: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | undefined;
}

export interface ToyyibPayBillResponse {
  success: boolean;
  paymentUrl?: string | undefined;
  billCode?: string | undefined;
  message?: string | undefined;
  isDemo?: boolean | undefined;
}

export interface VerifyToyyibPayParams {
  billCode?: string | undefined;
  orderId?: string | undefined;
}

export interface VerifyToyyibPayResponse {
  success: boolean;
  paid: boolean;
  orderId?: string | undefined;
  billCode?: string | undefined;
  status?: string | undefined;
  message?: string | undefined;
}

/**
 * Retrieve non-secret ToyyibPay preferences stored locally.
 * Secret keys remain exclusively on the server environment.
 */
export function getToyyibPayConfig(): ToyyibPayConfig {
  if (typeof window === 'undefined') {
    return {
      categoryCode: '',
      isSandbox: false,
      chargeToCustomer: true,
    };
  }

  // Purge any legacy client-side secret entries
  try {
    localStorage.removeItem('toyyibpay_secret_key');
    localStorage.removeItem('toyyibpay_config');
  } catch {
    // Ignore storage access errors
  }

  const categoryCode = localStorage.getItem('toyyibpay_category_code') || '';
  const isSandbox = localStorage.getItem('toyyibpay_sandbox') === 'true';
  const chargeToCustomer = localStorage.getItem('toyyibpay_charge_customer') !== 'false';

  return {
    categoryCode: categoryCode.trim(),
    isSandbox,
    chargeToCustomer,
  };
}

/**
 * Persist non-secret ToyyibPay preferences locally.
 */
export function saveToyyibPayConfig(config: Partial<ToyyibPayConfig>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('toyyibpay_secret_key');
    localStorage.removeItem('toyyibpay_config');
    if (config.categoryCode !== undefined) {
      localStorage.setItem('toyyibpay_category_code', config.categoryCode.trim());
    }
    if (config.isSandbox !== undefined) {
      localStorage.setItem('toyyibpay_sandbox', String(config.isSandbox));
    }
    if (config.chargeToCustomer !== undefined) {
      localStorage.setItem('toyyibpay_charge_customer', String(config.chargeToCustomer));
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Query server for non-secret ToyyibPay configuration readiness.
 */
export async function fetchToyyibPayGatewayStatus(): Promise<ToyyibPayGatewayStatus> {
  try {
    const res = await fetch('/api/toyyibpay/config', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { configured: false, categoryConfigured: false, sandbox: false };
    }
    const data = (await res.json()) as Partial<ToyyibPayGatewayStatus>;
    return {
      configured: Boolean(data.configured),
      categoryConfigured: Boolean(data.categoryConfigured),
      sandbox: Boolean(data.sandbox),
    };
  } catch {
    return { configured: false, categoryConfigured: false, sandbox: false };
  }
}

/**
 * Initiate ToyyibPay FPX checkout via server endpoint.
 */
export async function createToyyibPayCheckout(
  params: CreateToyyibPayBillParams
): Promise<ToyyibPayBillResponse> {
  try {
    const prefs = getToyyibPayConfig();
    const response = await fetch('/api/toyyibpay/create-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: params.orderId,
        totalAmount: params.totalAmount,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
        ...(prefs.categoryCode ? { categoryCode: prefs.categoryCode } : {}),
        isSandbox: prefs.isSandbox,
        chargeToCustomer: prefs.chargeToCustomer,
      }),
    });

    const data = (await response.json()) as ToyyibPayBillResponse;
    if (!response.ok || !data.success || !data.paymentUrl) {
      return {
        success: false,
        message: getFriendlyErrorMessage(
          data.message,
          'Sesi pembayaran FPX tidak dapat dimulakan buat masa ini.'
        ),
      };
    }

    return {
      success: true,
      paymentUrl: data.paymentUrl,
      billCode: data.billCode,
      isDemo: false,
    };
  } catch (err) {
    return {
      success: false,
      message: getFriendlyErrorMessage(
        err,
        'Gagal menyambung ke gerbang pembayaran dalam talian.'
      ),
    };
  }
}

/**
 * Verify a ToyyibPay payment status authoritatively through the server.
 */
export async function verifyToyyibPayPayment(
  params: VerifyToyyibPayParams
): Promise<VerifyToyyibPayResponse> {
  try {
    const prefs = getToyyibPayConfig();
    const response = await fetch('/api/toyyibpay/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(params.billCode ? { billCode: params.billCode } : {}),
        ...(params.orderId ? { orderId: params.orderId } : {}),
        isSandbox: prefs.isSandbox,
      }),
    });

    const data = (await response.json()) as VerifyToyyibPayResponse;
    if (!response.ok) {
      return {
        success: false,
        paid: false,
        message: getFriendlyErrorMessage(
          data.message,
          'Status bayaran tidak dapat disahkan buat masa ini.'
        ),
      };
    }

    return data;
  } catch (err) {
    return {
      success: false,
      paid: false,
      message: getFriendlyErrorMessage(err, 'Ralat semakan status bayaran.'),
    };
  }
}

/**
 * Check Bill Transaction Status via server verification endpoint.
 */
export async function getToyyibPayBillStatus(billCode: string): Promise<VerifyToyyibPayResponse> {
  return verifyToyyibPayPayment({ billCode });
}
