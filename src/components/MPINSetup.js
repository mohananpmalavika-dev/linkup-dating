import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import {
  getHasMpin,
  getStoredAuthToken,
  getStoredUserData,
  storeUserData
} from '../utils/auth';
import '../styles/MPINSetup.css';

const sanitizeMpinInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 6);

const MPINSetup = ({ onComplete, onCancel }) => {
  const currentUser = useMemo(() => getStoredUserData(), []);
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [oldMpin, setOldMpin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasExistingMpin, setHasExistingMpin] = useState(() => Boolean(currentUser?.hasMpin || getHasMpin()));

  useEffect(() => {
    const identifier = currentUser?.phone || currentUser?.email;

    if (!identifier) {
      return undefined;
    }

    let isActive = true;

    axios.get(`${API_BASE_URL}/auth/auth-methods`, {
      params: { identifier }
    }).then((response) => {
      if (!isActive) {
        return;
      }

      if (response.data?.exists) {
        setHasExistingMpin(Boolean(response.data?.hasMpin));
      }
    }).catch(() => {
      // Ignore this check and fall back to stored user state.
    });

    return () => {
      isActive = false;
    };
  }, [currentUser]);

  const pageCopy = useMemo(() => (
    hasExistingMpin
      ? {
          title: 'Reset your MPIN',
          subtitle: 'Confirm your current MPIN, then create a new one for faster sign-in.',
          eyebrow: 'Security',
          submitLabel: 'Update MPIN'
        }
      : {
          title: 'Create your MPIN',
          subtitle: 'Set a 4-6 digit MPIN so you can log in faster with your email or mobile number.',
          eyebrow: 'Quick Login',
          submitLabel: 'Set MPIN'
        }
  ), [hasExistingMpin]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const validateMpin = (value) => /^\d{4,6}$/.test(value);

  const persistHasMpin = () => {
    const storedUser = getStoredUserData();

    if (storedUser) {
      storeUserData({
        ...storedUser,
        hasMpin: true
      });
      return;
    }

    try {
      localStorage.setItem('linkup_has_mpin', 'true');
    } catch {
      // Ignore storage issues so success flow can continue.
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    if (hasExistingMpin && !validateMpin(oldMpin)) {
      setError('Enter your current 4-6 digit MPIN first.');
      return;
    }

    if (!validateMpin(mpin)) {
      setError('MPIN must be 4-6 digits.');
      return;
    }

    if (mpin !== confirmMpin) {
      setError('MPINs do not match.');
      return;
    }

    setLoading(true);

    try {
      const token = getStoredAuthToken();
      const payload = {
        mpin,
        confirmMpin
      };

      if (hasExistingMpin) {
        payload.oldMpin = oldMpin;
      }

      const response = await axios.post(
        `${API_BASE_URL}/auth/set-mpin`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.data?.success) {
        setError(response.data?.message || response.data?.error || 'Failed to save MPIN.');
        return;
      }

      persistHasMpin();
      setSuccess(response.data?.message || 'MPIN saved successfully.');

      window.setTimeout(() => {
        onComplete?.();
      }, 900);
    } catch (requestError) {
      if (!requestError.response) {
        setError('Backend is not running. Please start the API server and try again.');
      } else {
        setError(
          requestError.response.data?.message ||
            requestError.response.data?.error ||
            'Unable to save MPIN. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mpin-setup-panel">
      <div className="mpin-setup-shell">
        <section className="mpin-setup-card">
          <p className="mpin-setup-eyebrow">{pageCopy.eyebrow}</p>
          <h1>{pageCopy.title}</h1>
          <p className="mpin-setup-subtitle">{pageCopy.subtitle}</p>

          <div className="mpin-setup-tip">
            <strong>{hasExistingMpin ? 'Current MPIN required' : 'Quick login tip'}</strong>
            <span>
              {hasExistingMpin
                ? 'For security, changing an existing MPIN requires your current MPIN first.'
                : 'After this is set, you can log in faster with your email or mobile number plus MPIN.'}
            </span>
          </div>

          <form className="mpin-setup-form" onSubmit={handleSubmit}>
            {hasExistingMpin ? (
              <div className="mpin-setup-field">
                <label htmlFor="old-mpin">Current MPIN</label>
                <input
                  id="old-mpin"
                  type="password"
                  inputMode="numeric"
                  value={oldMpin}
                  onChange={(event) => {
                    setOldMpin(sanitizeMpinInput(event.target.value));
                    clearMessages();
                  }}
                  placeholder="Enter current MPIN"
                  maxLength={6}
                  autoComplete="current-password"
                />
              </div>
            ) : null}

            <div className="mpin-setup-field">
              <label htmlFor="new-mpin">{hasExistingMpin ? 'New MPIN' : 'MPIN'}</label>
              <input
                id="new-mpin"
                type="password"
                inputMode="numeric"
                value={mpin}
                onChange={(event) => {
                  setMpin(sanitizeMpinInput(event.target.value));
                  clearMessages();
                }}
                placeholder="Enter 4-6 digits"
                maxLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="mpin-setup-field">
              <label htmlFor="confirm-mpin">Confirm MPIN</label>
              <input
                id="confirm-mpin"
                type="password"
                inputMode="numeric"
                value={confirmMpin}
                onChange={(event) => {
                  setConfirmMpin(sanitizeMpinInput(event.target.value));
                  clearMessages();
                }}
                placeholder="Re-enter MPIN"
                maxLength={6}
                autoComplete="new-password"
              />
            </div>

            {error ? <div className="mpin-setup-message error">{error}</div> : null}
            {success ? <div className="mpin-setup-message success">{success}</div> : null}

            <div className="mpin-setup-actions">
              <button
                type="submit"
                className="mpin-primary-button"
                disabled={loading || !mpin || !confirmMpin || (hasExistingMpin && !oldMpin)}
              >
                {loading ? 'Saving...' : pageCopy.submitLabel}
              </button>
              {onCancel ? (
                <button
                  type="button"
                  className="mpin-secondary-button"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default MPINSetup;
