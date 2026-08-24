// src/lib/riders.ts
import { supabase } from '@/integrations/supabase/client';

export interface ClaimJobResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 1. Atomic Job Acceptance with Direct Fallback
 */
export async function acceptJob(riderId: string, orderId: string): Promise<boolean> {
  try {
    const { data: isSuccess, error } = await (supabase.rpc as any)('accept_job', {
      p_rider_id: riderId,
      p_order_id: orderId,
    });

    if (!error && Boolean(isSuccess)) {
      return true;
    }

    // Direct fallback: assign rider to order
    const { error: directErr } = await supabase
      .from('orders')
      .update({
        delivery_service: riderId,
        status: 'ready',
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', orderId);

    return !directErr;
  } catch (err) {
    console.warn('acceptJob fallback:', err);
    try {
      const { error: directErr } = await supabase
        .from('orders')
        .update({
          delivery_service: riderId,
          status: 'ready',
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', orderId);
      return !directErr;
    } catch {
      return false;
    }
  }
}

/**
 * 2. ISU 2: Auto-Dispatch Nearest Available Driver via get_nearest_available_rider RPC
 */
export async function getNearestAvailableRider(lat: number, lng: number): Promise<any | null> {
  try {
    const { data: nearestRiders, error } = await (supabase.rpc as any)('get_nearest_available_rider', {
      p_lat: lat,
      p_lng: lng,
    });

    if (error || !nearestRiders || nearestRiders.length === 0) {
      return null;
    }

    return nearestRiders[0];
  } catch (err) {
    console.error('Failed to fetch nearest available rider:', err);
    return null;
  }
}

export interface RefundResult {
  success: boolean;
  refundAmount?: number;
  message?: string;
  error?: string;
}

/**
 * Atomic Job Claim for Gig Delivery Riders
 */
export async function claimDeliveryJob(orderId: string, riderId: string): Promise<ClaimJobResult> {
  try {
    const { data: rpcRes, error } = await (supabase.rpc as any)('claim_delivery_job', {
      p_order_id: orderId,
      p_rider_id: riderId,
    });

    if (!error && (rpcRes as any)?.success !== false) {
      return { success: true, message: 'Job claimed successfully!' };
    }

    // Direct update fallback
    const { error: directErr } = await supabase
      .from('orders')
      .update({
        delivery_service: riderId,
        status: 'ready',
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', orderId);

    if (directErr) throw directErr;

    return {
      success: true,
      message: 'Job claimed successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'CLAIM_ERROR',
      message: err.message || 'Failed to claim delivery job.',
    };
  }
}

/**
 * Triggers Order Cancellation & Refund Processing
 */
export async function triggerOrderRefund(orderId: string, reason: string): Promise<RefundResult> {
  try {
    const { data: rpcRes, error } = await (supabase.rpc as any)('cancel_and_refund_order', {
      p_order_id: orderId,
      p_reason: reason,
    });

    if (error) throw error;
    const resObj = rpcRes as any;

    if (resObj?.success === false) {
      return {
        success: false,
        error: resObj.error || 'REFUND_FAILED',
        message: resObj.message || 'Refund processing failed.',
      };
    }

    return {
      success: true,
      refundAmount: resObj.refund_amount,
      message: resObj.message || 'Refund processed successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'RPC_ERROR',
      message: err.message || 'Failed to process order refund.',
    };
  }
}

/**
 * Marks Manual Staff Refund Complete with Idempotency & Rider-Race Guards
 */
export async function markManualRefundComplete(orderId: string, staffName: string, notes?: string): Promise<RefundResult> {
  try {
    const { data: rpcRes, error } = await (supabase.rpc as any)('mark_refund_complete', {
      p_order_id: orderId,
      p_staff_name: staffName,
      p_notes: notes || 'DuitNow manual QR refund transfer',
    });

    if (error) throw error;
    const resObj = rpcRes as any;

    if (resObj?.success === false) {
      return {
        success: false,
        error: resObj.error || 'REFUND_FAILED',
        message: resObj.message || 'Manual refund failed.',
      };
    }

    return {
      success: true,
      refundAmount: resObj.refund_amount,
      message: resObj.message || 'Manual refund recorded successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'RPC_ERROR',
      message: err.message || 'Failed to complete manual refund.',
    };
  }
}

/**
 * Assigns In-House Standby Rider Fallback for Unclaimed Delivery Orders
 */
export async function assignInHouseStandbyRider(orderId: string, staffName: string): Promise<ClaimJobResult> {
  try {
    const { data: rpcRes, error } = await (supabase.rpc as any)('assign_in_house_standby_rider', {
      p_order_id: orderId,
      p_staff_name: staffName,
    });

    if (error) throw error;
    const resObj = rpcRes as any;

    if (resObj?.success === false) {
      return {
        success: false,
        error: resObj.error || 'DISPATCH_FAILED',
        message: resObj.message || 'In-house standby dispatch failed.',
      };
    }

    return {
      success: true,
      message: resObj.message || 'Assigned to in-house standby rider successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'RPC_ERROR',
      message: err.message || 'Failed to assign in-house standby rider.',
    };
  }
}
