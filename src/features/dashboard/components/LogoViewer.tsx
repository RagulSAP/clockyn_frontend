import React from "react";

import { ImageViewer, Modal, Text } from "@/components/ui";

/** Full-screen company logo; a small dialog says so when the company has no logo. */
export function LogoViewer({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null | undefined;
  onClose: () => void;
}) {
  if (!visible) return null;
  if (uri)
    return (
      <ImageViewer visible uri={uri} onClose={onClose} caption="Company logo" />
    );
  return (
    <Modal visible onClose={onClose} size="sm" testID="logo-empty">
      <Text variant="body" color="textSecondary" align="center">
        No logo available
      </Text>
    </Modal>
  );
}
