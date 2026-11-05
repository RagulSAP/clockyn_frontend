/**
 * ClockynMap — WEB implementation on Leaflet with OpenStreetMap tiles (Esri imagery for satellite).
 * Same props as the native map; markers are CSS pins (no image assets), so nothing breaks under bundling.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/theme';
import { DEFAULT_MAP_ZOOM, mapContentSignature, type ClockynMapProps } from './types';

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTRIBUTION = 'Imagery &copy; Esri, Maxar, Earthstar Geographics';

const MAP_STYLE_ID = 'clockyn-map-style';
/** Street tiles are toned to the app theme with CSS filters (no extra tile provider): muted in light, inverted graphite in dark. Satellite is left untouched. */
const MAP_CSS =
  '.clockyn-tiles-light{filter:grayscale(.55) contrast(.96) brightness(1.02)}' +
  '.clockyn-tiles-dark{filter:invert(1) hue-rotate(180deg) grayscale(.6) brightness(.82) contrast(.92)}' +
  '.leaflet-container.clockyn-dark{background:var(--cm-surface)}' +
  '.leaflet-container.clockyn-dark .leaflet-control-zoom a{background:var(--cm-elevated);color:var(--cm-text);border-color:var(--cm-border)}' +
  '.leaflet-container.clockyn-dark .leaflet-control-attribution{background:var(--cm-tabbar);color:var(--cm-text2)}' +
  '.leaflet-container.clockyn-dark .leaflet-control-attribution a{color:var(--cm-text2)}';

function ensureMapStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(MAP_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = MAP_STYLE_ID;
  el.textContent = MAP_CSS;
  document.head.appendChild(el);
}

function escapeText(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Readable label colour for a pin fill (theme colours are light in dark mode, so a fixed white label would vanish). */
function pinTextColor(fill: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fill.trim());
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.4 ? '#0a0a0a' : '#fff';
}

function pinIcon(color: string, label?: string): L.DivIcon {
  const text = label ? escapeText(label.slice(0, 2)) : '';
  const html =
    `<div style="position:relative;width:30px;height:40px">` +
    `<div style="position:absolute;left:3px;top:0;width:24px;height:24px;background:${escapeText(color)};border:2px solid #fff;` +
    `border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>` +
    `<div style="position:absolute;left:3px;top:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;` +
    `color:${pinTextColor(color)};font:700 11px/1 system-ui,sans-serif">${text}</div></div>`;
  return L.divIcon({ html, className: 'clockyn-pin', iconSize: [30, 40], iconAnchor: [15, 38], tooltipAnchor: [0, -34] });
}

export function ClockynMap(props: ClockynMapProps) {
  const {
    height,
    region,
    markers = [],
    polylines = [],
    circles = [],
    draggableMarker,
    fitToMarkers,
    mapType = 'standard',
    showUserLocation,
    style,
    testID,
  } = props;
  const theme = useTheme();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const userRef = useRef<L.CircleMarker | null>(null);

  // Keep callbacks in a ref so handlers bound once to Leaflet always call the latest props.
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  // ── create / destroy the map ──────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const map = L.map(host, { zoomControl: true, attributionControl: true }).setView(
      [region.latitude, region.longitude],
      region.zoom ?? DEFAULT_MAP_ZOOM,
    );
    mapRef.current = map;
    overlayRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => cb.current.onMapPress?.(e.latlng.lat, e.latlng.lng));
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null;
    observer?.observe(host);
    // The container may not have its final size on first paint.
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => {
      clearTimeout(t);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      tileRef.current = null;
      userRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; region updates are handled below
  }, []);

  // ── base layer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const satellite = mapType !== 'standard';
    ensureMapStyle();
    const container = map.getContainer();
    container.classList.toggle('clockyn-dark', theme.isDark);
    tileRef.current = L.tileLayer(satellite ? SAT_URL : OSM_URL, {
      attribution: satellite ? SAT_ATTRIBUTION : OSM_ATTRIBUTION,
      maxZoom: satellite ? 19 : 19,
      className: satellite ? '' : theme.isDark ? 'clockyn-tiles-dark' : 'clockyn-tiles-light',
    }).addTo(map);
  }, [mapType, theme.isDark]);

  // ── recentre on region change ────────────────────────────────────────────
  const regionKey = `${region.latitude}|${region.longitude}|${region.zoom ?? ''}`;
  const lastRegionKey = useRef(regionKey);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastRegionKey.current === regionKey) return;
    lastRegionKey.current = regionKey;
    // Leaflet silently drops a setView() issued while a zoom animation is running (even with animate:false), so a quick
    // second region change (e.g. the route arriving right after the selection) left the map on the old view. Zoom changes
    // therefore jump (reset); pure pans keep the animation.
    const zoomChanges = (region.zoom ?? map.getZoom()) !== map.getZoom();
    map.setView([region.latitude, region.longitude], region.zoom ?? map.getZoom(), zoomChanges ? ({ reset: true } as L.ZoomPanOptions) : { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regionKey encodes the three values
  }, [regionKey]);

  // ── markers / polylines / circles ────────────────────────────────────────
  const signature = useMemo(() => mapContentSignature({ markers, polylines, circles, draggableMarker }), [markers, polylines, circles, draggableMarker]);
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const points: L.LatLngExpression[] = [];

    circles.forEach((c) => {
      const color = c.color ?? theme.colors.primary;
      L.circle([c.latitude, c.longitude], { radius: c.radius, color, weight: 2, fillColor: color, fillOpacity: 0.15 }).addTo(group);
    });
    polylines.forEach((l) => {
      if (l.coords.length === 0) return;
      const latlngs = l.coords.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
      L.polyline(latlngs, { color: l.color ?? theme.colors.info, weight: l.width ?? 4 }).addTo(group);
      points.push(...latlngs);
    });
    markers.forEach((m) => {
      const marker = L.marker([m.latitude, m.longitude], {
        icon: pinIcon(m.color ?? theme.colors.primary, m.label),
        draggable: m.draggable ?? !!draggableMarker,
        title: m.title,
        keyboard: true,
      }).addTo(group);
      const tip = [m.title, m.description].filter(Boolean).map((s) => escapeText(String(s))).join('<br/>');
      if (tip) marker.bindTooltip(tip, { direction: 'top' });
      marker.on('click', () => cb.current.onMarkerPress?.(m.id));
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        cb.current.onMarkerDragEnd?.(m.id, p.lat, p.lng);
      });
      points.push([m.latitude, m.longitude]);
    });

    if (fitToMarkers && points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 17 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures all drawn content
  }, [signature, fitToMarkers, theme.colors.primary, theme.colors.info]);

  // ── user position (blue dot) ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showUserLocation || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled || !mapRef.current) return;
        userRef.current?.remove();
        userRef.current = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: theme.colors.info,
          fillOpacity: 1,
        }).addTo(mapRef.current);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
      userRef.current?.remove();
      userRef.current = null;
    };
  }, [showUserLocation, theme.colors.info]);

  return (
    <div
      ref={hostRef}
      data-testid={testID}
      style={
        {
          '--cm-surface': theme.colors.surface,
          '--cm-elevated': theme.colors.surfaceElevated,
          '--cm-text': theme.colors.text,
          '--cm-text2': theme.colors.textSecondary,
          '--cm-border': theme.colors.borderStrong,
          '--cm-tabbar': theme.colors.tabBar,
          height,
          width: '100%',
          overflow: 'hidden',
          zIndex: 0,
          position: 'relative',
          ...(StyleSheet.flatten(style as object) as unknown as React.CSSProperties | undefined),
        } as React.CSSProperties
      }
    />
  );
}
