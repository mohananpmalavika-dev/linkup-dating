import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router';
import AccountSettings from './AccountSettings';
import { VideoIntroUploader } from './VideoIntroUploader';
import { VideoAuthenticationResult } from './VideoAuthenticationResult';
import CouponRedemption from './CouponRedemption';
import BadgeDisplay from './BadgeDisplay';
import useAchievements from '../hooks/useAchievements';
import DailyChallengesWidget from './DailyChallengesWidget';
import BoostButton from './BoostButton';
import IcebreakerVideoRecorder from './IcebreakerVideoRecorder';
import IcebreakerVideoGallery from './IcebreakerVideoGallery';
import useIcebreakerVideos from '../hooks/useIcebreakerVideos';
import MomentsUpload from './MomentsUpload';
import useMoments from '../hooks/useMoments';
import useAnalytics from '../hooks/useAnalytics';
import useVideoProfile from '../hooks/useVideoProfile';
import useEventDetails from '../hooks/useEventDetails';
import datingProfileService from '../services/datingProfileService';
import {
  buildLocalIdentityPack,
  buildTrustSummary
} from '../utils/datingPhaseTwo';
import '../styles/DatingProfile.css';

const defaultVerificationForm = {
  verificationType: 'id',
  verificationValue: '',
  document: null
};

const formatSearchHistoryLabel = (entry) => {
  const filters = entry?.filters || {};
  const parts = [];

  if (filters.ageRange?.min || filters.ageRange?.max) {
    parts.push(`Age ${filters.ageRange?.min || 18}-${filters.ageRange?.max || 99}`);
  }

  if (filters.heightRange?.min || filters.heightRange?.max) {
    parts.push(`Height ${filters.heightRange?.min || '?'}-${filters.heightRange?.max || '?'}`);
  }

  if (Array.isArray(filters.relationshipGoals) && filters.relationshipGoals.length > 0) {
    parts.push(filters.relationshipGoals.join(', '));
  } else if (filters.relationshipGoals) {
    parts.push(String(filters.relationshipGoals));
  }

  if (Array.isArray(filters.interests) && filters.interests.length > 0) {
    parts.push(filters.interests.join(', '));
  } else if (filters.interests) {
    parts.push(String(filters.interests));
  }

  return parts.length > 0 ? parts.join(' | ') : 'General discovery refresh';
};

const DatingProfile = ({ onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [editData, setEditData] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [verificationForm, setVerificationForm] = useState(defaultVerificationForm);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [stats, setStats] = useState({
    likes: 0,
    matches: 0,
    completion: 0
  });
  const [dailyLimits, setDailyLimits] = useState({
    remainingLikes: 50,
    remainingSuperlikes: 1,
    likeLimit: 50,
    superlikeLimit: 1
  });
  const [dailyPrompts, setDailyPrompts] = useState([]);
  const [answeredPrompts, setAnsweredPrompts] = useState([]);
  const [showPromptsEditor, setShowPromptsEditor] = useState(false);
  const [promptDraft, setPromptDraft] = useState({});
  const [notificationPreferences, setNotificationPreferences] = useState({
    newMatch: true,
    newMessage: true,
    likeReceived: true,
    superlikeReceived: true,
    profileViewed: false,
    dailyDigest: false,
    weeklyDigest: true,
    pushEnabled: true,
    emailEnabled: false
  });
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);

  // Phase 3: Photo verification
  const [verificationStatus, setVerificationStatus] = useState('none');
  const [showPhotoVerification, setShowPhotoVerification] = useState(false);
  const [verificationChallenge, setVerificationChallenge] = useState(null);
  const [verificationPhoto, setVerificationPhoto] = useState(null);
  const [verifyingPhoto, setVerifyingPhoto] = useState(false);

  // Phase 3: Subscription
  const [subscription, setSubscription] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Phase 4: Analytics
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [profileViews, setProfileViews] = useState({ viewers: [], isPremium: false, totalCount: 0 });
  const [showProfileViews, setShowProfileViews] = useState(false);
  const [premiumDashboard, setPremiumDashboard] = useState(null);
  const [trustScoreData, setTrustScoreData] = useState(null);
  const [showVoiceIntroUploader, setShowVoiceIntroUploader] = useState(false);
  const [voiceIntroFile, setVoiceIntroFile] = useState(null);
  const [voiceIntroDurationSeconds, setVoiceIntroDurationSeconds] = useState(null);
  const [uploadingVoiceIntro, setUploadingVoiceIntro] = useState(false);

  // Phase 4b: Video intro (Premium Feature)
  const [showVideoIntroUploader, setShowVideoIntroUploader] = useState(false);
  const [videoAuthResult, setVideoAuthResult] = useState(null);
  const [videoAuthLoading, setVideoAuthLoading] = useState(false);
  
  // Icebreaker Videos
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const { myVideos, activeVideo, loading: videosLoading, fetchMyVideos, uploadVideo: uploadIcebreakerVideo } = useIcebreakerVideos();

  // Moments Stories
  const [showMomentsUpload, setShowMomentsUpload] = useState(false);
  const { userMoments, stats: momentsStats, loading: momentsLoading, fetchMoments, uploadMoment } = useMoments();

// Analytics Dashboard
  const { personalStats, profilePerformance, matchRatePercentage, profileViews: analyticsProfileViews, likesReceived, recommendationCount, fetchAnalytics } = useAnalytics();

  // Video Profile
  const { hasVideoProfile, videoDuration, authenticationStatus, isAuthenticated, authenticationScore, fetchVideoProfile, uploadVideo: uploadVideoIntro, deleteVideo: deleteVideoIntro, recheckFraud: recheckVideoFraud } = useVideoProfile();

  // Event Details
  const { hasUpcomingEvents, nextEvent, totalUpcomingEvents, totalEventAttendees, averageEventRating, fetchUpcomingEvents } = useEventDetails();
  
  const navigate = useNavigate();
  
  // Achievements & Gamification
  const { unlockedAchievements, achievementNotification } = useAchievements(profile?.userId);

  const completionChecklist = [
    {
      key: 'bio',
      label: 'Add a bio',
      done: Boolean(profile?.bio && profile.bio.trim()),
      hint: 'Write a short intro so matches can get a feel for your personality.'
    },
    {
      key: 'photos',
      label: 'Add at least 3 photos',
      done: Array.isArray(profile?.photos) && profile.photos.length >= 3,
      hint: 'Profiles with multiple clear photos usually get more attention.'
    },
    {
      key: 'interests',
      label: 'Add interests',
      done: Array.isArray(profile?.interests) && profile.interests.length > 0,
      hint: 'Interests help us suggest better matches and conversation starters.'
    },
    {
      key: 'goals',
      label: 'Set relationship goals',
      done: Boolean(profile?.relationshipGoals),
      hint: 'Tell people what you are looking for to improve match quality.'
    },
    {
      key: 'voiceIntro',
      label: 'Add a voice intro',
      done: Boolean(profile?.voiceIntroUrl),
      hint: 'A short voice intro helps your profile feel more human and memorable.'
    },
    {
      key: 'videoIntro',
      label: 'Add a video intro (Premium)',
      done: Boolean(profile?.videoIntroUrl),
      hint: 'Video intros get 30% more matches! This premium feature unlocks authenticity verification.'
    },
    {
      key: 'verification',
      label: 'Complete verification',
      done: Boolean(profile?.verifications?.email && profile?.verifications?.phone && profile?.verifications?.id),
      hint: 'Verified profiles build more trust and can improve response rates.'
    }
  ];

  const completedSteps = completionChecklist.filter((item) => item.done).length;
  const completionPercent = Math.round((completedSteps / completionChecklist.length) * 100);
  const missingSteps = completionChecklist.filter((item) => !item.done);
  const identityPack = useMemo(() => buildLocalIdentityPack(profile || {}), [profile]);
  const trustSummary = useMemo(
    () => buildTrustSummary({
      profile: profile || {},
      trustScore: trustScoreData,
      verificationStatus: {
        verificationStatus
      }
    }),
    [profile, trustScoreData, verificationStatus]
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const [profileData, matchesData, likesData, completionData] = await Promise.all([
        datingProfileService.getMyProfile(),
        datingProfileService.getMatches(100),
        datingProfileService.getLikesReceived(100),
        datingProfileService.getProfileCompletion()
      ]);

      const [
        favoritesData,
        blockedUsersData,
        searchHistoryData,
        notificationsData,
        dailyLimitsData
      ] = await Promise.all([
        datingProfileService.getFavorites().catch(() => ({ favorites: [] })),
        datingProfileService.getBlockedUsers().catch(() => ({ blockedUsers: [] })),
        datingProfileService.getSearchHistory(8).catch(() => ({ history: [] })),
        datingProfileService.getNotifications(10).catch(() => ({ notifications: [], unreadCount: 0 })),
        datingProfileService.getDailyLimits().catch(() => ({ remainingLikes: 50, remainingSuperlikes: 1, likeLimit: 50, superlikeLimit: 1 }))
      ]);

      setProfile(profileData);
      setEditData({
        ...profileData,
        bio: profileData.bio || '',
        interests: Array.isArray(profileData.interests) ? profileData.interests : [],
        relationshipGoals: profileData.relationshipGoals || ''
      });
      setFavorites(Array.isArray(favoritesData.favorites) ? favoritesData.favorites : []);
      setBlockedUsers(Array.isArray(blockedUsersData.blockedUsers) ? blockedUsersData.blockedUsers : []);
      setSearchHistory(Array.isArray(searchHistoryData.history) ? searchHistoryData.history : []);
      setNotifications(Array.isArray(notificationsData.notifications) ? notificationsData.notifications : []);
      setUnreadNotificationCount(Number(notificationsData.unreadCount || 0));
      setDailyLimits({
        remainingLikes: dailyLimitsData.remainingLikes ?? 50,
        remainingSuperlikes: dailyLimitsData.remainingSuperlikes ?? 1,
        likeLimit: dailyLimitsData.likeLimit ?? 50,
        superlikeLimit: dailyLimitsData.superlikeLimit ?? 1
      });

      // Load daily prompts and notification preferences
      const [promptsData, profilePromptsData, notifPrefsData] = await Promise.all([
        datingProfileService.getDailyPrompts().catch(() => ({ prompts: [] })),
        datingProfileService.getProfilePrompts().catch(() => ({ prompts: [] })),
        datingProfileService.getNotificationPreferences().catch(() => ({
          newMatch: true, newMessage: true, likeReceived: true, superlikeReceived: true,
          profileViewed: false, dailyDigest: false, weeklyDigest: true,
          pushEnabled: true, emailEnabled: false
        }))
      ]);

      setDailyPrompts(promptsData.prompts || []);
      setAnsweredPrompts(profilePromptsData.prompts || []);
      setNotificationPreferences(notifPrefsData);

      // Phase 3: Load verification status and subscription
      const [verificationData, subscriptionData, plansData, premiumDashboardData, trustScorePayload] = await Promise.all([
        datingProfileService.getVerificationStatus().catch(() => ({ verificationStatus: 'none', profileVerified: false })),
        datingProfileService.getMySubscription().catch(() => ({ plan: 'free', isPremium: false, isGold: false })),
        datingProfileService.getSubscriptionPlans().catch(() => ({ plans: [] })),
        datingProfileService.getPremiumDashboard().catch(() => null),
        profileData?.userId
          ? datingProfileService.getProfileTrustScore(profileData.userId).catch(() => null)
          : Promise.resolve(null)
      ]);

      setVerificationStatus(verificationData.verificationStatus || 'none');
      setSubscription(subscriptionData);
      setSubscriptionPlans(plansData.plans || []);
      setPremiumDashboard(premiumDashboardData);
      setTrustScoreData(trustScorePayload);
      setStats({
        likes: Array.isArray(likesData) ? likesData.length : 0,
        matches: matchesData.matches?.length || 0,
        completion: completionData.profileCompletionPercent || profileData.profileCompletionPercent || 0
      });

      // Phase 4: Load analytics
      const analyticsData = await datingProfileService.getProfileAnalytics().catch(() => null);
      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (loadError) {
      setError('Failed to load profile');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    fetchMyVideos();
    fetchMoments();
    fetchVideoProfile();
    fetchUpcomingEvents();
  }, []);

  const handleSaveProfile = async () => {
    try {
      setError('');

      const response = await datingProfileService.updateProfile({
        bio: editData.bio,
        interests: editData.interests,
        relationshipGoals: editData.relationshipGoals
      });

      setProfile(response.profile);
      setEditData({
        ...response.profile,
        bio: response.profile?.bio || '',
        interests: Array.isArray(response.profile?.interests) ? response.profile.interests : [],
        relationshipGoals: response.profile?.relationshipGoals || ''
      });
      setStats((currentStats) => ({
        ...currentStats,
        completion: response.profile?.profileCompletionPercent || currentStats.completion
      }));
      setEditing(false);
    } catch (saveError) {
      setError('Failed to save profile');
      console.error(saveError);
    }
  };

  const handleVerifyIdentity = async () => {
    setVerificationLoading(true);
    setError('');

    try {
      await datingProfileService.verifyIdentity({
        verificationType: verificationForm.verificationType,
        verificationValue: verificationForm.verificationValue,
        document: verificationForm.document
      });
      setVerificationForm(defaultVerificationForm);
      await loadProfile();
    } catch (verificationError) {
      setError(verificationError || 'Failed to submit verification');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await datingProfileService.unblockUser(userId);
      await loadProfile();
    } catch (unblockError) {
      setError(unblockError || 'Failed to unblock user');
    }
  };

  const handleClearSearchHistory = async () => {
    try {
      await datingProfileService.clearSearchHistory();
      setSearchHistory([]);
    } catch (historyError) {
      setError(historyError || 'Failed to clear search history');
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await datingProfileService.markNotificationRead(notificationId);
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
      setUnreadNotificationCount((currentCount) => Math.max(0, currentCount - 1));
    } catch (notificationError) {
      setError(notificationError || 'Failed to update notification');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await datingProfileService.markAllNotificationsRead();
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({ ...notification, isRead: true }))
      );
      setUnreadNotificationCount(0);
    } catch (notificationError) {
      setError(notificationError || 'Failed to update notifications');
    }
  };

  const handleAnswerPrompt = async (promptId) => {
    const response = promptDraft[promptId]?.trim();
    if (!response) return;

    try {
      await datingProfileService.answerDailyPrompt(promptId, response);
      const updatedPrompts = await datingProfileService.getProfilePrompts();
      setAnsweredPrompts(updatedPrompts.prompts || []);
      setPromptDraft((current) => ({ ...current, [promptId]: '' }));
    } catch (err) {
      setError('Failed to save prompt answer');
      console.error(err);
    }
  };

  const handleDeletePromptAnswer = async (promptId) => {
    try {
      await datingProfileService.deleteDailyPromptAnswer(promptId);
      const updatedPrompts = await datingProfileService.getProfilePrompts();
      setAnsweredPrompts(updatedPrompts.prompts || []);
    } catch (err) {
      setError('Failed to delete prompt answer');
      console.error(err);
    }
  };

  const handleUpdateNotificationPreferences = async (updates) => {
    const nextPreferences = { ...notificationPreferences, ...updates };
    setNotificationPreferences(nextPreferences);

    try {
      await datingProfileService.updateNotificationPreferences(nextPreferences);
    } catch (err) {
      setError('Failed to update notification preferences');
      console.error(err);
    }
  };

  // Phase 3: Photo verification handlers
  const handleStartPhotoVerification = async () => {
    try {
      setVerifyingPhoto(true);
      setError('');
      const challenge = await datingProfileService.getVerificationChallenge();
      setVerificationChallenge(challenge);
      setShowPhotoVerification(true);
    } catch (err) {
      setError(err || 'Failed to start verification');
    } finally {
      setVerifyingPhoto(false);
    }
  };

  const handleCaptureVerificationPhoto = async () => {
    if (!verificationPhoto) {
      setError('Please capture a photo first');
      return;
    }

    try {
      setVerifyingPhoto(true);
      setError('');
      const result = await datingProfileService.verifyPhoto(verificationPhoto);
      setVerificationStatus(result.verificationStatus || 'approved');
      setShowPhotoVerification(false);
      setVerificationPhoto(null);
      setVerificationChallenge(null);
      await loadProfile();
    } catch (err) {
      setError(err || 'Photo verification failed');
    } finally {
      setVerifyingPhoto(false);
    }
  };

  const handleFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleVerificationFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await handleFileToBase64(file);
      setVerificationPhoto(base64);
    } catch (err) {
      setError('Failed to process photo');
    }
  };

  // Phase 3: Subscription handlers
  const handleSubscribe = async (plan) => {
    try {
      setSubscribing(true);
      setError('');
      await datingProfileService.createSubscription(plan);
      const subData = await datingProfileService.getMySubscription();
      setSubscription(subData);
      setShowSubscription(false);
    } catch (err) {
      setError(err || 'Failed to activate subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;

    try {
      setSubscribing(true);
      setError('');
      await datingProfileService.cancelSubscription();
      const subData = await datingProfileService.getMySubscription();
      setSubscription(subData);
    } catch (err) {
      setError(err || 'Failed to cancel subscription');
    } finally {
      setSubscribing(false);
    }
  };

  // Phase 4: Analytics handlers
  const handleLoadAnalytics = async () => {
    try {
      const analyticsData = await datingProfileService.getProfileAnalytics();
      setAnalytics(analyticsData);
      setShowAnalytics(true);
    } catch (err) {
      setError(err || 'Failed to load analytics');
    }
  };

  const handleLoadProfileViews = async () => {
    try {
      const viewsData = await datingProfileService.getProfileViews();
      setProfileViews(viewsData);
      setShowProfileViews(true);
    } catch (err) {
      setError(err || 'Failed to load profile views');
    }
  };

  const getAudioDurationSeconds = (file) =>
    new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      const objectUrl = URL.createObjectURL(file);

      audio.preload = 'metadata';
      audio.src = objectUrl;

      audio.onloadedmetadata = () => {
        const duration = Math.round(audio.duration || 0);
        URL.revokeObjectURL(objectUrl);
        resolve(duration);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read audio metadata'));
      };
    });

  const handleVoiceIntroSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file for your voice intro.');
      return;
    }

    try {
      setError('');
      const duration = await getAudioDurationSeconds(file);

      if (duration < 15 || duration > 30) {
        setVoiceIntroFile(null);
        setVoiceIntroDurationSeconds(null);
        setError('Voice intros must be between 15 and 30 seconds.');
        return;
      }

      setVoiceIntroFile(file);
      setVoiceIntroDurationSeconds(duration);
    } catch (voiceError) {
      setVoiceIntroFile(null);
      setVoiceIntroDurationSeconds(null);
      setError('Failed to inspect the audio file. Try another recording.');
    }
  };

  const handleUploadVoiceIntro = async () => {
    if (!voiceIntroFile || !voiceIntroDurationSeconds) {
      setError('Select a 15-30 second voice intro first.');
      return;
    }

    try {
      setUploadingVoiceIntro(true);
      setError('');
      await datingProfileService.uploadVoiceIntro(voiceIntroFile, voiceIntroDurationSeconds);
      setShowVoiceIntroUploader(false);
      setVoiceIntroFile(null);
      setVoiceIntroDurationSeconds(null);
      await loadProfile();
    } catch (voiceError) {
      setError(voiceError || 'Failed to upload voice intro');
    } finally {
      setUploadingVoiceIntro(false);
    }
  };

  const handleVideoIntroUploadSuccess = async (uploadResult, videoDetails) => {
    // Close uploader
    setShowVideoIntroUploader(false);
    
    // Display authentication result if available
    if (uploadResult?.authentication) {
      setVideoAuthResult(uploadResult.authentication);
    }
    
    // Reload profile
    await loadProfile();
  };

  const handleVideoIntroRetryFraud = async () => {
    try {
      setVideoAuthLoading(true);
      setError('');
      const result = await datingProfileService.recheckVideoFraud();
      if (result?.authentication) {
        setVideoAuthResult(result.authentication);
      }
    } catch (err) {
      setError(err || 'Failed to retry fraud detection');
    } finally {
      setVideoAuthLoading(false);
    }
  };

  const handleVideoIntroDelete = async () => {
    if (!window.confirm('Remove your video intro?')) {
      return;
    }

    try {
      setError('');
      await datingProfileService.deleteVideoIntro();
      setVideoAuthResult(null);
      await loadProfile();
    } catch (err) {
      setError(err || 'Failed to delete video intro');
    }
  };

  const getLastActiveLabel = (lastActive) => {
    if (!lastActive) return 'Not recently active';
    const diff = Date.now() - new Date(lastActive).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes === 0) return 'Active now';
    if (minutes === 1) return 'Active 1 minute ago';
    if (minutes > 1 && minutes >= 60) return `Active ${minutes} minutes ago`;
    if (hours === 1) return 'Active 1 hour ago';
    if (hours > 1 && hours >= 24) return `Active ${hours} hours ago`;
    if (days === 1) return 'Active yesterday';
    return `Active ${days} days ago`;
  };

  const getProfileStrengthColor = (score) => {
    if (score >= 90) return '#4caf50';
    if (score >= 75) return '#8bc34a';
    if (score >= 50) return '#ffc107';
    if (score >= 25) return '#ff9800';
    return '#f44336';
  };

  if (showAccountSettings) {
    return <AccountSettings onBack={() => setShowAccountSettings(false)} onLogout={onLogout} />;
  }

  if (loading) {
    return (
      <div className="profile-container loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container error">
        <p>{error}</p>
        <button onClick={loadProfile}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dating-profile-container">
      {editing ? (
        <div className="profile-edit">
          <h2>Edit Profile</h2>
          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={editData.bio || ''}
              onChange={(event) => setEditData({ ...editData, bio: event.target.value })}
              placeholder="Tell people about yourself"
            ></textarea>
          </div>
          <div className="form-group">
            <label>Interests</label>
            <input
              type="text"
              value={editData.interests?.join(', ') || ''}
              onChange={(event) => setEditData({
                ...editData,
                interests: event.target.value
                  .split(',')
                  .map((interest) => interest.trim())
                  .filter(Boolean)
              })}
              placeholder="Separate interests with commas"
            />
          </div>
          <div className="form-group">
            <label>Relationship Goals</label>
            <input
              type="text"
              value={editData.relationshipGoals || ''}
              onChange={(event) => setEditData({ ...editData, relationshipGoals: event.target.value })}
              placeholder="dating, relationship, marriage"
            />
          </div>
          <div className="button-group">
            <button onClick={() => setEditing(false)} className="btn-cancel">Cancel</button>
            <button onClick={handleSaveProfile} className="btn-save">Save Changes</button>
          </div>
        </div>
      ) : (
        <div className="profile-view">
          <div className="profile-header-section">
            {profile.photos?.length > 0 ? (
              <div className="profile-photo-main">
                <img src={profile.photos[0]} alt={profile.firstName} />
                {profile.profileVerified ? (
                  <div className="verified-badge">Verified</div>
                ) : null}
              </div>
            ) : (
              <div className="profile-photo-main profile-photo-fallback">
                <span>{profile.firstName?.charAt(0) || '?'}</span>
              </div>
            )}
            <h1>{profile.firstName}, {profile.age}</h1>
            <p className="location">
              {profile.location?.city || 'Unknown city'}
              {profile.location?.state ? `, ${profile.location.state}` : ''}
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.likes}</span>
              <span className="stat-label">Likes</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.matches}</span>
              <span className="stat-label">Matches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.completion}%</span>
              <span className="stat-label">Profile</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{dailyLimits.remainingLikes}</span>
              <span className="stat-label">Likes Left</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{dailyLimits.remainingSuperlikes}</span>
              <span className="stat-label">Superlikes</span>
            </div>
          </div>

          {/* Achievements & Badges Display */}
          {profile?.userId && (
            <div className="profile-section">
              <BadgeDisplay userId={profile.userId} maxBadges={6} compact={false} />
              <div className="achievements-action">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => navigate('/achievements')}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  🏆 View All Achievements
                </button>
              </div>
            </div>
          )}

          {/* Analytics Dashboard Preview */}
          <div className="profile-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>📊 Your Profile Analytics</h3>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => setShowAnalytics(true)}
                style={{ fontSize: '12px' }}
              >
                View Full
              </button>
            </div>
            
            {personalStats?.stats ? (
              <div className="analytics-quick-stats">
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Profile Views</span>
                    <strong>{analyticsProfileViews}</strong>
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Likes Received</span>
                    <strong>{likesReceived}</strong>
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Match Rate</span>
                    <strong>{matchRatePercentage}%</strong>
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Tips Available</span>
                    <strong>{recommendationCount}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: '14px' }}>Loading analytics...</p>
            )}

            <button 
              onClick={() => navigate('/analytics')}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px' }}
            >
              📈 View Detailed Analytics
            </button>
          </div>

          {/* Daily Challenges Widget */}
          <div className="profile-section">
            <DailyChallengesWidget />
          </div>

          {/* Upcoming Events Preview */}
          {hasUpcomingEvents && (
            <div className="profile-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>📅 Upcoming Events</h3>
                <button 
                  className="btn btn-sm btn-secondary"
                  onClick={() => navigate('/events')}
                  style={{ fontSize: '12px' }}
                >
                  View All
                </button>
              </div>
              
              {nextEvent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="event-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>{nextEvent.name}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      📅 {nextEvent.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      📍 {nextEvent.location}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      👥 {nextEvent.attendees} attending • ⭐ {nextEvent.rating}
                    </div>
                  </div>
                  
                  {totalUpcomingEvents > 1 && (
                    <div className="event-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#667eea', fontWeight: '600' }}>
                        +{totalUpcomingEvents - 1} more events coming up
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => navigate('/events')}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px' }}
              >
                🎉 Explore Events
              </button>
            </div>
          )}

          {/* Boost Button */}
          <div className="profile-section">
            <BoostButton 
              onBoostActivated={() => {
                // Profile is now boosted with increased visibility
              }}
              compact={false}
            />
          </div>

          {/* Icebreaker Videos */}
          <div className="profile-section">
            {!showVideoRecorder ? (
              <>
                {myVideos.length === 0 ? (
                  <div className="icebreaker-empty-state">
                    <h3>📹 Record Your Icebreaker Video</h3>
                    <p>Help matches know who you are! Record a quick 5-second video explaining why you're looking for someone.</p>
                    <button 
                      onClick={() => setShowVideoRecorder(true)}
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '12px' }}
                    >
                      🎥 Record First Video
                    </button>
                  </div>
                ) : (
                  <>
                    <IcebreakerVideoGallery 
                      onRecordNew={() => setShowVideoRecorder(true)}
                      videos={myVideos}
                      stats={{
                        total_views: myVideos.reduce((sum, v) => sum + (v.view_count || 0), 0),
                        average_rating: myVideos.length > 0 
                          ? (myVideos.reduce((sum, v) => sum + (v.average_rating || 0), 0) / myVideos.length).toFixed(1)
                          : 'N/A',
                        authenticity_score: myVideos.length > 0 && myVideos[0].authenticity_score 
                          ? myVideos[0].authenticity_score 
                          : 0,
                        total_ratings: myVideos.reduce((sum, v) => sum + (v.like_count || 0), 0)
                      }}
                      onDelete={fetchMyVideos}
                    />
                    <button 
                      onClick={() => navigate('/icebreaker-recorder')}
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '12px' }}
                    >
                      🎬 View Full Gallery & Analytics
                    </button>
                  </>
                )}
              </>
            ) : (
              <IcebreakerVideoRecorder 
                onUploadSuccess={async () => {
                  setShowVideoRecorder(false);
                  await fetchMyVideos();
                }}
                onCancel={() => setShowVideoRecorder(false)}
              />
            )}
          </div>

          {/* Moments Stories */}
          <div className="profile-section">
            {!showMomentsUpload ? (
              <>
                {userMoments.length === 0 ? (
                  <div className="moments-empty-state">
                    <h3>📸 Share Your Moments</h3>
                    <p>Show your matches what you're up to with 24-hour stories! Your moments disappear after 24 hours.</p>
                    <button 
                      onClick={() => setShowMomentsUpload(true)}
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '12px' }}
                    >
                      📸 Share First Moment
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3>Your Moments</h3>
                      <button 
                        onClick={() => setShowMomentsUpload(true)}
                        className="btn btn-sm btn-primary"
                      >
                        + Add Moment
                      </button>
                    </div>
                    <div className="moments-preview-grid">
                      {userMoments.map(moment => (
                        <div key={moment.id} className="moment-preview-card">
                          <img src={moment.photoUrl} alt="moment" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                          <div className="moment-stats" style={{
                            position: 'absolute',
                            bottom: '0',
                            left: '0',
                            right: '0',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                            padding: '8px',
                            display: 'flex',
                            justifyContent: 'space-around',
                            borderRadius: '0 0 8px 8px'
                          }}>
                            <span style={{ color: '#fff', fontSize: '12px' }}>👁️ {moment.viewCount || 0}</span>
                            <span style={{ color: '#fff', fontSize: '12px' }}>⏱️ {Math.ceil((new Date(moment.expiresAt) - new Date()) / (1000 * 60 * 60))}h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => navigate('/moments')}
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '12px' }}
                    >
                      👀 View My Moments
                    </button>
                  </>
                )}
              </>
            ) : (
              <MomentsUpload 
                onUploadSuccess={async () => {
                  setShowMomentsUpload(false);
                  await fetchMoments();
                }}
                onClose={() => setShowMomentsUpload(false)}
              />
            )}
          </div>

          <div className="profile-section completion-section">
            <div className="completion-header">
              <div>
                <h3>Profile completion</h3>
                <p>
                  {completionPercent >= 100
                    ? 'Your profile is fully ready for discovery.'
                    : `You have completed ${completedSteps} of ${completionChecklist.length} recommended steps.`}
                </p>
              </div>
              <div className="completion-pill">{completionPercent}%</div>
            </div>

            <div className="completion-bar" aria-hidden="true">
              <div className="completion-bar-fill" style={{ width: `${completionPercent}%` }}></div>
            </div>

            {missingSteps.length > 0 ? (
              <div className="completion-list">
                {missingSteps.map((item) => (
                  <div key={item.key} className="completion-item">
                    <div className="completion-item-icon">*</div>
                    <div className="completion-item-copy">
                      <strong>{item.label}</strong>
                      <span>{item.hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="completion-all-done">
                Nice work. All profile recommendations are complete.
              </div>
            )}
          </div>

          <div className="profile-section">
            <h3>About</h3>
            <p>{profile.bio || 'Add a bio so people can get to know you.'}</p>

            <div className="details-grid">
              {profile.occupation ? (
                <div className="detail">
                  <span className="label">Occupation</span>
                  <span className="value">{profile.occupation}</span>
                </div>
              ) : null}
              {profile.education ? (
                <div className="detail">
                  <span className="label">Education</span>
                  <span className="value">{profile.education}</span>
                </div>
              ) : null}
              {profile.height ? (
                <div className="detail">
                  <span className="label">Height</span>
                  <span className="value">{profile.height} cm</span>
                </div>
              ) : null}
              {profile.relationshipGoals ? (
                <div className="detail">
                  <span className="label">Looking For</span>
                  <span className="value">{profile.relationshipGoals}</span>
                </div>
              ) : null}
            </div>
          </div>

          {profile.interests?.length > 0 ? (
            <div className="profile-section">
              <h3>Interests</h3>
              <div className="interests-list">
                {profile.interests.map((interest) => (
                  <span key={interest} className="interest-tag">{interest}</span>
                ))}
              </div>
            </div>
          ) : null}

          {profile.photos?.length > 1 ? (
            <div className="profile-section">
              <h3>Photos</h3>
              <div className="photos-gallery">
                {profile.photos.map((photo, index) => (
                  <img key={`${photo}-${index}`} src={photo} alt={`${profile.firstName} ${index + 1}`} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="profile-section voice-intro-section">
            <div className="section-header-row">
              <div>
                <h3>Voice Intro</h3>
                <p>
                  Upload a 15-30 second intro so people can hear your vibe before they message.
                </p>
              </div>
              <button
                type="button"
                className="section-link-btn"
                onClick={() => {
                  setShowVoiceIntroUploader((current) => {
                    const next = !current;
                    if (!next) {
                      setVoiceIntroFile(null);
                      setVoiceIntroDurationSeconds(null);
                    }
                    return next;
                  });
                  setError('');
                }}
              >
                {showVoiceIntroUploader ? 'Close' : profile.voiceIntroUrl ? 'Replace' : 'Add intro'}
              </button>
            </div>

            {profile.voiceIntroUrl ? (
              <div className="voice-intro-card">
                <div className="voice-intro-card-header">
                  <strong>Live on your profile</strong>
                  {profile.voiceIntroDurationSeconds ? (
                    <span>{profile.voiceIntroDurationSeconds}s</span>
                  ) : null}
                </div>
                <audio controls preload="none" className="voice-intro-player" src={profile.voiceIntroUrl}>
                  Your browser does not support audio playback.
                </audio>
                <p className="voice-intro-note">
                  New intros are checked for safety and should stay within the 15-30 second range.
                </p>
              </div>
            ) : (
              <p className="voice-intro-note">
                No voice intro yet. Adding one can make your profile feel warmer and more personal.
              </p>
            )}

            {showVoiceIntroUploader ? (
              <div className="voice-intro-uploader">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleVoiceIntroSelection}
                />
                {voiceIntroFile ? (
                  <div className="voice-intro-draft">
                    <div className="voice-intro-draft-copy">
                      <strong>{voiceIntroFile.name}</strong>
                      <span>{voiceIntroDurationSeconds}s ready to upload</span>
                    </div>
                    <button
                      type="button"
                      className="btn-save"
                      onClick={handleUploadVoiceIntro}
                      disabled={uploadingVoiceIntro}
                    >
                      {uploadingVoiceIntro ? 'Uploading...' : 'Upload intro'}
                    </button>
                  </div>
                ) : (
                  <p className="voice-intro-note">
                    Choose a recording between 15 and 30 seconds. MP3, WAV, M4A, OGG, AAC, and WEBM are supported.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Video Profile Quick Stats */}
          <div className="profile-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>🎥 Video Profile</h3>
              {hasVideoProfile && (
                <span style={{ 
                  fontSize: '12px', 
                  padding: '4px 12px', 
                  background: isAuthenticated ? '#4CAF50' : '#FF9800', 
                  color: '#fff', 
                  borderRadius: '20px'
                }}>
                  {isAuthenticated ? '✓ Verified' : '⚠️ Under Review'}
                </span>
              )}
            </div>

            {hasVideoProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Duration</span>
                    <strong>{videoDuration || 0}s</strong>
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Authenticity Score</span>
                    <strong>{Math.round(authenticationScore * 100)}%</strong>
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Status</span>
                    <strong>{authenticationStatus ? authenticationStatus.replace(/_/g, ' ') : 'pending'}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '12px' }}>
                Add a 15-60 second video intro to boost matches by 30%! Our AI verifies it's really you.
              </p>
            )}

            <button 
              onClick={() => setShowVideoIntroUploader(!showVideoIntroUploader)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px' }}
            >
              {hasVideoProfile ? '🎬 Replace Video' : '📹 Record Video Intro'}
            </button>
          </div>

          {/* Video Intro Section - Premium Feature */}
          <div className="profile-section video-intro-section">
            <div className="section-header-row">
              <div>
                <h3>Video Intro ⭐</h3>
                <p>
                  Upload a 15-60 second video. Get 30% more matches! Our AI verifies it's really you.
                </p>
              </div>
              <button
                type="button"
                className="section-link-btn"
                onClick={() => setShowVideoIntroUploader(!showVideoIntroUploader)}
              >
                {showVideoIntroUploader ? 'Close' : profile.videoIntroUrl ? 'Replace' : 'Add video'}
              </button>
            </div>

            {profile.videoIntroUrl ? (
              <div className="video-intro-card">
                <div className="video-intro-card-header">
                  <strong>Live on your profile</strong>
                  {profile.videoIntroDurationSeconds ? (
                    <span>{profile.videoIntroDurationSeconds}s</span>
                  ) : null}
                </div>
                <video controls preload="metadata" className="video-intro-player" src={profile.videoIntroUrl} />
                <p className="video-intro-note">
                  Status: {profile.videoAuthenticationStatus ? profile.videoAuthenticationStatus.replace(/_/g, ' ') : 'pending'}
                </p>
                {profile.videoAuthenticationScore && (
                  <div className="auth-score-mini">
                    <span>Authenticity: {(profile.videoAuthenticationScore * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="video-intro-placeholder">
                <div className="placeholder-icon">🎥</div>
                <p>No video intro yet. Video intros significantly boost your profile visibility and match rate!</p>
              </div>
            )}

            {showVideoIntroUploader ? (
              <VideoIntroUploader
                isPremium={subscription?.plan === 'premium' || subscription?.plan === 'gold'}
                currentVideoUrl={profile.videoIntroUrl}
                currentDuration={profile.videoIntroDurationSeconds}
                onUploadSuccess={handleVideoIntroUploadSuccess}
                onClose={() => setShowVideoIntroUploader(false)}
              />
            ) : null}

            {videoAuthResult && (
              <div className="video-auth-result-wrapper">
                <VideoAuthenticationResult
                  authentication={videoAuthResult}
                  isPremium={subscription?.plan === 'premium' || subscription?.plan === 'gold'}
                  onRetry={handleVideoIntroRetryFraud}
                  onDelete={handleVideoIntroDelete}
                />
              </div>
            )}
          </div>

          <div className="profile-section">
            <h3>Verification</h3>
            <div className="verification-items">
              {profile.verifications?.email ? (
                <div className="verification-item verified">
                  <span>Email verified</span>
                </div>
              ) : null}
              {profile.verifications?.phone ? (
                <div className="verification-item verified">
                  <span>Phone verified</span>
                </div>
              ) : null}
              {profile.verifications?.id ? (
                <div className="verification-item verified">
                  <span>ID verified</span>
                </div>
              ) : (
                <div className="verification-item pending">
                  <span>Add ID verification</span>
                </div>
              )}
            </div>

            {!profile.verifications?.id ? (
              <div className="verification-form">
                <div className="form-group">
                  <label htmlFor="verification-type">Verification Type</label>
                  <select
                    id="verification-type"
                    value={verificationForm.verificationType}
                    onChange={(event) =>
                      setVerificationForm((currentForm) => ({
                        ...currentForm,
                        verificationType: event.target.value
                      }))
                    }
                  >
                    <option value="id">Government ID</option>
                    <option value="phone">Phone Number</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="verification-value">Reference Value</label>
                  <input
                    id="verification-value"
                    type="text"
                    value={verificationForm.verificationValue}
                    onChange={(event) =>
                      setVerificationForm((currentForm) => ({
                        ...currentForm,
                        verificationValue: event.target.value
                      }))
                    }
                    placeholder="Enter ID number, phone, or email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="verification-document">Upload supporting document</label>
                  <input
                    id="verification-document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) =>
                      setVerificationForm((currentForm) => ({
                        ...currentForm,
                        document: event.target.files?.[0] || null
                      }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="btn-save"
                  onClick={handleVerifyIdentity}
                  disabled={verificationLoading}
                >
                  {verificationLoading ? 'Submitting verification...' : 'Submit Verification'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Trust Ladder</h3>
                <p>Stronger verification, clearer photo checks, and more transparent trust badges.</p>
              </div>
              <span className={`section-meta-pill trust-pill ${trustSummary.level}`}>
                {trustSummary.level === 'trusted'
                  ? 'High trust'
                  : trustSummary.level === 'strong'
                    ? 'Strong trust'
                    : trustSummary.level === 'pending'
                      ? 'Pending'
                      : trustSummary.level === 'basic'
                        ? 'Basic'
                        : 'New'}
              </span>
            </div>

            {trustSummary.badges.length > 0 ? (
              <div className="interests-list">
                {trustSummary.badges.map((badge) => (
                  <span key={badge.label} className={`interest-tag trust-tag ${badge.tone}`}>
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="verification-items trust-ladder">
              {trustSummary.ladder.map((step) => (
                <div
                  key={step.key}
                  className={`verification-item ${step.completed ? 'verified' : 'pending'}`}
                >
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            <div className="verification-items trust-photo-checks">
              {trustSummary.photoChecks.map((check) => (
                <div
                  key={check.label}
                  className={`verification-item ${check.passed ? 'verified' : 'pending'}`}
                >
                  <strong>{check.label}</strong>
                  <span>{check.detail}</span>
                </div>
              ))}
            </div>

            {trustSummary.warnings.length > 0 ? (
              <div className="recommendations-list">
                <p><strong>What to tighten up</strong></p>
                <ul>
                  {trustSummary.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Local Identity Pack</h3>
                <p>City prompts, cultural badges, and local-date suggestions that make your profile feel grounded.</p>
              </div>
              {identityPack.cityVibe ? (
                <span className="section-meta-pill">{identityPack.cityVibe}</span>
              ) : null}
            </div>

            {identityPack.culturalBadges.length > 0 ? (
              <div className="interests-list">
                {identityPack.culturalBadges.map((badge) => (
                  <span key={badge.label} className={`interest-tag identity-tag ${badge.tone}`}>
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}

            {identityPack.cityBasedPrompts.length > 0 ? (
              <div className="recommendations-list">
                <p><strong>City prompts to lean on</strong></p>
                <ul>
                  {identityPack.cityBasedPrompts.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {identityPack.localDateSuggestions.length > 0 ? (
              <div className="recommendations-list">
                <p><strong>Local date suggestions</strong></p>
                <ul>
                  {identityPack.localDateSuggestions.map((suggestion) => (
                    <li key={`${suggestion.type}-${suggestion.title}`}>
                      <strong>{suggestion.title}</strong> {suggestion.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Notification Center</h3>
                <p>{unreadNotificationCount} unread</p>
              </div>
              {notifications.length > 0 ? (
                <button type="button" className="section-link-btn" onClick={handleMarkAllNotificationsRead}>
                  Mark all as read
                </button>
              ) : null}
            </div>
            {notifications.length > 0 ? (
              <div className="notification-listing">
                {notifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={`notification-card ${notification.isRead ? 'read' : 'unread'}`}
                    onClick={() => !notification.isRead && handleMarkNotificationRead(notification.id)}
                  >
                    <div className="notification-card-header">
                      <strong>{notification.title}</strong>
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{notification.body}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p>No notifications yet. Matches, messages, and verification updates will appear here.</p>
            )}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Favorite Profiles</h3>
                <p>{favorites.length} saved</p>
              </div>
            </div>
            {favorites.length > 0 ? (
              <div className="compact-profile-list">
                {favorites.map((favorite) => (
                  <div key={favorite.userId} className="compact-profile-card">
                    <div className="compact-profile-copy">
                      <strong>{favorite.firstName}{favorite.age ? `, ${favorite.age}` : ''}</strong>
                      <span>{favorite.location?.city || 'Location unavailable'}</span>
                    </div>
                    <span className="compact-meta">
                      Saved {new Date(favorite.favoritedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>Save profiles from discovery or browse to keep them handy here.</p>
            )}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Recent Search History</h3>
                <p>Quick recap of your latest discovery filters.</p>
              </div>
              {searchHistory.length > 0 ? (
                <button type="button" className="section-link-btn" onClick={handleClearSearchHistory}>
                  Clear
                </button>
              ) : null}
            </div>
            {searchHistory.length > 0 ? (
              <div className="search-history-list">
                {searchHistory.map((entry) => (
                  <div key={entry.id} className="search-history-item">
                    <strong>{formatSearchHistoryLabel(entry)}</strong>
                    <span>
                      {entry.resultCount} results | {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>Your recent searches will show up here once you start browsing with filters.</p>
            )}
          </div>

          <div className="profile-section">
            <h3>Blocked Users</h3>
            {blockedUsers.length > 0 ? (
              <div className="compact-profile-list">
                {blockedUsers.map((blockedUser) => (
                  <div key={blockedUser.id} className="compact-profile-card">
                    <div className="compact-profile-copy">
                      <strong>{blockedUser.firstName}{blockedUser.age ? `, ${blockedUser.age}` : ''}</strong>
                      <span>{blockedUser.location?.city || 'Location unavailable'}</span>
                    </div>
                    <button
                      type="button"
                      className="section-link-btn"
                      onClick={() => handleUnblockUser(blockedUser.id)}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>You have not blocked anyone yet.</p>
            )}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Daily Prompts</h3>
                <p>Answer prompts to show your personality on your profile.</p>
              </div>
              <button
                type="button"
                className="section-link-btn"
                onClick={() => setShowPromptsEditor((current) => !current)}
              >
                {showPromptsEditor ? 'Done' : 'Edit'}
              </button>
            </div>

            {answeredPrompts.length > 0 ? (
              <div className="answered-prompts-list">
                {answeredPrompts.map((prompt) => (
                  <div key={prompt.id} className="prompt-card">
                    <div className="prompt-header">
                      <span className="prompt-icon">{prompt.icon}</span>
                      <span className="prompt-text">{prompt.text}</span>
                    </div>
                    <p className="prompt-response">{prompt.response}</p>
                    {showPromptsEditor ? (
                      <button
                        type="button"
                        className="section-link-btn"
                        onClick={() => handleDeletePromptAnswer(prompt.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p>No prompts answered yet. Add some to help matches start conversations.</p>
            )}

            {showPromptsEditor ? (
              <div className="prompts-editor">
                <h4>Choose a prompt to answer</h4>
                {dailyPrompts
                  .filter((prompt) => !answeredPrompts.some((answered) => answered.id === prompt.id))
                  .map((prompt) => (
                    <div key={prompt.id} className="prompt-editor-item">
                      <div className="prompt-header">
                        <span className="prompt-icon">{prompt.icon}</span>
                        <span className="prompt-text">{prompt.text}</span>
                      </div>
                      <textarea
                        value={promptDraft[prompt.id] || ''}
                        onChange={(event) =>
                          setPromptDraft((current) => ({
                            ...current,
                            [prompt.id]: event.target.value
                          }))
                        }
                        placeholder="Your answer..."
                        maxLength={500}
                        rows={2}
                      />
                      <div className="prompt-editor-actions">
                        <span className="char-count">
                          {(promptDraft[prompt.id] || '').length}/500
                        </span>
                        <button
                          type="button"
                          className="btn-save"
                          onClick={() => handleAnswerPrompt(prompt.id)}
                          disabled={!promptDraft[prompt.id]?.trim()}
                        >
                          Save Answer
                        </button>
                      </div>
                    </div>
                  ))}
                {dailyPrompts.filter(
                  (prompt) => !answeredPrompts.some((answered) => answered.id === prompt.id)
                ).length === 0 ? (
                  <p>You have answered all available prompts.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Notification Settings</h3>
                <p>Control what notifications you receive and how.</p>
              </div>
              <button
                type="button"
                className="section-link-btn"
                onClick={() => setShowNotificationSettings((current) => !current)}
              >
                {showNotificationSettings ? 'Done' : 'Configure'}
              </button>
            </div>

            {showNotificationSettings ? (
              <div className="notification-settings">
                <div className="settings-group">
                  <h4>Push Notifications</h4>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.newMatch}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ newMatch: event.target.checked })
                      }
                    />
                    New matches
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.newMessage}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ newMessage: event.target.checked })
                      }
                    />
                    New messages
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.likeReceived}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ likeReceived: event.target.checked })
                      }
                    />
                    Likes received
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.superlikeReceived}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ superlikeReceived: event.target.checked })
                      }
                    />
                    Superlikes received
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.profileViewed}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ profileViewed: event.target.checked })
                      }
                    />
                    Profile views
                  </label>
                </div>

                <div className="settings-group">
                  <h4>Email Digests</h4>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.dailyDigest}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ dailyDigest: event.target.checked })
                      }
                    />
                    Daily digest
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.weeklyDigest}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ weeklyDigest: event.target.checked })
                      }
                    />
                    Weekly digest
                  </label>
                </div>

                <div className="settings-group">
                  <h4>Channels</h4>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.pushEnabled}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ pushEnabled: event.target.checked })
                      }
                    />
                    Push notifications enabled
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.emailEnabled}
                      onChange={(event) =>
                        handleUpdateNotificationPreferences({ emailEnabled: event.target.checked })
                      }
                    />
                    Email notifications enabled
                  </label>
                </div>
              </div>
            ) : (
              <div className="notification-summary">
                <span>
                  {notificationPreferences.pushEnabled ? '🔔 Push on' : '🔕 Push off'}
                </span>
                <span>
                  {notificationPreferences.emailEnabled ? '📧 Email on' : '📪 Email off'}
                </span>
                <span>
                  {notificationPreferences.weeklyDigest ? '📅 Weekly digest' : 'No digests'}
                </span>
              </div>
            )}
          </div>

          {/* Phase 3: Photo Verification Section */}
          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Photo Verification</h3>
                <p>
                  {verificationStatus === 'approved'
                    ? 'Your photo is verified. You have a verified badge on your profile.'
                    : verificationStatus === 'pending'
                    ? 'Your verification is pending review.'
                    : verificationStatus === 'rejected'
                    ? 'Your verification was rejected. Try again with better lighting.'
                    : 'Verify your photo to get a trusted badge and stand out.'}
                </p>
              </div>
              {verificationStatus !== 'approved' ? (
                <button
                  type="button"
                  className="section-link-btn"
                  onClick={() => setShowPhotoVerification((current) => !current)}
                >
                  {showPhotoVerification ? 'Cancel' : 'Verify'}
                </button>
              ) : (
                <span className="verified-badge">✓ Verified</span>
              )}
            </div>

            {showPhotoVerification ? (
              <div className="photo-verification-flow">
                {!verificationChallenge ? (
                  <button
                    type="button"
                    className="btn-save"
                    onClick={handleStartPhotoVerification}
                    disabled={verifyingPhoto}
                  >
                    {verifyingPhoto ? 'Loading...' : 'Start Verification Challenge'}
                  </button>
                ) : (
                  <div className="verification-challenge">
                    <div className="challenge-instructions">
                      <h4>📸 Pose Challenge</h4>
                      <p>{verificationChallenge.instructions}</p>
                      <p className="challenge-timer">Expires in {verificationChallenge.expiresIn / 60} minutes</p>
                    </div>

                    <div className="verification-upload">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleVerificationFileSelect}
                        id="verification-file"
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="verification-file" className="btn-edit">
                        {verificationPhoto ? 'Change Photo' : '📷 Take Selfie'}
                      </label>

                      {verificationPhoto ? (
                        <div className="verification-preview">
                          <img src={verificationPhoto} alt="Verification preview" />
                          <button
                            type="button"
                            className="btn-save"
                            onClick={handleCaptureVerificationPhoto}
                            disabled={verifyingPhoto}
                          >
                            {verifyingPhoto ? 'Verifying...' : 'Submit for Verification'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Phase 3: Subscription Section */}
          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Subscription</h3>
                <p>
                  {subscription?.isGold
                    ? 'Gold plan active. You have all premium features.'
                    : subscription?.isPremium
                    ? 'Premium plan active. Enjoy unlimited likes and more.'
                    : 'Upgrade to unlock unlimited likes, boosts, and more features.'}
                </p>
              </div>
              <button
                type="button"
                className="section-link-btn"
                onClick={() => setShowSubscription((current) => !current)}
              >
                {showSubscription ? 'Close' : subscription?.isPremium || subscription?.isGold ? 'Manage' : 'Upgrade'}
              </button>
            </div>

            {showSubscription ? (
              <div className="subscription-panel">
                {subscription?.isPremium || subscription?.isGold ? (
                  <div className="current-subscription">
                    <div className="subscription-badge">
                      {subscription.isGold ? '⭐ Gold' : '💎 Premium'} Active
                    </div>
                    {subscription.expiresAt ? (
                      <p>Renews on {new Date(subscription.expiresAt).toLocaleDateString()}</p>
                    ) : null}
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={handleCancelSubscription}
                      disabled={subscribing}
                    >
                      {subscribing ? 'Processing...' : 'Cancel Subscription'}
                    </button>
                  </div>
                ) : null}

                <div className="plans-grid">
                  {subscriptionPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`plan-card ${plan.id === 'free' ? 'plan-free' : ''} ${
                        subscription?.plan === plan.id ? 'plan-active' : ''
                      }`}
                    >
                      <h4>{plan.name}</h4>
                      <div className="plan-price">
                        {plan.price === 0 ? (
                          'Free'
                        ) : (
                          <>
                            ${plan.price}
                            <span>/{plan.interval}</span>
                          </>
                        )}
                      </div>
                      <ul className="plan-features">
                        {plan.features.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                      {plan.id !== 'free' && subscription?.plan !== plan.id ? (
                        <button
                          type="button"
                          className="btn-save"
                          onClick={() => handleSubscribe(plan.id)}
                          disabled={subscribing}
                        >
                          {subscribing ? 'Activating...' : `Get ${plan.name}`}
                        </button>
                      ) : subscription?.plan === plan.id ? (
                        <span className="plan-current-label">Current Plan</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {premiumDashboard ? (
            <div className="profile-section">
              <div className="section-header-row">
                <div>
                  <h3>Premium Insights</h3>
                  <p>Who viewed you, boost performance, priority intros, and the filters that convert best.</p>
                </div>
                <span className="section-meta-pill">
                  {premiumDashboard.subscription?.plan || 'free'}
                </span>
              </div>

              <div className="views-stats-grid">
                <div className="view-stat">
                  <span className="view-stat-value">{premiumDashboard.viewedYou?.totalCount || 0}</span>
                  <span className="view-stat-label">Who Viewed Me</span>
                </div>
                <div className="view-stat">
                  <span className="view-stat-value">{premiumDashboard.boost?.history?.length || 0}</span>
                  <span className="view-stat-label">Boost Runs</span>
                </div>
                <div className="view-stat">
                  <span className="view-stat-value">{premiumDashboard.priorityIntros?.sent || 0}</span>
                  <span className="view-stat-label">Intros Sent</span>
                </div>
                <div className="view-stat">
                  <span className="view-stat-value">{premiumDashboard.priorityIntros?.acceptanceRate || 0}%</span>
                  <span className="view-stat-label">Intro Accept Rate</span>
                </div>
              </div>

              {premiumDashboard.boost?.current ? (
                <div className="voice-intro-card">
                  <div className="voice-intro-card-header">
                    <strong>Boost live now</strong>
                    <span>{premiumDashboard.boost.current.minutesRemaining}m left</span>
                  </div>
                  <p className="voice-intro-note">
                    {premiumDashboard.boost.current.outcome?.profileViews || 0} views,
                    {' '}
                    {premiumDashboard.boost.current.outcome?.totalPositiveActions || 0} positive actions during this window.
                  </p>
                </div>
              ) : null}

              {premiumDashboard.boost?.history?.length > 0 ? (
                <div className="compact-profile-list">
                  {premiumDashboard.boost.history.slice(0, 3).map((boost) => (
                    <div key={boost.id || boost.expiresAt} className="compact-profile-card">
                      <div className="compact-profile-copy">
                        <strong>{boost.active ? 'Active boost' : 'Recent boost'}</strong>
                        <span>
                          {boost.outcome?.profileViews || 0} views · {boost.outcome?.totalPositiveActions || 0} actions
                        </span>
                      </div>
                      <span className="compact-meta">
                        {new Date(boost.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {premiumDashboard.premiumInsights?.length > 0 ? (
                <div className="recommendations-list">
                  <p><strong>Better premium insights</strong></p>
                  <ul>
                    {premiumDashboard.premiumInsights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="notification-summary">
                {(premiumDashboard.advancedFilters?.filters || []).map((filter) => (
                  <span key={filter}>{filter}</span>
                ))}
              </div>

              {premiumDashboard.likedYou?.preview?.length > 0 || premiumDashboard.viewedYou?.preview?.length > 0 ? (
                <div className="compact-dual-grid">
                  {premiumDashboard.likedYou?.preview?.length > 0 ? (
                    <div className="recommendations-list">
                      <p><strong>Premium direct-intent opportunities</strong></p>
                      <ul>
                        {premiumDashboard.likedYou.preview.map((liker) => (
                          <li key={`liked-${liker.userId}`}>
                            {(liker.firstName || 'Someone')}{liker.age ? `, ${liker.age}` : ''} {liker.location?.city ? `from ${liker.location.city}` : ''} already liked you.
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {premiumDashboard.viewedYou?.preview?.length > 0 ? (
                    <div className="recommendations-list">
                      <p><strong>Recent profile views</strong></p>
                      <ul>
                        {premiumDashboard.viewedYou.preview.map((viewer) => (
                          <li key={`viewed-${viewer.userId}`}>
                            {(viewer.firstName || 'Someone')}{viewer.age ? `, ${viewer.age}` : ''} viewed your profile
                            {viewer.location?.city ? ` from ${viewer.location.city}` : ''}.
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {premiumDashboard.bestPerformingPhotos?.length > 0 || premiumDashboard.bestPerformingPrompts?.length > 0 ? (
                <div className="compact-dual-grid">
                  {premiumDashboard.bestPerformingPhotos?.length > 0 ? (
                    <div className="recommendations-list">
                      <p><strong>Best-performing photos</strong></p>
                      <ul>
                        {premiumDashboard.bestPerformingPhotos.map((photo) => (
                          <li key={photo.photoId || photo.position}>
                            Photo {photo.position}: {photo.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {premiumDashboard.bestPerformingPrompts?.length > 0 ? (
                    <div className="recommendations-list">
                      <p><strong>Prompt performance</strong></p>
                      <ul>
                        {premiumDashboard.bestPerformingPrompts.map((prompt) => (
                          <li key={prompt.promptId}>
                            {prompt.text}: {prompt.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {premiumDashboard.upgradeReasons?.length > 0 ? (
                <div className="recommendations-list">
                  <p><strong>Why upgrade now</strong></p>
                  <ul>
                    {premiumDashboard.upgradeReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

            </div>
          ) : null}

          {/* Phase 4: Analytics & Insights Section */}
          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>📊 Profile Analytics</h3>
                <p>Insights about your profile performance and engagement.</p>
              </div>
              <button
                type="button"
                className="section-link-btn"
                onClick={() => {
                  if (!showAnalytics) {
                    handleLoadAnalytics();
                  } else {
                    setShowAnalytics(false);
                  }
                }}
              >
                {showAnalytics ? 'Hide' : 'View'}
              </button>
            </div>

            {showAnalytics && analytics ? (
              <div className="analytics-panel">
                {/* Profile Strength */}
                <div className="analytics-card">
                  <h4>Profile Strength</h4>
                  <div className="strength-meter">
                    <div
                      className="strength-bar"
                      style={{
                        width: `${analytics.profileStrength?.score || 0}%`,
                        backgroundColor: getProfileStrengthColor(analytics.profileStrength?.score || 0)
                      }}
                    />
                    <span className="strength-score">{analytics.profileStrength?.score || 0}/100</span>
                  </div>
                  <p className="strength-level">
                    Level: <strong>{analytics.profileStrength?.level || 'beginner'}</strong>
                  </p>
                  {analytics.profileStrength?.recommendations?.length > 0 ? (
                    <div className="recommendations-list">
                      <p><strong>💡 Recommendations:</strong></p>
                      <ul>
                        {analytics.profileStrength.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="strength-excellent">🎉 Your profile is excellent!</p>
                  )}
                </div>

                {/* Last Active */}
                <div className="analytics-card">
                  <h4>Activity Status</h4>
                  <p className="last-active-label">
                    {getLastActiveLabel(analytics.lastActive)}
                  </p>
                </div>

                {/* Views Stats */}
                <div className="analytics-card">
                  <h4>Profile Views</h4>
                  <div className="views-stats-grid">
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.views?.total || 0}</span>
                      <span className="view-stat-label">Total Views</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.views?.last7Days || 0}</span>
                      <span className="view-stat-label">Last 7 Days</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.views?.last30Days || 0}</span>
                      <span className="view-stat-label">Last 30 Days</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.views?.uniqueViewers || 0}</span>
                      <span className="view-stat-label">Unique Viewers</span>
                    </div>
                  </div>

                  {/* Daily Trend */}
                  {analytics.views?.dailyTrend?.length > 0 ? (
                    <div className="daily-trend">
                      <p><strong>7-Day Trend:</strong></p>
                      <div className="trend-bars">
                        {analytics.views.dailyTrend.map((day, idx) => (
                          <div key={idx} className="trend-bar-item">
                            <div
                              className="trend-bar"
                              style={{
                                height: `${Math.max(4, (day.count / Math.max(...analytics.views.dailyTrend.map(d => d.count))) * 40)}px`
                              }}
                            />
                            <span className="trend-date">{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="btn-edit"
                    onClick={handleLoadProfileViews}
                    style={{ marginTop: '12px' }}
                  >
                    👁️ See Who Viewed Your Profile
                  </button>
                </div>

                {/* Interactions Stats */}
                <div className="analytics-card">
                  <h4>Interactions</h4>
                  <div className="interactions-stats-grid">
                    <div className="interaction-stat">
                      <span className="interaction-stat-value">{analytics.interactions?.likesSent || 0}</span>
                      <span className="interaction-stat-label">Likes Sent</span>
                    </div>
                    <div className="interaction-stat">
                      <span className="interaction-stat-value">{analytics.interactions?.likesReceived || 0}</span>
                      <span className="interaction-stat-label">Likes Received</span>
                    </div>
                    <div className="interaction-stat">
                      <span className="interaction-stat-value">{analytics.interactions?.superlikesSent || 0}</span>
                      <span className="interaction-stat-label">Superlikes Sent</span>
                    </div>
                    <div className="interaction-stat">
                      <span className="interaction-stat-value">{analytics.interactions?.superlikesReceived || 0}</span>
                      <span className="interaction-stat-label">Superlikes Received</span>
                    </div>
                    <div className="interaction-stat">
                      <span className="interaction-stat-value">{analytics.interactions?.totalMatches || 0}</span>
                      <span className="interaction-stat-label">Total Matches</span>
                    </div>
                    <div className="interaction-stat">
                      <span className="interaction-stat-value">{analytics.interactions?.passesSent || 0}</span>
                      <span className="interaction-stat-label">Passes</span>
                    </div>
                  </div>
                </div>

                <div className="analytics-card">
                  <h4>Funnel Analytics</h4>
                  <div className="views-stats-grid">
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.funnel?.metrics?.likeToMatchRate || 0}%</span>
                      <span className="view-stat-label">Like to Match</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.funnel?.metrics?.firstMessageRate || 0}%</span>
                      <span className="view-stat-label">First Message Rate</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.funnel?.metrics?.datePlanCreationRate || 0}%</span>
                      <span className="view-stat-label">Date Plan Rate</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.profileCompletionPercent || 0}%</span>
                      <span className="view-stat-label">Profile Complete</span>
                    </div>
                  </div>

                  <div className="analytics-chip-row">
                    <span className="analytics-chip">Compatibility views: {analytics.funnel?.actions?.compatibilityViews || 0}</span>
                    <span className="analytics-chip">Planner opens: {analytics.funnel?.actions?.plannerOpens || 0}</span>
                    <span className="analytics-chip">Safety shares: {analytics.funnel?.actions?.safetyShares || 0}</span>
                    <span className="analytics-chip">Check-ins: {analytics.funnel?.actions?.checkInReminders || 0}</span>
                  </div>

                  <div className="recommendations-list">
                    <p><strong>Onboarding timeline</strong></p>
                    <ul>
                      <li>Email verified: {analytics.funnel?.onboarding?.emailVerifiedAt ? new Date(analytics.funnel.onboarding.emailVerifiedAt).toLocaleDateString() : 'Not tracked yet'}</li>
                      <li>Profile details saved: {analytics.funnel?.onboarding?.profileSavedAt ? new Date(analytics.funnel.onboarding.profileSavedAt).toLocaleDateString() : 'Not tracked yet'}</li>
                      <li>Onboarding completed: {analytics.funnel?.onboarding?.completedAt ? new Date(analytics.funnel.onboarding.completedAt).toLocaleDateString() : 'Not tracked yet'}</li>
                    </ul>
                  </div>
                </div>

                <div className="analytics-card">
                  <h4>Conversation Timing</h4>
                  <div className="views-stats-grid">
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.advanced?.replyRate || 0}%</span>
                      <span className="view-stat-label">Reply Rate</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.advanced?.matchRate || 0}%</span>
                      <span className="view-stat-label">Match Rate</span>
                    </div>
                    <div className="view-stat">
                      <span className="view-stat-value">{analytics.advanced?.averageTimeToFirstReplyLabel || 'n/a'}</span>
                      <span className="view-stat-label">Avg First Reply</span>
                    </div>
                  </div>

                  {analytics.advanced?.bestActiveHours?.length > 0 ? (
                    <div className="analytics-chip-row">
                      {analytics.advanced.bestActiveHours.map((slot) => (
                        <span key={slot.label} className="analytics-chip">
                          {slot.label}: {slot.engagementCount}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {analytics.advanced?.replyRateBasis ? (
                    <p className="analytics-helper-copy">{analytics.advanced.replyRateBasis}</p>
                  ) : null}
                </div>
              </div>
            ) : showAnalytics && !analytics ? (
              <p>Loading analytics...</p>
            ) : null}
          </div>

          {/* Phase 4: Profile Views Modal */}
          {showProfileViews && (
            <div className="profile-views-modal">
              <div className="profile-views-content">
                <div className="section-header-row">
                  <h3>👁️ Who Viewed Your Profile</h3>
                  <button
                    type="button"
                    className="section-link-btn"
                    onClick={() => setShowProfileViews(false)}
                  >
                    Close
                  </button>
                </div>

                {!profileViews.isPremium && profileViews.viewers?.length > 0 ? (
                  <div className="premium-upsell">
                    <p>🔒 Upgrade to Premium to see who viewed your profile</p>
                    <p>{profileViews.totalCount} people have viewed your profile</p>
                  </div>
                ) : null}

                {profileViews.viewers?.length > 0 ? (
                  <div className="viewers-list">
                    {profileViews.viewers.map((viewer) => (
                      <div key={viewer.userId} className={`viewer-card ${!viewer.isRevealed ? 'blurred' : ''}`}>
                        <div
                          className="viewer-photo"
                          style={{
                            backgroundImage: viewer.photoUrl && viewer.isRevealed
                              ? `url(${viewer.photoUrl})`
                              : 'linear-gradient(135deg, #667eea, #764ba2)'
                          }}
                        />
                        <div className="viewer-info">
                          {viewer.isRevealed ? (
                            <>
                              <strong>{viewer.firstName}, {viewer.age}</strong>
                              <span>{viewer.location?.city}</span>
                            </>
                          ) : (
                            <>
                              <strong>Someone</strong>
                              <span>Upgrade to see</span>
                            </>
                          )}
                          <span className="viewed-at">{new Date(viewer.viewedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No profile views yet. Complete your profile to get more visibility!</p>
                )}
              </div>
            </div>
          )}

          {error ? (
            <div className="profile-section">
              <p className="profile-inline-error">{error}</p>
            </div>
          ) : null}

          {/* Quick Links Section */}
          <div className="profile-section">
            <div className="section-header-row">
              <div>
                <h3>Quick Links</h3>
                <p>Access all your tools and features in one place.</p>
              </div>
            </div>
            <div className="profile-actions">
              <button onClick={() => navigate('/achievements')} className="btn-save">🏆 Achievements</button>
              <button onClick={() => navigate('/streaks')} className="btn-save">🔥 Streaks</button>
              <button onClick={() => navigate('/referrals')} className="btn-save">🎁 Referrals</button>
              <button onClick={() => navigate('/date-safety')} className="btn-save">🛡️ Safety Kit</button>
              <button onClick={() => navigate('/profile-reset')} className="btn-save">🔄 Profile Reset</button>
              <button onClick={() => navigate('/photo-ab-testing')} className="btn-save">📸 Photo A/B Test</button>
            </div>
          </div>

          <div className="profile-actions">
            <button onClick={() => setEditing(true)} className="btn-edit">
              Edit Profile
            </button>
            <button onClick={() => setShowCoupon(true)} className="btn-save">
              🎁 Redeem Coupon
            </button>
            <button onClick={() => setShowAccountSettings(true)} className="btn-save">
              Account Settings
            </button>
            <button onClick={loadProfile} className="btn-cancel">
              Refresh
            </button>
            <button onClick={onLogout} className="btn-logout">
              Log Out
            </button>
          </div>

          <CouponRedemption
            isOpen={showCoupon}
            onClose={() => setShowCoupon(false)}
            onRedemptionSuccess={() => {
              setShowCoupon(false);
              loadProfile();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatingProfile;
