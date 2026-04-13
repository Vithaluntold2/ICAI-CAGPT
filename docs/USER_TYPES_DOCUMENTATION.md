# ICAI CAGPT User Types Documentation

## Overview
ICAI CAGPT serves multiple user types across different subscription tiers, roles, and use cases. This document provides a comprehensive breakdown of all user classifications and their characteristics.

## Subscription-Based User Types

### Free Users (Personal/Home)
**Tier**: Free  
**Monthly Limits**: 500 queries, 10 documents, 1 profile  
**Export**: TXT/CSV only  

**Characteristics**:
- Personal finance management
- Students and beginners
- Basic AI chat functionality
- Single personal profile only

**Test Accounts**:
- `free.home@lucatest.com` - Standard home user
- `free.student@lucatest.com` - Student use case
- `free.newuser@lucatest.com` - Fresh account (tests onboarding)

### Plus Users ($)
**Tier**: Plus  
**Monthly Limits**: 3,000 queries, unlimited documents, 5 profiles  
**Features**: Scenario simulator, multi-member profiles  

**Characteristics**:
- Small businesses and freelancers
- Family financial planning
- Multiple profile management
- Advanced export formats

**Test Accounts**:
- `plus.business@lucatest.com` - Small business owner
- `plus.family@lucatest.com` - Family profile owner
- `plus.freelancer@lucatest.com` - Freelancer workflow

### Professional Users ($$)
**Tier**: Professional  
**Monthly Limits**: Unlimited queries and documents  
**Features**: API access, forensic analysis, white-label branding  

**Characteristics**:
- CPAs and tax consultants
- Financial advisors
- Accounting firms
- Client service providers

**Test Accounts**:
- `professional.cpa@lucatest.com` - CPA workflow
- `professional.consultant@lucatest.com` - Financial consultant

### Enterprise Users ($$$)
**Tier**: Enterprise  
**Monthly Limits**: Unlimited everything  
**Features**: SSO/SAML, custom AI training, multi-user teams  

**Characteristics**:
- Large corporations
- Enterprise accounting firms
- Multi-department organizations
- Custom integrations

**Test Accounts**:
- `enterprise.owner@lucatest.com` - Corporate owner
- `enterprise.cfo@lucatest.com` - C-level executive
- `enterprise.accountant@lucatest.com` - Staff member

## Role-Based User Types

### System Administrators

#### Super Administrators
**Access Level**: System-wide  
**Capabilities**:
- System monitoring and health checks
- Deployment management
- Maintenance mode control
- Infrastructure oversight

**Requirements**: Must be in `ADMIN_EMAIL_WHITELIST`  
**Test Account**: `superadmin@lucatest.com`

#### Administrators
**Access Level**: Business operations  
**Capabilities**:
- User management and support
- Analytics and reporting
- Training data management
- Coupon and promotion management

**Test Account**: `admin@lucatest.com`

### Profile Members (Team Collaboration)

#### Owner
**Permissions**: Full control  
**Capabilities**:
- Delete profile
- Manage all members and roles
- Full data access and modification
- Billing and subscription management

#### Admin
**Permissions**: Management without ownership  
**Capabilities**:
- Invite and remove members
- Manage profile data
- Cannot change owner or delete profile
- Cannot modify other admins

#### Member
**Permissions**: Contributor access  
**Capabilities**:
- View all profile data
- Add and modify data
- Cannot invite others
- Cannot change roles

#### Viewer
**Permissions**: Read-only access  
**Capabilities**:
- View profile data only
- Cannot modify anything
- Cannot invite others
- Typically for external stakeholders

## Feature-Specific User Types

### STACK Finance Learners

#### New Users (Weeks 1-2)
**Engagement**: High dopamine delivery  
**Features**:
- Full sound effects and animations
- 2-second celebration duration
- All motivational features enabled
- Maximum encouragement

#### Regular Users (Weeks 3-8)
**Engagement**: Moderate dopamine delivery  
**Features**:
- Selective sounds based on preferences
- 1.5-second celebration duration
- Learned user preferences applied
- Balanced motivation

#### Experienced Users (Week 9+)
**Engagement**: Minimal dopamine delivery  
**Features**:
- Focus on educational content quality
- 0.8-second celebration duration
- Minimal distractions
- Content-driven experience

### EasyLoans Platform Users

#### Individual Borrowers
**Profile**: Personal loan seekers  
**Characteristics**:
- Salaried or self-employed individuals
- Personal loan requirements
- Document submission and verification
- Credit score and eligibility tracking

#### Business Borrowers
**Profile**: Commercial loan applicants  
**Characteristics**:
- Business owners and entrepreneurs
- Commercial loan requirements
- Business document verification
- Revenue and profit analysis

#### DSA Agents
**Profile**: Direct Selling Agents  
**Characteristics**:
- Commission-based earnings
- Lead generation and management
- Multi-lender relationships
- Territory-based operations

#### Lenders
**Profile**: Financial institutions  
**Characteristics**:
- Banks, NBFCs, HFCs
- Loan product management
- Integration with DSA platform
- Rate and eligibility management

## Behavioral User Patterns

### Engagement Levels

#### High Engagement Users
**Characteristics**:
- Long session durations (>30 minutes)
- Frequent daily usage
- Prefers full feature set
- High interaction rates

**Optimization**:
- Rich visual feedback
- Advanced features prioritized
- Comprehensive analytics
- Premium support

#### Medium Engagement Users
**Characteristics**:
- Regular but moderate usage
- Selective feature adoption
- Task-focused sessions
- Balanced preferences

**Optimization**:
- Adaptive interface
- Feature recommendations
- Moderate visual feedback
- Standard support

#### Low Engagement Users
**Characteristics**:
- Sporadic usage patterns
- Minimal feature usage
- Quick task completion
- Prefers simplicity

**Optimization**:
- Simplified interface
- Essential features only
- Minimal distractions
- Self-service support

### Device Performance Profiles

#### High Performance
**Characteristics**:
- Modern devices and browsers
- Fast internet connections
- Can handle full animations
- Rich media support

**Optimization**:
- Full visual effects
- High-resolution assets
- Real-time features
- Advanced animations

#### Medium Performance
**Characteristics**:
- Standard devices
- Moderate processing power
- Limited animation support
- Standard media quality

**Optimization**:
- Reduced visual effects
- Optimized assets
- Selective animations
- Balanced performance

#### Low Performance
**Characteristics**:
- Older devices or slow connections
- Limited processing power
- Minimal animation support
- Basic media only

**Optimization**:
- Text-based interface
- Minimal visual effects
- Fast loading times
- Essential features only

## Edge Case Users

### Quota-Limited Users
**Condition**: At or near usage limits  
**Behavior**: Upgrade prompts and limit notifications  
**Test Account**: `quota.exhausted@lucatest.com`

### Security-Enhanced Users
**Condition**: MFA enabled  
**Behavior**: Two-factor authentication required  
**Test Account**: `mfa.enabled@lucatest.com`

### Restricted Users
**Condition**: Account locked or suspended  
**Behavior**: Limited access with recovery options  
**Test Account**: `locked.account@lucatest.com`

## User Journey Mapping

### Onboarding Journey
1. **New User** → Profile creation and setup
2. **Feature Discovery** → Guided tour and tutorials
3. **First Success** → Initial task completion
4. **Habit Formation** → Regular usage patterns
5. **Advanced Usage** → Feature mastery and optimization

### Upgrade Journey
1. **Limit Awareness** → Usage limit notifications
2. **Value Demonstration** → Premium feature previews
3. **Upgrade Decision** → Subscription selection
4. **Feature Unlock** → New capability access
5. **Value Realization** → ROI demonstration

### Team Collaboration Journey
1. **Profile Creation** → Business/family profile setup
2. **Member Invitation** → Team member onboarding
3. **Role Assignment** → Permission configuration
4. **Collaborative Usage** → Multi-user workflows
5. **Team Optimization** → Workflow refinement

## Usage Analytics and Insights

### Key Metrics by User Type
- **Free Users**: Conversion rate to paid tiers
- **Plus Users**: Feature adoption and retention
- **Professional Users**: API usage and client satisfaction
- **Enterprise Users**: Team collaboration and ROI

### Behavioral Indicators
- **Session Duration**: Engagement depth
- **Feature Usage**: Preference patterns
- **Support Requests**: Pain points and needs
- **Upgrade Patterns**: Value realization timing

## Personalization Strategies

### Content Personalization
- **Beginner Users**: Educational content and tutorials
- **Advanced Users**: Complex scenarios and edge cases
- **Business Users**: Industry-specific examples
- **Personal Users**: Relatable financial situations

### Interface Personalization
- **Power Users**: Advanced controls and shortcuts
- **Casual Users**: Simplified workflows
- **Mobile Users**: Touch-optimized interfaces
- **Desktop Users**: Keyboard shortcuts and multi-window

### Communication Personalization
- **New Users**: Onboarding and guidance
- **Active Users**: Feature updates and tips
- **Inactive Users**: Re-engagement campaigns
- **Churning Users**: Retention offers and support

---

*This documentation serves as the definitive guide for understanding and serving the diverse user base of ICAI CAGPT.*