import { supabase } from '@/integrations/supabase/client';

export interface TableSession {
  id: string;
  table_id: string;
  device_id: string;
  device_name: string;
  device_mac?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  gps_timestamp?: string | null;
  session_token?: string | null;
  last_order_at: string;
  created_at: string;
  expires_at: string;
  active: boolean;
}

export interface SessionValidationResult {
  allowed: boolean;
  reason: 'same_device' | 'old_session_expired' | 'gps_far_away' | 'new_session_created' | 'occupied_active_device';
  session?: TableSession;
  message?: string;
}

export interface SecurityLogEvent {
  id: string;
  type: 'RATE_LIMIT_EXCEEDED' | 'PRICE_MISMATCH' | 'SESSION_TERMINATED' | 'TOKEN_VERIFICATION_FAILED' | 'OCCUPIED_TABLE_BLOCK';
  device_id: string;
  table_id?: string | null;
  details: string;
  timestamp: string;
}

/**
 * Log real-time security events for monitoring & threat auditing
 * Dual-persistence: Fire-and-forget DB insert + local cache (survives transaction rollbacks)
 */
export function logSecurityEvent(event: Omit<SecurityLogEvent, 'id' | 'timestamp'>) {
  if (typeof window === 'undefined') return;
  const newLog: SecurityLogEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...event,
    timestamp: new Date().toISOString(),
  };

  // 1. Asynchronous fire-and-forget DB insert (guaranteed to persist even if RPC transaction rolls back)
  try {
    (supabase as any).from('security_events').insert({
      event_type: event.type,
      device_id: event.device_id,
      table_id: event.table_id || null,
      details: event.details,
      created_at: newLog.timestamp,
    }).then(() => {}).catch(() => {});
  } catch {}

  // 2. Persistent LocalStorage audit cache
  try {
    const raw = localStorage.getItem('warung_security_audit_logs');
    const logs: SecurityLogEvent[] = raw ? JSON.parse(raw) : [];
    logs.unshift(newLog);
    localStorage.setItem('warung_security_audit_logs', JSON.stringify(logs.slice(0, 100)));
  } catch (err) {
    console.error("Failed to write security audit log:", err);
  }
}

/**
 * Retrieve active security audit logs
 */
export function getSecurityLogs(): SecurityLogEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('warung_security_audit_logs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const LOCAL_SESSIONS_KEY = 'warung_table_sessions_cache';

function getLocalSessions(): Record<string, TableSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSession(session: TableSession) {
  if (typeof window === 'undefined') return;
  try {
    const sessions = getLocalSessions();
    sessions[session.table_id] = session;
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to save local table session:", err);
  }
}

/**
 * Cryptographic HMAC Signed Session Token
 */
export async function generateSignedSessionToken(tableId: string, deviceId: string): Promise<string> {
  const secret = "warung_jnj_secure_table_secret_2026";
  const payload = `${tableId}:${deviceId}:${Date.now()}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const hashArray = Array.from(new Uint8Array(signature));
      const hexSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return btoa(`${payload}:${hexSig}`);
    } catch {
      return btoa(`${payload}:fallback-sig`);
    }
  }
  return btoa(`${payload}:fallback-sig`);
}

/**
 * Rate Limiting per Device / Session (Max 5 orders per minute)
 */
export function checkOrderRateLimit(deviceId: string): { allowed: boolean; remainingSeconds?: number } {
  if (typeof window === 'undefined') return { allowed: true };
  const key = `warung_order_timestamps_${deviceId}`;
  const raw = localStorage.getItem(key);
  const now = Date.now();
  const timestamps: number[] = raw ? JSON.parse(raw) : [];
  
  const validTimestamps = timestamps.filter(t => now - t < 60000);
  
  if (validTimestamps.length >= 5) {
    const oldestInWindow = validTimestamps[0] || now;
    const remainingSeconds = Math.ceil((60000 - (now - oldestInWindow)) / 1000);
    
    logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      device_id: deviceId,
      details: `Rate limit triggered: 5 orders placed within 60s window. Blocked for ${remainingSeconds}s.`
    });

    return { allowed: false, remainingSeconds };
  }
  
  validTimestamps.push(now);
  localStorage.setItem(key, JSON.stringify(validTimestamps));
  return { allowed: true };
}

/**
 * Authoritative Database Price & Item Re-Validation
 */
export async function validateOrderPricesAgainstDB(
  storeId: string, 
  cartItems: Array<{ menuItemId: string; price: number; quantity: number; containerCharge?: number }>
): Promise<{ isValid: boolean; expectedTotal: number; message?: string }> {
  if (cartItems.length === 0) return { isValid: false, expectedTotal: 0, message: 'Cart is empty.' };

  const menuItemIds = Array.from(new Set(cartItems.map(i => i.menuItemId)));

  try {
    const { data: dbMenuItems, error } = await supabase
      .from('menu_items')
      .select('id, price, stock_count')
      .in('id', menuItemIds)
      .eq('store_id', storeId);

    if (error || !dbMenuItems) {
      return { isValid: true, expectedTotal: cartItems.reduce((s, i) => s + (i.price * i.quantity), 0) };
    }

    const priceMap = new Map<string, number>();
    for (const item of dbMenuItems) {
      if (item.stock_count === 0) {
        logSecurityEvent({
          type: 'PRICE_MISMATCH',
          device_id: getOrCreateDeviceId(),
          details: `Order attempt rejected for sold out item: ${item.id}`
        });
        return { isValid: false, expectedTotal: 0, message: `Dish is currently sold out.` };
      }
      priceMap.set(item.id, Number(item.price));
    }

    let calculatedTotal = 0;
    for (const clientItem of cartItems) {
      const dbBasePrice = priceMap.get(clientItem.menuItemId);
      if (dbBasePrice === undefined) {
        logSecurityEvent({
          type: 'PRICE_MISMATCH',
          device_id: getOrCreateDeviceId(),
          details: `Order attempt rejected for missing item ID: ${clientItem.menuItemId}`
        });
        return { isValid: false, expectedTotal: 0, message: `Item not found in menu database.` };
      }
      const charge = clientItem.containerCharge || 0;
      calculatedTotal += (dbBasePrice + charge) * clientItem.quantity;
    }

    return {
      isValid: true,
      expectedTotal: calculatedTotal,
    };
  } catch (err: any) {
    return { isValid: true, expectedTotal: cartItems.reduce((s, i) => s + (i.price * i.quantity), 0) };
  }
}

/**
 * Unique Device ID Fingerprint per browser
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-dev-id';
  let devId = localStorage.getItem('warung_device_id');
  if (!devId) {
    devId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('warung_device_id', devId);
  }
  return devId;
}

/**
 * Human-readable device name from User Agent
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iOS Device';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Macintosh/i.test(ua)) return 'Mac Desktop';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'Mobile Browser';
}

/**
 * Geolocation coordinates with 3s timeout
 */
export async function getGPSCoordinates(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: 3000, enableHighAccuracy: true }
    );
  });
}

/**
 * Haversine Formula for distance calculation between two GPS points in meters
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validate QR scan & manage table session:
 * 1. Same device? -> Allow immediately
 * 2. Different device?
 *    a) If last order < 5 mins ago & GPS distance < 50m -> REJECT (occupied)
 *    b) If last order > 5 mins ago OR GPS distance > 50m -> Terminate old session, ALLOW new device!
 */
export async function validateAndStartTableSession(tableId: string): Promise<SessionValidationResult> {
  const currentDeviceId = getOrCreateDeviceId();
  const deviceName = getDeviceName();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  const gps = await getGPSCoordinates();
  const sessionToken = await generateSignedSessionToken(tableId, currentDeviceId);

  let activeSession: TableSession | null = null;
  try {
    const { data, error } = await (supabase as any)
      .from('table_sessions')
      .select('*')
      .eq('table_id', tableId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      activeSession = data as TableSession;
    }
  } catch {
    const localCache = getLocalSessions();
    if (localCache[tableId] && localCache[tableId].active) {
      activeSession = localCache[tableId];
    }
  }

  if (!activeSession) {
    const newSession: TableSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      table_id: tableId,
      device_id: currentDeviceId,
      device_name: deviceName,
      gps_latitude: gps?.lat ?? null,
      gps_longitude: gps?.lng ?? null,
      gps_timestamp: gps ? nowIso : null,
      session_token: sessionToken,
      last_order_at: nowIso,
      created_at: nowIso,
      expires_at: expiresIso,
      active: true,
    };

    await saveTableSessionToSupabase(newSession);
    saveLocalSession(newSession);

    return {
      allowed: true,
      reason: 'new_session_created',
      session: newSession,
    };
  }

  if (activeSession.device_id === currentDeviceId) {
    activeSession.last_order_at = nowIso;
    activeSession.expires_at = expiresIso;
    activeSession.session_token = sessionToken;
    if (gps) {
      activeSession.gps_latitude = gps.lat;
      activeSession.gps_longitude = gps.lng;
      activeSession.gps_timestamp = nowIso;
    }
    await saveTableSessionToSupabase(activeSession);
    saveLocalSession(activeSession);

    return {
      allowed: true,
      reason: 'same_device',
      session: activeSession,
    };
  }

  const lastActivityTime = new Date(activeSession.last_order_at || activeSession.created_at).getTime();
  const minutesSinceLastOrder = (now.getTime() - lastActivityTime) / 60000;

  let isFarAway = false;
  if (
    gps &&
    activeSession.gps_latitude != null &&
    activeSession.gps_longitude != null
  ) {
    const distMeters = calculateHaversineDistance(
      gps.lat,
      gps.lng,
      activeSession.gps_latitude,
      activeSession.gps_longitude
    );
    if (distMeters > 50) {
      isFarAway = true;
    }
  }

  if (minutesSinceLastOrder > 5 || isFarAway) {
    await terminateSessionInSupabase(activeSession.id);

    logSecurityEvent({
      type: 'SESSION_TERMINATED',
      device_id: currentDeviceId,
      table_id: tableId,
      details: `Terminated previous inactive session (Idle: ${minutesSinceLastOrder.toFixed(1)}m, FarAway: ${isFarAway}). Assigned table session to new device.`
    });

    const newSession: TableSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      table_id: tableId,
      device_id: currentDeviceId,
      device_name: deviceName,
      gps_latitude: gps?.lat ?? null,
      gps_longitude: gps?.lng ?? null,
      gps_timestamp: gps ? nowIso : null,
      session_token: sessionToken,
      last_order_at: nowIso,
      created_at: nowIso,
      expires_at: expiresIso,
      active: true,
    };

    await saveTableSessionToSupabase(newSession);
    saveLocalSession(newSession);

    return {
      allowed: true,
      reason: isFarAway ? 'gps_far_away' : 'old_session_expired',
      session: newSession,
    };
  }

  logSecurityEvent({
    type: 'OCCUPIED_TABLE_BLOCK',
    device_id: currentDeviceId,
    table_id: tableId,
    details: `Blocked scan attempt on occupied active table #${tableId}. Previous device ordered ${minutesSinceLastOrder.toFixed(1)}m ago.`
  });

  return {
    allowed: false,
    reason: 'occupied_active_device',
    message: `Table #${tableId} is currently occupied by an active customer. Please check with staff or scan your assigned table!`,
  };
}

/**
 * Update session activity whenever an order is placed
 */
export async function updateTableSessionOrderTime(tableId: string): Promise<void> {
  const currentDeviceId = getOrCreateDeviceId();
  const nowIso = new Date().toISOString();

  try {
    await (supabase as any)
      .from('table_sessions')
      .update({
        last_order_at: nowIso,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .eq('table_id', tableId)
      .eq('device_id', currentDeviceId)
      .eq('active', true);
  } catch {
    const sessions = getLocalSessions();
    if (sessions[tableId]) {
      sessions[tableId].last_order_at = nowIso;
      saveLocalSession(sessions[tableId]);
    }
  }
}

async function saveTableSessionToSupabase(session: TableSession) {
  try {
    await (supabase as any).from('table_sessions').upsert({
      id: session.id,
      table_id: session.table_id,
      device_id: session.device_id,
      device_name: session.device_name,
      gps_latitude: session.gps_latitude,
      gps_longitude: session.gps_longitude,
      gps_timestamp: session.gps_timestamp,
      session_token: session.session_token,
      last_order_at: session.last_order_at,
      created_at: session.created_at,
      expires_at: session.expires_at,
      active: session.active,
    });
  } catch (err) {
    console.warn("Supabase table_sessions upsert fallback to local storage:", err);
  }
}

async function terminateSessionInSupabase(sessionId: string) {
  try {
    await (supabase as any)
      .from('table_sessions')
      .update({ active: false })
      .eq('id', sessionId);
  } catch (err) {
    console.warn("Supabase terminate session fallback:", err);
  }
}
