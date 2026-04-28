import React from 'react';
import { useNavigate } from '../router';
import { getTranslation } from '../data/translations';
import { getPublicPageContent, getPublicUiCopy } from '../data/publicPages';
import PublicResourceLinks from './PublicResourceLinks';
import '../styles/PublicInfoPage.css';

const PublicInfoPage = ({ language = 'en', pageKey }) => {
  const navigate = useNavigate();
  const page = getPublicPageContent(pageKey, language);
  const uiCopy = getPublicUiCopy(language);
  const { direction } = getTranslation(language);

  if (!page) {
    return null;
  }

  return (
    <main className="public-info-page" dir={direction}>
      <div className="public-info-shell">
        <header className="public-info-hero">
          <button type="button" className="public-info-home" onClick={() => navigate('/')}>
            {uiCopy.openApp}
          </button>
          <p className="public-info-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="public-info-summary">{page.summary}</p>
          <div className="public-info-meta">
            <span>{page.lastUpdated}</span>
            <span>{uiCopy.audienceLabel}</span>
          </div>
          {Array.isArray(page.heroActions) && page.heroActions.length > 0 ? (
            <div className="public-info-actions">
              {page.heroActions.map((action) => (
                action.href ? (
                  <a
                    key={`${pageKey}-${action.label}`}
                    className={`public-info-action public-info-action-${action.tone || 'secondary'}`}
                    href={action.href}
                  >
                    {action.label}
                  </a>
                ) : (
                  <button
                    key={`${pageKey}-${action.label}`}
                    type="button"
                    className={`public-info-action public-info-action-${action.tone || 'secondary'}`}
                    onClick={() => navigate(action.path || '/')}
                  >
                    {action.label}
                  </button>
                )
              ))}
            </div>
          ) : null}
          <PublicResourceLinks language={language} variant="pills" />
        </header>

        <div className="public-info-layout">
          <article className="public-info-content">
            {page.sections.map((section) => (
              <section key={section.title} className="public-info-section">
                <h2>{section.title}</h2>
                {Array.isArray(section.paragraphs)
                  ? section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))
                  : null}
                {Array.isArray(section.bullets) && section.bullets.length > 0 ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>

          <aside className="public-info-sidebar">
            {page.contactCards.map((card) => (
              <section key={card.title} className="public-info-contact-card">
                <h2>{card.title}</h2>
                <dl>
                  {card.items.map((item) => (
                    <div key={`${card.title}-${item.label}`} className="public-info-contact-item">
                      <dt>{item.label}</dt>
                      <dd>
                        {item.href ? (
                          <a href={item.href}>{item.value}</a>
                        ) : (
                          item.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default PublicInfoPage;
