export const PUBLIC_CONTACT_EMAIL = 'mgdhanyamohan@gmail.com';

export const PUBLIC_RESOURCE_ROUTES = [
  { key: 'privacy', path: '/privacy-policy', label: 'Privacy Policy' },
  { key: 'terms', path: '/terms', label: 'Terms' },
  { key: 'deletion', path: '/account-deletion', label: 'Delete Account' },
  { key: 'grievance', path: '/grievance', label: 'Grievance' },
  { key: 'support', path: '/support', label: 'Support' }
];

const mailtoLink = `mailto:${PUBLIC_CONTACT_EMAIL}`;

const PUBLIC_RESOURCE_LABELS = {
  en: {
    privacy: 'Privacy Policy',
    terms: 'Terms',
    deletion: 'Delete Account',
    grievance: 'Grievance',
    support: 'Support'
  },
  ml: {
    privacy: 'സ്വകാര്യതാ നയം',
    terms: 'നിബന്ധനകൾ',
    deletion: 'അക്കൗണ്ട് ഇല്ലാതാക്കൽ',
    grievance: 'പരാതി',
    support: 'സഹായം'
  }
};

const PUBLIC_UI_COPY = {
  en: {
    openApp: 'Open LinkUp',
    navAriaLabel: 'Public legal and support resources',
    audienceLabel: 'Public page for LinkUp Dating users and reviewers'
  },
  ml: {
    openApp: 'LinkUp തുറക്കുക',
    navAriaLabel: 'പൊതു നിയമ, സുരക്ഷ, സഹായ സ്രോതസ്സുകൾ',
    audienceLabel: 'LinkUp Dating ഉപയോക്താക്കളും വിലയിരുത്തുന്നവരും ഉപയോഗിക്കുന്ന പൊതുപേജ്'
  }
};

const EN_LAST_UPDATED = 'Last updated: April 28, 2026';
const ML_LAST_UPDATED = 'അവസാനം പുതുക്കിയത്: 2026 ഏപ്രിൽ 28';

const PUBLIC_PAGE_CONTENT_BY_LANGUAGE = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      eyebrow: 'Privacy & Data Use',
      summary:
        'This policy explains what LinkUp collects, why we collect it, and how we handle sensitive features such as ID verification, location sharing, and audio or video dating tools.',
      lastUpdated: EN_LAST_UPDATED,
      sections: [
        {
          title: 'Scope',
          paragraphs: [
            'This Privacy Policy applies to LinkUp Dating on the web and in mobile builds. It covers account creation, onboarding, messaging, matching, moderation, verification, location sharing, and video-date features.'
          ]
        },
        {
          title: 'Information We Collect',
          bullets: [
            'Account and profile details such as email address, username, display name, age, gender, city, state, country, relationship intent, languages, interests, bio, photos, and profile preferences.',
            'Verification and trust data such as the verification type you choose, government ID reference values, uploaded supporting documents, verification selfies, moderation decisions, fraud checks, and profile verification status.',
            'Communication and community data such as messages, attachments, reports, blocks, introductions, referrals, notifications, and support or grievance submissions.',
            'Location data when you actively use location features, including precise device coordinates from browser or device permissions and any manual location details you choose to type and share.',
            'Audio and video data when you use media features, including camera and microphone streams for calls, video intros, call metadata, and recording-consent signals.',
            'Technical and usage data such as IP address, device and browser details, local storage tokens, crash or error logs, and event analytics needed to operate the service.'
          ]
        },
        {
          title: 'How We Use Information',
          bullets: [
            'To create and secure accounts, verify logins, and prevent fraud or abuse.',
            'To power matching, messaging, trust badges, photo verification, and safety recommendations.',
            'To deliver features you request, including location sharing, video dates, notifications, and profile verification workflows.',
            'To investigate reports, moderate harmful content, respond to grievances, and comply with legal obligations.'
          ]
        },
        {
          title: 'How Information Is Shared',
          bullets: [
            'With other users when you choose to publish profile details, send messages, share locations, or join audio or video interactions.',
            'With service providers and infrastructure partners that help with hosting, storage, communications, analytics, moderation, fraud prevention, and customer support.',
            'With regulators, law enforcement, or other authorized parties when required by law or when necessary to protect users, investigate abuse, or enforce our Terms.'
          ]
        },
        {
          title: 'Retention and User Choices',
          paragraphs: [
            'We keep account and profile information while your account remains active and for a limited period afterward when needed for fraud prevention, dispute handling, or legal compliance.',
            'You can update your profile details in the app, decline camera, microphone, or location permissions, stop using optional media features, block other users, and request help with data access or deletion through the support and grievance channels listed on this page.'
          ]
        },
        {
          title: 'Children and Sensitive Features',
          paragraphs: [
            'LinkUp is intended only for adults who are at least 18 years old. Do not use the service if you are under 18.',
            'Government ID uploads, device location, camera, microphone, and recording-related controls are optional. Use them only when you are comfortable doing so and only for lawful, consensual interactions.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'Privacy Requests',
          items: [
            { label: 'Email', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'Typical requests', value: 'Access, correction, deletion, consent withdrawal, or safety concerns' }
          ]
        },
        {
          title: 'Sensitive Features Covered',
          items: [
            { label: 'Verification', value: 'Government ID reference values, supporting documents, and verification selfies' },
            { label: 'Location', value: 'Precise coordinates when you choose to share them' },
            { label: 'Camera and mic', value: 'Used only when you start media features such as video dates or intros' }
          ]
        }
      ]
    },
    terms: {
      title: 'Terms of Service',
      eyebrow: 'Rules for Using LinkUp',
      summary:
        'These Terms govern your use of LinkUp Dating, including account creation, matching, messaging, verification, and safety-focused media or location features.',
      lastUpdated: EN_LAST_UPDATED,
      sections: [
        {
          title: 'Eligibility',
          bullets: [
            'You must be at least 18 years old and legally able to use the service.',
            'You must provide accurate account information and use only your own identity, photos, and verification material.'
          ]
        },
        {
          title: 'Acceptable Use',
          bullets: [
            'Do not harass, threaten, exploit, impersonate, stalk, defraud, or spam other users.',
            'Do not upload unlawful, sexually exploitative, hateful, or non-consensual content.',
            'Do not scrape the service, bypass access controls, or misuse verification, messaging, referral, or moderation systems.'
          ]
        },
        {
          title: 'Safety, Location, and Recording',
          bullets: [
            'Only share locations with people you trust. If you send location details, you are directing LinkUp to show that information to the selected recipient.',
            'Only enable camera or microphone access when you intend to use media features such as video intros or video dates.',
            'Do not record or distribute another person’s audio, video, or personal information without all required consent.'
          ]
        },
        {
          title: 'Verification and Moderation',
          paragraphs: [
            'LinkUp may review profiles, photos, verification submissions, reports, and other activity to keep the service safe. We may warn, limit, suspend, or permanently remove accounts that violate these Terms or create safety risks.',
            'Verification features improve trust signals but do not guarantee the identity, intent, or conduct of any other user.'
          ]
        },
        {
          title: 'Your Content and Our License',
          paragraphs: [
            'You keep ownership of the content you submit, but you grant LinkUp a limited license to host, process, display, and distribute that content as needed to operate the service, enforce safety controls, and improve product quality.',
            'You are responsible for making sure you have the right to upload every photo, document, recording, or other item you submit.'
          ]
        },
        {
          title: 'Termination and Contact',
          paragraphs: [
            'You may stop using LinkUp at any time. We may suspend or terminate access when needed for safety, fraud prevention, legal compliance, or repeated misuse of the service.',
            'Questions about these Terms can be sent to the contact listed on the Support and Grievance pages.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'Contact',
          items: [
            { label: 'Support and legal email', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'Applies to', value: 'LinkUp Dating web experience, mobile builds, and related moderation tools' }
          ]
        },
        {
          title: 'Key Safety Commitments',
          items: [
            { label: 'Adults only', value: '18+ only' },
            { label: 'Consent first', value: 'Required before recording or sharing another person’s personal data' },
            { label: 'Moderation', value: 'Reports, blocks, and trust workflows may be reviewed and enforced' }
          ]
        }
      ]
    },
    deletion: {
      title: 'Delete Account',
      eyebrow: 'Account Deletion Resource',
      summary:
        'This public page explains how LinkUp users can delete their account, what information is removed, and what limited records may be retained for safety, fraud prevention, or legal compliance.',
      lastUpdated: EN_LAST_UPDATED,
      heroActions: [
        { label: 'Open Login', path: '/login', tone: 'primary' },
        { label: 'Email Deletion Request', href: `${mailtoLink}?subject=LinkUp%20Account%20Deletion%20Request`, tone: 'secondary' }
      ],
      sections: [
        {
          title: 'Delete Your Account in LinkUp',
          paragraphs: [
            'If you can still access your LinkUp account, sign in on the web, open your profile, go to Account Settings, and use the Delete Account action.',
            'The confirmation flow requires the word DELETE before the account is removed.'
          ]
        },
        {
          title: 'Request Deletion Without App Access',
          bullets: [
            `Email ${PUBLIC_CONTACT_EMAIL} from the address linked to your LinkUp account with the subject line "LinkUp Account Deletion Request".`,
            'Include your account email, username if known, and whether you can still access the account.',
            'If you lost access to the inbox used for LinkUp, include enough detail for support to verify ownership before deletion is processed.'
          ]
        },
        {
          title: 'What Is Deleted',
          bullets: [
            'Your account record and related dating profile data.',
            'Profile photos, profile preferences, interactions, matches, and messages associated through the primary user record.',
            'Verification tokens, user blocks, user reports, and related chat records that are removed through the account-deletion flow and database cascades.'
          ]
        },
        {
          title: 'What May Be Retained',
          bullets: [
            'Limited server logs, abuse-report evidence, or safety and moderation records already stored outside the primary account tables.',
            'Records we must keep for fraud prevention, dispute handling, platform security, or legal compliance.',
            'Aggregated or de-identified analytics that no longer identify you directly.'
          ]
        },
        {
          title: 'Timing',
          paragraphs: [
            'Self-service deletion through account settings is intended to happen immediately after confirmation.',
            'Requests sent by email may require manual ownership checks before they are completed.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'Deletion Contact',
          items: [
            { label: 'Email', value: PUBLIC_CONTACT_EMAIL, href: `${mailtoLink}?subject=LinkUp%20Account%20Deletion%20Request` },
            { label: 'Best subject line', value: 'LinkUp Account Deletion Request' },
            { label: 'Use for', value: 'Deletion requests when you cannot complete the process from Account Settings' }
          ]
        },
        {
          title: 'What to Include',
          items: [
            { label: 'Required', value: 'Registered account email' },
            { label: 'Helpful', value: 'Username, device details, and whether you still have account access' },
            { label: 'Note', value: 'For security, LinkUp may verify ownership before deleting an account requested by email.' }
          ]
        }
      ]
    },
    grievance: {
      title: 'Grievance Redressal',
      eyebrow: 'Public Complaint Channel',
      summary:
        'LinkUp provides a public grievance and abuse-reporting channel for user safety, privacy requests, and intermediary or platform complaints.',
      lastUpdated: EN_LAST_UPDATED,
      sections: [
        {
          title: 'How to File a Grievance',
          bullets: [
            'Email the grievance contact listed on this page with the issue summary, affected account or profile details, dates or timestamps, and any screenshots or supporting files you can safely share.',
            'Use in-app report and block flows when the issue relates to another user, unsafe behavior, impersonation, harassment, or non-consensual content.',
            'If your complaint involves privacy, account access, ID verification, location misuse, or media misuse, describe the feature used and what outcome you are requesting.'
          ]
        },
        {
          title: 'What We Prioritize',
          bullets: [
            'Impersonation, fake profiles, fraud, extortion, and repeat harassment.',
            'Non-consensual intimate content, unauthorized recordings, stalking, and doxxing or location misuse.',
            'Privacy and data handling concerns, including deletion requests and government ID or document complaints.',
            'Access issues involving OTP login, account suspension, moderation actions, or verification status.'
          ]
        },
        {
          title: 'Response Targets',
          bullets: [
            'Safety-critical reports and illegal-content complaints are reviewed as quickly as possible.',
            'General grievances are typically acknowledged within 24 hours.',
            'We aim to resolve or meaningfully update most grievances within 15 days, depending on complexity and evidence needs.'
          ]
        },
        {
          title: 'Emergency Situations',
          paragraphs: [
            'If you believe someone is in immediate danger, contact local emergency services or law enforcement first. Then send LinkUp the report details so we can preserve relevant evidence, restrict accounts, and support follow-up actions where appropriate.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'Grievance Contact',
          items: [
            { label: 'Role', value: 'LinkUp Grievance and Safety Desk' },
            { label: 'Email', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'Use for', value: 'User complaints, abuse reports, privacy issues, access disputes, and policy violations' }
          ]
        },
        {
          title: 'Include These Details',
          items: [
            { label: 'Who', value: 'Your account email and the reported profile or username' },
            { label: 'What happened', value: 'A short timeline with dates, timestamps, or message references' },
            { label: 'Evidence', value: 'Screenshots, URLs, or supporting files when available' }
          ]
        }
      ]
    },
    support: {
      title: 'Support',
      eyebrow: 'Help & Safety Support',
      summary:
        'Use this page if you need help with login, verification, media permissions, safety tools, or a request related to your LinkUp account.',
      lastUpdated: EN_LAST_UPDATED,
      sections: [
        {
          title: 'What Support Can Help With',
          bullets: [
            'OTP login issues, account recovery, onboarding problems, and username setup.',
            'Profile verification submissions, government ID or document questions, and trust-status clarifications.',
            'Location sharing, camera or microphone permissions, video-date setup, recording-consent issues, and media troubleshooting.',
            'Reports, blocks, account safety concerns, suspicious activity, and content moderation follow-up.',
            'Privacy requests, access or deletion requests, and general product or store-compliance questions.'
          ]
        },
        {
          title: 'Self-Service Safety Tools',
          bullets: [
            'Use in-app block and report controls for abusive or suspicious users.',
            'Check device or browser settings if location, camera, or microphone permissions were denied earlier.',
            'Review your profile and verification settings before submitting support requests about trust badges or visibility.'
          ]
        },
        {
          title: 'Response Targets',
          bullets: [
            'General support requests usually receive an initial response within 72 hours.',
            'Safety and abuse issues are escalated faster through the grievance and report flows.',
            'Requests that require manual verification or moderation review may take longer when evidence is incomplete or additional validation is needed.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'Support Contact',
          items: [
            { label: 'Email', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'Best for', value: 'Login help, verification help, feature support, and privacy requests' }
          ]
        },
        {
          title: 'Before You Write In',
          items: [
            { label: 'Include', value: 'Your account email, device type, app issue, and screenshots if possible' },
            { label: 'Mention', value: 'Whether the issue involves ID checks, location sharing, camera, microphone, or video features' }
          ]
        }
      ]
    }
  },
  ml: {
    privacy: {
      title: 'സ്വകാര്യതാ നയം',
      eyebrow: 'സ്വകാര്യതയും ഡാറ്റ ഉപയോഗവും',
      summary:
        'LinkUp എന്ത് വിവരങ്ങൾ ശേഖരിക്കുന്നു, എന്തിനാണ് ശേഖരിക്കുന്നത്, ഐഡി സ്ഥിരീകരണം, ലൊക്കേഷൻ പങ്കിടൽ, ഓഡിയോ അല്ലെങ്കിൽ വീഡിയോ ഡേറ്റിംഗ് ഉപകരണങ്ങൾ പോലുള്ള സങ്കീർണ്ണ സവിശേഷതകൾ എങ്ങനെ കൈകാര്യം ചെയ്യുന്നു എന്നതിനെക്കുറിച്ച് ഈ നയം വിശദീകരിക്കുന്നു.',
      lastUpdated: ML_LAST_UPDATED,
      sections: [
        {
          title: 'പ്രാബല്യ പരിധി',
          paragraphs: [
            'വെബിലും മൊബൈൽ ബിൽഡുകളിലും ഉള്ള LinkUp Dating-ന് ഈ സ്വകാര്യതാ നയം ബാധകമാണ്. അക്കൗണ്ട് സൃഷ്ടിക്കൽ, ഓൺബോർഡിംഗ്, സന്ദേശവിനിമയം, മാച്ചിംഗ്, മോഡറേഷൻ, സ്ഥിരീകരണം, ലൊക്കേഷൻ പങ്കിടൽ, വീഡിയോ ഡേറ്റ് സവിശേഷതകൾ എന്നിവയെ ഇത് ഉൾക്കൊള്ളുന്നു.'
          ]
        },
        {
          title: 'ഞങ്ങൾ ശേഖരിക്കുന്ന വിവരങ്ങൾ',
          bullets: [
            'ഇമെയിൽ വിലാസം, ഉപയോക്തൃനാമം, പ്രദർശന നാമം, പ്രായം, ലിംഗം, നഗരം, സംസ്ഥാനം, രാജ്യം, ബന്ധ ലക്ഷ്യം, ഭാഷകൾ, താൽപര്യങ്ങൾ, ബയോ, ഫോട്ടോകൾ, പ്രൊഫൈൽ മുൻഗണനകൾ എന്നിവ പോലുള്ള അക്കൗണ്ടും പ്രൊഫൈലും സംബന്ധിച്ച വിവരങ്ങൾ.',
            'നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന സ്ഥിരീകരണ തരം, സർക്കാർ ഐഡി റഫറൻസ് മൂല്യങ്ങൾ, അപ്ലോഡ് ചെയ്ത സഹായ രേഖകൾ, സ്ഥിരീകരണ സെൽഫികൾ, മോഡറേഷൻ തീരുമാനങ്ങൾ, തട്ടിപ്പ് പരിശോധനകൾ, പ്രൊഫൈൽ സ്ഥിരീകരണ സ്ഥിതി എന്നിവ പോലുള്ള വിശ്വാസ-സ്ഥിരീകരണ വിവരങ്ങൾ.',
            'സന്ദേശങ്ങൾ, അറ്റാച്ച്മെന്റുകൾ, റിപ്പോർട്ടുകൾ, ബ്ലോക്കുകൾ, പരിചയപ്പെടുത്തലുകൾ, റഫറലുകൾ, നോട്ടിഫിക്കേഷനുകൾ, സഹായം അല്ലെങ്കിൽ പരാതിയുമായി ബന്ധപ്പെട്ട സമർപ്പണങ്ങൾ പോലുള്ള ആശയവിനിമയ-സമൂഹ വിവരങ്ങൾ.',
            'ലൊക്കേഷൻ ഫീച്ചറുകൾ നിങ്ങൾ സജീവമായി ഉപയോഗിക്കുമ്പോൾ ലഭിക്കുന്ന കൃത്യമായ ഉപകരണ കോർഡിനേറ്റുകളും നിങ്ങൾ സ്വമേധയാ ടൈപ്പ് ചെയ്ത് പങ്കിടുന്ന ലൊക്കേഷൻ വിവരങ്ങളും ഉൾപ്പെടെയുള്ള ലൊക്കേഷൻ ഡാറ്റ.',
            'മീഡിയ ഫീച്ചറുകൾ ഉപയോഗിക്കുമ്പോൾ ക്യാമറയും മൈക്രോഫോണും വഴി ലഭിക്കുന്ന സ്ട്രീമുകൾ, വീഡിയോ ഇൻട്രോകൾ, കോൾ മെറ്റാഡാറ്റ, റെക്കോർഡിംഗ് സമ്മത സൂചനകൾ തുടങ്ങിയ ഓഡിയോ-വീഡിയോ ഡാറ്റ.',
            'സേവനം പ്രവർത്തിപ്പിക്കാൻ ആവശ്യമായ IP വിലാസം, ഉപകരണം-ബ്രൗസർ വിവരങ്ങൾ, ലോക്കൽ സ്റ്റോറേജ് ടോക്കണുകൾ, ക്രാഷ് അല്ലെങ്കിൽ പിശക് ലോഗുകൾ, ഉപയോഗ അനലിറ്റിക്സ് പോലുള്ള സാങ്കേതിക ഡാറ്റ.'
          ]
        },
        {
          title: 'വിവരങ്ങൾ ഉപയോഗിക്കുന്ന വിധം',
          bullets: [
            'അക്കൗണ്ടുകൾ സൃഷ്ടിക്കാനും സുരക്ഷിതമാക്കാനും, ലോഗിൻ സ്ഥിരീകരിക്കാനും, തട്ടിപ്പും ദുരുപയോഗവും തടയാനും.',
            'മാച്ചിംഗ്, സന്ദേശവിനിമയം, ട്രസ്റ്റ് ബാഡ്ജുകൾ, ഫോട്ടോ സ്ഥിരീകരണം, സുരക്ഷാ ശുപാർശകൾ പോലുള്ള ഡേറ്റിംഗ് സവിശേഷതകൾ പ്രവർത്തിപ്പിക്കാനും മെച്ചപ്പെടുത്താനും.',
            'ലൊക്കേഷൻ പങ്കിടൽ, വീഡിയോ ഡേറ്റുകൾ, നോട്ടിഫിക്കേഷനുകൾ, പ്രൊഫൈൽ സ്ഥിരീകരണ പ്രവാഹങ്ങൾ എന്നിവ ഉൾപ്പെടെ നിങ്ങൾ ആവശ്യപ്പെടുന്ന ഫീച്ചറുകൾ നൽകാനായി.',
            'റിപ്പോർട്ടുകൾ അന്വേഷിക്കാനും, ഹാനികരമായ ഉള്ളടക്കം നിയന്ത്രിക്കാനും, പരാതികൾക്ക് പ്രതികരിക്കാനും, നിയമ ബാധ്യതകൾ പാലിക്കാനും.'
          ]
        },
        {
          title: 'വിവരങ്ങൾ പങ്കിടുന്ന വിധം',
          bullets: [
            'നിങ്ങൾ പ്രൊഫൈൽ വിശദാംശങ്ങൾ പ്രസിദ്ധീകരിക്കുമ്പോഴും, സന്ദേശങ്ങൾ അയയ്ക്കുമ്പോഴും, ലൊക്കേഷൻ പങ്കിടുമ്പോഴും, ഓഡിയോ അല്ലെങ്കിൽ വീഡിയോ ഇടപെടലുകളിൽ ചേരുമ്പോഴും മറ്റ് ഉപയോക്താക്കളുമായി.',
            'ഹോസ്റ്റിംഗ്, സ്റ്റോറേജ്, കമ്മ്യൂണിക്കേഷൻസ്, അനലിറ്റിക്സ്, മോഡറേഷൻ, തട്ടിപ്പ് തടയൽ, ഉപഭോക്തൃ സഹായം എന്നിവയിൽ സഹായിക്കുന്ന സേവനദാതാക്കളുമായും ഇൻഫ്രാസ്ട്രക്ചർ പങ്കാളികളുമായും.',
            'നിയമം ആവശ്യപ്പെടുമ്പോഴും ഉപയോക്താക്കളെ സംരക്ഷിക്കാനും ദുരുപയോഗം അന്വേഷിക്കാനും നിബന്ധനകൾ നടപ്പിലാക്കാനും ആവശ്യമാകുമ്പോഴും അധികാരമുള്ള സ്ഥാപനങ്ങളുമായും.'
          ]
        },
        {
          title: 'സംരക്ഷണ കാലയളവും നിങ്ങളുടെ തിരഞ്ഞെടുപ്പുകളും',
          paragraphs: [
            'നിങ്ങളുടെ അക്കൗണ്ട് സജീവമായിരിക്കുന്നതുവരെ അക്കൗണ്ടും പ്രൊഫൈലും സംബന്ധിച്ച വിവരങ്ങൾ ഞങ്ങൾ സൂക്ഷിക്കും. തട്ടിപ്പ് തടയൽ, തർക്കപരിഹാരം, നിയമാനുസരണം എന്നിവയ്ക്കായി ആവശ്യമുണ്ടെങ്കിൽ പിന്നീട് പരിമിതകാലം കൂടി സൂക്ഷിക്കാം.',
            'ആപ്പിൽ നിന്ന് നിങ്ങളുടെ പ്രൊഫൈൽ വിശദാംശങ്ങൾ പുതുക്കാം, ക്യാമറ, മൈക്രോഫോൺ, ലൊക്കേഷൻ അനുമതികൾ നിഷേധിക്കാം, ഐച്ഛിക മീഡിയ ഫീച്ചറുകൾ ഉപയോഗിക്കുന്നത് നിർത്താം, മറ്റു ഉപയോക്താക്കളെ ബ്ലോക്ക് ചെയ്യാം, ഈ പേജിലെ സഹായം/പരാതി ചാനലുകൾ വഴി ഡാറ്റ ആക്സസിനോ ഇല്ലാതാക്കലിനോ സഹായം അഭ്യർത്ഥിക്കാം.'
          ]
        },
        {
          title: 'കുട്ടികളും സങ്കീർണ്ണ സവിശേഷതകളും',
          paragraphs: [
            'LinkUp 18 വയസോ അതിലധികമോ പ്രായമുള്ളവർക്കുള്ള സേവനമാണ്. 18 വയസിന് താഴെയുള്ളവർ സേവനം ഉപയോഗിക്കരുത്.',
            'സർക്കാർ ഐഡി അപ്ലോഡുകൾ, ഉപകരണ ലൊക്കേഷൻ, ക്യാമറ, മൈക്രോഫോൺ, റെക്കോർഡിംഗ് നിയന്ത്രണങ്ങൾ എന്നിവ ഐച്ഛികമാണ്. നിങ്ങൾക്ക് സൗകര്യമുള്ളപ്പോൾ മാത്രം, നിയമാനുസൃതവും പരസ്പര സമ്മതത്തോടെയുള്ള ഇടപെടലുകൾക്കായി മാത്രം ഉപയോഗിക്കുക.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'സ്വകാര്യതാ അഭ്യർത്ഥനകൾ',
          items: [
            { label: 'ഇമെയിൽ', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'സാധാരണ അഭ്യർത്ഥനകൾ', value: 'ആക്സസ്, തിരുത്തൽ, ഇല്ലാതാക്കൽ, സമ്മതം പിൻവലിക്കൽ, അല്ലെങ്കിൽ സുരക്ഷാ ആശങ്കകൾ' }
          ]
        },
        {
          title: 'ഇവിടെ ഉൾപ്പെടുന്ന സങ്കീർണ്ണ സവിശേഷതകൾ',
          items: [
            { label: 'സ്ഥിരീകരണം', value: 'സർക്കാർ ഐഡി റഫറൻസ് മൂല്യങ്ങൾ, സഹായ രേഖകൾ, സ്ഥിരീകരണ സെൽഫികൾ' },
            { label: 'ലൊക്കേഷൻ', value: 'നിങ്ങൾ പങ്കിടാൻ തിരഞ്ഞെടുക്കുമ്പോൾ ലഭിക്കുന്ന കൃത്യമായ കോർഡിനേറ്റുകൾ' },
            { label: 'ക്യാമറയും മൈക്കും', value: 'വീഡിയോ ഡേറ്റുകൾ അല്ലെങ്കിൽ ഇൻട്രോകൾ പോലുള്ള മീഡിയ ഫീച്ചറുകൾ നിങ്ങൾ ആരംഭിക്കുമ്പോൾ മാത്രം ഉപയോഗിക്കുന്നു' }
          ]
        }
      ]
    },
    terms: {
      title: 'സേവന നിബന്ധനകൾ',
      eyebrow: 'LinkUp ഉപയോഗിക്കുന്നതിനുള്ള ചട്ടങ്ങൾ',
      summary:
        'അക്കൗണ്ട് സൃഷ്ടിക്കൽ, മാച്ചിംഗ്, സന്ദേശവിനിമയം, സ്ഥിരീകരണം, സുരക്ഷകേന്ദ്രിതമായ മീഡിയ അല്ലെങ്കിൽ ലൊക്കേഷൻ സവിശേഷതകൾ എന്നിവ ഉൾപ്പെടെ LinkUp Dating ഉപയോഗിക്കുന്നതിനെ ഈ നിബന്ധനകൾ നിയന്ത്രിക്കുന്നു.',
      lastUpdated: ML_LAST_UPDATED,
      sections: [
        {
          title: 'യോഗ്യത',
          bullets: [
            'നിങ്ങൾക്ക് കുറഞ്ഞത് 18 വയസെങ്കിലും ഉണ്ടായിരിക്കണം, സേവനം നിയമാനുസൃതമായി ഉപയോഗിക്കാൻ യോഗ്യനായിരിക്കണം.',
            'നിങ്ങൾ ശരിയായ അക്കൗണ്ട് വിവരങ്ങൾ നൽകുകയും നിങ്ങളുടെ സ്വന്തം തിരിച്ചറിയൽ, ഫോട്ടോകൾ, സ്ഥിരീകരണ രേഖകൾ മാത്രമേ ഉപയോഗിക്കാവൂ.'
          ]
        },
        {
          title: 'സ്വീകാര്യമായ ഉപയോഗം',
          bullets: [
            'മറ്റു ഉപയോക്താക്കളെ ഉപദ്രവിക്കരുത്, ഭീഷണിപ്പെടുത്തരുത്, ചൂഷണം ചെയ്യരുത്, വ്യാജവേഷം ധരിക്കരുത്, പിന്തുടരരുത്, ചതിക്കരുത്, സ്പാം ചെയ്യരുത്.',
            'നിയമവിരുദ്ധമായ, ലൈംഗികമായി ചൂഷണപരമായ, വെറുപ്പിന് ഇടയാക്കുന്ന, അല്ലെങ്കിൽ സമ്മതമില്ലാത്ത ഉള്ളടക്കം അപ്ലോഡ് ചെയ്യരുത്.',
            'സേവനം സ്ക്രേപ്പ് ചെയ്യരുത്, ആക്സസ് നിയന്ത്രണങ്ങൾ മറികടക്കരുത്, സ്ഥിരീകരണം, സന്ദേശവിനിമയം, റഫറൽ, മോഡറേഷൻ സംവിധാനങ്ങൾ ദുരുപയോഗം ചെയ്യരുത്.'
          ]
        },
        {
          title: 'സുരക്ഷ, ലൊക്കേഷൻ, റെക്കോർഡിംഗ്',
          bullets: [
            'നിങ്ങൾ വിശ്വസിക്കുന്ന ആളുകളുമായേ ലൊക്കേഷൻ പങ്കിടൂ. ലൊക്കേഷൻ അയയ്ക്കുമ്പോൾ അതത് വ്യക്തിയിലേക്ക് ആ വിവരം കാണിക്കാൻ LinkUp-നെ നിങ്ങൾ നിർദ്ദേശിക്കുന്നതാണ്.',
            'വീഡിയോ ഇൻട്രോകൾ, വീഡിയോ ഡേറ്റുകൾ പോലുള്ള മീഡിയ സവിശേഷതകൾ ഉപയോഗിക്കാനാണ് നിങ്ങൾ ഉദ്ദേശിക്കുന്നതെങ്കിൽ മാത്രം ക്യാമറയോ മൈക്രോഫോണോ പ്രവർത്തനക്ഷമമാക്കുക.',
            'മറ്റൊരാളുടെ ഓഡിയോ, വീഡിയോ, വ്യക്തിഗത വിവരങ്ങൾ എന്നിവ ആവശ്യമായ മുഴുവൻ സമ്മതമില്ലാതെ റെക്കോർഡ് ചെയ്യുകയോ വിതരണം ചെയ്യുകയോ അരുത്.'
          ]
        },
        {
          title: 'സ്ഥിരീകരണവും മോഡറേഷനും',
          paragraphs: [
            'സേവനം സുരക്ഷിതമായി നിലനിർത്താൻ LinkUp പ്രൊഫൈലുകൾ, ഫോട്ടോകൾ, സ്ഥിരീകരണ സമർപ്പണങ്ങൾ, റിപ്പോർട്ടുകൾ, മറ്റ് പ്രവർത്തനങ്ങൾ എന്നിവ പരിശോധിക്കാം. ഈ നിബന്ധനകൾ ലംഘിക്കുന്നതോ സുരക്ഷാ അപകടം സൃഷ്ടിക്കുന്നതോ ആയ അക്കൗണ്ടുകൾക്ക് മുന്നറിയിപ്പ് നൽകുകയോ, പരിമിതപ്പെടുത്തുകയോ, സസ്പെൻഡ് ചെയ്യുകയോ, സ്ഥിരമായി നീക്കം ചെയ്യുകയോ ചെയ്യാം.',
            'സ്ഥിരീകരണ സവിശേഷതകൾ വിശ്വാസ സൂചനകൾ മെച്ചപ്പെടുത്തുന്നു. എന്നാൽ മറ്റൊരാളുടെ തിരിച്ചറിയൽ, ഉദ്ദേശ്യം, പെരുമാറ്റം എന്നിവയ്ക്ക് പൂർണ്ണ ഉറപ്പ് നൽകുന്നില്ല.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'ബന്ധപ്പെടുക',
          items: [
            { label: 'സഹായവും നിയമ ഇമെയിലും', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'ബാധകമാകുന്നത്', value: 'LinkUp Dating വെബ് അനുഭവം, മൊബൈൽ ബിൽഡുകൾ, അനുബന്ധ മോഡറേഷൻ ഉപകരണങ്ങൾ' }
          ]
        },
        {
          title: 'പ്രധാന സുരക്ഷാ പ്രതിബദ്ധതകൾ',
          items: [
            { label: 'പ്രായപൂർത്തിയായവർക്ക് മാത്രം', value: '18+ മാത്രം' },
            { label: 'സമ്മതം ആദ്യം', value: 'മറ്റൊരാളുടെ ഡാറ്റ പങ്കിടുന്നതിനും റെക്കോർഡിംഗിനും മുമ്പ് ആവശ്യമാണ്' },
            { label: 'മോഡറേഷൻ', value: 'റിപ്പോർട്ടുകൾ, ബ്ലോക്കുകൾ, വിശ്വാസ-സ്ഥിരീകരണ പ്രവാഹങ്ങൾ പരിശോധിക്കുകയും നടപ്പിലാക്കുകയും ചെയ്യും' }
          ]
        }
      ]
    },
    deletion: {
      title: 'അക്കൗണ്ട് ഇല്ലാതാക്കൽ',
      eyebrow: 'അക്കൗണ്ട് നീക്കംചെയ്യൽ സഹായം',
      summary:
        'LinkUp അക്കൗണ്ട് എങ്ങനെ ഇല്ലാതാക്കാം, എന്ത് വിവരങ്ങളാണ് നീക്കം ചെയ്യപ്പെടുന്നത്, സുരക്ഷ, തട്ടിപ്പ് തടയൽ, നിയമാനുസരണം എന്നിവയ്ക്കായി എന്തെല്ലാം പരിമിത രേഖകൾ നിലനിർത്തേണ്ടിവരും എന്നീ കാര്യങ്ങൾ ഈ പൊതു പേജ് വിശദീകരിക്കുന്നു.',
      lastUpdated: ML_LAST_UPDATED,
      heroActions: [
        { label: 'ലോഗിൻ തുറക്കുക', path: '/login', tone: 'primary' },
        { label: 'ഇമെയിൽ വഴി ഇല്ലാതാക്കൽ അഭ്യർത്ഥിക്കുക', href: `${mailtoLink}?subject=LinkUp%20Account%20Deletion%20Request`, tone: 'secondary' }
      ],
      sections: [
        {
          title: 'LinkUp-ൽ നിന്ന് അക്കൗണ്ട് ഇല്ലാതാക്കൽ',
          paragraphs: [
            'നിങ്ങൾക്ക് ഇപ്പോഴും LinkUp അക്കൗണ്ടിൽ പ്രവേശിക്കാനാകുന്നുവെങ്കിൽ, വെബിൽ ലോഗിൻ ചെയ്ത് പ്രൊഫൈലിലേക്ക് പോകുകയും Account Settings-ൽ Delete Account പ്രവർത്തനം ഉപയോഗിക്കുകയും ചെയ്യുന്നതാണ് ഏറ്റവും വേഗത്തിലുള്ള മാർഗം.',
            'അക്കൗണ്ട് സ്ഥിരമായി ഇല്ലാതാക്കുന്നതിന് മുമ്പ് DELETE എന്ന വാക്ക് ഉറപ്പായി നൽകണം.'
          ]
        },
        {
          title: 'ആപ്പ് ആക്സസ് ഇല്ലാതെ അഭ്യർത്ഥിക്കുക',
          bullets: [
            `നിങ്ങളുടെ LinkUp അക്കൗണ്ടുമായി ബന്ധിപ്പിച്ചിരിക്കുന്ന ഇമെയിൽ വിലാസത്തിൽ നിന്ന് "${PUBLIC_CONTACT_EMAIL}" എന്ന വിലാസത്തിലേക്ക് "LinkUp Account Deletion Request" എന്ന വിഷയം ചേർത്ത് മെയിൽ അയയ്ക്കൂ.`,
            'നിങ്ങളുടെ അക്കൗണ്ട് ഇമെയിലും, അറിയുന്നുവെങ്കിൽ ഉപയോക്തൃനാമവും, ഇപ്പോഴും അക്കൗണ്ടിൽ പ്രവേശിക്കാനാകുന്നുണ്ടോ എന്ന വിവരവും ഉൾപ്പെടുത്തൂ.',
            'LinkUp-യ്ക്കായി ഉപയോഗിച്ച ഇൻബോക്സിൽ പ്രവേശനം നഷ്ടപ്പെട്ടിട്ടുണ്ടെങ്കിൽ, ഇല്ലാതാക്കൽ നടപടിക്ക് മുമ്പ് ഉടമസ്ഥാവകാശം പരിശോധിക്കാൻ മതിയായ വിവരങ്ങൾ നൽകണം.'
          ]
        },
        {
          title: 'എന്തൊക്കെയാണ് ഇല്ലാതാക്കുക',
          bullets: [
            'നിങ്ങളുടെ അക്കൗണ്ട് രേഖയും ബന്ധപ്പെട്ട ഡേറ്റിംഗ് പ്രൊഫൈൽ ഡാറ്റയും.',
            'പ്രൊഫൈൽ ഫോട്ടോകൾ, പ്രൊഫൈൽ മുൻഗണനകൾ, ഇടപെടലുകൾ, മാച്ചുകൾ, സന്ദേശങ്ങൾ.',
            'സ്ഥിരീകരണ ടോക്കണുകൾ, ഉപയോക്തൃ ബ്ലോക്കുകൾ, റിപ്പോർട്ടുകൾ, അനുബന്ധ ചാറ്റ് രേഖകൾ എന്നിവ.'
          ]
        },
        {
          title: 'എന്തൊക്കെയാണ് നിലനിർത്താൻ സാധ്യതയുള്ളത്',
          bullets: [
            'പരിമിത സർവർ ലോഗുകൾ, ദുരുപയോഗ റിപ്പോർട്ട് തെളിവുകൾ, സുരക്ഷാ/മോഡറേഷൻ രേഖകൾ.',
            'തട്ടിപ്പ് തടയൽ, തർക്കപരിഹാരം, പ്ലാറ്റ്ഫോം സുരക്ഷ, നിയമാനുസരണം എന്നിവയ്ക്കായി ആവശ്യമായ രേഖകൾ.',
            'നിങ്ങളെ നേരിട്ട് തിരിച്ചറിയാത്ത സംയോജിതമോ അനാമികമാക്കിയതോ ആയ അനലിറ്റിക്സ്.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'ഇല്ലാതാക്കൽ ബന്ധപ്പെടൽ',
          items: [
            { label: 'ഇമെയിൽ', value: PUBLIC_CONTACT_EMAIL, href: `${mailtoLink}?subject=LinkUp%20Account%20Deletion%20Request` },
            { label: 'വിഷയ വരി', value: 'LinkUp Account Deletion Request' },
            { label: 'ഉപയോഗിക്കുക', value: 'Account Settings വഴി പ്രക്രിയ പൂർത്തിയാക്കാൻ കഴിയാത്തപ്പോൾ' }
          ]
        }
      ]
    },
    grievance: {
      title: 'പരാതി പരിഹാരം',
      eyebrow: 'പൊതു പരാതി ചാനൽ',
      summary:
        'ഉപയോക്തൃ സുരക്ഷ, സ്വകാര്യത അഭ്യർത്ഥനകൾ, ദുരുപയോഗ റിപ്പോർട്ടുകൾ, പ്ലാറ്റ്ഫോം പരാതികൾ എന്നിവയ്ക്കായി LinkUp ഒരു പൊതു പരാതി ചാനൽ നൽകുന്നു.',
      lastUpdated: ML_LAST_UPDATED,
      sections: [
        {
          title: 'പരാതി എങ്ങനെ നൽകാം',
          bullets: [
            'ഈ പേജിലെ പരാതി ഇമെയിലിലേക്ക് പ്രശ്നത്തിന്റെ സംഗ്രഹം, ബാധിച്ച അക്കൗണ്ട് അല്ലെങ്കിൽ പ്രൊഫൈൽ വിവരങ്ങൾ, തീയതികൾ/സമയമുദ്രകൾ, സുരക്ഷിതമായി പങ്കിടാനാകുന്ന സ്ക്രീൻഷോട്ടുകൾ അല്ലെങ്കിൽ സഹായ ഫയലുകൾ എന്നിവയോടെ മെയിൽ അയയ്ക്കൂ.',
            'മറ്റൊരു ഉപയോക്താവുമായി ബന്ധപ്പെട്ട അസുരക്ഷിത പെരുമാറ്റം, വ്യാജവേഷം, ഉപദ്രവം, സമ്മതമില്ലാത്ത ഉള്ളടക്കം എന്നിവയാണെങ്കിൽ ആപ്പിലെ report, block പ്രവാഹങ്ങൾ ഉപയോഗിക്കൂ.',
            'നിങ്ങളുടെ പരാതി സ്വകാര്യത, അക്കൗണ്ട് ആക്സസ്, ഐഡി സ്ഥിരീകരണം, ലൊക്കേഷൻ ദുരുപയോഗം, മീഡിയ ദുരുപയോഗം എന്നിവയുമായി ബന്ധപ്പെട്ടതാണെങ്കിൽ ഉപയോഗിച്ച ഫീച്ചറും നിങ്ങൾ പ്രതീക്ഷിക്കുന്ന ഫലവും വ്യക്തമാക്കൂ.'
          ]
        },
        {
          title: 'ഞങ്ങൾ മുൻഗണന നൽകുന്നത്',
          bullets: [
            'വ്യാജവേഷം, വ്യാജ പ്രൊഫൈലുകൾ, തട്ടിപ്പ്, ഭീഷണിപ്പെടുത്തൽ, ആവർത്തിച്ച ഉപദ്രവം.',
            'സമ്മതമില്ലാത്ത അടുപ്പമുള്ള ഉള്ളടക്കം, അനധികൃത റെക്കോർഡിംഗുകൾ, പിന്തുടരൽ, doxxing അല്ലെങ്കിൽ ലൊക്കേഷൻ ദുരുപയോഗം.',
            'സ്വകാര്യതയും ഡാറ്റ കൈകാര്യം ചെയ്യലും സംബന്ധിച്ച ആശങ്കകൾ, ഇല്ലാതാക്കൽ അഭ്യർത്ഥനകൾ, സർക്കാർ ഐഡി അല്ലെങ്കിൽ രേഖ പരാതികൾ.',
            'OTP ലോഗിൻ, അക്കൗണ്ട് സസ്പെൻഷൻ, മോഡറേഷൻ നടപടികൾ, സ്ഥിരീകരണ നില എന്നിവയുമായി ബന്ധപ്പെട്ട ആക്സസ് പ്രശ്നങ്ങൾ.'
          ]
        },
        {
          title: 'പ്രതികരണ ലക്ഷ്യങ്ങൾ',
          bullets: [
            'സുരക്ഷാ-ഗൗരവമുള്ള റിപ്പോർട്ടുകളും നിയമവിരുദ്ധ ഉള്ളടക്ക പരാതികളും കഴിയുന്നത്ര വേഗത്തിൽ അവലോകനം ചെയ്യുന്നു.',
            'സാധാരണ പരാതികൾക്ക് സാധാരണയായി 24 മണിക്കൂറിനുള്ളിൽ അംഗീകാരം നൽകുന്നു.',
            'സങ്കീർണ്ണതയും തെളിവിന്റെ ആവശ്യകതയും അനുസരിച്ച് മിക്ക പരാതികൾക്കും 15 ദിവസത്തിനുള്ളിൽ പരിഹാരമോ അർത്ഥപൂർണ്ണമായ അപ്ഡേറ്റോ നൽകാൻ ഞങ്ങൾ ശ്രമിക്കുന്നു.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'പരാതി ബന്ധപ്പെടൽ',
          items: [
            { label: 'പങ്ക്', value: 'LinkUp പരാതി & സുരക്ഷാ ഡെസ്ക്' },
            { label: 'ഇമെയിൽ', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'ഉപയോഗിക്കുക', value: 'ഉപയോക്തൃ പരാതികൾ, ദുരുപയോഗ റിപ്പോർട്ടുകൾ, സ്വകാര്യത പ്രശ്നങ്ങൾ, ആക്സസ് തർക്കങ്ങൾ' }
          ]
        }
      ]
    },
    support: {
      title: 'സഹായം',
      eyebrow: 'സഹായവും സുരക്ഷാ പിന്തുണയും',
      summary:
        'ലോഗിൻ, സ്ഥിരീകരണം, മീഡിയ അനുമതികൾ, സുരക്ഷാ ഉപകരണങ്ങൾ, അല്ലെങ്കിൽ നിങ്ങളുടെ LinkUp അക്കൗണ്ടുമായി ബന്ധപ്പെട്ട അഭ്യർത്ഥനകൾ എന്നിവയ്ക്ക് സഹായം ആവശ്യമാണെങ്കിൽ ഈ പേജ് ഉപയോഗിക്കൂ.',
      lastUpdated: ML_LAST_UPDATED,
      sections: [
        {
          title: 'സഹായം നൽകാൻ കഴിയുന്ന മേഖലകൾ',
          bullets: [
            'OTP ലോഗിൻ പ്രശ്നങ്ങൾ, അക്കൗണ്ട് വീണ്ടെടുപ്പ്, ഓൺബോർഡിംഗ് തടസ്സങ്ങൾ, ഉപയോക്തൃനാമ ക്രമീകരണം.',
            'പ്രൊഫൈൽ സ്ഥിരീകരണ സമർപ്പണങ്ങൾ, സർക്കാർ ഐഡി അല്ലെങ്കിൽ രേഖ സംബന്ധമായ ചോദ്യങ്ങൾ, വിശ്വാസ നിലയെക്കുറിച്ചുള്ള വിശദീകരണങ്ങൾ.',
            'ലൊക്കേഷൻ പങ്കിടൽ, ക്യാമറ/മൈക്രോഫോൺ അനുമതികൾ, വീഡിയോ ഡേറ്റ് സജ്ജീകരണം, റെക്കോർഡിംഗ് സമ്മത പ്രശ്നങ്ങൾ, മീഡിയ ട്രബിൾഷൂട്ടിംഗ്.',
            'റിപ്പോർട്ടുകൾ, ബ്ലോക്കുകൾ, അക്കൗണ്ട് സുരക്ഷാ ആശങ്കകൾ, സംശയാസ്പദ പ്രവർത്തനം, ഉള്ളടക്ക മോഡറേഷൻ ഫോളോ-അപ്പ്.',
            'സ്വകാര്യത അഭ്യർത്ഥനകൾ, ആക്സസ് അല്ലെങ്കിൽ ഇല്ലാതാക്കൽ അഭ്യർത്ഥനകൾ.'
          ]
        },
        {
          title: 'Self-service സുരക്ഷാ ഉപകരണങ്ങൾ',
          bullets: [
            'ദുരുപയോഗപരമായ അല്ലെങ്കിൽ സംശയാസ്പദമായ ഉപയോക്താക്കൾക്കായി ആപ്പിലെ block, report നിയന്ത്രണങ്ങൾ ഉപയോഗിക്കൂ.',
            'ലൊക്കേഷൻ, ക്യാമറ, മൈക്രോഫോൺ അനുമതികൾ മുമ്പ് നിഷേധിച്ചിരുന്നെങ്കിൽ ഉപകരണമോ ബ്രൗസറോയിലെ ക്രമീകരണങ്ങൾ പരിശോധിക്കൂ.',
            'Trust badge അല്ലെങ്കിൽ visibility സംബന്ധിച്ച സഹായ അഭ്യർത്ഥനകൾ അയയ്ക്കുന്നതിന് മുമ്പ് നിങ്ങളുടെ പ്രൊഫൈൽ, സ്ഥിരീകരണ ക്രമീകരണങ്ങൾ പരിശോധിക്കൂ.'
          ]
        },
        {
          title: 'പ്രതികരണ ലക്ഷ്യങ്ങൾ',
          bullets: [
            'പൊതുവായ സഹായ അഭ്യർത്ഥനകൾക്ക് സാധാരണയായി 72 മണിക്കൂറിനുള്ളിൽ ആദ്യ പ്രതികരണം ലഭിക്കും.',
            'സുരക്ഷയോ ദുരുപയോഗമോ ബന്ധപ്പെട്ട വിഷയങ്ങൾ grievance, report പ്രവാഹങ്ങൾ വഴി കൂടുതൽ വേഗത്തിൽ ഉയർത്തിപ്പിടിക്കും.',
            'മാനുവൽ സ്ഥിരീകരണമോ മോഡറേഷൻ അവലോകനമോ ആവശ്യമായ അഭ്യർത്ഥനകൾക്ക് ചിലപ്പോൾ കൂടുതൽ സമയം എടുക്കാം.'
          ]
        }
      ],
      contactCards: [
        {
          title: 'സഹായ ബന്ധപ്പെടൽ',
          items: [
            { label: 'ഇമെയിൽ', value: PUBLIC_CONTACT_EMAIL, href: mailtoLink },
            { label: 'അത്യുത്തമം', value: 'ലോഗിൻ സഹായം, സ്ഥിരീകരണ സഹായം, ഫീച്ചർ പിന്തുണ, സ്വകാര്യത അഭ്യർത്ഥനകൾ' }
          ]
        }
      ]
    }
  }
};

export const PUBLIC_PAGE_CONTENT = PUBLIC_PAGE_CONTENT_BY_LANGUAGE.en;

const getLocalizedRecord = (records, language = 'en') => records[language] || records.en;

export const getPublicUiCopy = (language = 'en') => getLocalizedRecord(PUBLIC_UI_COPY, language);

export const getPublicResourceRoutes = (language = 'en') => {
  const labels = getLocalizedRecord(PUBLIC_RESOURCE_LABELS, language);

  return PUBLIC_RESOURCE_ROUTES.map((resource) => ({
    ...resource,
    label: labels[resource.key] || resource.label
  }));
};

export const getPublicPageContent = (pageKey, language = 'en') => {
  const pages = PUBLIC_PAGE_CONTENT_BY_LANGUAGE[language] || PUBLIC_PAGE_CONTENT_BY_LANGUAGE.en;
  return pages[pageKey] || PUBLIC_PAGE_CONTENT_BY_LANGUAGE.en[pageKey] || null;
};
