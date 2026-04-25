export const MODULE_PATHS = {
  dashboard: "/dashboard",
  "admin-dashboard": "/admin-dashboard",
  ecommerce: "/ecommerce",
  cart: "/cart",
  orders: "/orders",
  returns: "/returns",
  messaging: "/messaging",
  classifieds: "/classifieds",
  realestate: "/realestate",
  fooddelivery: "/fooddelivery",
  localmarket: "/localmarket",
  ridesharing: "/ridesharing",
  matrimonial: "/matrimonial",
  socialmedia: "/socialmedia",
  reminderalert: "/reminderalert",
  quicklinks: "/quicklinks",
  diary: "/diary",
  sosalert: "/sosalert",
  astrology: "/astrology",
  support: "/support",
};

export const ROUTABLE_MODULES = new Set(Object.keys(MODULE_PATHS));

export const getProtectedModuleFromPathname = (pathname = "") =>
  String(pathname)
    .split("/")
    .filter(Boolean)[0] || "";

export const getPathForModule = (moduleId = "", fallbackPath = MODULE_PATHS.dashboard) =>
  MODULE_PATHS[moduleId] || fallbackPath;
