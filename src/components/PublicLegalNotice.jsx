import React from 'react';
import { getTranslationValue } from '../data/translations';
import PublicResourceLinks from './PublicResourceLinks';

const PublicLegalNotice = ({
  language = 'en',
  message
}) => (
  <div className="public-legal-callout">
    <p>{message || getTranslationValue(language, 'public.reviewNotice')}</p>
    <PublicResourceLinks language={language} variant="inline" />
  </div>
);

export default PublicLegalNotice;
