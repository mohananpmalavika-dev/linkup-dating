import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import '../styles/DatingSignUp.css';

/**
 * DatingSignUp Component
 * Sign up for dating app with profile creation
 */
const DatingSignUp = ({ onSignUpSuccess, onLoginClick }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: Profile, 3: Photos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    // Step 1: Auth
    email: '',
    password: '',
    confirmPassword: '',
    // Step 2: Profile
    firstName: '',
    age: '',
    gender: 'female',
    city: '',
    state: '',
    country: '',
    bio: '',
    relationshipGoals: 'dating',
    interests: [],
    height: '',
    occupation: '',
    education: '',
    // Step 3: Photos
    photos: [],
  });

  const INTERESTS = [
    'Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Sports',
    'Hiking', 'Photography', 'Reading', 'Movies', 'Yoga', 'Meditation',
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...files]
    }));
  };

  const handleStep1 = async () => {
    setError('');
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    setError('');
    if (!formData.firstName || !formData.age || !formData.city) {
      setError('Please fill in all required fields');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();

      // Auth info
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);

      // Profile info
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('age', formData.age);
      formDataToSend.append('gender', formData.gender);
      formDataToSend.append('city', formData.city);
      formDataToSend.append('state', formData.state);
      formDataToSend.append('country', formData.country);
      formDataToSend.append('bio', formData.bio);
      formDataToSend.append('relationshipGoals', formData.relationshipGoals);
      formDataToSend.append('interests', JSON.stringify(formData.interests));
      formDataToSend.append('height', formData.height);
      formDataToSend.append('occupation', formData.occupation);
      formDataToSend.append('education', formData.education);

      // Photos
      formData.photos.forEach((photo, idx) => {
        formDataToSend.append(`photos`, photo);
      });

      const response = await axios.post(`${API_BASE_URL}/dating/signup`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSignUpSuccess?.(response.data.token, response.data.user);
      setSuccess('Account created successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dating-signup-container">
      <div className="signup-card">
        <h1>Create Your Dating Profile</h1>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Step Indicators */}
        <div className="step-indicators">
          {[1, 2, 3].map(s => (
            <div key={s} className={`step ${s <= step ? 'active' : ''}`}>
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Email & Password */}
        {step === 1 && (
          <div className="signup-step">
            <h2>Create Your Account</h2>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••"
              />
            </div>
            <button className="btn-next" onClick={handleStep1}>Next</button>
          </div>
        )}

        {/* Step 2: Profile Info */}
        {step === 2 && (
          <div className="signup-step">
            <h2>Tell Us About Yourself</h2>
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Your name"
                />
              </div>
              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  placeholder="Age"
                  min="18"
                  max="100"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleInputChange}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-Binary</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="Your city"
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="State"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell others about yourself"
                rows="3"
              ></textarea>
            </div>

            <div className="form-group">
              <label>Looking For</label>
              <select name="relationshipGoals" value={formData.relationshipGoals} onChange={handleInputChange}>
                <option value="casual">Casual Dating</option>
                <option value="dating">Looking to Date</option>
                <option value="relationship">Serious Relationship</option>
                <option value="marriage">Marriage</option>
              </select>
            </div>

            <div className="form-group">
              <label>Interests</label>
              <div className="interests-grid">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    className={`interest-btn ${formData.interests.includes(interest) ? 'selected' : ''}`}
                    onClick={() => handleInterestToggle(interest)}
                    type="button"
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Height (cm)</label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  placeholder="160"
                />
              </div>
              <div className="form-group">
                <label>Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleInputChange}
                  placeholder="Your job"
                />
              </div>
            </div>

            <div className="button-group">
              <button className="btn-back" onClick={() => setStep(1)}>Back</button>
              <button className="btn-next" onClick={handleStep2}>Next</button>
            </div>
          </div>
        )}

        {/* Step 3: Photos */}
        {step === 3 && (
          <div className="signup-step">
            <h2>Add Your Photos</h2>
            <p>Add at least 1 photo (up to 6)</p>

            <div className="photo-upload-area">
              <label className="upload-button">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
                📸 Add Photos
              </label>
              <p>Click to upload or drag and drop</p>
            </div>

            {formData.photos.length > 0 && (
              <div className="photo-preview">
                <h3>Your Photos ({formData.photos.length})</h3>
                <div className="photos-grid">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="photo-item">
                      <img src={URL.createObjectURL(photo)} alt={`Photo ${idx + 1}`} />
                      <button
                        className="btn-remove"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            photos: prev.photos.filter((_, i) => i !== idx)
                          }));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="button-group">
              <button className="btn-back" onClick={() => setStep(2)}>Back</button>
              <button
                className="btn-submit"
                onClick={handleSubmit}
                disabled={loading || formData.photos.length === 0}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </div>
        )}

        {/* Login Link */}
        <div className="login-link">
          Already have an account? <button onClick={onLoginClick}>Log in</button>
        </div>
      </div>
    </div>
  );
};

export default DatingSignUp;
