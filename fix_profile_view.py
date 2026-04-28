import re

with open('src/components/DatingProfileView.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
new_import = "import { useActivityStatus } from '../hooks/useActivityStatus';\n"
marker = "import '../styles/DatingProfile.css';\n"

if new_import.strip() not in content:
    content = content.replace(marker, marker + new_import)
    print('Added useActivityStatus import')
else:
    print('Import already present')

# Add hook usage inside the component after 'const currentUserId = currentUser?.id;'
hook_usage = """
  const {
    status: activityStatus,
    formatted: activityFormatted,
    isOnline,
    currentActivity,
    lastActiveFormatted,
    isVideoDating,
    loading: activityLoading
  } = useActivityStatus(profile?.userId, profile?.matchId, true);
"""
marker_hook = "const currentUserId = currentUser?.id;"

if 'useActivityStatus' in content and 'activityStatus' not in content:
    content = content.replace(marker_hook, marker_hook + hook_usage)
    print('Added useActivityStatus hook usage')
else:
    print('Hook usage already present or not needed')

# Enhance activity hint to use real-time data
old_activity_hint = """const activityHint = getProfileActivityHint(profile?.lastActive);"""
new_activity_hint = """const activityHint = useMemo(() => {
    if (activityFormatted) {
      return { label: activityFormatted.text, tone: activityFormatted.badge || 'online' };
    }
    return getProfileActivityHint(profile?.lastActive);
  }, [activityFormatted, profile?.lastActive]);"""

if old_activity_hint in content:
    content = content.replace(old_activity_hint, new_activity_hint)
    print('Replaced activityHint with real-time data')
else:
    print('activityHint not found or already updated')

# Add activity status chip in the header meta section
old_header_meta = """{activityHint ? (
              <span className={`activity-chip ${activityHint.tone}`}>{activityHint.label}</span>
            ) : null}"""

new_header_meta = """{activityHint ? (
              <span className={`activity-chip ${activityHint.tone}`}>{activityHint.label}</span>
            ) : null}
            {isVideoDating && (
              <span className="activity-chip video-dating">Video dating</span>
            )}"""

if 'isVideoDating' not in content:
    content = content.replace(old_header_meta, new_header_meta)
    print('Added video dating chip')
else:
    print('Video dating chip already present')

with open('src/components/DatingProfileView.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done updating DatingProfileView.js')
