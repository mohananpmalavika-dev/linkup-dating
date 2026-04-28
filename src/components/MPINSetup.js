import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/api";
import { getStoredAuthToken } from "../utils/auth";

const MPINSetup = ({ onComplete, onCancel }) => {
  const [mpin, setMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [oldMpin, setOldMpin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hasExistingMpin, setHasExistingMpin] = useState(null);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const validateMpin = (value) => /^\d{4,6}$/.test(value);

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!validateMpin(mpin)) {
      setError("MPIN must be 4-6 digits");
      return;
    }

    if (mpin !== confirmMpin) {
      setError("MPINs do not match");
      return;
    }

    setLoading(true);

    try {
      const token = getStoredAuthToken();
      const payload = { mpin, confirmMpin: confirmMpin };

      if (hasExistingMpin && oldMpin) {
        payload.oldMpin = oldMpin;
      }

      const response = await axios.post(
        `${API_BASE_URL}/auth/set-mpin`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.data?.success) {
        setError(response.data?.message || response.data?.error || "Failed to set MPIN");
        return;
      }

      setSuccess(response.data?.message || "MPIN set successfully");

      // Store that user has MPIN
      try {
        localStorage.setItem("linkup_has_mpin", "true");
      } catch {}

      setTimeout(() => {
        onComplete?.();
      }, 1200);
    } catch (err) {
      if (!err.response) {
        setError("Backend is not running. Please start the API server and try again.");
      } else {
        setError(
          err.response.data?.message ||
            err.response.data?.error ||
            "Unable to set MPIN. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mpin-setup-panel">
      <div className="card">
        <h3>{hasExistingMpin ? "Change MPIN" : "Set MPIN"}</h3>
        <p className="subtitle">
          {hasExistingMpin
            ? "Enter your old MPIN and create a new one."
            : "Create a 4-6 digit MPIN for quick and secure login."}
        </p>

        <form onSubmit={handleSubmit}>
          {hasExistingMpin ? (
            <div className="form-group">
              <label htmlFor="oldMpin">Old MPIN</label>
              <input
                type="password"
                inputMode="numeric"
                id="oldMpin"
                placeholder="Enter old MPIN"
                value={oldMpin}
                onChange={(e) => {
                  setOldMpin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  clearMessages();
                }}
                maxLength={6}
              />
            </div>
          ) : null}

          <div className="form-group">
            <label htmlFor="newMpin">New MPIN</label>
            <input
              type="password"
              inputMode="numeric"
              id="newMpin"
              placeholder="Enter 4-6 digit MPIN"
              value={mpin}
              onChange={(e) => {
                setMpin(e.target.value.replace(/\D/g, "").slice(0, 6));
                clearMessages();
              }}
              maxLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmMpin">Confirm MPIN</label>
            <input
              type="password"
              inputMode="numeric"
              id="confirmMpin"
              placeholder="Confirm MPIN"
              value={confirmMpin}
              onChange={(e) => {
                setConfirmMpin(e.target.value.replace(/\D/g, "").slice(0, 6));
                clearMessages();
              }}
              maxLength={6}
            />
          </div>

          {error ? <div className="error-message">{error}</div> : null}
          {success ? <div className="success-message">{success}</div> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : hasExistingMpin ? "Update MPIN" : "Set MPIN"}
            </button>
            {onCancel ? (
              <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
};

export default MPINSetup;

