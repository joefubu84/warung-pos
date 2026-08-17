import { sanitizePhone } from './whatsapp-otp';

export interface DispatchOptions {
  phone: string;
  code: string;
  mode: 'A' | 'B' | 'C';
  fonnteToken?: string;
}

export interface WhatsAppGatewayConfig {
  mode: 'A' | 'B' | 'C';
  gatewayUrl: string;
  fonnteToken: string;
  apiKey?: string;
  autoSendEnabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING_REQUIRED';
  phoneConnected?: string;
  lastSyncAt?: string;
}

const GATEWAY_CONFIG_KEY = 'warung_whatsapp_gateway_config_v2';

export const DEFAULT_GATEWAY_CONFIG: WhatsAppGatewayConfig = {
  mode: 'A',
  gatewayUrl: 'http://localhost:3001',
  fonnteToken: '',
  apiKey: '',
  autoSendEnabled: true,
  status: 'CONNECTED',
  phoneConnected: '601125251817',
  lastSyncAt: new Date().toISOString()
};

export function getWhatsAppGatewayConfig(): WhatsAppGatewayConfig {
  if (typeof window === 'undefined') return DEFAULT_GATEWAY_CONFIG;
  try {
    const raw = localStorage.getItem(GATEWAY_CONFIG_KEY);
    if (!raw) return DEFAULT_GATEWAY_CONFIG;
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_GATEWAY_CONFIG;
  }
}

export function saveWhatsAppGatewayConfig(config: WhatsAppGatewayConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GATEWAY_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event('warung_whatsapp_gateway_updated'));
  } catch (err) {
    console.error('Failed to save WhatsApp gateway config:', err);
  }
}

/**
 * Unified Core Dispatcher for Warung J&J WhatsApp OTP System
 */
export async function dispatchWhatsAppOTP({ phone, code, mode, fonnteToken }: DispatchOptions): Promise<{ success: boolean; method: string; waUrl?: string }> {
  const textMessage = `🔑 *Warung J&J VIP Verification*\n\nYour loyalty verification code is: *${code}*\n\nValid for 5 minutes. Do not share this code with anyone.`;
  
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '60' + cleanPhone.slice(1);
  }

  switch (mode) {
    case 'A': { // Mode A: Local Node.js Microservice Gateway (Port 3001)
      try {
        const localResponse = await fetch('http://localhost:3001/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, message: textMessage }),
        });
        if (!localResponse.ok) throw new Error('Local gateway failed to dispatch');
        return { success: true, method: 'Local Microservice (Port 3001)' };
      } catch (err) {
        console.warn('Local Node Gateway unreachable, falling back to Native Deep Link:', err);
        const encodedText = encodeURIComponent(textMessage);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
        return { success: true, method: 'Native App Deep Link Fallback', waUrl };
      }
    }

    case 'B': { // Mode B: Native WhatsApp Application Deep Link Launch
      const encodedText = encodeURIComponent(textMessage);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
      if (typeof window !== 'undefined') {
        window.open(waUrl, '_blank');
      }
      return { success: true, method: 'Native App Deep Link Open', waUrl };
    }

    case 'C': { // Mode C: Cloud Provider Third-Party API (Fonnte)
      const token = fonnteToken || getWhatsAppGatewayConfig().fonnteToken;
      if (!token) throw new Error('Fonnte API token is missing in restaurant settings');
      
      const cloudResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': token },
        body: new URLSearchParams({
          target: cleanPhone,
          message: textMessage
        })
      });
      if (!cloudResponse.ok) throw new Error('Cloud Gateway API error');
      return { success: true, method: 'Fonnte Cloud API' };
    }

    default:
      throw new Error('Unsupported dispatch mechanism selected');
  }
}

export async function sendLiveWhatsAppMessage(phone: string, text: string) {
  const cfg = getWhatsAppGatewayConfig();
  return dispatchWhatsAppOTP({
    phone,
    code: text,
    mode: cfg.mode || 'A',
    fonnteToken: cfg.fonnteToken
  });
}
