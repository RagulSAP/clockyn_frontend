import React from 'react';
import { TemplateListScreen } from '../components/TemplateListScreen';
import { countBasisConfig } from '../config/incentiveConfigs';

/** Route screen: thin wrapper over the shared template list with this type's config. */
export default function CountBasisScreen() {
  return <TemplateListScreen config={countBasisConfig} />;
}
