import re

with open('src/components/StatusPreferenceManager.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace manual useState + useEffect with useStatusPreference import
old_imports = "import React, { useState, useEffect } from 'react';\nimport './StatusPreferenceManager.css';"
new_imports = "import React, { useState, useEffect } from 'react';\nimport { useStatusPreference } from '../hooks/useActivityStatus';\nimport './StatusPreferenceManager.css';"

if 'useStatusPreference' not in content:
    content = content.replace(old_imports, new_imports)
    print('Replaced imports')
else:
    print('useStatusPreference already imported')

# Replace the entire hook body using regex
# We need to replace from const [preference, setPreference up to just before the return statement

old_body = """const StatusPreferenceManager = ({ matchId, userId, onSave = null, isOpen = false, onClose = null }) => {
  const [preference, setPreference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState('full');
  const [customSettings, setCustomSettings] = useState({
    showOnlineStatus: true,
    showLastActive: true,
    showTypingIndicator: true,
    showActivityStatus: true,
    showReadReceipts: true,
    shareDetailedStatus: true
  });

  useEffect(() => {
    if (!isOpen || !matchId) return;
    fetchPreference();
  }, [isOpen, matchId]);

