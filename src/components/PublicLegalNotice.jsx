import React from 'react';
import PublicResourceLinks from './PublicResourceLinks';

const PublicLegalNotice = ({
  message = 'Review our Privacy Policy, Terms, Grievance, and Support pages before you continue.'
}) => (
  <div className="public-legal-callout">
    <p>{message}</p>
    <PublicResourceLinks variant="inline" />
  </div>
);

export default PublicLegalNotice;
