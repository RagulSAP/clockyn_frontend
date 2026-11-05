import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { useBreakpoint } from '@/components/layout';
import { Button, Card, Icon, Modal, SegmentedControl, Spinner, Text } from '@/components/ui';
import { reverseGeocode } from '@/lib/platform/geocode';
import { ClockynMap, type LatLng, type MapType } from '@/lib/platform/maps';
import { spacing, useTheme } from '@/theme';

import { FALLBACK_MAP_CENTER, formatGps } from '../utils/branchForm';

export type PickedLocation = LatLng & { address: string | null };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Pin shown when the picker opens (stored coordinates in edit mode, the current GPS fix in add mode). */
  startPin: LatLng | null;
  /** Radius circle drawn around the pin, metres. */
  radius: number;
  /** "Update Location" when the branch already has GPS, otherwise "Save Location". */
  confirmLabel: 'Save Location' | 'Update Location';
  onConfirm: (location: PickedLocation) => void;
};

const MAP_TYPES = [
  { label: 'Map', value: 'standard' as MapType },
  { label: 'Satellite', value: 'hybrid' as MapType },
];

/**
 * Map picker of the branch form: tap the map or drag the pin to choose the branch location. The confirm button
 * is available as soon as a pin exists (v1 only offered it after the first tap). Works on native maps and Leaflet.
 */
export function LocationPickerModal({ visible, onClose, startPin, radius, confirmLabel, onConfirm }: Props) {
  const { colors } = useTheme();
  const { isPhone } = useBreakpoint();
  const [pin, setPin] = useState<LatLng | null>(startPin);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [address, setAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const requestId = useRef(0);

  const lookup = useCallback((at: LatLng) => {
    const id = ++requestId.current;
    void reverseGeocode(at.latitude, at.longitude)
      .then((text) => {
        if (id === requestId.current) setAddress(text);
      })
      .finally(() => {
        if (id === requestId.current) setResolving(false);
      });
  }, []);

  // (Re)opening starts from the given pin (state reset while rendering, per the React "adjust state on prop change" pattern).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPin(startPin);
      setAddress(null);
      setResolving(startPin !== null);
    }
  }

  const startLat = startPin?.latitude;
  const startLng = startPin?.longitude;
  useEffect(() => {
    requestId.current += 1; // drop lookups of a previous opening
    if (visible && startLat !== undefined && startLng !== undefined) lookup({ latitude: startLat, longitude: startLng });
  }, [visible, startLat, startLng, lookup]);

  const place = useCallback(
    (latitude: number, longitude: number) => {
      const next = { latitude, longitude };
      setPin(next);
      setAddress(null);
      setResolving(true);
      lookup(next);
    },
    [lookup],
  );

  const center = pin ?? FALLBACK_MAP_CENTER;
  const addressText = address ?? (resolving ? 'Fetching address...' : 'Address not available');

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Select Location"
      size="lg"
      testID="location-picker"
      footer={
        <Button
          title={confirmLabel}
          icon="check"
          fullWidth
          disabled={!pin}
          onPress={() => pin && onConfirm({ ...pin, address })}
          testID="location-picker-confirm"
        />
      }
    >
      <View style={{ gap: spacing.md }}>
        <SegmentedControl options={MAP_TYPES} value={mapType} onChange={setMapType} />
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          <ClockynMap
            height={isPhone ? 320 : 420}
            region={{ latitude: center.latitude, longitude: center.longitude, zoom: pin ? 17 : 14 }}
            markers={pin ? [{ id: 'branch', latitude: pin.latitude, longitude: pin.longitude, title: 'Branch location', color: colors.primary }] : []}
            circles={pin ? [{ id: 'radius', latitude: pin.latitude, longitude: pin.longitude, radius, color: colors.primary }] : []}
            draggableMarker
            mapType={mapType}
            showUserLocation
            onMapPress={place}
            onMarkerDragEnd={(_id, lat, lng) => place(lat, lng)}
            testID="location-picker-map"
          />
        </View>
        <Card variant="muted" padding={spacing.md}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <Icon name="map-pin" size={20} color="primary" />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text variant="bodyStrong">{pin ? 'Selected location' : 'Pin your branch location'}</Text>
              {pin ? (
                <>
                  <Text variant="callout" color="textSecondary" testID="location-picker-coords">
                    {formatGps(pin.latitude, pin.longitude, 6)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    {resolving ? <Spinner size="small" /> : null}
                    <Text variant="callout" color="textMuted" numberOfLines={2} style={{ flexShrink: 1 }}>
                      {addressText}
                    </Text>
                  </View>
                </>
              ) : (
                <Text variant="callout" color="textSecondary">
                  Tap on the map to set the exact location
                </Text>
              )}
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
