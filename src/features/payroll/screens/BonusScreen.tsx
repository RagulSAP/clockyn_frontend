import React from 'react';
import { TemplateListScreen } from '../components/TemplateListScreen';
import { bonusConfig } from '../config/incentiveConfigs';

/** Route screen: thin wrapper over the shared template list with this type's config. */
export default function BonusScreen() {
  return <TemplateListScreen config={bonusConfig} />;
}
