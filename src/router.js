import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const isTestEnvironment = process.env.NODE_ENV === 'test';

const normalizePath = (value = '/') => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '/';
  }

  const withLeadingSlash = normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
  return withLeadingSlash.replace(/\/{2,}/g, '/');
};

const joinPaths = (basePath = '/', childPath = '') => {
  if (!childPath) {
    return normalizePath(basePath);
  }

  if (childPath === '*') {
    return '*';
  }

  if (childPath.startsWith('/')) {
    return normalizePath(childPath);
  }

  const normalizedBasePath = normalizePath(basePath);
  if (normalizedBasePath === '/') {
    return normalizePath(`/${childPath}`);
  }

  return normalizePath(`${normalizedBasePath}/${childPath}`);
};

const matchPattern = (pattern, pathname) => {
  if (pattern === '*') {
    return { matched: true, params: {}, basePath: normalizePath(pathname) };
  }

  const normalizedPattern = normalizePath(pattern);
  const normalizedPathname = normalizePath(pathname);

  if (normalizedPattern === '/*') {
    return { matched: true, params: {}, basePath: '/' };
  }

  if (normalizedPattern.endsWith('/*')) {
    const basePath = normalizePath(normalizedPattern.slice(0, -2) || '/');
    const matchesBasePath = basePath === '/'
      ? normalizedPathname.startsWith('/')
      : normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`);

    return matchesBasePath
      ? { matched: true, params: {}, basePath }
      : { matched: false, params: {}, basePath };
  }

  const patternSegments = normalizedPattern.split('/').filter(Boolean);
  const pathnameSegments = normalizedPathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathnameSegments.length) {
    return { matched: false, params: {}, basePath: normalizedPattern };
  }

  const params = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const currentPatternSegment = patternSegments[index];
    const currentPathSegment = pathnameSegments[index];

    if (currentPatternSegment.startsWith(':')) {
      params[currentPatternSegment.slice(1)] = decodeURIComponent(currentPathSegment || '');
      continue;
    }

    if (currentPatternSegment !== currentPathSegment) {
      return { matched: false, params: {}, basePath: normalizedPattern };
    }
  }

  return { matched: true, params, basePath: normalizedPattern };
};

const TestRouterContext = createContext({
  location: { pathname: '/', state: null },
  navigate: () => {}
});

const TestRouteContext = createContext({
  outlet: null,
  params: {}
});

const renderMatchedRoutes = (children, pathname, basePath = '/') => {
  const routeChildren = React.Children.toArray(children).filter(React.isValidElement);

  for (const child of routeChildren) {
    const childPath = child.props.path ?? '';
    const routePattern = childPath === ''
      ? normalizePath(basePath)
      : joinPaths(basePath, childPath);
    const match = matchPattern(routePattern, pathname);

    if (!match.matched) {
      continue;
    }

    const outlet = child.props.children
      ? renderMatchedRoutes(child.props.children, pathname, match.basePath)
      : null;

    return (
      <TestRouteContext.Provider value={{ outlet, params: match.params }}>
        {child.props.element || null}
      </TestRouteContext.Provider>
    );
  }

  return null;
};

let BrowserRouter;
let Navigate;
let Outlet;
let Route;
let Routes;
let useLocation;
let useNavigate;
let useParams;
let router;

if (isTestEnvironment) {
  BrowserRouter = ({ children }) => {
    const [location, setLocation] = useState(() => ({
      pathname: normalizePath(window.location.pathname || '/'),
      state: window.history.state || null
    }));

    useEffect(() => {
      const handlePopState = () => {
        setLocation({
          pathname: normalizePath(window.location.pathname || '/'),
          state: window.history.state || null
        });
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }, []);

    const navigate = useCallback((to, options = {}) => {
      const nextPath = normalizePath(to);
      const nextState = options.state ?? null;

      if (options.replace) {
        window.history.replaceState(nextState, '', nextPath);
      } else {
        window.history.pushState(nextState, '', nextPath);
      }

      setLocation({
        pathname: nextPath,
        state: nextState
      });
    }, []);

    const contextValue = useMemo(() => ({
      location,
      navigate
    }), [location, navigate]);

    return (
      <TestRouterContext.Provider value={contextValue}>
        {children}
      </TestRouterContext.Provider>
    );
  };

  Navigate = ({ replace = false, state = null, to }) => {
    const navigate = useNavigate();

    useEffect(() => {
      navigate(to, { replace, state });
    }, [navigate, replace, state, to]);

    return null;
  };

  Outlet = () => {
    const routeContext = useContext(TestRouteContext);
    return routeContext.outlet || null;
  };

  Route = () => null;

  Routes = ({ children }) => {
    const location = useLocation();
    return renderMatchedRoutes(children, location.pathname);
  };

  useLocation = () => useContext(TestRouterContext).location;
  useNavigate = () => useContext(TestRouterContext).navigate;
  useParams = () => useContext(TestRouteContext).params;

  router = {
    BrowserRouter,
    Navigate,
    Outlet,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams
  };
} else {
  router = require('react-router-dom');
  BrowserRouter = router.BrowserRouter;
  Navigate = router.Navigate;
  Outlet = router.Outlet;
  Route = router.Route;
  Routes = router.Routes;
  useLocation = router.useLocation;
  useNavigate = router.useNavigate;
  useParams = router.useParams;
}

export {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
};

export default router;
