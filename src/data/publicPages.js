export const PUBLIC_CONTACT_EMAIL = 'mgdhanyamohan@gmail.com';

export const PUBLIC_RESOURCE_ROUTES = [
  { key: 'privacy', path: '/privacy-policy', label: 'Privacy Policy' },
  { key: 'terms', path: '/terms', label: 'Terms' },
  { key: 'deletion', path: '/account-deletion', label: 'Delete Account' },
  { key: 'grievance', path: '/grievance', label: 'Grievance' },
  { key: 'support', path: '/support', label: 'Support' }
];

const mailtoLink = `mailto:${PUBLIC_CONTACT_EMAIL}`;
const lastUpdatedLabel = 'Last updated: April 28, 2026';

export const PUBLIC_PAGE_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Privacy & Data Use',
    summary:
      'This policy explains what LinkUp collects, why we collect it, and how we handle sensitive features such as ID verification, location sharing, and audio or video dating tools.',
    lastUpdated: lastUpdatedLabel,
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
          'Account and profile details such as email address, username, display name, age, gender, city, state, country, relationship intent, languages, religion or community preferences, interests, occupation, education, bio, photos, and profile preferences.',
          'Verification and trust data such as the verification type you choose, government ID reference values, uploaded supporting documents, verification selfies, moderation decisions, fraud checks, and profile verification status.',
          'Communication and community data such as messages, attachments, reports, blocks, introductions, referrals, notifications, and support or grievance submissions.',
          'Location data when you actively use location features, including precise device coordinates from browser or device permissions and any manual location details you choose to type and share.',
          'Audio and video data when you use media features, including camera and microphone streams for calls, video intros, call metadata, and recording-consent signals when both participants use recording controls.',
          'Technical and usage data such as IP address, device and browser details, local storage tokens, notification preferences, crash or error logs, and event analytics needed to operate the service.'
        ]
      },
      {
        title: 'How We Use Information',
        bullets: [
          'To create and secure accounts, verify logins, and prevent fraud or abuse.',
          'To build and improve dating features such as matching, messaging, trust badges, photo verification, and safety recommendations.',
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
          'We keep account and profile information while your account remains active and for a limited period afterward when needed for fraud prevention, dispute handling, or legal compliance. Verification and safety records may be retained longer than ordinary profile content when necessary to investigate abuse or repeat violations.',
          'You can update your profile details in the app, decline camera, microphone, or location permissions, stop using optional media features, block other users, and request help with data access or deletion through the support and grievance channels listed on this page.'
        ]
      },
      {
        title: 'Children and Sensitive Features',
        paragraphs: [
          'LinkUp is intended only for adults who are at least 18 years old. Do not use the service if you are under 18.',
          'Government ID uploads, device location, camera, microphone, and any recording-related controls are optional feature areas. Use them only when you are comfortable doing so and only for lawful, consensual interactions.'
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
    lastUpdated: lastUpdatedLabel,
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
          'Do not record or distribute another person’s audio, video, or personal information without all required consent. Where LinkUp offers recording-consent controls, both participants must agree before recording begins.'
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
    lastUpdated: lastUpdatedLabel,
    heroActions: [
      { label: 'Open Login', path: '/login', tone: 'primary' },
      { label: 'Email Deletion Request', href: `${mailtoLink}?subject=LinkUp%20Account%20Deletion%20Request`, tone: 'secondary' }
    ],
    sections: [
      {
        title: 'Delete Your Account in LinkUp',
        paragraphs: [
          'If you can still access your LinkUp account, the fastest option is to sign in on the web, open your profile, go to Account Settings, and use the Delete Account action. The in-app confirmation requires the word DELETE before the account is removed.',
          'This web flow is intended to satisfy outside-the-app deletion access for Play listing compliance, so you can start from a browser without opening the Android app.'
        ]
      },
      {
        title: 'Request Deletion Without App Access',
        bullets: [
          `Email ${PUBLIC_CONTACT_EMAIL} from the email address linked to your LinkUp account with the subject line "LinkUp Account Deletion Request".`,
          'Include your account email, username if you know it, and whether you can still access the account.',
          'If you lost access to the inbox used for LinkUp, include enough detail for support to verify ownership before any deletion is processed.'
        ]
      },
      {
        title: 'What Is Deleted',
        bullets: [
          'Your account record and related dating profile data.',
          'Profile photos, profile preferences, interactions, matches, and messages associated through the primary user record.',
          'Video-date records, verification tokens, user blocks, user reports, chatroom membership records, chatroom messages, and lobby messages that are deleted through the existing account-removal flow and database cascades.'
        ]
      },
      {
        title: 'What May Be Retained',
        bullets: [
          'Limited server logs, abuse-report evidence, or safety and moderation records that were already stored outside the primary account tables.',
          'Records we must keep for fraud prevention, dispute handling, platform security, or legal compliance.',
          'Aggregated or de-identified analytics that no longer identify you directly.'
        ]
      },
      {
        title: 'Timing',
        paragraphs: [
          'Self-service deletion through the authenticated account settings flow is intended to happen immediately after confirmation. Requests sent by email may require manual ownership checks before they are completed.',
          'If your request also involves a grievance, abuse report, payment issue, or legal hold, some data may need to be preserved until that issue is resolved.'
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
    lastUpdated: lastUpdatedLabel,
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
    lastUpdated: lastUpdatedLabel,
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
};
