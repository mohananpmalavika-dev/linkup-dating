import React from "react";
import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";
import AnnouncementBar from "./AnnouncementBar";

const Layout = ({
  loggedInUser,
  onLogout,
  language,
  appDataError = "",
  enabledModules = [],
}) => {
  return (
    <>
      <AnnouncementBar language={language} />
      <Navigation
        onLogout={onLogout}
        loggedInUser={loggedInUser}
        enabledModules={enabledModules}
      />
      <main className="main-content">
        {appDataError ? <div className="app-loading">{appDataError}</div> : null}
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
