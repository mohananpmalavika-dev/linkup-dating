import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import useI18n from "../hooks/useI18n";
import { getPathForModule, getProtectedModuleFromPathname } from "../utils/moduleRoutes";
import "../styles/Navigation.css";

const ALWAYS_VISIBLE_MODULE_IDS = new Set(["dashboard", "diary", "quicklinks"]);

const Navigation = ({ onLogout, loggedInUser, enabledModules = [] }) => {
  const { currentUser, cart } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const displayUser = loggedInUser || currentUser;
  const isAdmin = displayUser?.role === "admin" || displayUser?.registrationType === "admin";
  const isSeller =
    displayUser?.registrationType === "entrepreneur" || displayUser?.role === "business";
  const defaultHomeModule = isAdmin ? "admin-dashboard" : "dashboard";
  const currentModule = getProtectedModuleFromPathname(location.pathname) || defaultHomeModule;
  const subscribedCategoryIds = (displayUser?.selectedBusinessCategories || [])
    .map((category) => category?.id)
    .filter(Boolean);
  const enabledModuleIds = new Set(Array.isArray(enabledModules) ? enabledModules : []);
  const cartItemCount = cart.reduce((total, item) => total + Number(item.quantity || 1), 0);

  const allBusinessModules = [
    { id: "dashboard", label: isSeller ? "Seller Dashboard" : t("modules.dashboard", "Dashboard") },
    { id: "ecommerce", label: t("modules.ecommerce", "GlobeMart") },
    { id: "messaging", label: t("modules.messaging", "LinkUp") },
    { id: "classifieds", label: t("modules.classifieds", "TradePost") },
    { id: "realestate", label: t("modules.realestate", "HomeSphere") },
    { id: "fooddelivery", label: t("modules.fooddelivery", "Feastly") },
    { id: "localmarket", label: t("modules.localmarket", "Local Market") },
    { id: "ridesharing", label: t("modules.ridesharing", "SwiftRide") },
    { id: "matrimonial", label: t("modules.matrimonial", "SoulMatch") },
    { id: "socialmedia", label: t("modules.socialmedia", "VibeHub") },
    { id: "diary", label: t("modules.diary", "My Diary") },
    { id: "reminderalert", label: t("modules.reminderalert", "ReminderAlert - Todo List") },
    { id: "quicklinks", label: t("modules.quicklinks", "Quick Links") },
    { id: "sosalert", label: t("modules.sosalert", "SOS Safety Center") },
    { id: "astrology", label: t("modules.astrology", "AstroNila") },
  ];
  const isModuleVisible = (moduleId) =>
    ALWAYS_VISIBLE_MODULE_IDS.has(moduleId) || enabledModuleIds.has(moduleId);

  const modules = isAdmin
    ? [{ id: "admin-dashboard", label: t("modules.admin", "Admin Dashboard") }]
    : allBusinessModules.filter(
        (module) =>
          isModuleVisible(module.id) &&
          (!isSeller ||
            module.id === "dashboard" ||
            module.sellerVisible === true ||
            subscribedCategoryIds.includes(module.id))
      );
  const showSosButton = enabledModuleIds.has("sosalert");

  useEffect(() => {
    setIsSidebarOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  const handleModuleClick = (moduleId) => {
    navigate(getPathForModule(moduleId, getPathForModule(defaultHomeModule)));
    setIsSidebarOpen(false);
  };

  const handleSOSButtonClick = () => {
    if (!showSosButton) {
      return;
    }

    navigate(getPathForModule("sosalert", getPathForModule(defaultHomeModule)));
    setIsSidebarOpen(false);

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("malabarbazaar:sos-requested"));
    }, currentModule === "sosalert" ? 0 : 150);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-top-row">
            <div
              className="nav-logo"
              onClick={() => handleModuleClick(defaultHomeModule)}
            >
              <img src="/logo.svg" alt="NilaHub Logo" className="logo-image" />
              <span>NilaHub</span>
            </div>

            <div className="nav-right">
              {!isAdmin && !isSeller && (
                <button
                  type="button"
                  className={`cart-icon cart-button ${currentModule === "cart" ? "cart-button-active" : ""}`}
                  onClick={() => handleModuleClick("cart")}
                >
                  {t("navigation.cart", "Cart")} {cartItemCount}
                </button>
              )}
              {showSosButton ? (
                <button
                  type="button"
                  className="sos-alert-button"
                  onClick={handleSOSButtonClick}
                  title="Open SOS Safety Center and trigger the emergency workflow"
                >
                  SOS
                </button>
              ) : null}
              <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)}>
                <span className="user-avatar">{displayUser.avatar}</span>
                <span className="user-name">{displayUser.name || displayUser.email}</span>
                <span className="dropdown-icon">v</span>

                {showUserMenu && (
                  <div className="user-menu">
                    <div className="user-menu-item">
                      <strong>{displayUser.email}</strong>
                    </div>
                    <div className="user-menu-item">
                      <span>
                        {isAdmin
                          ? t("navigation.adminAccess", "Admin access")
                          : isSeller
                            ? "Seller access"
                            : t("navigation.businessAccess", "Business access")}
                      </span>
                    </div>
                    <button className="logout-btn" onClick={onLogout}>
                      {t("common.logout", "Logout")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="nav-bottom-row">
            <button className="hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {t("common.menu", "Menu")}
            </button>

            <div className="nav-menu" aria-label="Primary navigation">
              {modules.map((module) => (
                <button
                  key={module.id}
                  className={`nav-link ${currentModule === module.id ? "nav-link-active" : ""}`}
                  onClick={() => handleModuleClick(module.id)}
                  aria-current={currentModule === module.id ? "page" : undefined}
                >
                  {module.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h3>NilaHub</h3>
          <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>
            {t("common.close", "Close")}
          </button>
        </div>
        <div className="sidebar-menu">
          {modules.map((module) => (
            <button
              key={module.id}
              className={`sidebar-link ${currentModule === module.id ? "sidebar-link-active" : ""}`}
              onClick={() => handleModuleClick(module.id)}
              aria-current={currentModule === module.id ? "page" : undefined}
            >
              {module.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navigation;
