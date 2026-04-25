import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/api";
import { showServiceWorkerNotification } from "../pwaConfig";

const AppContext = createContext();
const STOREFRONT_STORAGE_KEY = "malabarbazaar-storefront";
const DEFAULT_PRODUCTS_LIMIT = 12;
const DEFAULT_MANAGED_PRODUCTS_LIMIT = 12;
const DEFAULT_ORDERS_LIMIT = 10;
const EMPTY_PAGINATION = {
  page: 1,
  limit: DEFAULT_PRODUCTS_LIMIT,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};
const EMPTY_PAYMENT_GATEWAYS = {
  stripe: { enabled: false, publishableKey: "" },
  razorpay: { enabled: false, keyId: "" },
};
const EMPTY_PAYMENT_SECURITY = {
  tokenizedOnly: false,
  threeDSecure: "unavailable",
  rawCardStorage: true,
};
const EMPTY_MANAGED_PRODUCT_COUNTS = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  active: 0,
  disabled: 0,
};
const EMPTY_ORDER_STATS = { openCount: 0 };
const EMPTY_SELLER_ORDER_STATS = { openFulfillmentCount: 0 };
const EMPTY_CHECKOUT_STATUS = {
  type: "",
  message: "",
  gateway: "",
};

const EMPTY_MODULE_DATA = {
  ecommerceProducts: [],
  classifiedsListings: [],
  classifiedsMessages: [],
  classifiedsReports: [],
  realestateProperties: [],
  restaurants: [],
  rideOffers: [],
  conversations: [],
  matrimonialProfiles: [],
  socialMediaPosts: [],
  socialMediaStories: [],
};

const getDateValue = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;
const DEFAULT_RETURN_WINDOW_DAYS = 0;

const createMarketplaceItemId = (productId, batchId) =>
  batchId ? `${productId}::batch::${batchId}` : productId;

const buildBatchBackedProduct = (product, batch, options = {}) =>
  buildNormalizedProduct(
    {
      ...product,
      id: createMarketplaceItemId(product.id || product._id, batch?.id),
      productId: product.id || product._id,
      batchId: batch?.id || "",
      batchLabel: batch?.batchLabel || "",
      batchLocation: batch?.location || "",
      location: batch?.location || product.location || "",
      stock: Number(batch?.stock ?? product.stock ?? 0),
      price: batch?.price ?? product.price ?? 0,
      mrp: batch?.mrp ?? product.mrp ?? product.price ?? 0,
      discountAmount: batch?.discountAmount ?? product.discountAmount ?? 0,
      discountPercentage: batch?.discountPercentage ?? product.discountPercentage ?? 0,
      discountStartDate: batch?.discountStartDate ?? product.discountStartDate ?? null,
      discountEndDate: batch?.discountEndDate ?? product.discountEndDate ?? null,
      manufacturingDate: batch?.manufacturingDate ?? null,
      expiryDate: batch?.expiryDate ?? null,
      returnAllowed:
        typeof batch?.returnAllowed === "boolean"
          ? batch.returnAllowed
          : Boolean(product.returnAllowed),
      returnWindowDays:
        Number(batch?.returnWindowDays ?? product.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS) || 0,
      inventoryBatch: batch || null,
    },
    options
  );

const getReturnEligibleUntil = (item, order) => {
  const returnWindowDays = Number(item?.returnWindowDays ?? 0);
  if (!item?.returnAllowed || returnWindowDays <= 0) {
    return null;
  }

  const baselineDate = getDateValue(order?.deliveredAt);

  if (!baselineDate) {
    return null;
  }

  const eligibleUntil = new Date(baselineDate);
  eligibleUntil.setDate(eligibleUntil.getDate() + returnWindowDays);
  return eligibleUntil;
};

const normalizeOrderItem = (item, order) => {
  const eligibleUntil = getReturnEligibleUntil(item, order);

  return {
    ...item,
    id: item.id || item.productId || item._id,
    productId: item.productId || item.id || item._id,
    batchId: item.batchId || "",
    batchLabel: item.batchLabel || "",
    location: item.location || item.batchLocation || "",
    batchLocation: item.batchLocation || item.location || "",
    expiryDate: item.expiryDate || null,
    returnAllowed: Boolean(item.returnAllowed),
    returnWindowDays: Number(item.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS) || 0,
    returnEligibleUntil: eligibleUntil ? eligibleUntil.toISOString() : null,
    returnRequest: item.returnRequest || null,
  };
};

const normalizeOrder = (order, fallbackItems = []) => {
  const normalizedItems = (order?.items?.length ? order.items : fallbackItems).map((item) =>
    normalizeOrderItem(item, order)
  );

  return {
    ...order,
    id: order?.id || order?._id,
    items: normalizedItems,
  };
};

const buildMarketplaceProducts = (product, options = {}) => {
  if (product?.batchId) {
    return [buildNormalizedProduct(product, options)];
  }

  const normalizedProductId = product.id || product._id;
  const activeBatches = (product.inventoryBatches || []).filter((batch) => {
    if (!batch || batch.isActive === false || batch.isExpired === true) {
      return false;
    }

    const batchStock = Number(batch.stock ?? 0);
    return Number.isFinite(batchStock) ? batchStock > 0 : false;
  });

  if (activeBatches.length > 0) {
    return activeBatches.map((batch) =>
      buildBatchBackedProduct(
        {
          ...product,
          id: normalizedProductId,
        },
        batch,
        options
      )
    );
  }

  return [buildNormalizedProduct(product, options)];
};

const buildNormalizedProduct = (product, options = {}) => {
  const { respectDiscountSchedule = false } = options;
  const mrp = roundCurrency(product.mrp ?? product.price ?? 0);
  const sellingPrice = roundCurrency(product.price ?? 0);
  const savedDiscountAmount = roundCurrency(
    product.discountAmount ?? Math.max(0, mrp - sellingPrice)
  );
  const savedDiscountPercentage = roundCurrency(
    product.discountPercentage ??
      (mrp > 0 ? (savedDiscountAmount / mrp) * 100 : 0)
  );
  const discountStartDate = getDateValue(product.discountStartDate);
  const discountEndDate = getDateValue(product.discountEndDate);
  const now = new Date();
  const hasSavedDiscount = savedDiscountAmount > 0 && mrp > sellingPrice;
  const hasSchedule = Boolean(discountStartDate || discountEndDate);
  const isBeforeStart = discountStartDate ? now < discountStartDate : false;
  const isAfterEnd = discountEndDate ? now > discountEndDate : false;
  const isDiscountActive =
    hasSavedDiscount && (!respectDiscountSchedule || (!isBeforeStart && !isAfterEnd));
  const effectivePrice = isDiscountActive ? sellingPrice : mrp || sellingPrice;

  return {
    ...product,
    id: product.id || product._id,
    price: effectivePrice,
    mrp: mrp || effectivePrice,
    sellingPrice,
    discountAmount: isDiscountActive ? savedDiscountAmount : 0,
    discountPercentage: isDiscountActive ? savedDiscountPercentage : 0,
    savedDiscountAmount,
    savedDiscountPercentage,
    discountStartDate: product.discountStartDate || null,
    discountEndDate: product.discountEndDate || null,
    isDiscountActive,
    isDiscountScheduled: hasSchedule,
    discountStatus: !hasSavedDiscount
      ? "none"
      : isDiscountActive
        ? "active"
        : isBeforeStart
          ? "upcoming"
          : isAfterEnd
            ? "expired"
            : "inactive",
    approvalStatus: product.approvalStatus || "approved",
    isActive: product.isActive !== false,
    moderationNote: product.moderationNote || "",
    productId: product.productId || product.id || product._id,
    batchId: product.batchId || "",
    batchLabel: product.batchLabel || "",
    batchLocation: product.batchLocation || product.location || "",
    imageVariants: product.imageVariants || null,
    imageCdn: product.imageCdn || "",
    rating: Number(product.rating ?? 0),
    reviews: Number(product.reviews ?? product.reviewCount ?? 0),
    views: Number(product.views ?? 0),
    clicks: Number(product.clicks ?? 0),
    unitsSold: Number(product.unitsSold ?? 0),
    flashSale: product.flashSale || null,
    flashSaleActive: Boolean(product.flashSaleActive || product.flashSale?.saleId),
    flashSaleEndsAt: product.flashSaleEndsAt || product.flashSale?.endsAt || null,
    flashSaleRemainingStock: Number(product.flashSaleRemainingStock ?? product.flashSale?.remainingStock ?? 0),
    returnAllowed: Boolean(product.returnAllowed),
    returnWindowDays: Number(product.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS) || 0,
    inventoryBatch: product.inventoryBatch || null,
    expiryDate: product.expiryDate || null,
    manufacturingDate: product.manufacturingDate || null,
  };
};

const getSafeStock = (product) => {
  if (typeof product?.stock !== "number" || Number.isNaN(product.stock)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Number(product.stock));
};

const buildPageParams = (page, limit) => ({
  page,
  limit,
});

const buildModuleDataState = (incomingModuleData = {}, currentData = EMPTY_MODULE_DATA) => ({
  ...EMPTY_MODULE_DATA,
  ...currentData,
  ...incomingModuleData,
  ecommerceProducts:
    Array.isArray(incomingModuleData?.ecommerceProducts)
      ? incomingModuleData.ecommerceProducts
      : Array.isArray(currentData?.ecommerceProducts)
        ? currentData.ecommerceProducts
        : [],
});

const canUseBrowserStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readPersistedStorefront = () => {
  if (!canUseBrowserStorage()) {
    return { cart: [], favorites: [], savedAddresses: [] };
  }

  try {
    const rawValue = window.localStorage.getItem(STOREFRONT_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    return {
      cart: Array.isArray(parsedValue?.cart) ? parsedValue.cart : [],
      favorites: Array.isArray(parsedValue?.favorites) ? parsedValue.favorites : [],
      savedAddresses: Array.isArray(parsedValue?.savedAddresses) ? parsedValue.savedAddresses : [],
    };
  } catch (error) {
    return { cart: [], favorites: [], savedAddresses: [] };
  }
};

const persistStorefrontSnapshot = (snapshot) => {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(
    STOREFRONT_STORAGE_KEY,
    JSON.stringify({
      cart: Array.isArray(snapshot?.cart) ? snapshot.cart : [],
      favorites: Array.isArray(snapshot?.favorites) ? snapshot.favorites : [],
      savedAddresses: Array.isArray(snapshot?.savedAddresses) ? snapshot.savedAddresses : [],
      updatedAt: new Date().toISOString(),
    })
  );
};

const syncStorefrontToServiceWorker = (cart) => {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return;
  }

  const payload = {
    type: "STORE_OFFLINE_CART",
    payload: {
      cart,
      updatedAt: new Date().toISOString(),
    },
  };

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(payload);
    return;
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(payload);
    })
    .catch(() => {
      // Keep storefront persistence resilient even if the SW is not ready yet.
    });
};

axios.defaults.withCredentials = true;

export const AppProvider = ({ children, loggedInUser, language = "en", authToken = "" }) => {
  const persistedStorefrontState = useMemo(() => readPersistedStorefront(), []);
  const currentUser = useMemo(
    () =>
      loggedInUser || {
        id: 1,
        name: "Dhanya",
        email: "dhanya@nilahub.com",
        phone: "+91 9876543210",
        avatar: "U",
      },
    [loggedInUser]
  );

  const [cart, setCart] = useState(() => persistedStorefrontState.cart || []);
  const [favorites, setFavorites] = useState(() => persistedStorefrontState.favorites || []);
  const [savedAddresses, setSavedAddresses] = useState(() => persistedStorefrontState.savedAddresses || []);
  const [orders, setOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [moduleData, setModuleData] = useState(EMPTY_MODULE_DATA);
  const [allManagedProducts, setAllManagedProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [paymentGateways, setPaymentGateways] = useState(EMPTY_PAYMENT_GATEWAYS);
  const [paymentSecurityConfig, setPaymentSecurityConfig] = useState(EMPTY_PAYMENT_SECURITY);
  const [checkoutStatus, setCheckoutStatus] = useState(EMPTY_CHECKOUT_STATUS);
  const [ordersPagination, setOrdersPagination] = useState({
    ...EMPTY_PAGINATION,
    limit: DEFAULT_ORDERS_LIMIT,
  });
  const [sellerOrdersPagination, setSellerOrdersPagination] = useState({
    ...EMPTY_PAGINATION,
    limit: DEFAULT_ORDERS_LIMIT,
  });
  const [marketplacePagination, setMarketplacePagination] = useState({
    ...EMPTY_PAGINATION,
    limit: DEFAULT_PRODUCTS_LIMIT,
  });
  const [managedProductsPagination, setManagedProductsPagination] = useState({
    ...EMPTY_PAGINATION,
    limit: DEFAULT_MANAGED_PRODUCTS_LIMIT,
  });
  const [orderStats, setOrderStats] = useState(EMPTY_ORDER_STATS);
  const [sellerOrderStats, setSellerOrderStats] = useState(EMPTY_SELLER_ORDER_STATS);
  const [managedProductCounts, setManagedProductCounts] = useState(EMPTY_MANAGED_PRODUCT_COUNTS);
  const isSellerAccount =
    currentUser?.registrationType === "entrepreneur" || currentUser?.role === "business";
  const currentUserId = currentUser?.id;
  const currentUserRegistrationType = currentUser?.registrationType;
  const currentUserRole = currentUser?.role;
  const handledStripeRedirectRef = useRef("");
  const storefrontHydratedRef = useRef(false);
  const storefrontPersistTimeoutRef = useRef(null);
  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken]
  );

  useEffect(() => {
    const persistedState = readPersistedStorefront();
    setCart(Array.isArray(loggedInUser?.cart) ? loggedInUser.cart : persistedState.cart || []);
    setFavorites(Array.isArray(loggedInUser?.favorites) ? loggedInUser.favorites : persistedState.favorites || []);
    setSavedAddresses(Array.isArray(loggedInUser?.savedAddresses) ? loggedInUser.savedAddresses : persistedState.savedAddresses || []);
    storefrontHydratedRef.current = true;
  }, [loggedInUser]);

  useEffect(() => {
    if (!storefrontHydratedRef.current || !currentUserId) {
      persistStorefrontSnapshot({ cart, favorites, savedAddresses });
      syncStorefrontToServiceWorker(cart);
      return;
    }

    const persistStorefrontState = async () => {
      try {
        await axios.patch(`${API_BASE_URL}/auth/me`, {
          cart,
          favorites,
          savedAddresses,
        });
      } catch (error) {
        // Keep the UI responsive even if persistence fails temporarily.
      }

      persistStorefrontSnapshot({ cart, favorites, savedAddresses });
      syncStorefrontToServiceWorker(cart);
    };

    if (storefrontPersistTimeoutRef.current) {
      clearTimeout(storefrontPersistTimeoutRef.current);
    }

    storefrontPersistTimeoutRef.current = setTimeout(() => {
      persistStorefrontState();
      storefrontPersistTimeoutRef.current = null;
    }, 500);

    return () => {
      if (storefrontPersistTimeoutRef.current) {
        clearTimeout(storefrontPersistTimeoutRef.current);
        storefrontPersistTimeoutRef.current = null;
      }
    };
  }, [cart, currentUserId, favorites, savedAddresses]);

  useEffect(() => () => {
    if (storefrontPersistTimeoutRef.current) {
      clearTimeout(storefrontPersistTimeoutRef.current);
    }
  }, []);

  const applyModuleData = useCallback((incomingModuleData = {}) => {
    setModuleData((currentData) => buildModuleDataState(incomingModuleData, currentData));
  }, []);

  const fetchModuleData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/app-data/public`);

      if (response.data?.success) {
        applyModuleData(response.data.data?.moduleData || {});
      }
    } catch (error) {
      setModuleData((currentData) => ({
        ...EMPTY_MODULE_DATA,
        ecommerceProducts: currentData.ecommerceProducts || [],
      }));
    }
  }, [applyModuleData]);

  const fetchOrders = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!currentUserId) {
      setOrders([]);
      setOrdersPagination({
        ...EMPTY_PAGINATION,
        limit: DEFAULT_ORDERS_LIMIT,
      });
      setOrderStats(EMPTY_ORDER_STATS);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/orders/mine`, {
        headers: authHeaders,
        params: buildPageParams(page, DEFAULT_ORDERS_LIMIT),
      });

      if (response.data?.success) {
        const nextOrders = (response.data.orders || []).map((order) => normalizeOrder(order));
        setOrders((currentOrders) => (append ? [...currentOrders, ...nextOrders] : nextOrders));
        setOrdersPagination(
          response.data.pagination || {
            ...EMPTY_PAGINATION,
            limit: DEFAULT_ORDERS_LIMIT,
          }
        );
        setOrderStats(response.data.stats || EMPTY_ORDER_STATS);
      }
    } catch (error) {
      setOrders([]);
      setOrdersPagination({
        ...EMPTY_PAGINATION,
        limit: DEFAULT_ORDERS_LIMIT,
      });
      setOrderStats(EMPTY_ORDER_STATS);
    }
  }, [authHeaders, currentUserId]);

  const fetchSellerOrders = useCallback(async ({ page = 1, append = false } = {}) => {
    const canManageOrders =
      currentUserRegistrationType === "admin" ||
      currentUserRole === "admin" ||
      currentUserRegistrationType === "entrepreneur" || currentUserRole === "business";

    if (!currentUserId || !canManageOrders) {
      setSellerOrders([]);
      setSellerOrdersPagination({
        ...EMPTY_PAGINATION,
        limit: DEFAULT_ORDERS_LIMIT,
      });
      setSellerOrderStats(EMPTY_SELLER_ORDER_STATS);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/orders/manage`, {
        headers: authHeaders,
        params: buildPageParams(page, DEFAULT_ORDERS_LIMIT),
      });

      if (response.data?.success) {
        const nextOrders = (response.data.orders || []).map((order) => normalizeOrder(order));
        setSellerOrders((currentOrders) =>
          append ? [...currentOrders, ...nextOrders] : nextOrders
        );
        setSellerOrdersPagination(
          response.data.pagination || {
            ...EMPTY_PAGINATION,
            limit: DEFAULT_ORDERS_LIMIT,
          }
        );
        setSellerOrderStats(response.data.stats || EMPTY_SELLER_ORDER_STATS);
        return;
      }
    } catch (error) {
      // Ignore and fall back to empty seller orders.
    }

    setSellerOrders([]);
    setSellerOrdersPagination({
      ...EMPTY_PAGINATION,
      limit: DEFAULT_ORDERS_LIMIT,
    });
    setSellerOrderStats(EMPTY_SELLER_ORDER_STATS);
  }, [authHeaders, currentUserId, currentUserRegistrationType, currentUserRole]);

  const fetchPaymentConfig = useCallback(async () => {
    if (!currentUserId) {
      setPaymentGateways(EMPTY_PAYMENT_GATEWAYS);
      setPaymentSecurityConfig(EMPTY_PAYMENT_SECURITY);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/orders/payment-config`, {
        headers: authHeaders,
      });

      if (response.data?.success) {
        setPaymentGateways({
          ...EMPTY_PAYMENT_GATEWAYS,
          ...(response.data.gateways || {}),
        });
        setPaymentSecurityConfig({
          ...EMPTY_PAYMENT_SECURITY,
          ...(response.data.security || {}),
        });
        return;
      }
    } catch (error) {
      // Ignore and fall back to disabled gateways.
    }

    setPaymentGateways(EMPTY_PAYMENT_GATEWAYS);
    setPaymentSecurityConfig(EMPTY_PAYMENT_SECURITY);
  }, [authHeaders, currentUserId]);

  const clearCheckoutStatus = useCallback(() => {
    setCheckoutStatus(EMPTY_CHECKOUT_STATUS);
  }, []);

  const approvedProducts = useMemo(
    () =>
      (moduleData.ecommerceProducts || []).flatMap((product) =>
        buildMarketplaceProducts(product, { respectDiscountSchedule: true })
      ),
    [moduleData.ecommerceProducts]
  );

  const fetchApprovedProducts = useCallback(async ({ page = 1, append = false } = {}) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products`, {
        params: buildPageParams(page, DEFAULT_PRODUCTS_LIMIT),
      });

      if (response.data?.success) {
        const nextProducts = (response.data.products || []).flatMap((product) =>
          buildMarketplaceProducts(product, { respectDiscountSchedule: true })
        );
        setModuleData((currentData) => ({
          ...currentData,
          ecommerceProducts: append
            ? [...(currentData.ecommerceProducts || []), ...nextProducts]
            : nextProducts,
        }));
        setMarketplacePagination(
          response.data.pagination || {
            ...EMPTY_PAGINATION,
            limit: DEFAULT_PRODUCTS_LIMIT,
          }
        );
      }

      setProductsError("");
    } catch (error) {
      setModuleData((currentData) => ({
        ...currentData,
        ecommerceProducts: [],
      }));
      setMarketplacePagination({
        ...EMPTY_PAGINATION,
        limit: DEFAULT_PRODUCTS_LIMIT,
      });
      setProductsError("Backend is unavailable. GlobeMart listings could not be loaded.");
    }
  }, []);

  const fetchManagedProducts = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!currentUserId) {
      setAllManagedProducts([]);
      setManagedProductsPagination({
        ...EMPTY_PAGINATION,
        limit: DEFAULT_MANAGED_PRODUCTS_LIMIT,
      });
      setManagedProductCounts(EMPTY_MANAGED_PRODUCT_COUNTS);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/products/manage`, {
        headers: authHeaders,
        params: buildPageParams(page, DEFAULT_MANAGED_PRODUCTS_LIMIT),
      });

      if (response.data?.success) {
        const nextProducts = response.data.products || [];
        setAllManagedProducts((currentProducts) =>
          append ? [...currentProducts, ...nextProducts] : nextProducts
        );
        setManagedProductsPagination(
          response.data.pagination || {
            ...EMPTY_PAGINATION,
            limit: DEFAULT_MANAGED_PRODUCTS_LIMIT,
          }
        );
        setManagedProductCounts(response.data.counts || EMPTY_MANAGED_PRODUCT_COUNTS);
      }
    } catch (error) {
      setAllManagedProducts([]);
      setManagedProductsPagination({
        ...EMPTY_PAGINATION,
        limit: DEFAULT_MANAGED_PRODUCTS_LIMIT,
      });
      setManagedProductCounts(EMPTY_MANAGED_PRODUCT_COUNTS);
    }
  }, [authHeaders, currentUserId]);

  const refreshProducts = useCallback(async () => {
    setProductsLoading(true);
    await Promise.all([
      fetchModuleData(),
      fetchApprovedProducts({ page: 1, append: false }),
      fetchManagedProducts({ page: 1, append: false }),
      fetchOrders({ page: 1, append: false }),
      fetchSellerOrders({ page: 1, append: false }),
      fetchPaymentConfig(),
    ]);
    setProductsLoading(false);
  }, [
    fetchApprovedProducts,
    fetchManagedProducts,
    fetchModuleData,
    fetchOrders,
    fetchPaymentConfig,
    fetchSellerOrders,
  ]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const addToCart = (product) => {
    if (isSellerAccount) {
      return false;
    }

    let wasAdded = false;

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);
      const availableStock = getSafeStock(product);

      if (existingItem) {
        const nextQuantity = Math.min((existingItem.quantity || 1) + 1, availableStock);
        wasAdded = nextQuantity > (existingItem.quantity || 1);

        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQuantity } : item
        );
      }

      if (availableStock <= 0) {
        wasAdded = false;
        return currentCart;
      }

      wasAdded = true;
      return [...currentCart, { ...product, quantity: 1 }];
    });

    return wasAdded;
  };

  const removeFromCart = (productId) => {
    if (isSellerAccount) {
      return;
    }

    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  };

  const updateCartQuantity = (productId, nextQuantity) => {
    if (isSellerAccount) {
      return;
    }

    if (nextQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((currentCart) => {
      const currentItem = currentCart.find((item) => item.id === productId);
      const availableStock = getSafeStock(currentItem);
      const cappedQuantity = Math.min(nextQuantity, availableStock);

      return currentCart.map((item) =>
        item.id === productId ? { ...item, quantity: cappedQuantity } : item
      );
    });
  };

  const addToFavorites = (product) => {
    setFavorites((currentFavorites) => {
      if (currentFavorites.some((fav) => fav.id === product.id)) {
        return currentFavorites;
      }

      return [...currentFavorites, product];
    });
  };

  const removeFavorite = (productId) => {
    setFavorites((currentFavorites) =>
      currentFavorites.filter((fav) => fav.id !== productId)
    );
  };

  const notifyStorefrontEvent = useCallback(async ({ title = "", body = "", tag = "", url = "/" } = {}) => {
    try {
      await showServiceWorkerNotification({
        title,
        body,
        tag,
        data: { url },
      });
    } catch (error) {
      // Notifications are optional; do not block commerce flows on them.
    }
  }, []);

  const createClassifiedListing = async (listingData) => {
    const response = await axios.post(`${API_BASE_URL}/app-data/classifieds/listings`, listingData, {
      headers: authHeaders,
    });

    if (!response.data?.success) {
      throw new Error("Unable to create the classified listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const sendClassifiedMessage = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/classifieds/listings/${encodeURIComponent(listingId)}/messages`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to send the classified message.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data;
  };

  const reportClassifiedListing = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/classifieds/listings/${encodeURIComponent(listingId)}/reports`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to report the classified listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data;
  };

  const addClassifiedReview = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/classifieds/listings/${encodeURIComponent(listingId)}/reviews`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to submit the classified review.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const getSellerRating = async (sellerEmail) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/app-data/classifieds/user/${encodeURIComponent(sellerEmail)}/rating`,
        { headers: authHeaders }
      );
      if (response.data?.success) {
        return response.data.data;
      }
    } catch (error) {
      console.warn('Seller rating fetch failed:', sellerEmail);
    }
    return { classifiedsTotalRating: 5.0, classifiedsReviewCount: 0 };
  };

  const updateClassifiedListing = async (listingId, listingData) => {
    const response = await axios.patch(
      `${API_BASE_URL}/app-data/classifieds/listings/${encodeURIComponent(listingId)}`,
      listingData,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to update the classified listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const moderateClassifiedListing = async (listingId, action) => {
    const response = await axios.patch(
      `${API_BASE_URL}/app-data/classifieds/listings/${encodeURIComponent(listingId)}/moderation`,
      { action },
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to moderate the classified listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data;
  };

  const deleteClassifiedListing = async (listingId) => {
    const response = await axios.delete(
      `${API_BASE_URL}/app-data/classifieds/listings/${encodeURIComponent(listingId)}`,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to delete the classified listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data;
  };

  const createRealEstateListing = async (listingData) => {
    const response = await axios.post(`${API_BASE_URL}/app-data/realestate/listings`, listingData, {
      headers: authHeaders,
    });

    if (!response.data?.success) {
      throw new Error("Unable to create the real-estate listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const updateRealEstateListing = async (listingId, listingData) => {
    const response = await axios.patch(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}`,
      listingData,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to update the real-estate listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const sendRealEstateEnquiry = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}/enquiries`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to send the real-estate enquiry.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const sendRealEstateMessage = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}/messages`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to send the real-estate message.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const addRealEstateReview = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}/reviews`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to submit the real-estate review.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const reportRealEstateListing = async (listingId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}/reports`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to report the real-estate listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const moderateRealEstateListing = async (listingId, action) => {
    const response = await axios.patch(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}/moderation`,
      { action },
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to moderate the real-estate listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data?.listing;
  };

  const deleteRealEstateListing = async (listingId) => {
    const response = await axios.delete(
      `${API_BASE_URL}/app-data/realestate/listings/${encodeURIComponent(listingId)}`,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to delete the real-estate listing.");
    }

    applyModuleData(response.data.data?.moduleData || {});
    return response.data.data;
  };

  const placeOrder = async (orderData) => {
    if (isSellerAccount) {
      throw new Error("Seller accounts cannot purchase products.");
    }

    const response = await axios.post(
      `${API_BASE_URL}/orders`,
      {
        ...orderData,
        items: orderData.items.map((item) => ({
          id: item.id,
          productId: item.productId || item.id,
          batchId: item.batchId || "",
          batchLabel: item.batchLabel || "",
          flashSaleId: item.flashSaleId || item.flashSale?.saleId || "",
          flashReservationId: item.flashReservationId || "",
          flashReservationExpiresAt: item.flashReservationExpiresAt || null,
          location: item.batchLocation || item.location || "",
          expiryDate: item.expiryDate || null,
          returnAllowed: Boolean(item.returnAllowed),
          returnWindowDays: Number(item.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS) || 0,
          name: item.name,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
        })),
      },
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to place the order.");
    }

    const normalizedOrder = normalizeOrder(response.data.order, orderData.items);
    setOrders((currentOrders) => [normalizedOrder, ...currentOrders]);
    setCart([]);
    await refreshProducts();
    await notifyStorefrontEvent({
      title: "Order placed",
      body: "Your order was confirmed and the GST invoice is available from Orders.",
      tag: `order-${normalizedOrder.id}`,
      url: "/?source=pwa&module=orders",
    });
    return normalizedOrder;
  };

  const initializePayment = async (gateway, orderData) => {
    if (isSellerAccount) {
      throw new Error("Seller accounts cannot purchase products.");
    }

    const response = await axios.post(
      `${API_BASE_URL}/orders/payments/create`,
      {
        gateway,
        ...orderData,
        items: orderData.items.map((item) => ({
          id: item.id,
          productId: item.productId || item.id,
          batchId: item.batchId || "",
          batchLabel: item.batchLabel || "",
          flashSaleId: item.flashSaleId || item.flashSale?.saleId || "",
          flashReservationId: item.flashReservationId || "",
          flashReservationExpiresAt: item.flashReservationExpiresAt || null,
          location: item.batchLocation || item.location || "",
          expiryDate: item.expiryDate || null,
          returnAllowed: Boolean(item.returnAllowed),
          returnWindowDays: Number(item.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS) || 0,
          name: item.name,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
        })),
      },
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to initialize payment.");
    }

    return response.data;
  };

  const verifyRazorpayPayment = useCallback(async (paymentData) => {
    const response = await axios.post(
      `${API_BASE_URL}/orders/payments/razorpay/verify`,
      paymentData,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to verify Razorpay payment.");
    }

    const newOrder = normalizeOrder(response.data.order);
    setOrders((currentOrders) => {
      const existingOrder = currentOrders.find((order) => order.id === newOrder?.id);
      return existingOrder ? currentOrders : [newOrder, ...currentOrders];
    });
    setCart([]);
    await refreshProducts();
    await notifyStorefrontEvent({
      title: "Razorpay payment successful",
      body: "Your order is confirmed and the GST invoice is ready in Orders.",
      tag: `order-${newOrder.id}`,
      url: "/?source=pwa&module=orders",
    });
    return newOrder;
  }, [authHeaders, notifyStorefrontEvent, refreshProducts]);

  const verifyStripePayment = useCallback(async (paymentData) => {
    const response = await axios.post(
      `${API_BASE_URL}/orders/payments/stripe/verify`,
      paymentData,
      { headers: authHeaders }
    );

    if (!response.data?.success) {
      throw new Error("Unable to verify Stripe payment.");
    }

    const newOrder = normalizeOrder(response.data.order);
    setOrders((currentOrders) => {
      const existingOrder = currentOrders.find((order) => order.id === newOrder?.id);
      return existingOrder ? currentOrders : [newOrder, ...currentOrders];
    });
    setCart([]);
    await refreshProducts();
    await notifyStorefrontEvent({
      title: "Stripe payment successful",
      body: "Your order is confirmed and the GST invoice is ready in Orders.",
      tag: `order-${newOrder.id}`,
      url: "/?source=pwa&module=orders",
    });
    return newOrder;
  }, [authHeaders, notifyStorefrontEvent, refreshProducts]);

  const createProduct = async (productData) => {
    const response = await axios.post(`${API_BASE_URL}/products`, productData, {
      headers: authHeaders,
    });
    await refreshProducts();
    return response.data?.product;
  };

  const updateProduct = async (productId, productData) => {
    const response = await axios.put(`${API_BASE_URL}/products/${productId}`, productData, {
      headers: authHeaders,
    });
    await refreshProducts();
    return response.data?.product;
  };

  const addProductInventory = async (productId, inventoryData) => {
    const response = await axios.patch(`${API_BASE_URL}/products/${productId}/inventory`, inventoryData, {
      headers: authHeaders,
    });
    await refreshProducts();
    return response.data?.product;
  };

  const updateProductInventory = async (productId, batchId, inventoryData) => {
    const response = await axios.patch(
      `${API_BASE_URL}/products/${productId}/inventory/${batchId}`,
      inventoryData,
      {
        headers: authHeaders,
      }
    );
    await refreshProducts();
    return response.data?.product;
  };

  const setInventoryBatchAvailability = async (productId, batchId, isActive) => {
    const response = await axios.patch(
      `${API_BASE_URL}/products/${productId}/inventory/${batchId}/availability`,
      { isActive },
      {
        headers: authHeaders,
      }
    );
    await refreshProducts();
    return response.data?.product;
  };

  const setProductAvailability = async (productId, isActive) => {
    await axios.patch(
      `${API_BASE_URL}/products/${productId}/availability`,
      {
        isActive,
      },
      {
        headers: authHeaders,
      }
    );
    await refreshProducts();
  };

  const moderateProduct = async (productId, approvalStatus, moderationNote = "") => {
    const response = await axios.patch(
      `${API_BASE_URL}/products/${productId}/status`,
      { approvalStatus, moderationNote },
      { headers: authHeaders }
    );
    await refreshProducts();
    return response.data?.product;
  };

  const updateSellerOrderStatus = async (orderId, payload) => {
    const response = await axios.patch(
      `${API_BASE_URL}/orders/${orderId}/status`,
      payload,
      { headers: authHeaders }
    );
    await refreshProducts();
    return response.data?.order;
  };

  const syncSellerOrderStatus = async (orderId, payload) => {
    const response = await axios.patch(
      `${API_BASE_URL}/orders/${orderId}/status/sync`,
      payload,
      { headers: authHeaders }
    );
    await refreshProducts();
    return response.data;
  };

  const requestItemReturn = async (orderId, itemId, payload) => {
    const response = await axios.post(
      `${API_BASE_URL}/orders/${orderId}/returns`,
      {
        itemId,
        ...payload,
      },
      { headers: authHeaders }
    );

    if (!response.data?.success || !response.data?.order) {
      throw new Error("Unable to submit the return request.");
    }

    const normalizedOrder = normalizeOrder(response.data.order);
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        String(order.id) === String(orderId) ? normalizedOrder : order
      )
    );
    setSellerOrders((currentOrders) =>
      currentOrders.map((order) =>
        String(order.id) === String(orderId) ? normalizedOrder : order
      )
    );
    return normalizedOrder;
  };

  const updateItemReturnRequestStatus = async (orderId, itemId, payload) => {
    const response = await axios.patch(
      `${API_BASE_URL}/orders/${orderId}/returns/${encodeURIComponent(itemId)}`,
      payload,
      { headers: authHeaders }
    );

    if (!response.data?.success || !response.data?.order) {
      throw new Error("Unable to update the return request.");
    }

    const normalizedOrder = normalizeOrder(response.data.order);
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        String(order.id) === String(orderId) ? normalizedOrder : order
      )
    );
    setSellerOrders((currentOrders) =>
      currentOrders.map((order) =>
        String(order.id) === String(orderId) ? normalizedOrder : order
      )
    );
    return normalizedOrder;
  };

  const loadMoreMarketplaceProducts = useCallback(async () => {
    if (!marketplacePagination.hasNextPage || productsLoading) {
      return;
    }

    setProductsLoading(true);
    await fetchApprovedProducts({
      page: marketplacePagination.page + 1,
      append: true,
    });
    setProductsLoading(false);
  }, [fetchApprovedProducts, marketplacePagination.hasNextPage, marketplacePagination.page, productsLoading]);

  const loadMoreManagedProducts = useCallback(async () => {
    if (!managedProductsPagination.hasNextPage || productsLoading) {
      return;
    }

    setProductsLoading(true);
    await fetchManagedProducts({
      page: managedProductsPagination.page + 1,
      append: true,
    });
    setProductsLoading(false);
  }, [fetchManagedProducts, managedProductsPagination.hasNextPage, managedProductsPagination.page, productsLoading]);

  const loadMoreOrders = useCallback(async () => {
    if (!ordersPagination.hasNextPage || productsLoading) {
      return;
    }

    setProductsLoading(true);
    await fetchOrders({
      page: ordersPagination.page + 1,
      append: true,
    });
    setProductsLoading(false);
  }, [fetchOrders, ordersPagination.hasNextPage, ordersPagination.page, productsLoading]);

  const loadMoreSellerOrders = useCallback(async () => {
    if (!sellerOrdersPagination.hasNextPage || productsLoading) {
      return;
    }

    setProductsLoading(true);
    await fetchSellerOrders({
      page: sellerOrdersPagination.page + 1,
      append: true,
    });
    setProductsLoading(false);
  }, [fetchSellerOrders, productsLoading, sellerOrdersPagination.hasNextPage, sellerOrdersPagination.page]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const paymentState = query.get("payment");
    const gateway = query.get("gateway");
    const attemptId = query.get("attemptId");
    const sessionId = query.get("session_id");

    if (gateway !== "stripe") {
      return;
    }

    const clearStripeParams = () => {
      query.delete("payment");
      query.delete("gateway");
      query.delete("attemptId");
      query.delete("session_id");
      const nextQuery = query.toString();
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`
      );
    };

    if (paymentState === "cancelled") {
      setCheckoutStatus({
        type: "info",
        message: "Stripe checkout was cancelled. You can try again.",
        gateway: "stripe",
      });
      clearStripeParams();
      return;
    }

    if (paymentState !== "success" || !attemptId || !sessionId) {
      return;
    }

    const redirectKey = `${attemptId}:${sessionId}`;
    if (handledStripeRedirectRef.current === redirectKey) {
      return;
    }

    handledStripeRedirectRef.current = redirectKey;
    let isMounted = true;

    const finalizeStripePayment = async () => {
      setCheckoutStatus({
        type: "loading",
        message: "Verifying Stripe payment...",
        gateway: "stripe",
      });

      try {
        await verifyStripePayment({ attemptId, sessionId });
        if (isMounted) {
          setCheckoutStatus({
            type: "success",
            message: "Payment successful. Your order has been placed.",
            gateway: "stripe",
          });
        }
      } catch (error) {
        if (isMounted) {
          setCheckoutStatus({
            type: "error",
            message:
              error.response?.data?.message || error.message || "Unable to verify Stripe payment.",
            gateway: "stripe",
          });
        }
      } finally {
        clearStripeParams();
      }
    };

    finalizeStripePayment();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, verifyStripePayment]);

  const updateSavedAddresses = useCallback((nextAddresses) => {
    setSavedAddresses(Array.isArray(nextAddresses) ? nextAddresses : []);
  }, []);

  const downloadOrderInvoice = useCallback(async (orderId) => {
    if (!orderId) {
      throw new Error("Order ID is required to download the invoice.");
    }

    const response = await axios.get(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/invoice`, {
      headers: authHeaders,
      responseType: "blob",
    });

    const blob = new Blob([response.data], { type: "application/pdf" });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `invoice-${orderId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  }, [authHeaders]);

  const apiCall = useCallback(async (endpoint, method = 'GET', data = null) => {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: authHeaders,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    } else if (data && method === 'GET') {
      config.params = data;
    }

    const response = await axios(config);
    return response.data;
  }, [authHeaders]);

  const trackProductMetric = useCallback(async (productId, metric = "view") => {
    if (!productId) {
      return null;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/products/${encodeURIComponent(productId)}/track`,
        { metric },
        { headers: authHeaders }
      );

      return response.data?.product || null;
    } catch (error) {
      return null;
    }
  }, [authHeaders]);

  const fetchActiveFlashSales = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/flashsales`, {
        headers: authHeaders,
      });

      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }, [authHeaders]);

  const reserveFlashSaleItems = useCallback(async (items = []) => {
    const flashSaleItems = (items || []).filter((item) => item.flashSale?.saleId || item.flashSaleId);
    if (flashSaleItems.length === 0) {
      return items;
    }

    const response = await axios.post(
      `${API_BASE_URL}/flashsales/reserve/bulk`,
      {
        items: flashSaleItems.map((item) => ({
          productId: item.productId || item.id,
          flashSaleId: item.flashSale?.saleId || item.flashSaleId,
          quantity: Number(item.quantity || 1),
        })),
      },
      { headers: authHeaders }
    );

    const reservations = Array.isArray(response.data?.data) ? response.data.data : [];
    const reservationMap = new Map(
      reservations.map((reservation) => [`${reservation.saleId}:${reservation.productId}`, reservation])
    );

    return (items || []).map((item) => {
      const reservation = reservationMap.get(
        `${item.flashSale?.saleId || item.flashSaleId}:${item.productId || item.id}`
      );

      if (!reservation) {
        return item;
      }

      return {
        ...item,
        price: Number(reservation.salePrice || item.price || 0),
        flashSaleId: reservation.saleId,
        flashReservationId: reservation.reservation?.reservationId || item.flashReservationId || "",
        flashReservationExpiresAt: reservation.reservation?.expiresAt || item.flashReservationExpiresAt || null,
        flashSale: {
          ...(item.flashSale || {}),
          ...reservation,
        },
      };
    });
  }, [authHeaders]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        language,
        cart,
        favorites,
        savedAddresses,
        orders,
        sellerOrders,
        ecommerceProducts: approvedProducts,
        managedProducts: allManagedProducts.map((product) => buildNormalizedProduct(product)),
        ordersPagination,
        sellerOrdersPagination,
        marketplacePagination,
        managedProductsPagination,
        orderStats,
        sellerOrderStats,
        managedProductCounts,
        productsLoading,
        productsError,
        paymentGateways,
        paymentSecurityConfig,
        checkoutStatus,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        addToFavorites,
        removeFavorite,
        createClassifiedListing,
        sendClassifiedMessage,
        reportClassifiedListing,
        addClassifiedReview,
        updateClassifiedListing,
        moderateClassifiedListing,
        deleteClassifiedListing,
        createRealEstateListing,
        updateRealEstateListing,
        sendRealEstateEnquiry,
        sendRealEstateMessage,
        addRealEstateReview,
        reportRealEstateListing,
        moderateRealEstateListing,
        deleteRealEstateListing,
        updateSavedAddresses,
        downloadOrderInvoice,
        apiCall,
        fetchActiveFlashSales,
        placeOrder,
        initializePayment,
        verifyRazorpayPayment,
        verifyStripePayment,
        clearCheckoutStatus,
        createProduct,
        updateProduct,
        addProductInventory,
        updateProductInventory,
        setInventoryBatchAvailability,
        setProductAvailability,
        moderateProduct,
        updateSellerOrderStatus,
        syncSellerOrderStatus,
        requestItemReturn,
        updateItemReturnRequestStatus,
        reserveFlashSaleItems,
        trackProductMetric,
        loadMoreMarketplaceProducts,
        loadMoreManagedProducts,
        loadMoreOrders,
        loadMoreSellerOrders,
        refreshProducts,
        mockData: {
          ecommerceProducts: approvedProducts,
          classifiedsListings: moduleData.classifiedsListings || [],
          classifiedsMessages: moduleData.classifiedsMessages || [],
          classifiedsReports: moduleData.classifiedsReports || [],
          realestateProperties: moduleData.realestateProperties || [],
          restaurants: moduleData.restaurants || [],
          rideOffers: moduleData.rideOffers || [],
          conversations: moduleData.conversations || [],
          matrimonialProfiles: moduleData.matrimonialProfiles || [],
          socialMediaPosts: moduleData.socialMediaPosts || [],
          socialMediaStories: moduleData.socialMediaStories || [],
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
