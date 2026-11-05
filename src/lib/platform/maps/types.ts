import type { StyleProp, ViewStyle } from 'react-native';

export type LatLng = { latitude: number; longitude: number };

export type MapRegion = LatLng & {
  /** Web-mercator zoom level (1 = world … 19 = building). Default 15. */
  zoom?: number;
};

export type MapMarkerSpec = LatLng & {
  id: string;
  title?: string;
  /** Secondary text (native callout / web tooltip). */
  description?: string;
  /** Pin colour (any CSS colour string). */
  color?: string;
  /** Short text drawn in the pin (web) / used as description fallback (native). */
  label?: string;
  /** Overrides `draggableMarker` for this marker. */
  draggable?: boolean;
};

export type MapPolylineSpec = {
  id: string;
  coords: LatLng[];
  color?: string;
  width?: number;
};

/** Translucent radius circle (e.g. the branch attendance radius). */
export type MapCircleSpec = LatLng & {
  id: string;
  /** metres */
  radius: number;
  color?: string;
};

export type MapType = 'standard' | 'satellite' | 'hybrid';

export type ClockynMapProps = {
  height: number | string;
  region: MapRegion;
  markers?: MapMarkerSpec[];
  polylines?: MapPolylineSpec[];
  circles?: MapCircleSpec[];
  onMapPress?: (latitude: number, longitude: number) => void;
  onMarkerPress?: (id: string) => void;
  /** Called when a draggable marker is released. */
  onMarkerDragEnd?: (id: string, latitude: number, longitude: number) => void;
  /** Makes every marker draggable (per-marker `draggable` wins). */
  draggableMarker?: boolean;
  /** Fit the viewport around all markers + polyline points whenever they change. */
  fitToMarkers?: boolean;
  mapType?: MapType;
  /** Show the device position (blue dot). */
  showUserLocation?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const DEFAULT_MAP_ZOOM = 15;

/** Stable signature of everything that is drawn, used to avoid needless layer rebuilds / re-fits. */
export function mapContentSignature(p: Pick<ClockynMapProps, 'markers' | 'polylines' | 'circles' | 'draggableMarker'>): string {
  return JSON.stringify([
    (p.markers ?? []).map((m) => [m.id, m.latitude, m.longitude, m.title, m.description, m.color, m.label, m.draggable]),
    (p.polylines ?? []).map((l) => [l.id, l.color, l.width, l.coords.length, l.coords[0], l.coords[l.coords.length - 1]]),
    (p.circles ?? []).map((c) => [c.id, c.latitude, c.longitude, c.radius, c.color]),
    !!p.draggableMarker,
  ]);
}

/** Longitude span (degrees) visible at a web-mercator zoom for a map `widthPx` wide. */
export function zoomToLongitudeDelta(zoom: number, widthPx: number): number {
  return (360 * (widthPx / 256)) / Math.pow(2, zoom);
}

/** Adds an alpha channel to a `#RRGGBB` colour (other colour formats are returned unchanged). */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
  return `${color}${a}`;
}
