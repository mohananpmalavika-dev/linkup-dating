import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import '../styles/DiscoveryCards.css';
import datingProfileService from '../services/datingProfileService';

const DEFAULT_FILTERS = {
  ageMin: '', ageMax: '', distance: '', gender: '',
  relationshipGoals: '', interests: '',
  heightRangeMin: '', heightRangeMax: '', bodyTypes: ''
};

const BODY_TYPE_OPTIONS = ['Slim','Average','Athletic','Curvy','Muscular','Heavyset'];
const INTEREST_OPTIONS = ['Travel','Fitness','Music','Art','Cooking','Gaming','Sports','Hiking','Photography','Reading','Movies','Yoga'];

const buildDiscoveryFilters = (filters) => {
  const params = {};
  if (filters.ageMin !== '') params.ageMin = Number(filters.ageMin);
  if (filters.ageMax !== '') params.ageMax = Number(filters.ageMax);
  if (filters.distance !== '') params.distance = Number(filters.distance);
  if (filters.gender) params.gender = filters.gender;
  if (filters.relationshipGoals.trim()) params.relationshipGoals = filters.relationshipGoals.trim();
  if (filters.interests.trim()) params.interests = filters.interests.split(',').map(i => i.trim()).filter(Boolean).join(',');
  if (filters.heightRangeMin !== '') params.heightRangeMin = Number(filters.heightRangeMin);
  if (filters.heightRangeMax !== '') params.heightRangeMax = Number(filters.heightRangeMax);
  if (filters.bodyTypes.trim()) params.bodyTypes = filters.bodyTypes.split(',').map(b => b.trim()).filter(Boolean).join(',');
  return params;
};

const DiscoveryCards = ({ onMatch, onProfileView }) => {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteUserIds, setFavoriteUserIds] = useState(new Set());
  const [remainingLikes, setRemainingLikes] = useState(50);
  const [remainingSuperlikes, setRemainingSuperlikes] = useState(1);
  const [remainingRewinds, setRemainingRewinds] = useState(3);
  const [discoveryMode, setDiscoveryMode] = useState('regular');
  const [subscription, setSubscription] = useState(null);
  const [boosting, setBoosting] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const loadMoreTriggered = useRef(false);

  const activeFilterCount = useMemo(() => Object.values(appliedFilters).filter(v => String(v).trim() !== '').length, [appliedFilters]);

  useEffect(() => { loadProfiles(appliedFilters); loadDailyLimits(); }, []);
  useEffect(() => {
    datingProfileService.getFavorites().then(d => setFavoriteUserIds(new Set((d.favorites||[]).map(f=>String(f.userId))))).catch(()=>{});
  }, []);

  const loadProfiles = async (nextFilters = appliedFilters, cursor = null) => {
    if (cursor) setLoadingMore(true);
    else { setLoading(true); setProfiles([]); setCurrentIndex(0); }
    setError('');
    try {
      const params = { ...buildDiscoveryFilters(nextFilters), cursor, limit: 20 };
      const data = await datingProfileService.getDiscoveryProfiles(params);
      const newProfiles = data.profiles || [];
      if (cursor) {
        setProfiles(prev => [...prev, ...newProfiles]);
      } else {
        setProfiles(newProfiles);
        setCurrentIndex(0);
      }
      setNoMoreProfiles(!data.hasMore && newProfiles.length === 0);
      setNextCursor(data.nextCursor || null);
      setDiscoveryMode('regular');
    } catch (err) { setError('Failed to load profiles. Please try again.'); console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const loadDailyLimits = async () => {
    try {
      const [limitsData, subData] = await Promise.all([
        datingProfileService.getDailyLimits().catch(()=>({})),
        datingProfileService.getMySubscription().catch(()=>({plan:'free',isPremium:false}))
      ]);
      setRemainingLikes(limitsData.remainingLikes??50);
      setRemainingSuperlikes(limitsData.remainingSuperlikes??1);
      setRemainingRewinds(limitsData.remainingRewinds??3);
      setSubscription(subData);
    } catch (err) { console.error(err); }
  };

  const handleBoost = async () => {
    setBoosting(true); setError('');
    try { const r = await datingProfileService.boostProfile(); setError(r.message||'Profile boosted!'); setTimeout(()=>setError(''),3000); }
    catch (err) { setError(err||'Boost requires Premium'); }
    finally { setBoosting(false); }
  };

  const loadTopPicks = async (cursor = null) => {
    if (cursor) setLoadingMore(true);
    else { setLoading(true); setProfiles([]); setCurrentIndex(0); }
    setError('');
    try {
      const data = await datingProfileService.getTopPicks(20);
      if (cursor) setProfiles(prev => [...prev, ...(data.profiles||[])]);
      else { setProfiles(data.profiles||[]); setCurrentIndex(0); }
      setNoMoreProfiles((data.profiles||[]).length===0);
      setDiscoveryMode('topPicks');
      setNextCursor(null);
    }
    catch (err) { setError('Failed to load top picks.'); console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const loadSmartQueue = async (cursor = null) => {
    if (cursor) setLoadingMore(true);
    else { setLoading(true); setError(''); setProfiles([]); setCurrentIndex(0); }
    try {
      const params = cursor ? { cursor, limit: 20 } : { limit: 20 };
      const d = await datingProfileService.getDiscoveryQueue(params);
      const newProfiles = d.profiles || [];
      if (cursor) setProfiles(prev => [...prev, ...newProfiles]);
      else { setProfiles(newProfiles); setCurrentIndex(0); }
      setNoMoreProfiles(!d.hasMore && newProfiles.length === 0);
      setNextCursor(d.nextCursor || null);
      setDiscoveryMode('smartQueue');
    }
    catch (err) { setError('Failed to load smart queue.'); console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const loadTrending = async (cursor = null) => {
    if (cursor) setLoadingMore(true);
    else { setLoading(true); setError(''); setProfiles([]); setCurrentIndex(0); }
    try {
      const params = cursor ? { cursor, limit: 20 } : { limit: 20 };
      const d = await datingProfileService.getTrendingProfiles(params);
      const newProfiles = d.profiles || [];
      if (cursor) setProfiles(prev => [...prev, ...newProfiles]);
      else { setProfiles(newProfiles); setCurrentIndex(0); }
      setNoMoreProfiles(!d.hasMore && newProfiles.length === 0);
      setNextCursor(d.nextCursor || null);
      setDiscoveryMode('trending');
    }
    catch (err) { setError('Failed to load trending.'); console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const loadNewProfiles = async (cursor = null) => {
    if (cursor) setLoadingMore(true);
    else { setLoading(true); setError(''); setProfiles([]); setCurrentIndex(0); }
    try {
      const params = cursor ? { cursor, limit: 20 } : { limit: 20 };
      const d = await datingProfileService.getNewProfiles(params);
      const newProfiles = d.profiles || [];
      if (cursor) setProfiles(prev => [...prev, ...newProfiles]);
      else { setProfiles(newProfiles); setCurrentIndex(0); }
      setNoMoreProfiles(!d.hasMore && newProfiles.length === 0);
      setNextCursor(d.nextCursor || null);
      setDiscoveryMode('newProfiles');
    }
    catch (err) { setError('Failed to load new profiles.'); console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const handleRewind = async () => {
    if (remainingRewinds <= 0) return;
    try { const r = await datingProfileService.rewindPass(); setRemainingRewinds(r.rewindsRemaining??0); if (r.restoredProfile) { setProfiles(c=>[r.restoredProfile,...c]); setCurrentIndex(0); setNoMoreProfiles(false); } }
    catch (err) { setError('Failed to rewind'); console.error(err); }
  };

  const setMode = (mode) => {
    if (mode === discoveryMode) return;
    if (mode === 'regular') loadProfiles(appliedFilters);
    else if (mode === 'topPicks') loadTopPicks();
    else if (mode === 'smartQueue') loadSmartQueue();
    else if (mode === 'trending') loadTrending();
    else if (mode === 'newProfiles') loadNewProfiles();
  };

  const getCurrentProfile = () => profiles[currentIndex];

  const handleLike = async () => {
    const profile = getCurrentProfile(); if (!profile) return;
    if (remainingLikes <= 0) { setError('Daily like limit reached.'); return; }
    try { const r = await datingProfileService.likeProfile(profile.userId); setRemainingLikes(p=>Math.max(0,p-1)); if (r.isMatch) onMatch?.({...profile,matchId:r.match?.id||null}); moveToNextCard(); }
    catch (err) { setError('Failed to like'); console.error(err); }
  };

  const handleSuperlike = async () => {
    const profile = getCurrentProfile(); if (!profile) return;
    if (remainingSuperlikes <= 0) { setError('Daily superlike limit reached.'); return; }
    try { const r = await datingProfileService.superlikeProfile(profile.userId); setRemainingSuperlikes(p=>Math.max(0,p-1)); if (r.isMatch) onMatch?.({...profile,matchId:r.match?.id||null,superlike:true}); moveToNextCard(); }
    catch (err) { setError('Failed to superlike'); console.error(err); }
  };

  const handlePass = async () => {
    const profile = getCurrentProfile(); if (!profile) return;
    try { await datingProfileService.passProfile(profile.userId); moveToNextCard(); }
    catch (err) { setError('Failed to pass'); console.error(err); }
  };

  const handleToggleFavorite = async () => {
    const profile = getCurrentProfile(); if (!profile?.userId) return;
    const uid = String(profile.userId); const next = new Set(favoriteUserIds);
    try { if (next.has(uid)) { await datingProfileService.removeFavorite(profile.userId); next.delete(uid); } else { await datingProfileService.favoriteProfile(profile.userId); next.add(uid); } setFavoriteUserIds(next); }
    catch (e) { setError('Failed to update favorites'); console.error(e); }
  };

  const moveToNextCard = useCallback(() => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(i=>i+1);
    } else {
      setNoMoreProfiles(true);
      if (nextCursor && !loadMoreTriggered.current) {
        loadMoreTriggered.current = true;
        if (discoveryMode === 'smartQueue') loadSmartQueue(nextCursor);
        else if (discoveryMode === 'trending') loadTrending(nextCursor);
        else if (discoveryMode === 'newProfiles') loadNewProfiles(nextCursor);
        else if (discoveryMode === 'regular') loadProfiles(appliedFilters, nextCursor);
      }
    }
  }, [currentIndex, profiles.length, nextCursor, discoveryMode, appliedFilters]);

  const reloadProfiles = () => {
    setCurrentIndex(0); setNoMoreProfiles(false); loadMoreTriggered.current = false;
    if (discoveryMode==='smartQueue') loadSmartQueue();
    else if (discoveryMode==='trending') loadTrending();
    else if (discoveryMode==='newProfiles') loadNewProfiles();
    else if (discoveryMode==='topPicks') loadTopPicks();
    else loadProfiles(appliedFilters);
  };

  const handleFilterChange = (field, value) => setFilters(c=>({...c,[field]:value}));

  const toggleInterest = (interest) => {
    setFilters(c => {
      const list = c.interests.split(',').map(i=>i.trim()).filter(Boolean);
      const exists = list.includes(interest);
      return {...c, interests: (exists?list.filter(i=>i!==interest):[...list,interest]).join(', ')};
    });
  };

  const toggleBodyType = (bodyType) => {
    setFilters(c => {
      const list = c.bodyTypes.split(',').map(t=>t.trim()).filter(Boolean);
      const exists = list.includes(bodyType);
      return {...c, bodyTypes: (exists?list.filter(t=>t!==bodyType):[...list,bodyType]).join(', ')};
    });
  };

  const handleApplyFilters = async (e) => {
    e.preventDefault();
    const next = { ageMin:filters.ageMin, ageMax:filters.ageMax, distance:filters.distance, gender:filters.gender, relationshipGoals:filters.relationshipGoals, interests:filters.interests, heightRangeMin:filters.heightRangeMin, heightRangeMax:filters.heightRangeMax, bodyTypes:filters.bodyTypes };
    setAppliedFilters(next); setShowFilters(false); setNextCursor(null); loadMoreTriggered.current = false; await loadProfiles(next);
  };

  const handleResetFilters = async () => { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setShowFilters(false); setNextCursor(null); loadMoreTriggered.current = false; await loadProfiles(DEFAULT_FILTERS); };

  const currentProfile = getCurrentProfile();

  if (loading) return <div className="discovery-container loading"><div className="spinner"></div><p>Finding profiles for you...</p></div>;
  if (error && profiles.length === 0) return <div className="discovery-container error"><p className="error-message">{error}</p><button onClick={()=>loadProfiles(appliedFilters)} className="btn-retry">Retry</button></div>;

  if (noMoreProfiles || !currentProfile) {
    return (
      <div className="discovery-container no-profiles">
        <div className="discovery-toolbar">
          <button type="button" className="btn-filter-toggle" onClick={()=>setShowFilters(c=>!c)}>Filters {activeFilterCount>0?`(${activeFilterCount})`:''}</button>
        </div>
        {showFilters && (
          <form className="filter-panel empty-filter-panel" onSubmit={handleApplyFilters}>
            <h3>Discovery preferences</h3>
            <div className="filter-grid">
              <label className="filter-field"><span>Age from</span><input type="number" min="18" max="99" value={filters.ageMin} onChange={e=>handleFilterChange('ageMin',e.target.value)}/></label>
              <label className="filter-field"><span>Age to</span><input type="number" min="18" max="99" value={filters.ageMax} onChange={e=>handleFilterChange('ageMax',e.target.value)}/></label>
              <label className="filter-field"><span>Distance (km)</span><input type="number" min="1" max="500" value={filters.distance} onChange={e=>handleFilterChange('distance',e.target.value)}/></label>
              <label className="filter-field"><span>Gender</span><select value={filters.gender} onChange={e=>handleFilterChange('gender',e.target.value)}><option value="">Any</option><option value="male">Male</option><option value="female">Female</option><option value="non-binary">Non-binary</option><option value="other">Other</option></select></label>
              <label className="filter-field"><span>Relationship goal</span><select value={filters.relationshipGoals} onChange={e=>handleFilterChange('relationshipGoals',e.target.value)}><option value="">Any</option><option value="serious">Serious</option><option value="casual">Casual</option><option value="friendship">Friendship</option><option value="marriage">Marriage</option></select></label>
              <label className="filter-field filter-field-full"><span>Interests</span><input type="text" placeholder="music, travel, fitness" value={filters.interests} onChange={e=>handleFilterChange('interests',e.target.value)}/></label>
            </div>
            <div className="filter-actions"><button type="button" className="btn-filter-secondary" onClick={handleResetFilters}>Reset</button><button type="submit" className="btn-filter-primary">Apply</button></div>
          </form>
        )}
        <div className="empty-state"><h2>No More Profiles</h2><p>{activeFilterCount>0?'No profiles match your current preferences.':"You've reviewed all available profiles!"}</p>{loadingMore?<div className="spinner small"></div>:<button onClick={reloadProfiles} className="btn-primary">Reload Profiles</button>}</div>
      </div>
    );
  }

  const scoreBreakdown = currentProfile?.scoreBreakdown;

  return (
    <div className="discovery-container">
      <div className="discovery-toolbar">
        <div className="toolbar-left">
          <button type="button" className="btn-filter-toggle" onClick={()=>setShowFilters(c=>!c)}>Filters {activeFilterCount>0?`(${activeFilterCount})`:''}</button>
          <button type="button" className={`btn-mode-toggle ${discoveryMode==='topPicks'?'active':''}`} onClick={()=>setMode('topPicks')}>🏆 Top Picks</button>
          <button type="button" className={`btn-mode-toggle ${discoveryMode==='smartQueue'?'active':''}`} onClick={()=>setMode('smartQueue')}>🧠 For You</button>
          <button type="button" className={`btn-mode-toggle ${discoveryMode==='trending'?'active':''}`} onClick={()=>setMode('trending')}>🔥 Trending</button>
          <button type="button" className={`btn-mode-toggle ${discoveryMode==='newProfiles'?'active':''}`} onClick={()=>setMode('newProfiles')}>✨ New</button>
        </div>
        <div className="daily-limits">
          <span title="Remaining likes">❤️ {remainingLikes}</span>
          <span title="Remaining superlikes">⭐ {remainingSuperlikes}</span>
          <span title="Remaining rewinds">↩️ {remainingRewinds}</span>
          <button type="button" className="btn-boost" onClick={handleBoost} disabled={boosting||!(subscription?.isPremium||subscription?.isGold)}>{boosting?'⚡...':'⚡ Boost'}</button>
        </div>
      </div>

      {showFilters && (
        <form className="filter-panel" onSubmit={handleApplyFilters}>
          <div className="filter-panel-header"><div><h3>Discovery preferences</h3><p>Refine who shows up in your swipe stack.</p></div><button type="button" className="btn-filter-close" onClick={()=>setShowFilters(false)}>Close</button></div>
          <div className="filter-grid">
            <label className="filter-field"><span>Age from</span><input type="number" min="18" max="99" value={filters.ageMin} onChange={e=>handleFilterChange('ageMin',e.target.value)} placeholder="Any"/></label>
            <label className="filter-field"><span>Age to</span><input type="number" min="18" max="99" value={filters.ageMax} onChange={e=>handleFilterChange('ageMax',e.target.value)} placeholder="Any"/></label>
            <label className="filter-field"><span>Distance (km)</span><input type="number" min="1" max="500" value={filters.distance} onChange={e=>handleFilterChange('distance',e.target.value)} placeholder="Any"/></label>
            <label className="filter-field"><span>Gender</span><select value={filters.gender} onChange={e=>handleFilterChange('gender',e.target.value)}><option value="">Any</option><option value="male">Male</option><option value="female">Female</option><option value="non-binary">Non-binary</option><option value="other">Other</option></select></label>
            <label className="filter-field"><span>Relationship goal</span><select value={filters.relationshipGoals} onChange={e=>handleFilterChange('relationshipGoals',e.target.value)}><option value="">Any</option><option value="serious">Serious</option><option value="casual">Casual</option><option value="friendship">Friendship</option><option value="marriage">Marriage</option></select></label>
            <label className="filter-field"><span>Height from (cm)</span><input type="number" min="130" max="230" value={filters.heightRangeMin} onChange={e=>handleFilterChange('heightRangeMin',e.target.value)} placeholder="Any"/></label>
            <label className="filter-field"><span>Height to (cm)</span><input type="number" min="130" max="230" value={filters.heightRangeMax} onChange={e=>handleFilterChange('heightRangeMax',e.target.value)} placeholder="Any"/></label>
            <label className="filter-field filter-field-full"><span>Body Types</span><div className="chip-group">{BODY_TYPE_OPTIONS.map(bt=>(<button key={bt} type="button" className={`chip ${filters.bodyTypes.includes(bt)?'active':''}`} onClick={()=>toggleBodyType(bt)}>{bt}</button>))}</div></label>
            <label className="filter-field filter-field-full"><span>Interests</span><div className="chip-group">{INTEREST_OPTIONS.map(i=>(<button key={i} type="button" className={`chip ${filters.interests.includes(i)?'active':''}`} onClick={()=>toggleInterest(i)}>{i}</button>))}</div></label>
          </div>
          <div className="filter-actions"><button type="button" className="btn-filter-secondary" onClick={handleResetFilters}>Reset</button><button type="submit" className="btn-filter-primary">Apply filters</button></div>
        </form>
      )}

      {activeFilterCount > 0 && (
        <div className="active-filter-summary">
          {appliedFilters.ageMin ? <span>Age {appliedFilters.ageMin}+</span> : null}
          {appliedFilters.ageMax ? <span>Up to {appliedFilters.ageMax}</span> : null}
          {appliedFilters.distance ? <span>{appliedFilters.distance} km</span> : null}
          {appliedFilters.gender ? <span>{appliedFilters.gender}</span> : null}
          {appliedFilters.relationshipGoals ? <span>{appliedFilters.relationshipGoals}</span> : null}
          {appliedFilters.interests ? <span>{appliedFilters.interests}</span> : null}
          {appliedFilters.heightRangeMin ? <span>Height {appliedFilters.heightRangeMin}+</span> : null}
          {appliedFilters.heightRangeMax ? <span>Height ≤{appliedFilters.heightRangeMax}</span> : null}
          {appliedFilters.bodyTypes ? <span>{appliedFilters.bodyTypes}</span> : null}
        </div>
      )}

      <div className="card-stack">
        <div className="profile-card active">
          <div className="photo-container">
            {currentProfile.photos && currentProfile.photos.length > 0 ? (
              <>
                <img 
                  src={currentProfile.photos[0]} 
                  alt={currentProfile.firstName} 
                  className="profile-photo" 
                  loading="lazy"
                  decoding="async"
                  onError={e=>{e.target.src='https://via.placeholder.com/400x600?text=No+Photo';}}
                />
                {currentProfile.photos.length > 1 && <div className="photo-indicators">{currentProfile.photos.map((_,idx)=>(<div key={idx} className={`indicator ${idx===0?'active':''}`}></div>))}</div>}
              </>
            ) : <div className="no-photo">No Photos</div>}
            <div className="profile-header">
              <div className="name-age"><h2>{currentProfile.firstName}</h2><span className="age">{currentProfile.age}</span></div>
              {currentProfile.profileVerified && <div className="verified-badge" title="Verified Profile">✓</div>}
            </div>
            <div className="location">📍 {currentProfile.location?.city}, {currentProfile.location?.state}{currentProfile.distanceKm !== undefined && currentProfile.distanceKm !== null ? ` · ${currentProfile.distanceKm} km` : ''}</div>
          </div>

          <div className="profile-info">
            {currentProfile.compatibilityScore ? (
              <div className="compatibility-panel">
                <div className="compatibility-badge" onClick={() => setShowScoreBreakdown(s => !s)} style={{ cursor: scoreBreakdown ? 'pointer' : 'default' }}>
                  Compatibility {currentProfile.compatibilityScore}%
                  {scoreBreakdown && <span className="score-toggle">{showScoreBreakdown ? ' ▲' : ' ▼'}</span>}
                </div>
                {showScoreBreakdown && scoreBreakdown && (
                  <div className="score-breakdown">
                    <div className="score-row"><span>Compatibility</span><div className="score-bar"><div className="score-fill" style={{width:`${scoreBreakdown.compatibility}%`}}></div></div><b>{scoreBreakdown.compatibility}%</b></div>
                    <div className="score-row"><span>Behavioral</span><div className="score-bar"><div className="score-fill behavioral" style={{width:`${scoreBreakdown.behavioral}%`}}></div></div><b>{scoreBreakdown.behavioral}%</b></div>
                    <div className="score-row"><span>Recency</span><div className="score-bar"><div className="score-fill recency" style={{width:`${scoreBreakdown.recency}%`}}></div></div><b>{scoreBreakdown.recency}%</b></div>
                    <div className="score-row"><span>Trending</span><div className="score-bar"><div className="score-fill trending" style={{width:`${scoreBreakdown.trending}%`}}></div></div><b>{scoreBreakdown.trending}%</b></div>
                    <div className="score-row"><span>Diversity</span><div className="score-bar"><div className="score-fill diversity" style={{width:`${scoreBreakdown.diversity}%`}}></div></div><b>{scoreBreakdown.diversity}%</b></div>
                  </div>
                )}
                {currentProfile.compatibilityReasons?.length > 0 && <div className="compatibility-reasons">{currentProfile.compatibilityReasons.map(r=>(<span key={r} className="compatibility-reason">{r}</span>))}</div>}
                {currentProfile.icebreakers?.[0] && <p className="compatibility-opener">Try this opener: {currentProfile.icebreakers[0]}</p>}
              </div>
            ) : null}
            {currentProfile.bio && <div className="bio"><p>{currentProfile.bio}</p></div>}
            <div className="details-grid">
              {currentProfile.occupation && <div className="detail-item"><span className="label">Occupation</span><span className="value">{currentProfile.occupation}</span></div>}
              {currentProfile.education && <div className="detail-item"><span className="label">Education</span><span className="value">{currentProfile.education}</span></div>}
              {currentProfile.relationshipGoals && <div className="detail-item"><span className="label">Looking For</span><span className="value">{currentProfile.relationshipGoals}</span></div>}
              {currentProfile.bodyType && <div className="detail-item"><span className="label">Body Type</span><span className="value">{currentProfile.bodyType}</span></div>}
              {currentProfile.height && <div className="detail-item"><span className="label">Height</span><span className="value">{currentProfile.height} cm</span></div>}
            </div>
            {currentProfile.interests && currentProfile.interests.length > 0 && (
              <div className="interests"><h4>Interests</h4><div className="interest-tags">{currentProfile.interests.map((interest,idx)=>(<span key={idx} className="tag">{interest}</span>))}</div></div>
            )}
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button onClick={handlePass} className="btn-action btn-pass" title="Not interested" aria-label="Pass">✕</button>
        <button onClick={handleRewind} className="btn-action btn-rewind" title="Undo last pass" aria-label="Rewind" disabled={remainingRewinds<=0}>↩️</button>
        <button onClick={()=>onProfileView?.(currentProfile)} className="btn-action btn-view" title="View full profile" aria-label="View Profile">ⓘ</button>
        <button onClick={handleSuperlike} className="btn-action btn-superlike" title="Superlike" aria-label="Superlike" disabled={remainingSuperlikes<=0}>⭐</button>
        <button onClick={handleLike} className="btn-action btn-like" title="Like this profile" aria-label="Like" disabled={remainingLikes<=0}>♥</button>
      </div>

      <div className="card-counter">{currentIndex + 1} of {profiles.length}{nextCursor ? ' +' : ''}</div>
      {loadingMore && <div className="loading-more"><div className="spinner small"></div><span>Loading more...</span></div>}
    </div>
  );
};

export default DiscoveryCards;

