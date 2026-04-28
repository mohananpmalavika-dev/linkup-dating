import React from 'react';
import { useLocation, useNavigate } from '../router';
import { PUBLIC_RESOURCE_ROUTES } from '../data/publicPages';
import '../styles/PublicResourceLinks.css';

const PublicResourceLinks = ({ variant = 'inline' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Public legal and support resources"
      className={`public-resource-links public-resource-links-${variant}`}
    >
      {PUBLIC_RESOURCE_ROUTES.map((resource) => {
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
