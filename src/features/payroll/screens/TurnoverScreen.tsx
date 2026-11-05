import React from 'react';
import { TemplateListScreen } from '../components/TemplateListScreen';
import { turnoverConfig } from '../config/incentiveConfigs';

/** Route screen: thin wrapper over the shared template list with this type's config. */
export default function TurnoverScreen() {
  return <TemplateListScreen config={turnoverConfig} />;
}
