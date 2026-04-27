import re

with open('src/components/DiscoveryCards.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update loadProfiles to support cursor
old_loadProfiles = '''  const loadProfiles = async (nextFilters = appliedFilters) => {
    setLoading(true); setError('');
    try {
      const data = await datingProfileService.getDiscoveryProfiles(buildDiscoveryFilters(nextFilters));
      setProfiles(data.profiles||[]); setCurrentIndex(0); setNoMoreProfiles((data.profiles||[]).length===0); setDiscoveryMode('regular');
    } catch (err) { setError('Failed to load profiles. Please try again.'); console.error(err); }
    finally { setLoading(false); }
  };'''

new_loadProfiles = '''  const loadProfiles = async (nextFilters = appliedFilters, cursor = null) => {
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
  };'''

content = content.replace(old_loadProfiles, new_loadProfiles)

# 2. Update loadTopPicks
old_topPicks = '''  const loadTopPicks = async () => {
    setLoading(true); setError('');
    try { const d = await datingProfileService.getTopPicks(10); setProfiles(d.profiles||[]); setCurrentIndex(0); setNoMoreProfiles((d.profiles||[]).length===0); setDiscoveryMode('topPicks'); }
    catch (err) { setError('Failed to load top picks.'); console.error(err); }
    finally { setLoading(false); }
  };'''

new_topPicks = '''  const loadTopPicks = async (cursor = null) => {
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
  };'''

content = content.replace(old_topPicks, new_topPicks)

# 3. Update loadSmartQueue
old_smartQueue = '''  const loadSmartQueue = async (page=1) => {
    setLoading(true); setError('');
    try { const d = await datingProfileService.getDiscoveryQueue(page,10); setProfiles(d.profiles||[]); setCurrentIndex(0); setNoMoreProfiles((d.profiles||[]).length===0); setQueuePage(page); setDiscoveryMode('smartQueue'); }
    catch (err) { setError('Failed to load smart queue.'); console.error(err); }
    finally { setLoading(false); }
  };'''

new_smartQueue = '''  const loadSmartQueue = async (cursor = null) => {
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
  };'''

content = content.replace(old_smartQueue, new_smartQueue)

# 4. Update loadTrending
old_trending = '''  const loadTrending = async () => {
    setLoading(true); setError('');
    try { const d = await datingProfileService.getTrendingProfiles(10); setProfiles(d.profiles||[]); setCurrentIndex(0); setNoMoreProfiles((d.profiles||[]).length===0); setDiscoveryMode('trending'); }
    catch (err) { setError('Failed to load trending.'); console.error(err); }
    finally { setLoading(false); }
  };'''

new_trending = '''  const loadTrending = async (cursor = null) => {
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
  };'''

content = content.replace(old_trending, new_trending)

# 5. Update loadNewProfiles
old_new = '''  const loadNewProfiles = async () => {
    setLoading(true); setError('');
    try { const d = await datingProfileService.getNewProfiles(10); setProfiles(d.profiles||[]); setCurrentIndex(0); setNoMoreProfiles((d.profiles||[]).length===0); setDiscoveryMode('newProfiles'); }
    catch (err) { setError('Failed to load new profiles.'); console.error(err); }
    finally { setLoading(false); }
  };'''

new_new = '''  const loadNewProfiles = async (cursor = null) => {
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
  };'''

content = content.replace(old_new, new_new)

# 6. Update setMode
old_setMode = '''  const setMode = (mode) => {
    if (mode === discoveryMode) return;
    if (mode === 'regular') loadProfiles(appliedFilters);
    else if (mode === 'topPicks') loadTopPicks();
    else if (mode === 'smartQueue') loadSmartQueue(1);
    else if (mode === 'trending') loadTrending();
    else if (mode === 'newProfiles') loadNewProfiles();
  };'''

new_setMode = '''  const setMode = (mode) => {
    if (mode === discoveryMode) return;
    if (mode === 'regular') loadProfiles(appliedFilters);
    else if (mode === 'topPicks') loadTopPicks();
    else if (mode === 'smartQueue') loadSmartQueue();
    else if (mode === 'trending') loadTrending();
    else if (mode === 'newProfiles') loadNewProfiles();
  };'''

content = content.replace(old_setMode, new_setMode)

# 7. Update moveToNextCard
old_move = '''  const moveToNextCard = () => {
    if (currentIndex < profiles.length - 1) setCurrentIndex(i=>i+1);
    else setNoMoreProfiles(true);
  };'''

new_move = '''  const moveToNextCard = useCallback(() => {
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
  }, [currentIndex, profiles.length, nextCursor, discoveryMode, appliedFilters]);'''

content = content.replace(old_move, new_move)

# 8. Update reloadProfiles
old_reload = '''  const reloadProfiles = () => {
    setCurrentIndex(0); setNoMoreProfiles(false);
    if (discoveryMode==='smartQueue') loadSmartQueue(queuePage+1);
    else if (discoveryMode==='trending') loadTrending();
    else if (discoveryMode==='newProfiles') loadNewProfiles();
    else if (discoveryMode==='topPicks') loadTopPicks();
    else loadProfiles(appliedFilters);
  };'''

new_reload = '''  const reloadProfiles = () => {
    setCurrentIndex(0); setNoMoreProfiles(false); loadMoreTriggered.current = false;
    if (discoveryMode==='smartQueue') loadSmartQueue();
    else if (discoveryMode==='trending') loadTrending();
    else if (discoveryMode==='newProfiles') loadNewProfiles();
    else if (discoveryMode==='topPicks') loadTopPicks();
    else loadProfiles(appliedFilters);
  };'''

content = content.replace(old_reload, new_reload)

# 9. Update handleApplyFilters
old_apply = '''  const handleApplyFilters = async (e) => {
    e.preventDefault();
    const next = { ageMin:filters.ageMin, ageMax:filters.ageMax, distance:filters.distance, gender:filters.gender, relationshipGoals:filters.relationshipGoals, interests:filters.interests, heightRangeMin:filters.heightRangeMin, heightRangeMax:filters.heightRangeMax, bodyTypes:filters.bodyTypes };
    setAppliedFilters(next); setShowFilters(false); await loadProfiles(next);
  };'''

new_apply = '''  const handleApplyFilters = async (e) => {
    e.preventDefault();
    const next = { ageMin:filters.ageMin, ageMax:filters.ageMax, distance:filters.distance, gender:filters.gender, relationshipGoals:filters.relationshipGoals, interests:filters.interests, heightRangeMin:filters.heightRangeMin, heightRangeMax:filters.heightRangeMax, bodyTypes:filters.bodyTypes };
    setAppliedFilters(next); setShowFilters(false); setNextCursor(null); loadMoreTriggered.current = false; await loadProfiles(next);
  };'''

content = content.replace(old_apply, new_apply)

# 10. Update handleResetFilters
old_reset = '''  const handleResetFilters = async () => { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setShowFilters(false); await loadProfiles(DEFAULT_FILTERS); };'''

new_reset = '''  const handleResetFilters = async () => { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setShowFilters(false); setNextCursor(null); loadMoreTriggered.current = false; await loadProfiles(DEFAULT_FILTERS); };'''

content = content.replace(old_reset, new_reset)

# 11. Update error display
old_error = 'if (error) return <div className="discovery-container error"><p className="error-message">{error}</p><button onClick={()=>loadProfiles(appliedFilters)} className="btn-retry">Retry</button></div>;'
new_error = 'if (error && profiles.length === 0) return <div className="discovery-container error"><p className="error-message">{error}</p><button onClick={()=>loadProfiles(appliedFilters)} className="btn-retry">Retry</button></div>;'
content = content.replace(old_error, new_error)

# 12. Update empty state
old_empty = '<div className="empty-state"><h2>No More Profiles</h2><p>{activeFilterCount>0?\'No profiles match your current preferences.\':"You\'ve reviewed all available profiles!"}</p><button onClick={reloadProfiles} className="btn-primary">Reload Profiles</button></div>'
new_empty = '<div className="empty-state"><h2>No More Profiles</h2><p>{activeFilterCount>0?\'No profiles match your current preferences.\':"You\'ve reviewed all available profiles!"}</p>{loadingMore?<div className="spinner small"></div>:<button onClick={reloadProfiles} className="btn-primary">Reload Profiles</button>}</div>'
content = content.replace(old_empty, new_empty)

# 13. Add lazy loading to img
old_img = '<img src={currentProfile.photos[0]} alt={currentProfile.firstName} className="profile-photo" onError={e=>{e.target.src=\'https://via.placeholder.com/400x600?text=No+Photo\';}}/>'
new_img = '''<img 
                  src={currentProfile.photos[0]} 
                  alt={currentProfile.firstName} 
                  className="profile-photo" 
                  loading="lazy"
                  decoding="async"
                  onError={e=>{e.target.src='https://via.placeholder.com/400x600?text=No+Photo';}}
                />'''
content = content.replace(old_img, new_img)

# 14. Update card counter and add loading indicator
old_counter = '<div className="card-counter">{currentIndex + 1} of {profiles.length}</div>'
new_counter = '<div className="card-counter">{currentIndex + 1} of {profiles.length}{nextCursor ? \' +\' : \'\'}</div>\n      {loadingMore && <div className="loading-more"><div className="spinner small"></div><span>Loading more...</span></div>}'
content = content.replace(old_counter, new_counter)

with open('src/components/DiscoveryCards.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('All DiscoveryCards updates done')
