# ICAI CAGPT Voice Mode - Technical Proposal

**Document Version:** 2.0  
**Date:** January 14, 2026  
**Prepared For:** ICAI CAGPT Product Team  
**Prepared By:** Engineering Team  
**Status:** APPROVED - Pay-As-You-Go Model

---

## 1. Executive Summary

This proposal outlines a comprehensive voice interaction system for ICAI CAGPT that enables users to communicate with Luca using natural speech. The system will support **real-time** speech-to-text (STT) and text-to-speech (TTS) capabilities across **8 regions** with **local languages and accents**.

### Key Objectives
- Enable hands-free interaction with Luca for financial advisory
- Support multilingual users across global markets
- Provide authentic local accent voices for natural communication
- **Voice as Add-On:** Free tier included with all subscriptions, paid tiers via pre-paid credits
- **Pay-As-You-Go:** Per-second billing with 30% markup on provider costs

---

## 2. Target Regions and Language Requirements

| Region | Primary Languages | Accents Required (TTS) | Population Reach |
|--------|-------------------|------------------------|------------------|
| **India** | Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Gujarati, Malayalam, Punjabi, English (Indian) | Indian English, Hindi, Regional | 1.4B |
| **United States** | English, Spanish | US English, US Spanish | 330M |
| **United Kingdom** | English, Welsh | British English, Scottish | 67M |
| **Middle East** | Arabic (MSA, Gulf, Egyptian, Levantine), Farsi, Hebrew, Urdu | Gulf Arabic, Egyptian Arabic | 400M |
| **Indonesia** | Indonesian (Bahasa), Javanese, Sundanese | Indonesian | 275M |
| **Philippines** | Filipino/Tagalog, English, Cebuano | Filipino English, Tagalog | 115M |
| **Canada** | English, French | Canadian English, Quebec French | 40M |
| **Turkey** | Turkish, Kurdish | Turkish | 85M |

**Total Languages:** 35+  
**Total Voice Variants:** 50+

---

## 3. Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────────┐ │
│  │ Microphone  │───▶│  WebAudio   │───▶│  Recorder   │───▶│  WebSocket/  │ │
│  │   Input     │    │   API       │    │   (Opus)    │    │    REST      │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────────────┘ │
│                                                                    │        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            ▼        │
│  │   Speaker   │◀───│  Audio      │◀───│  Streaming  │◀───────────────────┐│
│  │   Output    │    │  Player     │    │   Decoder   │                    ││
│  └─────────────┘    └─────────────┘    └─────────────┘                    ││
└──────────────────────────────────────────────────────────────────────────┼─┘
                                                                           │
┌──────────────────────────────────────────────────────────────────────────┼─┐
│                              SERVER (Node.js)                            │ │
│  ┌──────────────────────────────────────────────────────────────────┐   │ │
│  │                     Voice Router Service                          │◀──┘ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │     │
│  │  │ User Tier   │  │ Language    │  │ Provider Health Monitor │  │     │
│  │  │ Detector    │  │ Detector    │  │ (Circuit Breaker)       │  │     │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                    │                                       │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         ▼                          ▼                          ▼           │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐      │
│  │  FREE TIER   │         │ STANDARD TIER│         │ PREMIUM TIER │      │
│  │  (Open Src)  │         │  (Budget)    │         │  (Quality)   │      │
│  └──────────────┘         └──────────────┘         └──────────────┘      │
│         │                          │                          │           │
│  ┌──────┴──────┐           ┌───────┴───────┐         ┌───────┴───────┐   │
│  │             │           │               │         │               │   │
│  ▼             ▼           ▼               ▼         ▼               ▼   │
│ ┌────┐     ┌────────┐   ┌────────┐    ┌────────┐  ┌────────┐   ┌────────┐│
│ │Vosk│     │Piper   │   │Deepgram│    │Azure   │  │OpenAI  │   │Eleven  ││
│ │STT │     │TTS     │   │STT     │    │TTS     │  │Whisper │   │Labs TTS││
│ └────┘     └────────┘   └────────┘    └────────┘  └────────┘   └────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Provider Analysis

### 4.1 Speech-to-Text (STT) Providers

| Provider | Languages | Real-time | Accuracy | Indian English | Arabic | Cost | Tier |
|----------|-----------|-----------|----------|----------------|--------|------|------|
| **Vosk (Open Source)** | 20+ | ✅ | Good | ✅ | ✅ | Free | Free |
| **Whisper.cpp (Local)** | 99+ | ⚠️ Near-RT | Excellent | ✅ | ✅ | Free | Free |
| **Deepgram** | 36 | ✅ | Excellent | ✅ | ✅ | $0.0043/min | Standard |
| **Azure Speech** | 140+ | ✅ | Excellent | ✅ | ✅ | $0.016/min | Standard |
| **Google Speech** | 125+ | ✅ | Excellent | ✅ | ✅ | $0.016/min | Standard |
| **OpenAI Whisper API** | 99+ | ✅ | Best | ✅ | ✅ | $0.006/min | Premium |
| **AssemblyAI** | 12 | ✅ | Excellent | ⚠️ | ❌ | $0.015/min | Premium |

### 4.2 Text-to-Speech (TTS) Providers

| Provider | Voices | Languages | Indian Accents | Arabic | Turkish | Cost | Quality | Tier |
|----------|--------|-----------|----------------|--------|---------|------|---------|------|
| **Piper TTS (Open Source)** | 100+ | 30+ | ⚠️ Limited | ✅ | ✅ | Free | Good | Free |
| **Coqui TTS (Open Source)** | Custom | 20+ | ✅ Trainable | ✅ | ⚠️ | Free | Good | Free |
| **Azure Neural Voices** | 400+ | 140+ | ✅ 10+ Indian | ✅ | ✅ | $0.016/1K chars | Excellent | Standard |
| **Google Cloud TTS** | 380+ | 50+ | ✅ | ✅ | ✅ | $0.016/1K chars | Excellent | Standard |
| **Amazon Polly** | 60+ | 30+ | ✅ | ✅ | ✅ | $0.004/1K chars | Good | Standard |
| **OpenAI TTS** | 6 | 57 | ❌ No Indian | ⚠️ | ⚠️ | $0.015/1K chars | Excellent | Standard |
| **ElevenLabs** | 1000+ | 29 | ✅ Custom | ✅ | ✅ | $0.30/1K chars | Best | Premium |
| **PlayHT** | 800+ | 142 | ✅ | ✅ | ✅ | $0.05/1K chars | Excellent | Premium |

---

## 5. Recommended Provider Stack by Region

### 5.1 Free Tier (Open Source Stack)

| Component | Provider | Notes |
|-----------|----------|-------|
| STT | **Vosk** (primary) + **Whisper.cpp** (fallback) | Self-hosted, no API costs |
| TTS | **Piper TTS** | 30+ languages, good quality |
| Deployment | Docker containers | Easy scaling |

**Supported Languages (Free):**
- English (US, UK, Indian)
- Hindi
- Arabic
- Indonesian
- Turkish
- French
- Spanish

**Limitations:**
- Voice quality is good but not premium
- Some regional accents may sound generic
- Requires server resources for inference

---

### 5.2 Paid Tier - Standard (Budget-Optimized)

| Component | Provider | Cost Estimate |
|-----------|----------|---------------|
| STT | **Deepgram** | $0.0043/min |
| TTS | **Azure Neural Voices** | $0.016/1K chars |
| Fallback STT | **Azure Speech** | $0.016/min |

**Why This Combo:**
- Deepgram: Best price-to-quality ratio for STT
- Azure: 400+ voices with excellent regional coverage

**Regional Voice Mapping:**

| Region | Azure Voice Examples |
|--------|---------------------|
| India (Hindi) | `hi-IN-MadhurNeural`, `hi-IN-SwaraNeural` |
| India (English) | `en-IN-NeerjaNeural`, `en-IN-PrabhatNeural` |
| India (Tamil) | `ta-IN-PallaviNeural`, `ta-IN-ValluvarNeural` |
| India (Telugu) | `te-IN-MohanNeural`, `te-IN-ShrutiNeural` |
| India (Bengali) | `bn-IN-BashkarNeural`, `bn-IN-TanishaaNeural` |
| India (Marathi) | `mr-IN-AarohiNeural`, `mr-IN-ManoharNeural` |
| India (Kannada) | `kn-IN-GaganNeural`, `kn-IN-SapnaNeural` |
| India (Gujarati) | `gu-IN-DhwaniNeural`, `gu-IN-NiranjanNeural` |
| India (Malayalam) | `ml-IN-MidhunNeural`, `ml-IN-SobhanaNeural` |
| India (Punjabi) | `pa-IN-GurdeepNeural`, `pa-IN-VaaniNeural` |
| Middle East (Arabic Gulf) | `ar-AE-FatimaNeural`, `ar-AE-HamdanNeural` |
| Middle East (Arabic Egyptian) | `ar-EG-SalmaNeural`, `ar-EG-ShakirNeural` |
| Middle East (Arabic Saudi) | `ar-SA-HamedNeural`, `ar-SA-ZariyahNeural` |
| Middle East (Hebrew) | `he-IL-AvriNeural`, `he-IL-HilaNeural` |
| Middle East (Farsi) | `fa-IR-DilaraNeural`, `fa-IR-FaridNeural` |
| Indonesia | `id-ID-ArdiNeural`, `id-ID-GadisNeural` |
| Philippines (Filipino) | `fil-PH-AngeloNeural`, `fil-PH-BlessicaNeural` |
| Philippines (English) | `en-PH-JamesNeural`, `en-PH-RosaNeural` |
| Turkey | `tr-TR-AhmetNeural`, `tr-TR-EmelNeural` |
| Canada (English) | `en-CA-ClaraNeural`, `en-CA-LiamNeural` |
| Canada (French) | `fr-CA-AntoineNeural`, `fr-CA-SylvieNeural` |
| UK | `en-GB-LibbyNeural`, `en-GB-RyanNeural` |
| US | `en-US-JennyNeural`, `en-US-GuyNeural` |
| US (Spanish) | `es-US-AlonsoNeural`, `es-US-PalomaNeural` |

**Estimated Cost (Standard Tier):**
- 1 minute conversation ≈ 150 words spoken each way
- STT: $0.0043 × 1 min = $0.0043
- TTS: $0.016 × 0.15K chars = $0.0024
- **Total per minute: ~$0.007**
- **1000 conversations (5 min each): ~$35**

---

### 5.3 Paid Tier - Premium (Quality-Optimized)

| Component | Provider | Cost Estimate |
|-----------|----------|---------------|
| STT | **OpenAI Whisper API** | $0.006/min |
| TTS | **ElevenLabs** (primary) | $0.30/1K chars |
| TTS Fallback | **PlayHT** | $0.05/1K chars |

**Why This Combo:**
- Whisper: Industry-best accuracy, handles all accents perfectly
- ElevenLabs: Most natural, human-like voices with emotion
- Voice cloning capability for custom Luca personas

**Premium Features:**
- Voice cloning for custom "Luca" personas per region
- Emotional tone adaptation (professional, friendly, concerned)
- Ultra-low latency streaming
- Accent intensity adjustment

**Estimated Cost (Premium Tier):**
- STT: $0.006 × 1 min = $0.006
- TTS: $0.30 × 0.15K chars = $0.045
- **Total per minute: ~$0.05**
- **1000 conversations (5 min each): ~$250**

---

## 6. Pricing Model - Voice Add-On (Pay-As-You-Go)

### 6.1 Subscription Structure

Voice Mode is an **optional add-on** to the core ICAI CAGPT subscription. All core subscription plans (Free, Pro, Enterprise) include **Free Voice Tier** by default.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LUCAAGENT CORE SUBSCRIPTIONS                            │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────────┐    │
│  │    FREE     │    │      PRO        │    │       ENTERPRISE         │    │
│  │   $0/mo     │    │    $XX/mo       │    │       $XXX/mo            │    │
│  └──────┬──────┘    └────────┬────────┘    └────────────┬─────────────┘    │
│         │                    │                          │                   │
│         └────────────────────┼──────────────────────────┘                   │
│                              │                                              │
│                              ▼                                              │
│         ┌────────────────────────────────────────────┐                     │
│         │   🎤 FREE VOICE (Included by Default)       │                     │
│         │   • Vosk STT + Piper TTS (Open Source)      │                     │
│         │   • 10 languages, basic accents             │                     │
│         │   • 30 min/month FREE                       │                     │
│         └────────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     VOICE ADD-ONS (Pre-paid Credits)                        │
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────┐    │
│  │  🎙️ STANDARD VOICE CREDITS  │    │   🎧 PREMIUM VOICE CREDITS       │    │
│  │      Pay-As-You-Go          │    │       Pay-As-You-Go             │    │
│  │                             │    │                                 │    │
│  │  • Deepgram STT             │    │  • OpenAI Whisper STT           │    │
│  │  • Azure Neural Voices      │    │  • ElevenLabs TTS               │    │
│  │  • 50+ languages            │    │  • 100+ languages               │    │
│  │  • All regional accents     │    │  • Ultra-natural voices         │    │
│  │  • $0.02/min                │    │  • $0.30/min                    │    │
│  │  • 200-400ms latency        │    │  • <150ms latency               │    │
│  └─────────────────────────────┘    └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Cost Breakdown (30% Markup)

#### Provider Costs (What We Pay)

| Tier | STT Provider | STT Cost/min | TTS Provider | TTS Cost/1K chars |
|------|--------------|--------------|--------------|-------------------|
| Free | Vosk (self-hosted) | ~$0.001 | Piper (self-hosted) | ~$0.001 |
| Standard | Deepgram | $0.0043 | Azure Neural | $0.016 |
| Premium | OpenAI Whisper | $0.006 | ElevenLabs | $0.30 |

#### Combined Cost Per Conversation Minute
*Assumption: 1 min conversation = 1 min STT + ~750 chars TTS output*

| Tier | Our STT Cost | Our TTS Cost | **Total Cost/min** | **User Price (+30%)** |
|------|--------------|--------------|--------------------|-----------------------|
| **Free** | $0.001 | $0.00075 | $0.00175 | **FREE** (subsidized) |
| **Standard** | $0.0043 | $0.012 | $0.0163 | **$0.02/min** |
| **Premium** | $0.006 | $0.225 | $0.231 | **$0.30/min** |

### 6.3 Pre-paid Credit Packages

Users purchase voice credits in advance (same model as core subscription).

#### Standard Voice Credits

| Package | Credits | Price | Per-Minute Rate | Savings |
|---------|---------|-------|-----------------|---------|
| Starter | 50 min | $1.00 | $0.02/min | — |
| Basic | 250 min | $4.50 | $0.018/min | 10% |
| Pro | 500 min | $8.00 | $0.016/min | 20% |
| Business | 1000 min | $14.00 | $0.014/min | 30% |

#### Premium Voice Credits

| Package | Credits | Price | Per-Minute Rate | Savings |
|---------|---------|-------|-----------------|---------|
| Starter | 10 min | $3.00 | $0.30/min | — |
| Basic | 50 min | $13.50 | $0.27/min | 10% |
| Pro | 100 min | $24.00 | $0.24/min | 20% |
| Business | 250 min | $52.50 | $0.21/min | 30% |

### 6.4 Billing Rules

| Rule | Implementation |
|------|----------------|
| **Billing Granularity** | Per-second (rounded up to nearest second) |
| **Minimum Charge** | 1 second |
| **Credit Model** | Pre-paid (same as subscription) |
| **Credit Expiry** | Never expires while subscription active |
| **Spending Caps** | User-configurable monthly limit |
| **Low Balance Alert** | Notify at 20% remaining |
| **Zero Balance** | Falls back to Free tier |

### 6.5 Free Tier Limits

| Limit | Value | After Limit |
|-------|-------|-------------|
| Monthly Minutes | 30 min | Prompt to purchase credits |
| Languages | 10 (English, Hindi, Arabic, Indonesian, Filipino, Turkish, French, Spanish, Urdu, Farsi) | Upgrade to Standard |
| Voice Quality | Good (Piper) | Upgrade for Neural voices |
| Latency | 500-1000ms | Upgrade for faster response |

### 6.6 Example Billing Scenarios

**Scenario 1: Casual User (Standard)**
```
User speaks for 45 seconds → STT charges 45 sec
Luca responds with 500 chars → TTS charges

Calculation:
  STT: 45 sec = 0.75 min × $0.02 = $0.015
  (TTS included in per-minute rate)
  ────────────────────────────────
  Total deducted: $0.015 from credits
```

**Scenario 2: Power User (Premium)**
```
User speaks for 2 minutes → STT charges 120 sec
Luca responds with detailed analysis

Calculation:
  Total: 2 min × $0.30 = $0.60
  ────────────────────────────────
  Total deducted: $0.60 from credits
```

**Scenario 3: Free Tier User**
```
User has used 28 of 30 free minutes
User speaks for 3 minutes

Result:
  - First 2 minutes: FREE (uses remaining quota)
  - After 30 min limit: Prompt appears
    "You've used your free voice minutes. 
     Purchase Standard credits for $0.02/min 
     or Premium for $0.30/min"
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up voice service architecture
- [ ] Implement provider abstraction layer
- [ ] Integrate OpenAI Whisper for STT (works for all tiers initially)
- [ ] Integrate OpenAI TTS (basic voices)
- [ ] Create WebSocket streaming endpoint

### Phase 2: Regional Expansion (Week 3-4)
- [ ] Integrate Azure Neural Voices for regional TTS
- [ ] Add Deepgram for cost-effective STT
- [ ] Implement language/accent auto-detection
- [ ] Build voice selection UI with preview

### Phase 3: Open Source Tier (Week 5-6)
- [ ] Deploy Vosk STT server (Docker)
- [ ] Deploy Piper TTS server (Docker)
- [ ] Implement tier-based routing
- [ ] Add fallback mechanisms

### Phase 4: Premium Features (Week 7-8)
- [ ] Integrate ElevenLabs
- [ ] Implement voice cloning for custom Luca personas
- [ ] Add emotion/tone controls
- [ ] Build admin voice management dashboard

### Phase 5: Optimization (Week 9-10)
- [ ] Latency optimization
- [ ] Cost monitoring and alerts
- [ ] Usage analytics
- [ ] A/B testing different voices

---

## 8. Technical Specifications

### 8.1 Audio Format Requirements

| Attribute | Requirement |
|-----------|-------------|
| STT Input Format | WebM Opus, WAV, MP3 |
| STT Sample Rate | 16kHz minimum |
| TTS Output Format | MP3 (default), OGG, WAV |
| TTS Sample Rate | 24kHz (Azure), 44.1kHz (ElevenLabs) |
| Max Audio Duration | 60 seconds per request |
| Streaming Chunk Size | 250ms |

### 8.2 API Endpoints

```
POST /api/voice/stt                 # Transcribe audio to text
POST /api/voice/tts                 # Convert text to speech
GET  /api/voice/voices              # List available voices
GET  /api/voice/voices/:region      # List voices for region
POST /api/voice/stream              # WebSocket streaming
GET  /api/voice/languages           # Supported languages
POST /api/voice/detect-language     # Auto-detect language
GET  /api/voice/credits             # Get user's voice credit balance
POST /api/voice/credits/purchase    # Purchase voice credits
GET  /api/voice/usage               # Get usage history
PUT  /api/voice/spending-cap        # Set monthly spending cap
```

### 8.3 WebSocket Protocol for Real-time

```javascript
// Client → Server
{
  "type": "audio_chunk",
  "data": "<base64_audio>",
  "language": "en-IN",
  "interim": true
}

// Server → Client (STT)
{
  "type": "transcript",
  "text": "What is my tax liability?",
  "is_final": true,
  "confidence": 0.95
}

// Server → Client (TTS)
{
  "type": "audio_chunk", 
  "data": "<base64_audio>",
  "is_final": false
}
```

---

## 9. Cost Projections

### Monthly Cost Estimates (1000 Active Users)

| Usage Pattern | Free Tier Cost | Standard Tier Cost | Premium Tier Cost |
|--------------|----------------|--------------------|--------------------|
| Light (5 min/user/month) | $0 (self-hosted: ~$50 server) | $35 | $250 |
| Medium (20 min/user/month) | $0 (self-hosted: ~$100 server) | $140 | $1,000 |
| Heavy (60 min/user/month) | $0 (self-hosted: ~$200 server) | $420 | $3,000 |

### Infrastructure Costs (Free Tier Self-Hosted)

| Component | Specification | Monthly Cost |
|-----------|--------------|--------------|
| Vosk Server | 4 vCPU, 8GB RAM | $40 |
| Piper TTS Server | 2 vCPU, 4GB RAM | $20 |
| GPU Instance (optional) | T4 for faster inference | $150 |

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider downtime | High | Multi-provider failover |
| Poor accent recognition | Medium | Train custom models, user feedback loop |
| High costs | Medium | Usage limits, caching, compression |
| Latency issues | Medium | Edge deployment, streaming |
| Data privacy | High | On-prem option, no audio storage |
| Credit fraud | Medium | Pre-paid model, spending caps |

---

## 11. Revenue Projections

### Assumptions
- 1000 active users
- 30% upgrade to paid voice credits
- Average Standard user: 100 min/month
- Average Premium user: 30 min/month

### Monthly Revenue Estimate

| Source | Users | Avg Spend | Revenue |
|--------|-------|-----------|---------|
| Standard Voice Credits | 250 | $2.00 | $500 |
| Premium Voice Credits | 50 | $9.00 | $450 |
| **Total Voice Revenue** | | | **$950** |

### Monthly Costs

| Cost | Amount |
|------|--------|
| Standard (Deepgram + Azure) | $250 × $0.0163 × 100 = $407 |
| Premium (Whisper + ElevenLabs) | $50 × $0.231 × 30 = $347 |
| Free Tier Infrastructure | $60 |
| **Total Costs** | **$814** |

### Monthly Profit
**$950 - $814 = $136** (14% margin initially, scales with volume)

---

## 12. Recommendation

### Immediate Implementation (MVP)
1. **STT:** OpenAI Whisper API (best accuracy, all accents)
2. **TTS:** Azure Neural Voices (best regional coverage)
3. **Free Tier:** Vosk + Piper (deploy in Phase 3)

### Why Azure for TTS?
- Covers ALL your required regions with native accents
- 10+ Indian language voices
- Arabic (Gulf, Egyptian, Saudi, Levantine)
- Indonesian, Filipino, Turkish, French-Canadian
- Cost-effective at $0.016/1K characters
- Neural voices are near-premium quality

### Future Enhancement
- ElevenLabs for premium users wanting ultra-natural voices
- Custom "Luca" voice cloned for brand consistency

---

## 12. Next Steps

1. **Approve Proposal** - Confirm scope and budget
2. **API Key Setup** - Provision Azure, Deepgram, OpenAI credentials
3. **Sprint Planning** - Begin Phase 1 implementation
4. **Voice Testing** - Sample voices for stakeholder approval

---

## Appendix A: Complete Language/Voice Matrix

### India (10 Languages)

| Language | Azure Voice (Female) | Azure Voice (Male) |
|----------|---------------------|-------------------|
| Hindi | hi-IN-SwaraNeural | hi-IN-MadhurNeural |
| Tamil | ta-IN-PallaviNeural | ta-IN-ValluvarNeural |
| Telugu | te-IN-ShrutiNeural | te-IN-MohanNeural |
| Bengali | bn-IN-TanishaaNeural | bn-IN-BashkarNeural |
| Marathi | mr-IN-AarohiNeural | mr-IN-ManoharNeural |
| Kannada | kn-IN-SapnaNeural | kn-IN-GaganNeural |
| Gujarati | gu-IN-DhwaniNeural | gu-IN-NiranjanNeural |
| Malayalam | ml-IN-SobhanaNeural | ml-IN-MidhunNeural |
| Punjabi | pa-IN-VaaniNeural | pa-IN-GurdeepNeural |
| English (Indian) | en-IN-NeerjaNeural | en-IN-PrabhatNeural |

### Middle East (6 Languages)

| Language | Azure Voice (Female) | Azure Voice (Male) |
|----------|---------------------|-------------------|
| Arabic (Gulf/UAE) | ar-AE-FatimaNeural | ar-AE-HamdanNeural |
| Arabic (Saudi) | ar-SA-ZariyahNeural | ar-SA-HamedNeural |
| Arabic (Egyptian) | ar-EG-SalmaNeural | ar-EG-ShakirNeural |
| Hebrew | he-IL-HilaNeural | he-IL-AvriNeural |
| Farsi/Persian | fa-IR-DilaraNeural | fa-IR-FaridNeural |
| Urdu | ur-PK-UzmaNeural | ur-PK-AsadNeural |

### Southeast Asia

| Language | Azure Voice (Female) | Azure Voice (Male) |
|----------|---------------------|-------------------|
| Indonesian | id-ID-GadisNeural | id-ID-ArdiNeural |
| Filipino/Tagalog | fil-PH-BlessicaNeural | fil-PH-AngeloNeural |
| English (Philippines) | en-PH-RosaNeural | en-PH-JamesNeural |

### Other Regions

| Language | Azure Voice (Female) | Azure Voice (Male) |
|----------|---------------------|-------------------|
| Turkish | tr-TR-EmelNeural | tr-TR-AhmetNeural |
| English (Canada) | en-CA-ClaraNeural | en-CA-LiamNeural |
| French (Canada) | fr-CA-SylvieNeural | fr-CA-AntoineNeural |
| English (UK) | en-GB-SoniaNeural | en-GB-RyanNeural |
| English (US) | en-US-JennyNeural | en-US-GuyNeural |
| Spanish (US) | es-US-PalomaNeural | es-US-AlonsoNeural |

---

**Document Status:** APPROVED  
**Pricing Model:** Pay-As-You-Go with Pre-paid Credits  
**Review Date:** January 14, 2026  
**Approved By:** Product Team
