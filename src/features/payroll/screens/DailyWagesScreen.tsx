import React from 'react';
import { TemplateListScreen } from '../components/TemplateListScreen';
import { dailyWagesConfig } from '../config/wageConfigs';

/** Route screen: thin wrapper over the shared template list with this type's config. */
export default function DailyWagesScreen() {
  return <TemplateListScreen config={dailyWagesConfig} />;
}
