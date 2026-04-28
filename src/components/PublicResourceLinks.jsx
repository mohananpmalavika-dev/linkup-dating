import React from 'react';
import { useLocation, useNavigate } from '../router';
import { getPublicResourceRoutes, getPublicUiCopy } from '../data/publicPages';
import '../styles/PublicResourceLinks.css';

const PublicResourceLinks = ({ language = 'en', variant = 'inline' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const resourceRoutes = getPublicResourceRoutes(language);
  const uiCopy = getPublicUiCopy(language);

  return (
    <nav
      aria-label={uiCopy.navAriaLabel}
      className={`public-resource-links public-resource-links-${variant}`}
    >
      {resourceRoutes.map((resource) => {
        const isActive = location.pathname === resource.path;

        return (
          <button
            key={resource.path}
            type="button"
            className={`public-resource-link ${isActive ? 'is-active' : ''}`}
            onClick={() => navigate(resource.path)}
          >
            {resource.label}
          </button>
        );
      })}
    </nav>
  );
};

export default PublicResourceLinks;
