/**
 * ClockynMap — NATIVE (Android / iOS) implementation on react-native-maps.
 * Android uses Google Maps (needs the key from app config); iOS uses Apple Maps.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View, type LayoutChangeEvent } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import { useTheme } from '@/theme';
import { DEFAULT_MAP_ZOOM, mapContentSignature, withAlpha, zoomToLongitudeDelta, type ClockynMapProps } from './types';

/**
 * Android builds without a Google Maps API key (no `GOOGLE_MAPS_API_KEY` at build time -> no
 * `com.google.android.geo.API_KEY` manifest meta-data) make the Google Maps SDK throw "API key not found" when a
 * map view is created, which kills the app natively (a JS error boundary cannot catch it). Show a placeholder
 * instead. Expo Go ships its own key, so it is exempt. `app.config.ts` publishes `extra.googleMapsKeyConfigured`
 * because `android.config` is stripped from the runtime manifest.
 */
function isGoogleMapsUnavailable(): boolean {
  if (Platform.OS !== 'android') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return Constants.expoConfig?.extra?.googleMapsKeyConfigured !== true;
}

export function ClockynMap(props: ClockynMapProps) {
  const theme = useTheme();
  if (isGoogleMapsUnavailable()) {
    return (
      <View
        style={[{ height: props.height as number, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: theme.colors.surface }, props.style]}
        testID={props.testID}
      >
        <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>Map unavailable: this build has no Google Maps key.</Text>
      </View>
    );
  }
  return <NativeMap {...props} />;
}

function NativeMap(props: ClockynMapProps) {
  const {
    height,
    region,
    markers = [],
    polylines = [],
    circles = [],
    onMapPress,
    onMarkerPress,
    onMarkerDragEnd,
    draggableMarker,
    fitToMarkers,
    mapType = 'standard',
    showUserLocation,
    style,
    testID,
  } = props;
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);

  const zoom = region.zoom ?? DEFAULT_MAP_ZOOM;
  const lngDelta = zoomToLongitudeDelta(zoom, width || 360);
  const targetRegion = useMemo<Region>(
    () => ({ latitude: region.latitude, longitude: region.longitude, latitudeDelta: lngDelta, longitudeDelta: lngDelta }),
    [region.latitude, region.longitude, lngDelta],
  );

  const [initial] = useState(targetRegion);

  // Re-centre when the requested region changes (not on every render).
  const regionKey = `${region.latitude}|${region.longitude}|${region.zoom ?? ''}`;
  const lastRegionKey = useRef(regionKey);
  useEffect(() => {
    if (!ready || lastRegionKey.current === regionKey) return;
    lastRegionKey.current = regionKey;
    mapRef.current?.animateToRegion(targetRegion, 350);
  }, [regionKey, ready, targetRegion]);

  const signature = mapContentSignature({ markers, polylines, circles, draggableMarker });
  useEffect(() => {
    if (!ready || !fitToMarkers) return;
    const coords = [...markers, ...polylines.flatMap((l) => l.coords)].map((c) => ({ latitude: c.latitude, longitude: c.longitude }));
    if (coords.length < 2) return;
    mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature captures markers/polylines
  }, [signature, ready, fitToMarkers]);

  const handlePress = useCallback(
    (e: MapPressEvent) => {
      if (e.nativeEvent.action === 'marker-press') return;
      const { latitude, longitude } = e.nativeEvent.coordinate;
      onMapPress?.(latitude, longitude);
    },
    [onMapPress],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={[{ height: height as number, overflow: 'hidden' }, style]} onLayout={onLayout} testID={testID}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initial}
        mapType={mapType === 'satellite' ? 'satellite' : mapType === 'hybrid' ? 'hybrid' : 'standard'}
        showsUserLocation={!!showUserLocation}
        showsMyLocationButton={!!showUserLocation}
        zoomControlEnabled
        onMapReady={() => setReady(true)}
        onPress={handlePress}
      >
        {circles.map((c) => (
          <Circle
            key={c.id}
            center={{ latitude: c.latitude, longitude: c.longitude }}
            radius={c.radius}
            strokeColor={c.color ?? theme.colors.primary}
            fillColor={withAlpha(c.color ?? theme.colors.primary, 0.2)}
            strokeWidth={2}
          />
        ))}
        {polylines.map((l) => (
          <Polyline key={l.id} coordinates={l.coords} strokeColor={l.color ?? theme.colors.info} strokeWidth={l.width ?? 4} />
        ))}
        {markers.map((m) => (
          <Marker
            key={m.id}
            identifier={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.description ?? m.label}
            pinColor={m.color ?? theme.colors.primary}
            draggable={m.draggable ?? !!draggableMarker}
            onPress={() => onMarkerPress?.(m.id)}
            onDragEnd={(e) => onMarkerDragEnd?.(m.id, e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
          />
        ))}
      </MapView>
    </View>
  );
}
