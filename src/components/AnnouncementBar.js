import React from "react";
import { getTranslation } from "../data/translations";
import "../styles/AnnouncementBar.css";

const AnnouncementBar = ({ language = "en" }) => {
  const { announcement, direction } = getTranslation(language);
  const offerMessages = announcement.offers;
  const scrollingMessages = announcement.messages;
  const marqueeItems = [...scrollingMessages, ...scrollingMessages];

  return (
    <div className="announcement-stack" aria-label="Important updates" dir={direction}>
      <div className="offer-strip">
        {offerMessages.map((message, index) => (
          <span key={message}>
            {message}
            {index < offerMessages.length - 1 && <b>|</b>}
          </span>
        ))}
      </div>

      <div className="marquee-strip">
        <div className="marquee-track">
          {marqueeItems.map((message, index) => (
            <span key={`${message}-${index}`}>{message}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBar;
