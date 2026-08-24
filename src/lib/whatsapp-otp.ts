import { dispatchWhatsAppOTP, getWhatsAppGatewayConfig } from './whatsapp-gateway';

export interface OtpSession {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
}

export interface WhatsAppMessage {
  id: string;
  phone: string;
  type: 'otp' | 'receipt' | 'promo';
  content: string;
  sentAt: string;
  status: 'sent' | 'delivered';
}

export interface PendingRegistrationState {
  phone: string;
  name: string;
  step: 'phone' | 'otp' | 'welcome';
  otpCode?: string;
  expiresAt: number;
}

const OTP_SESSIONS_KEY = 'warung_whatsapp_otp_sessions_v2';
const SENT_MESSAGES_KEY = 'warung_whatsapp_sent_messages_v1';
const RATE_LIMIT_KEY = 'warung_whatsapp_hourly_rate_limits_v1';
const SESSION_ACTIVITY_KEY = 'warung_customer_session_activity_v1';
const PENDING_REGISTRATION_KEY = 'warung_pending_otp_registration_v2';

// Clean phone string format (e.g. 601125251817)
export function sanitizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('60') && cleaned.length >= 9) {
    cleaned = '60' + cleaned;
  }
  return cleaned;
}

// 1. Pending Registration State Management (Persists across tab switching & reloads)
export function savePendingRegistration(phone: string, name: string = '', otpCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PendingRegistrationState = {
      phone: sanitizePhone(phone),
      name,
      step: 'otp',
      otpCode: otpCode || '',
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins validity
    };
    localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save pending registration:', err);
  }
}

export function clearPendingRegistration(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_REGISTRATION_KEY);
  } catch (err) {}
}

export function getPendingRegistration(): PendingRegistrationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_REGISTRATION_KEY);
    if (!raw) return null;
    const data: PendingRegistrationState = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(PENDING_REGISTRATION_KEY);
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

// Rate Limiter: Max 5 requests per hour per phone
export function checkRateLimit(phone: string): { allowed: boolean; waitSeconds?: number } {
  if (typeof window === 'undefined') return { allowed: true };
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const limits: Record<string, { count: number; firstAt: number }> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const clean = sanitizePhone(phone);
    const userLimit = limits[clean];

    const oneHour = 60 * 60 * 1000;

    if (!userLimit) {
      limits[clean] = { count: 1, firstAt: now };
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
      return { allowed: true };
    }

    if (now - userLimit.firstAt > oneHour) {
      limits[clean] = { count: 1, firstAt: now };
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
      return { allowed: true };
    }

    if (userLimit.count >= 5) {
      const waitMs = oneHour - (now - userLimit.firstAt);
      return { allowed: false, waitSeconds: Math.ceil(waitMs / 1000) };
    }

    userLimit.count += 1;
    limits[clean] = userLimit;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
    return { allowed: true };
  } catch (err) {
    return { allowed: true };
  }
}

// Generate & Dispatch 6-digit WhatsApp OTP (Expires in 10 minutes)
export function requestWhatsAppOtp(phone: string): { success: boolean; message: string; otpCode?: string } {
  const cleanPhone = sanitizePhone(phone);
  if (cleanPhone.length < 10) {
    return { success: false, message: 'Invalid phone number format. Malaysia format example: +60123456789 or 0123456789.' };
  }

  const rateCheck = checkRateLimit(cleanPhone);
  if (!rateCheck.allowed) {
    return { 
      success: false, 
      message: `🚫 Security Rate Limit: Max 5 requests per hour. Please try again in ${Math.ceil((rateCheck.waitSeconds || 60) / 60)} minutes.` 
    };
  }

  // Check if account is locked out from 3 wrong attempts
  try {
    const raw = localStorage.getItem(OTP_SESSIONS_KEY);
    const sessions: Record<string, OtpSession> = raw ? JSON.parse(raw) : {};
    const existing = sessions[cleanPhone];
    if (existing && existing.lockedUntil && Date.now() < existing.lockedUntil) {
      const remainingMins = Math.ceil((existing.lockedUntil - Date.now()) / (60 * 1000));
      return {
        success: false,
        message: `🔒 Account temporarily locked due to 3 wrong attempts. Please wait ${remainingMins} minutes before trying again.`
      };
    }
  } catch (err) {
    console.error('Lock check error:', err);
  }

  // Generate 6-digit OTP code (Valid for 10 minutes)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins validity

  const session: OtpSession = {
    phone: cleanPhone,
    code,
    expiresAt,
    attempts: 0
  };

  try {
    const raw = localStorage.getItem(OTP_SESSIONS_KEY);
    const sessions: Record<string, OtpSession> = raw ? JSON.parse(raw) : {};
    sessions[cleanPhone] = session;
    localStorage.setItem(OTP_SESSIONS_KEY, JSON.stringify(sessions));

    const text = `🔑 *Warung J&J VIP Verification*\n\nYour 6-digit OTP code is: *${code}*\n\nValid for 10 minutes. Do not share this code.`;
    recordWhatsAppMessage(cleanPhone, 'otp', text);

    const config = getWhatsAppGatewayConfig();
    dispatchWhatsAppOTP({
      phone: cleanPhone,
      code,
      mode: config.mode || 'A',
      fonnteToken: config.fonnteToken
    }).catch(err => console.warn('OTP background dispatch notice:', err));
  } catch (err) {
    console.error('Failed to save OTP session:', err);
  }

  return {
    success: true,
    message: `💬 WhatsApp OTP sent to +${cleanPhone}. Valid for 10 minutes.`,
    otpCode: code
  };
}

// Verify 6-digit OTP Code (Max 3 wrong attempts -> 15 min lock)
export function verifyWhatsAppOtp(phone: string, inputCode: string): { success: boolean; message: string; pointsAwarded?: number } {
  const cleanPhone = sanitizePhone(phone);
  try {
    const raw = localStorage.getItem(OTP_SESSIONS_KEY);
    const sessions: Record<string, OtpSession> = raw ? JSON.parse(raw) : {};
    const session = sessions[cleanPhone];

    if (!session) {
      return { success: false, message: 'No active OTP verification session found. Please request a new OTP.' };
    }

    if (session.lockedUntil && Date.now() < session.lockedUntil) {
      const remainingMins = Math.ceil((session.lockedUntil - Date.now()) / (60 * 1000));
      return { success: false, message: `🔒 Account locked due to 3 wrong attempts. Try again in ${remainingMins} minutes.` };
    }

    if (Date.now() > session.expiresAt) {
      clearPendingRegistration();
      return { success: false, message: '⏰ Verification OTP code expired (10 min limit). Please request a new OTP.' };
    }

    if (session.code.trim() !== inputCode.trim()) {
      session.attempts += 1;
      if (session.attempts >= 3) {
        session.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins lock
        sessions[cleanPhone] = session;
        localStorage.setItem(OTP_SESSIONS_KEY, JSON.stringify(sessions));
        clearPendingRegistration();
        return { success: false, message: '🔒 Account locked for 15 minutes due to 3 incorrect attempts.' };
      }

      sessions[cleanPhone] = session;
      localStorage.setItem(OTP_SESSIONS_KEY, JSON.stringify(sessions));
      return { success: false, message: `❌ Invalid OTP code. (${3 - session.attempts} attempts remaining)` };
    }

    // Success: Clear session and pending state
    delete sessions[cleanPhone];
    localStorage.setItem(OTP_SESSIONS_KEY, JSON.stringify(sessions));
    clearPendingRegistration();

    // Refresh 30-min session inactivity timestamp
    updateSessionActivity(cleanPhone);

    return {
      success: true,
      message: '✅ VIP Verification Successful! Welcome to Warung J&J Member Program.',
      pointsAwarded: 50
    };
  } catch (err) {
    return { success: false, message: 'Verification failed. Please try again.' };
  }
}

export function updateSessionActivity(phone: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_ACTIVITY_KEY, JSON.stringify({
      phone: sanitizePhone(phone),
      lastActiveAt: Date.now()
    }));
  } catch (err) {}
}

export function isSessionExpired(phone: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const thirtyMins = 30 * 60 * 1000;
    return (Date.now() - data.lastActiveAt) > thirtyMins;
  } catch (err) {
    return false;
  }
}

export function recordWhatsAppMessage(phone: string, type: WhatsAppMessage['type'], content: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SENT_MESSAGES_KEY);
    const messages: WhatsAppMessage[] = raw ? JSON.parse(raw) : [];
    messages.unshift({
      id: `msg-${Date.now()}`,
      phone: sanitizePhone(phone),
      type,
      content,
      sentAt: new Date().toISOString(),
      status: 'delivered'
    });
    localStorage.setItem(SENT_MESSAGES_KEY, JSON.stringify(messages));
  } catch (err) {}
}

export function getWhatsAppWebUrl(phone: string, text: string): string {
  const clean = sanitizePhone(phone);
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

/**
 * 📲 Quick Zero-Cost WhatsApp Notifications for Rider Milestones & Dispatch Alerts
 */
export function sendRiderDeliveryWhatsAppNotification(
  status: 'picked_up' | 'arrived' | 'completed' | 'dispatched', 
  customerPhone: string, 
  orderId: string
): void {
  if (!customerPhone) return;
  const cleanPhone = sanitizePhone(customerPhone);
  const shortId = orderId.slice(0, 8).toUpperCase();
  
  let message = "";

  switch (status) {
    case 'picked_up':
      message = `Halo! 🍱 Pesanan Warung J&J anda (#${shortId}) telah diambil oleh rider kami dan sedang dalam perjalanan ke lokasi anda. Sedia ya! 🛵💨`;
      break;
    case 'arrived':
      message = `Halo! 🛵 Rider Warung J&J (#${shortId}) telah tiba di hadapan lokasi penghantaran anda. Sila sedia untuk menerima pesanan. Terima kasih! 🍱✨`;
      break;
    case 'completed':
      message = `Terima kasih! ✅ Pesanan Warung J&J (#${shortId}) telah diserahkan dengan jayanya. Selamat menjamu selera! Lawati https://warungjnj.online lagi. 🌟`;
      break;
    case 'dispatched':
      message = `🚨 *TUGASAN PESANAN BARU!* Pesanan #${shortId} di Warung J&J sedia untuk diambil. Sila buka aplikasi rider anda untuk terima tugasan.`;
      break;
  }

  const waLink = getWhatsAppWebUrl(cleanPhone, message);
  if (typeof window !== 'undefined') {
    window.open(waLink, '_blank');
  }
}
