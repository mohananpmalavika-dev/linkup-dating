import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/AdminCouponManager.css';

const AdminCouponManager = () => {
  const [activeTab, setActiveTab] = useState('list');
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form state for creating coupon
  const [formData, setFormData] = useState({
    code: '',
    couponType: 'both',
    likesValue: 10,
    superlikesValue: 5,
    maxRedemptions: null,
    expiryDate: '',
    description: '',
    minUserLevel: 0,
    targetUserIds: ''
  });

  const token = localStorage.getItem('token');

  const apiClient = axios.create({
    baseURL: '/api',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  // Fetch coupons list
  const fetchCoupons = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/admin/coupons', {
        params: { page: pageNum, limit: 10 }
      });

      setCoupons(response.data.coupons || []);
      setTotalPages(Math.ceil(response.data.total / 10));
      setPage(pageNum);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  // Create coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      setError('Coupon code is required');
      return;
    }

    if (formData.couponType !== 'both' && formData.likesValue === 0 && formData.superlikesValue === 0) {
      setError('Please enter likes or superlikes value');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        code: formData.code.toUpperCase(),
        couponType: formData.couponType,
        likesValue: parseInt(formData.likesValue) || 0,
        superlikesValue: parseInt(formData.superlikesValue) || 0,
        maxRedemptions: formData.maxRedemptions ? parseInt(formData.maxRedemptions) : null,
        expiryDate: formData.expiryDate || null,
        description: formData.description,
        minUserLevel: parseInt(formData.minUserLevel) || 0,
        targetUserIds: formData.targetUserIds || null
      };

      const response = await apiClient.post('/admin/coupons', payload);

      setSuccess(`✓ Coupon ${formData.code} created successfully!`);
      setFormData({
        code: '',
        couponType: 'both',
        likesValue: 10,
        superlikesValue: 5,
        maxRedemptions: null,
        expiryDate: '',
        description: '',
        minUserLevel: 0,
        targetUserIds: ''
      });

      // Refresh coupons list
      fetchCoupons(1);
      setActiveTab('list');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  // Update coupon
  const handleUpdateCoupon = async (couponId) => {
    try {
      setLoading(true);
      setError('');

      const payload = {
        isActive: selectedCoupon.is_active,
        maxRedemptions: selectedCoupon.max_redemptions,
        expiryDate: selectedCoupon.expiry_date,
        description: selectedCoupon.description
      };

      await apiClient.put(`/admin/coupons/${couponId}`, payload);

      setSuccess('✓ Coupon updated successfully!');
      fetchCoupons(page);
      setSelectedCoupon(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update coupon');
    } finally {
      setLoading(false);
    }
  };

  // Delete coupon
  const handleDeleteCoupon = async (couponId, couponCode) => {
    if (!window.confirm(`Delete coupon ${couponCode}?`)) return;

    try {
      setLoading(true);
      setError('');

      await apiClient.delete(`/admin/coupons/${couponId}`);

      setSuccess(`✓ Coupon ${couponCode} deleted!`);
      fetchCoupons(page);
      setSelectedCoupon(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete coupon');
    } finally {
      setLoading(false);
    }
  };

  // Get coupon usage analytics
  const handleViewUsage = async (couponId) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/admin/coupons/${couponId}/usage`);

      setSelectedCoupon({
        ...selectedCoupon,
        usages: response.data.usages
      });
      setActiveTab('usage');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch coupon usage');
    } finally {
      setLoading(false);
    }
  };

  // Initialize
  useEffect(() => {
    fetchCoupons(1);
  }, []);

  const renderListTab = () => (
    <div className="coupon-list-section">
      <div className="section-header">
        <h3>Active Coupons</h3>
        <button
          className="btn btn-primary"
          onClick={() => setActiveTab('create')}
        >
          + Create Coupon
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading && <div className="loading">Loading coupons...</div>}

      {!loading && coupons.length === 0 && (
        <div className="empty-state">
          <p>No coupons yet. Create one to get started!</p>
        </div>
      )}

      {!loading && coupons.length > 0 && (
        <>
          <div className="table-responsive">
            <table className="coupon-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Likes</th>
                  <th>Superlikes</th>
                  <th>Max Redemptions</th>
                  <th>Redeemed</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <strong>{coupon.code}</strong>
                    </td>
                    <td>{coupon.coupon_type}</td>
                    <td>{coupon.likes_value || '-'}</td>
                    <td>{coupon.superlikes_value || '-'}</td>
                    <td>{coupon.max_redemptions || 'Unlimited'}</td>
                    <td>
                      {coupon.current_redemptions}/{coupon.max_redemptions || '∞'}
                    </td>
                    <td>
                      {coupon.expiry_date
                        ? new Date(coupon.expiry_date).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${coupon.is_active ? 'active' : 'inactive'}`}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-small btn-info"
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            handleViewUsage(coupon.id);
                          }}
                        >
                          Usage
                        </button>
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            setActiveTab('edit');
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => fetchCoupons(page - 1)}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => fetchCoupons(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderCreateTab = () => (
    <div className="coupon-form-section">
      <div className="form-header">
        <h3>Create New Coupon</h3>
        <button
          className="btn btn-text"
          onClick={() => {
            setActiveTab('list');
            setError('');
          }}
        >
          ← Back
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleCreateCoupon} className="coupon-form">
        <div className="form-group">
          <label>Coupon Code *</label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., SUMMER2024"
            maxLength="50"
            required
          />
          <small>Uppercase alphanumeric, max 50 characters</small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Coupon Type *</label>
            <select
              value={formData.couponType}
              onChange={(e) => setFormData({ ...formData, couponType: e.target.value })}
            >
              <option value="likes">Likes Only</option>
              <option value="superlikes">Superlikes Only</option>
              <option value="both">Both Likes & Superlikes</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Likes Value</label>
            <input
              type="number"
              min="0"
              value={formData.likesValue}
              onChange={(e) => setFormData({ ...formData, likesValue: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="form-group">
            <label>Superlikes Value</label>
            <input
              type="number"
              min="0"
              value={formData.superlikesValue}
              onChange={(e) => setFormData({ ...formData, superlikesValue: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Max Redemptions</label>
            <input
              type="number"
              min="1"
              value={formData.maxRedemptions}
              onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
              placeholder="Leave blank for unlimited"
            />
          </div>

          <div className="form-group">
            <label>Expiry Date</label>
            <input
              type="datetime-local"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              placeholder="Leave blank for no expiry"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Min User Level</label>
            <input
              type="number"
              min="0"
              value={formData.minUserLevel}
              onChange={(e) => setFormData({ ...formData, minUserLevel: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Target User IDs (comma-separated)</label>
          <textarea
            value={formData.targetUserIds}
            onChange={(e) => setFormData({ ...formData, targetUserIds: e.target.value })}
            placeholder="Leave blank to allow all users. e.g., 123,456,789"
            rows="3"
          />
          <small>If specified, only these users can redeem the coupon</small>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Internal notes about this coupon"
            rows="3"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
          {loading ? 'Creating...' : 'Create Coupon'}
        </button>
      </form>
    </div>
  );

  const renderEditTab = () => {
    if (!selectedCoupon) return null;

    return (
      <div className="coupon-edit-section">
        <div className="form-header">
          <h3>Edit Coupon: {selectedCoupon.code}</h3>
          <button
            className="btn btn-text"
            onClick={() => {
              setActiveTab('list');
              setSelectedCoupon(null);
            }}
          >
            ← Back
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="edit-form">
          <div className="form-group">
            <label>Status</label>
            <select
              value={selectedCoupon.is_active ? 'active' : 'inactive'}
              onChange={(e) =>
                setSelectedCoupon({
                  ...selectedCoupon,
                  is_active: e.target.value === 'active'
                })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="form-group">
            <label>Max Redemptions</label>
            <input
              type="number"
              min="1"
              value={selectedCoupon.max_redemptions || ''}
              onChange={(e) =>
                setSelectedCoupon({
                  ...selectedCoupon,
                  max_redemptions: e.target.value ? parseInt(e.target.value) : null
                })
              }
              placeholder="Unlimited if blank"
            />
          </div>

          <div className="form-group">
            <label>Expiry Date</label>
            <input
              type="datetime-local"
              value={selectedCoupon.expiry_date || ''}
              onChange={(e) =>
                setSelectedCoupon({
                  ...selectedCoupon,
                  expiry_date: e.target.value || null
                })
              }
              placeholder="Never if blank"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={selectedCoupon.description || ''}
              onChange={(e) =>
                setSelectedCoupon({
                  ...selectedCoupon,
                  description: e.target.value
                })
              }
              rows="3"
            />
          </div>

          <div className="stats">
            <div className="stat-card">
              <h4>Redemptions</h4>
              <p>
                {selectedCoupon.current_redemptions} / {selectedCoupon.max_redemptions || '∞'}
              </p>
            </div>
            <div className="stat-card">
              <h4>Created</h4>
              <p>{new Date(selectedCoupon.created_at).toLocaleDateString()}</p>
            </div>
            <div className="stat-card">
              <h4>Credits</h4>
              <p>
                {selectedCoupon.likes_value} Likes, {selectedCoupon.superlikes_value} Superlikes
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={() => handleUpdateCoupon(selectedCoupon.id)}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  };

  const renderUsageTab = () => {
    if (!selectedCoupon || !selectedCoupon.usages) return null;

    return (
      <div className="coupon-usage-section">
        <div className="form-header">
          <h3>Coupon Usage: {selectedCoupon.code}</h3>
          <button
            className="btn btn-text"
            onClick={() => {
              setActiveTab('list');
              setSelectedCoupon(null);
            }}
          >
            ← Back
          </button>
        </div>

        <div className="usage-stats">
          <div className="stat-card">
            <h4>Total Redeemed</h4>
            <p>{selectedCoupon.usages.length}</p>
          </div>
          <div className="stat-card">
            <h4>Total Likes Granted</h4>
            <p>{selectedCoupon.usages.reduce((sum, u) => sum + (u.likes_granted || 0), 0)}</p>
          </div>
          <div className="stat-card">
            <h4>Total Superlikes Granted</h4>
            <p>{selectedCoupon.usages.reduce((sum, u) => sum + (u.superlikes_granted || 0), 0)}</p>
          </div>
        </div>

        {selectedCoupon.usages.length === 0 ? (
          <div className="empty-state">
            <p>No users have redeemed this coupon yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>User Name</th>
                  <th>Likes Granted</th>
                  <th>Superlikes Granted</th>
                  <th>Redeemed At</th>
                </tr>
              </thead>
              <tbody>
                {selectedCoupon.usages.map((usage, idx) => (
                  <tr key={idx}>
                    <td>{usage.email || 'N/A'}</td>
                    <td>{usage.first_name || 'N/A'}</td>
                    <td>{usage.likes_granted}</td>
                    <td>{usage.superlikes_granted}</td>
                    <td>{new Date(usage.redeemed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-coupon-manager">
      <div className="coupon-header">
        <h2>Coupon Management</h2>
        <p>Create and manage promotional coupons for likes and superlikes</p>
      </div>

      <div className="coupon-tabs">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('list');
            setError('');
          }}
        >
          📋 Coupons List
        </button>
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('create');
            setError('');
            setSuccess('');
          }}
        >
          ➕ Create Coupon
        </button>
        {selectedCoupon && activeTab === 'edit' && (
          <button className={`tab-btn active`}>
            ✏️ Edit Coupon
          </button>
        )}
        {selectedCoupon && activeTab === 'usage' && (
          <button className={`tab-btn active`}>
            📊 Usage Analytics
          </button>
        )}
      </div>

      <div className="coupon-content">
        {activeTab === 'list' && renderListTab()}
        {activeTab === 'create' && renderCreateTab()}
        {activeTab === 'edit' && renderEditTab()}
        {activeTab === 'usage' && renderUsageTab()}
      </div>
    </div>
  );
};

export default AdminCouponManager;
