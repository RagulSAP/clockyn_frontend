import React from 'react';
import { TemplateListScreen } from '../components/TemplateListScreen';
import { hourlyConfig } from '../config/wageConfigs';

/** Route screen: thin wrapper over the shared template list with this type's config. */
export default function HourlyChargesScreen() {
  return <TemplateListScreen config={hourlyConfig} />;
}
