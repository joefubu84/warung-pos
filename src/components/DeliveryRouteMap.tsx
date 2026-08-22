// src/components/DeliveryRouteMap.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { 
  Navigation, 
  MapPin, 
  Store, 
  Compass, 
  Maximize2, 
  ExternalLink,
  Bike,
  Route as RouteIcon,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const WARUNG_COORDS = {
  lat: 5.9284153,
  lng: 116.1146463,
  name: 'Warung JNJ (Penampang)',
  address: 'a17, Jln Datuk Panglima Banting, 89500 Penampang, Sabah',
  googleMapsUrl: 'https://www.google.com/maps/dir//Warung+JNJ,+a17,+Jln+Datuk+Panglima+Banting,+89500+Penampang,+Sabah/@5.9810544,116.0768506,9z/data=!4m8!4m7!1m0!1m5!1m1!1s0x323b692e917f9eb1:0x66ccb58dff90bc87!2m2!1d116.1146463!2d5.9284153?entry=ttu'
};

// Strict Sabah / Greater KK & Penampang Bounding Box to prevent glitched locations outside Malaysia
export const SABAH_BOUNDS_COORDS = {
  minLat: 4.0,
  maxLat: 7.5,
  minLng: 114.8,
  maxLng: 119.5,
};

export const isWithinSabah = (lat: number, lng: number): boolean => {
  return (
    lat >= SABAH_BOUNDS_COORDS.minLat &&
    lat <= SABAH_BOUNDS_COORDS.maxLat &&
    lng >= SABAH_BOUNDS_COORDS.minLng &&
    lng <= SABAH_BOUNDS_COORDS.maxLng
  );
};

export interface DeliveryRouteMapProps {
  origin?: { lat: number; lng: number; title?: string };
  destination: { lat: number; lng: number; address?: string };
  interactive?: boolean;
  showZoneCircle?: boolean;
  riderLocation?: { lat: number; lng: number } | null;
  deliveryStatus?: string;
  className?: string;
  height?: string | number;
  onDestinationChange?: (lat: number, lng: number, addressText?: string) => void;
  onRouteCalculated?: (data: { distanceKm: number; durationMins: number; polyline: [number, number][] }) => void;
  showNavigationButtons?: boolean;
  allowFullscreen?: boolean;
}

export const DeliveryRouteMap: React.FC<DeliveryRouteMapProps> = React.memo(({
  origin = WARUNG_COORDS,
  destination,
  interactive = false,
  showZoneCircle = true,
  riderLocation,
  deliveryStatus,
  className = '',
  height = '320px',
  onDestinationChange,
  onRouteCalculated,
  showNavigationButtons = true,
  allowFullscreen = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Layer references
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineOuterRef = useRef<L.Polyline | null>(null);
  const routePolylineInnerRef = useRef<L.Polyline | null>(null);
  const zoneCircleRef = useRef<L.Circle | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const isInternalUpdateRef = useRef<boolean>(false);
  const lastCenteredCoordRef = useRef<{ lat: number; lng: number }>({
    lat: destination?.lat || origin.lat,
    lng: destination?.lng || origin.lng
  });

  const [mapViewMode, setMapViewMode] = useState<'streets' | 'satellite'>('satellite');
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [roadStepsSummary, setRoadStepsSummary] = useState<string>('');

  // Fallback Haversine calculation
  const calculateStraightKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  };

  // Custom DivIcon Markers
  const createStoreIcon = () => {
    return L.divIcon({
      className: 'custom-store-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
          <div style="position: absolute; width: 38px; height: 38px; background: rgba(245, 158, 11, 0.35); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 32px; height: 32px; background: #f59e0b; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
  };

  const createDestIcon = (isDraggable: boolean) => {
    return L.divIcon({
      className: 'custom-dest-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
          <div style="position: absolute; width: 40px; height: 40px; background: rgba(16, 185, 129, 0.35); border-radius: 50%; animation: pulse 2s infinite;"></div>
          <div style="position: relative; width: 34px; height: 34px; background: #10b981; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          ${isDraggable ? `<div style="position: absolute; bottom: -14px; background: #0f172a; color: #10b981; border: 1px solid #10b981; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">TARIK PIN</div>` : ''}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  const createRiderIcon = () => {
    return L.divIcon({
      className: 'custom-rider-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
          <div style="position: absolute; width: 38px; height: 38px; background: rgba(56, 189, 248, 0.4); border-radius: 50%; animation: ping 1.5s infinite;"></div>
          <div style="position: relative; width: 32px; height: 32px; background: #0284c7; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.6);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18.5" cy="17.5" r="3.5"/>
              <circle cx="5.5" cy="17.5" r="3.5"/>
              <circle cx="15" cy="5" r="1"/>
              <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
  };

  // Reverse Geocoding Helper restricted to Malaysia with House & Building Number Detection
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&countrycodes=my&addressdetails=1`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const houseNo = addr.house_number || addr.housenumber || addr.unit || addr.building || '';
        const road = addr.road || addr.street || addr.residential || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || '';
        const city = addr.city || addr.town || 'Penampang';
        const state = addr.state || 'Sabah';
        const postcode = addr.postcode || '';

        const parts = [
          houseNo ? `No. ${houseNo}` : '',
          road,
          suburb,
          city,
          postcode,
          state
        ].filter(Boolean);

        if (parts.length > 0) return parts.join(', ');
      }
      if (data && data.display_name) {
        return data.display_name;
      }
    } catch (e) {
      console.warn('Reverse geocoding error:', e);
    }
    return `Lokasi (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Initialize Map with strict Sabah/Malaysia Bounding Box & Max Viscosity
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const sabahBounds = L.latLngBounds(
        L.latLng(SABAH_BOUNDS_COORDS.minLat, SABAH_BOUNDS_COORDS.minLng),
        L.latLng(SABAH_BOUNDS_COORDS.maxLat, SABAH_BOUNDS_COORDS.maxLng)
      );

      const map = L.map(mapContainerRef.current, {
        center: [origin.lat, origin.lng],
        zoom: 13,
        minZoom: 10,
        maxZoom: 18,
        maxBounds: sabahBounds,
        maxBoundsViscosity: 1.0, // 100% strict lock preventing user from dragging outside Sabah
        zoomControl: true,
        attributionControl: false,
      });

      // Initialize Google Hybrid Satellite (with sharp road names & POI overlay)
      const initialLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        minZoom: 10,
        subdomains: ['0', '1', '2', '3'],
        bounds: sabahBounds
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      mapInstanceRef.current = map;

      // Mobile-friendly Center Pin Map Dragging (Grab / Google Maps style)
      if (interactive && onDestinationChange) {
        let debounceTimer: any = null;

        map.on('movestart', () => {
          setIsMapMoving(true);
        });

        map.on('moveend', () => {
          setIsMapMoving(false);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            if (!mapInstanceRef.current) return;
            const center = mapInstanceRef.current.getCenter();
            if (!isWithinSabah(center.lat, center.lng)) {
              toast.error('Sila gerakkan peta ke dalam kawasan Sabah / Penampang.');
              return;
            }
            lastCenteredCoordRef.current = { lat: center.lat, lng: center.lng };
            isInternalUpdateRef.current = true;
            const addr = await reverseGeocode(center.lat, center.lng);
            if (onDestinationChange) {
              onDestinationChange(center.lat, center.lng, addr);
            }
          }, 300);
        });

        map.on('click', async (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          if (!isWithinSabah(lat, lng)) {
            toast.error('Sila pilih lokasi di dalam kawasan Sabah / Penampang.');
            return;
          }
          lastCenteredCoordRef.current = { lat, lng };
          map.panTo([lat, lng], { animate: true, duration: 0.5 });
        });
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Dynamically switch between Google Satellite (Hybrid) and Google Road Maps
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const sabahBounds = L.latLngBounds(
      L.latLng(SABAH_BOUNDS_COORDS.minLat, SABAH_BOUNDS_COORDS.minLng),
      L.latLng(SABAH_BOUNDS_COORDS.maxLat, SABAH_BOUNDS_COORDS.maxLng)
    );

    // lyrs=y: Google Hybrid Satellite (Real photographic satellite imagery with road & business labels)
    // lyrs=m: Google Standard Road Map
    const tileUrl = mapViewMode === 'satellite'
      ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      minZoom: 10,
      subdomains: ['0', '1', '2', '3'],
      bounds: sabahBounds
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [mapViewMode]);

  // Fetch Real Road Route from OSRM
  const fetchRoadRoute = useCallback(async (
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number
  ) => {
    setIsLoadingRoute(true);
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // OSRM full GeoJSON road geometry query
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();

      let polylinePoints: [number, number][] = [];
      let distKm = 0;
      let durMins = 0;
      let summaryText = '';

      if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        distKm = Math.round((route.distance / 1000) * 10) / 10;
        durMins = Math.max(5, Math.ceil(route.duration / 60) + 3);
        
        // Extract road name summary
        const legs = route.legs?.[0];
        if (legs && legs.steps) {
          const majorRoads = legs.steps
            .map((s: any) => s.name)
            .filter((n: string) => n && n.length > 2 && !n.includes('unnamed'))
            .slice(0, 2);
          if (majorRoads.length > 0) {
            summaryText = `melalui ${Array.from(new Set(majorRoads)).join(' / ')}`;
          }
        }

        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        if (route.geometry && route.geometry.coordinates) {
          polylinePoints = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        }
      } else {
        // Fallback: Haversine straight line with road estimation
        const straight = calculateStraightKm(startLat, startLng, endLat, endLng);
        distKm = Math.round(straight * 1.35 * 10) / 10;
        durMins = Math.max(5, Math.ceil(distKm * 2));
        polylinePoints = [
          [startLat, startLng],
          [(startLat + endLat) / 2 + 0.002, (startLng + endLng) / 2 - 0.002],
          [endLat, endLng]
        ];
      }

      setRouteDistance(distKm);
      setRouteDuration(durMins);
      setRoadStepsSummary(summaryText);

      if (onRouteCalculated) {
        onRouteCalculated({ distanceKm: distKm, durationMins: durMins, polyline: polylinePoints });
      }

      // Draw or Update Glowing Real-Road Polylines
      if (routePolylineOuterRef.current) {
        routePolylineOuterRef.current.remove();
      }
      if (routePolylineInnerRef.current) {
        routePolylineInnerRef.current.remove();
      }

      if (polylinePoints.length > 0) {
        // Outer glowing path
        routePolylineOuterRef.current = L.polyline(polylinePoints, {
          color: '#10b981',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Inner solid road navigation line
        routePolylineInnerRef.current = L.polyline(polylinePoints, {
          color: '#059669',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Auto Fit bounds to show the complete road route ONLY in read-only mode (not during user dragging)
        if (!interactive) {
          const bounds = L.latLngBounds(polylinePoints);
          bounds.extend([startLat, startLng]);
          bounds.extend([endLat, endLng]);
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
        }
      }
    } catch (err) {
      console.warn('Road routing fetch error:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [onRouteCalculated, interactive]);

  // Update Markers & Zone Circle when coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Origin Marker (Warung J&J)
    if (!originMarkerRef.current) {
      originMarkerRef.current = L.marker([origin.lat, origin.lng], {
        icon: createStoreIcon(),
      }).addTo(map);
      originMarkerRef.current.bindPopup(`
        <div style="font-family: inherit; font-size: 11px; padding: 2px;">
          <strong style="color: #f59e0b; display: block; font-size: 12px;">🏪 ${origin.title || origin.name || 'Warung J&J'}</strong>
          <span style="color: #94a3b8;">Pusat Masakan & Pengambilan Makanan</span>
        </div>
      `);
    } else {
      originMarkerRef.current.setLatLng([origin.lat, origin.lng]);
    }

    // 2. Zone Circle (15km radius)
    if (showZoneCircle) {
      if (!zoneCircleRef.current) {
        zoneCircleRef.current = L.circle([origin.lat, origin.lng], {
          radius: 15000, // 15km
          color: '#10b981',
          weight: 1.5,
          dashArray: '5, 8',
          fillColor: '#10b981',
          fillOpacity: 0.04
        }).addTo(map);
      } else {
        zoneCircleRef.current.setLatLng([origin.lat, origin.lng]);
      }
    }

    // 3. Destination Marker (Customer)
    if (destination && destination.lat && destination.lng) {
      if (interactive) {
        const center = map.getCenter();
        const distFromCenter = calculateStraightKm(center.lat, center.lng, destination.lat, destination.lng);
        const distFromLast = calculateStraightKm(lastCenteredCoordRef.current.lat, lastCenteredCoordRef.current.lng, destination.lat, destination.lng);

        // Only pan map if update was triggered externally from search selection AND distance is substantial (> 200m)
        if (!isInternalUpdateRef.current && distFromCenter > 0.2 && distFromLast > 0.2 && !isMapMoving) {
          lastCenteredCoordRef.current = { lat: destination.lat, lng: destination.lng };
          map.panTo([destination.lat, destination.lng], { animate: true, duration: 0.5 });
        }
        isInternalUpdateRef.current = false;

        // Remove static Leaflet marker so only the mobile-friendly floating center pin is active
        if (destMarkerRef.current) {
          destMarkerRef.current.remove();
          destMarkerRef.current = null;
        }
      } else {
        // In read-only mode (rider/tracking), show the static destination marker
        if (!destMarkerRef.current) {
          destMarkerRef.current = L.marker([destination.lat, destination.lng], {
            icon: createDestIcon(false),
            draggable: false
          }).addTo(map);
        } else {
          destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        }

        destMarkerRef.current.bindPopup(`
          <div style="font-family: inherit; font-size: 11px; padding: 2px;">
            <strong style="color: #10b981; display: block; font-size: 12px;">📍 Lokasi Penghantaran</strong>
            <span style="color: #cbd5e1;">${destination.address || 'Alamat Pelanggan'}</span>
          </div>
        `);
      }

      // Calculate & Render Real Road Route
      fetchRoadRoute(origin.lat, origin.lng, destination.lat, destination.lng);
    }

    // 4. Rider Marker (if active/moving)
    if (riderLocation && riderLocation.lat && riderLocation.lng) {
      if (!riderMarkerRef.current) {
        riderMarkerRef.current = L.marker([riderLocation.lat, riderLocation.lng], {
          icon: createRiderIcon()
        }).addTo(map);
      } else {
        riderMarkerRef.current.setLatLng([riderLocation.lat, riderLocation.lng]);
      }
      riderMarkerRef.current.bindPopup(`
        <div style="font-family: inherit; font-size: 11px; padding: 2px;">
          <strong style="color: #38bdf8; display: block; font-size: 12px;">🛵 Rider Warung J&J</strong>
          <span style="color: #94a3b8;">Sedang dalam perjalanan</span>
        </div>
      `);
    } else if (riderMarkerRef.current) {
      riderMarkerRef.current.remove();
      riderMarkerRef.current = null;
    }
  }, [origin.lat, origin.lng, destination.lat, destination.lng, interactive, showZoneCircle, riderLocation, fetchRoadRoute]);

  // Recenter Handler
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (destination?.lat && destination?.lng) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([origin.lat, origin.lng], 13);
    }
  };

  // Open in Google Maps Navigation
  const openGoogleMaps = () => {
    if (destination?.lat && destination?.lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`,
        '_blank'
      );
    }
  };

  // Open in Waze Navigation
  const openWaze = () => {
    if (destination?.lat && destination?.lng) {
      window.open(`https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`, '_blank');
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl transition-all ${isFullscreen ? 'fixed inset-4 z-50 h-auto' : ''} ${className}`}>
      
      {/* MAP CONTAINER */}
      <div 
        ref={mapContainerRef} 
        style={{ height: isFullscreen ? '100%' : height, width: '100%', minHeight: '260px' }} 
        className="z-0"
      />

      {/* TOP FLOATING ROUTE STATS HUD */}
      <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg pointer-events-auto flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <RouteIcon className="w-3.5 h-3.5" />
            <span>{isLoadingRoute ? 'Mengira...' : `${routeDistance || 0} km`}</span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center gap-1.5 text-sky-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{isLoadingRoute ? '...' : `~${routeDuration || 0} min`}</span>
          </div>

          {roadStepsSummary && (
            <>
              <span className="hidden sm:inline text-slate-600">|</span>
              <span className="hidden sm:inline text-[10px] text-slate-300 font-normal truncate max-w-[160px]">
                {roadStepsSummary}
              </span>
            </>
          )}
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Satellite vs Street View Mode Switcher */}
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setMapViewMode(prev => prev === 'satellite' ? 'streets' : 'satellite')}
            className={`h-8 px-2.5 rounded-xl border font-bold font-mono text-xs shadow-lg flex items-center gap-1.5 transition-all ${
              mapViewMode === 'satellite'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                : 'bg-slate-900/90 border-slate-700 text-sky-300 hover:bg-slate-800'
            }`}
            title="Tukar Paparan Satelit / Peta Standard"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{mapViewMode === 'satellite' ? 'Satelit 🛰️' : 'Peta 🗺️'}</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={handleRecenter}
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-lg"
            title="Pusatkan Peta"
          >
            <Compass className="w-4 h-4" />
          </Button>

          {allowFullscreen && (
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-lg"
              title="Skrin Penuh"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* MOBILE-FRIENDLY FIXED CENTER PIN (GRAB / GOOGLE MAPS STYLE) */}
      {interactive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-20 flex flex-col items-center select-none">
          {/* FLOATING ADDRESS/HINT PILL */}
          <div 
            className={`mb-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap shadow-2xl transition-all duration-300 border backdrop-blur-md flex items-center gap-1.5 ${
              isMapMoving
                ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 scale-105 -translate-y-2 shadow-[0_10px_25px_rgba(245,158,11,0.4)]'
                : 'bg-slate-950/90 text-emerald-300 border-emerald-500/60 scale-100 translate-y-0 shadow-[0_10px_25px_rgba(16,185,129,0.3)]'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 ${isMapMoving ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
            <span className="max-w-[200px] truncate">
              {isMapMoving ? 'Lepaskan untuk tetapkan lokasi...' : (destination?.address ? destination.address.split(',')[0] : 'Lokasi Terpilih 📍')}
            </span>
          </div>

          {/* PIN BODY */}
          <div 
            className={`relative flex items-center justify-center transition-all duration-300 ${
              isMapMoving ? '-translate-y-3 scale-110' : 'translate-y-0 scale-100'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
              <MapPin className="w-6 h-6 fill-white text-emerald-600" />
            </div>
            {/* PIN NEEDLE POINT */}
            <div className="absolute -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-emerald-500" />
          </div>

          {/* GROUND TARGET SHADOW / PULSE RING */}
          <div className="relative mt-2 flex items-center justify-center">
            <div className={`w-4 h-2 bg-black/60 rounded-full blur-[1px] transition-all duration-300 ${isMapMoving ? 'scale-75 opacity-40' : 'scale-100 opacity-90'}`} />
            <div className={`absolute w-7 h-7 rounded-full border border-emerald-400/60 transition-all ${isMapMoving ? 'scale-125 opacity-70 animate-ping' : 'scale-100 opacity-30'}`} />
          </div>
        </div>
      )}

      {/* INTERACTIVE HINT BANNER */}
      {interactive && (
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex items-center justify-between gap-2">
          <div className="bg-slate-950/90 backdrop-blur-md border border-emerald-500/40 px-3 py-1.5 rounded-xl shadow-lg pointer-events-auto flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            <span>Gerakkan peta untuk tepatkan pin lokasi penghantaran 📍</span>
          </div>
        </div>
      )}

      {/* QUICK TURN-BY-TURN NAVIGATION BUTTONS */}
      {showNavigationButtons && !interactive && (
        <div className="absolute bottom-3 right-3 z-10 pointer-events-auto flex items-center gap-1.5">
          <Button
            size="sm"
            type="button"
            onClick={openGoogleMaps}
            className="h-8 px-2.5 bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-sky-400 text-xs font-mono font-bold rounded-xl shadow-xl flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Google Maps</span>
          </Button>

          <Button
            size="sm"
            type="button"
            onClick={openWaze}
            className="h-8 px-2.5 bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-cyan-400 text-xs font-mono font-bold rounded-xl shadow-xl flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Waze</span>
          </Button>
        </div>
      )}
    </div>
  );
});

DeliveryRouteMap.displayName = 'DeliveryRouteMap';

