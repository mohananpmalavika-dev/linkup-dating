# Admin Moderation Workflow Guide

## Overview

The Admin Moderation Dashboard allows admins to review user reports, manage content, issue warnings, and ban users to maintain platform safety and compliance.

---

## Dashboard Overview

### Location
- **Admin Panel**: `/admin/moderation`
- **Route**: Protected by admin authentication
- **Access**: Admin and Super Admin users only

### Main Features
1. **Review Queue** - Process flagged content
2. **Statistics** - View moderation metrics
3. **User Management** - Issue warnings and bans (coming soon)

---

## Review Queue Workflow

### Step 1: Access the Dashboard

```
1. Log in with admin account
2. Navigate to /admin/moderation
3. Click "Review Queue" tab
```

### Step 2: Review Pending Flags

The left panel shows all pending flags with:
- **Content Type**: What was reported (profile, bio, photo, message)
- **Reason**: Why it was flagged
- **Date**: When it was reported
- **Content ID**: Identifier for the content

**Filter Options**:
- Status: Pending / All
- Sort: Most Recent / Oldest

### Step 3: Examine Content Details

Click a flag to see full details on the right panel:
- **Content Type**: Category of content
- **Content ID**: Exact content identifier
- **Reported By**: User who made the report
- **Reason**: Detailed reason for report
- **Reported On**: Timestamp of report

### Step 4: Make a Decision

**Option A: Approve**
- Choose "Approve" radio button
- Content stays visible
- User is NOT notified
- Flag is resolved

**Option B: Reject**
- Choose "Reject" radio button
- Content violates policy
- User may be warned/banned
- Write resolution note explaining action
- Flag is resolved

### Step 5: Add Resolution Note

Optional: Explain your decision
- Example: "Fake photos violate Terms of Service - user warned"
- Example: "Offensive language - user suspended 7 days"
- Example: "Review incomplete - investigating further"

### Step 6: Submit Decision

Click "Submit Decision" to:
- Resolve the flag
- Log the action
- Remove flag from queue
- Proceed to next flag

---

## Escalation Workflow

### Critical Issues (Immediate Action)

If content relates to:
- **Violence/Threats**: Remove immediately, temp ban
- **Self-Harm/Suicide**: Contact law enforcement, permanent ban
- **Child Safety**: Report to NCMEC (CyberTipline)
- **Child Sexual Abuse Material**: Report to NCMEC, law enforcement

**Action Protocol**:
```
1. Remove content immediately
2. Issue temporary suspension (24-72 hours)
3. Document incident thoroughly
4. Escalate to Super Admin
5. Contact law enforcement if necessary
```

### High Priority Issues (24-Hour Review)

- NSFW/Explicit content
- Severe harassment
- Hate speech
- Targeted abuse

**Action Protocol**:
```
1. Flag for urgent review
2. Temporary suspension (pending review)
3. Investigate user history
4. Issue warning or ban based on history
```

### Standard Issues (48-Hour Review)

- Minor profanity
- Spam
- Misleading content
- Copyright issues

**Action Protocol**:
```
1. Queue for standard review
2. Issue user warning
3. Note in moderation log
4. Monitor user for repeat offenses
```

---

## User Warning System

### First Violation
- Issue formal warning
- Content may be removed or hidden
- User can appeal

### Second Violation (within 30 days)
- Suspend user for 1-7 days
- Content removed
- Loss of features (messaging, dating)

### Third Violation (within 90 days)
- Suspend user for 7-30 days
- OR Permanent ban (if severe)
- Refer to Super Admin for review

---

## Ban Types

### Temporary Ban

```json
{
  "ban_type": "temporary",
  "duration_days": 7,
  "reason": "Harassment of other users",
  "start_date": "2026-04-28T00:00:00Z"
}
```

Duration: 1-90 days
- 1-3 days: Minor violations
- 3-7 days: Repeated violations
- 7-30 days: Severe violations
- 30+ days: Pattern of abuse

### Permanent Ban

```json
{
  "ban_type": "permanent",
  "reason": "Repeated harassment and abuse despite warnings"
}
```

Used for:
- Repeat offenders (3+ violations)
- Severe violations (threats, hate speech)
- Child safety violations
- Fraud/scam attempts

---

## Moderation Statistics

### Dashboard Metrics

1. **Pending Flags**: Backlog of unreviewedreports
   - Target: <10 (24-hour review SLA)
   - Alert if: >50 (escalate to team)

2. **Resolved Flags**: Total processed
   - Shows approval vs. rejection rate
   - Useful for trend analysis

3. **Recent Actions**: Last 30 days
   - Warnings issued
   - Suspensions applied
   - Content removed

### Monitoring Goals

- **Response Time**: <24 hours for urgent, <48 hours for standard
- **Appeal Rate**: <10% (should indicate fair decisions)
- **Re-offender Rate**: <15% (indicates effectiveness)
- **Appeal Success Rate**: <5% (indicates consistent decisions)

---

## Best Practices

### 1. Consistent Standards

- Apply policies uniformly
- Document reasoning
- Review decisions regularly
- Discuss gray areas with team

### 2. Privacy Protection

- Never share user personal data
- Redact sensitive information
- Don't disclose moderation actions publicly
- Respect user confidentiality

### 3. Impartiality

- Don't let personal bias affect decisions
- Treat all users equally
- Review appeals objectively
- Recuse yourself if conflicted

### 4. Documentation

- Always add resolution notes
- Explain reasoning clearly
- Include policy references
- Log pattern violations

### 5. Communication

- Be professional with flagged users
- Explain violations clearly
- Offer appeal process
- Provide path to reinstatement

---

## Appeal Process

### User Appeals Ban/Warning

1. User submits appeal with explanation
2. Super Admin reviews appeal
3. Appeal is approved or denied
4. User is notified

**Appeal Success Factors**:
- Genuine acknowledgment of violation
- Evidence of changed behavior
- Time served (for temp bans)
- Specific steps to prevent recurrence

---

## Common Scenarios

### Scenario 1: Fake Profile Photos

**Flag Reason**: "Catfishing - photos appear to be stock images"

**Investigation**:
- Check reverse image search results
- Look for warning signs (perfect photo quality, generic poses)
- Review user message patterns

**Decision**: REJECT
- **Reason**: Violates "Authentic Photos" policy
- **Action**: Warning (first offense)
- **Message**: "Your profile photos must be authentic. Stock photos/images of others aren't allowed."

### Scenario 2: Offensive Language

**Flag Reason**: "Bio contains racist slurs"

**Investigation**:
- Read full bio
- Confirm language is offensive
- Check context (joke vs. genuine hate)

**Decision**: REJECT
- **Reason**: Violates "Respectful Community" policy
- **Action**: Suspension (1-7 days depending on severity)
- **Message**: "Hateful language violates our policies. Account suspended 3 days."

### Scenario 3: Spam Promotion

**Flag Reason**: "Messages promote cryptocurrency investment scheme"

**Investigation**:
- Review message content
- Check message patterns (mass DM?)
- Look for financial scam indicators

**Decision**: REJECT
- **Reason**: Spam/investment scam
- **Action**: Temporary ban (3-7 days)
- **Message**: "Spamming and investment schemes are prohibited. Account suspended 7 days."

### Scenario 4: Misunderstood Humor

**Flag Reason**: "Offensive message about dating failures"

**Investigation**:
- Read message in full context
- Check if self-deprecating humor
- Review user history (pattern?)

**Decision**: APPROVE
- **Reason**: Self-directed humor, not targeting others
- **Note**: "Message is self-deprecating joke, not targeting/harassing others"

---

## Tools & Resources

### Dashboard Sections

1. **Review Queue**
   - Left: List of pending flags
   - Right: Detail panel and resolution form

2. **Statistics**
   - Pending count
   - Resolved count
   - Action breakdown

3. **User Management** (Coming Soon)
   - User warning history
   - Ban management
   - User appeals

### Filters & Sorting

**Filter by Status**:
- Pending: Only unreviewed flags
- All: All flags including resolved

**Sort by**:
- Most Recent: Newest flags first
- Oldest: Flags oldest first (for processing backlog)

---

## Escalation Contacts

### Super Admin
- For permanent bans
- For policy clarifications
- For serious violations
- For team training

### Law Enforcement
- Contact if: CSAM, threats of violence, criminal activity
- What to report: User ID, incident details, evidence
- Who reports: Super Admin or company legal

### Platform Safety Team
- Report patterns: Coordinated harassment, bot networks
- Report new threats: Emerging scam tactics
- Request help: Unclear policy decisions

---

## Performance Metrics

### Personal Metrics (Track Yourself)

- Flags reviewed per day
- Appeal rate on your decisions
- Average review time
- Consistency with team decisions

### Team Metrics

- Total flags processed
- Average resolution time
- Appeal success rate
- Most common violations

### Goal

Process all pending flags within 24 hours (urgent) or 48 hours (standard).

---

## Training & Onboarding

### New Moderator Checklist

- [ ] Read Terms of Service
- [ ] Read Community Guidelines
- [ ] Review this guide
- [ ] Shadow experienced moderator (5+ flags)
- [ ] Make decisions on simple flags (spam, profanity)
- [ ] Review decisions with trainer
- [ ] Approved for independent review

### Regular Training

- Monthly: Policy updates
- Quarterly: Case study reviews
- As needed: Complex policy interpretation

---

## Support & Questions

**Common Questions**:

Q: How strict should I be with language?
A: Follow Community Guidelines. Minor profanity (1 use) = warning. Repeated or severe = suspension.

Q: What if I'm unsure about a decision?
A: Mark as "investigating" and escalate to Super Admin for guidance.

Q: Can I unban a user?
A: Only Super Admin can modify bans. Submit recommendation to Super Admin.

**Need Help?**
- Slack: #moderation-help
- Email: moderation@datinghub.app
- Escalate to: Super Admin

---

## Changelog & Updates

**Last Updated**: April 28, 2026

**Recent Changes**:
- Added Review Queue interface
- Implemented resolution tracking
- Added appeal system (backend)
- Integrated Sentry error logging

**Upcoming Features**:
- User management dashboard
- Advanced analytics
- Automated spam detection
- User appeal review interface

