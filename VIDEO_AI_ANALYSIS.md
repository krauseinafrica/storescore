# Video AI Analysis with Google Gemini — StoreScore Integration Plan

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Use Cases](#use-cases)
3. [Technical Architecture](#technical-architecture)
4. [Pricing Analysis](#pricing-analysis)
5. [Implementation Phases](#implementation-phases)
6. [Competitive Advantage](#competitive-advantage)
7. [Risks & Considerations](#risks--considerations)
8. [API Integration Notes](#api-integration-notes)
9. [ROI Projection](#roi-projection)

---

## 1. Executive Summary

StoreScore currently uses Claude AI (Anthropic Sonnet 4.5) for walk summary generation, photo analysis, and SOP document matching. These features are already a significant differentiator — no competitor offers AI-powered walk summaries or AI photo analysis with SOP matching (see [COMPETITION.md](./COMPETITION.md)).

**Video analysis represents the next frontier.** Instead of capturing individual photos during a store walk, evaluators could record a continuous walk-through video. An AI model would then analyze the entire video to produce comprehensive, section-by-section scoring suggestions, identify issues the evaluator may have missed, and generate richer narrative summaries.

Google Gemini is the ideal model for this capability because:

- **Native video understanding**: Gemini processes video natively (not frame-by-frame extraction), understanding temporal context, motion, and spatial relationships.
- **Long context window**: Gemini models support up to 1M+ tokens, easily accommodating 5-10 minute walk-through videos.
- **Cost-effective**: At $0.25-$0.50 per million tokens for video input, a typical 5-minute walk video costs approximately $0.02-$0.04 to analyze.
- **Multimodal prompting**: Video can be combined with text prompts (scoring templates, SOP criteria, prior walk data) in a single request for contextual analysis.

This addition would make StoreScore the **first store inspection platform in the market** to offer AI-powered video analysis of store walks.

---

## 2. Use Cases

### 2.1 Walk-Through Video Analysis (Primary)

**Scenario**: Evaluator records a continuous video while walking through the store, moving through each section (curb appeal, aisles, backroom, etc.). After the walk, the video is uploaded and analyzed.

**AI Output**:
- Section-by-section quality assessment with suggested scores (1-5)
- Specific observations per scoring criterion (e.g., "Shelf at aisle 3 has gaps in inventory, approximately 15% empty facing")
- Issues the evaluator may have missed
- Timestamped references to video moments for each observation

**Value**: Captures far more detail than individual photos. A 5-minute video contains thousands of frames worth of visual data compared to 10-20 discrete photos.

### 2.2 Before/After Comparisons

**Scenario**: Compare a walk-through video from this month against the previous month's video for the same store. Gemini analyzes both videos and identifies what improved, what declined, and what stayed the same.

**AI Output**:
- Side-by-side comparison narrative
- Specific areas of improvement (e.g., "End cap displays are now fully stocked compared to previous walk")
- Areas of decline with visual evidence timestamps
- Trend analysis feeding into scoring history

**Value**: Objective, consistent comparison that removes evaluator bias and catches subtle changes over time.

### 2.3 Display & Planogram Compliance

**Scenario**: Video captures product displays, shelf layouts, and signage. Gemini analyzes against known standards (SOP documents already in the system).

**AI Output**:
- Compliance percentage per display area
- Missing or misplaced products identified
- Signage condition assessment
- Comparison against SOP requirements (leveraging existing `SOPDocument` and `SOPCriterionLink` models)

**Value**: Currently only GoSpotCheck offers AI shelf recognition, but their solution is CPG-oriented and expensive. StoreScore can deliver this to franchise owners affordably.

### 2.4 Cleanliness & Safety Verification

**Scenario**: Walk-through video captures floor conditions, lighting, signage placement, fire exit access, and general cleanliness.

**AI Output**:
- Safety hazard identification (wet floors, blocked exits, exposed wiring, tripping hazards)
- Cleanliness scoring suggestions per area
- Specific frame references for documentation
- Auto-generated action items with photo evidence extracted from video frames

**Value**: Safety and cleanliness are 2 of the 6 scored sections in the current template (11 criteria combined). Video analysis provides much richer evidence than spot photos.

### 2.5 Employee Interaction Review (with consent)

**Scenario**: With proper consent and notification, video captures employee-customer interactions, employee adherence to dress code, badge wearing, and customer service behaviors.

**AI Output**:
- Customer greeting frequency observations
- Employee appearance compliance
- Service behavior patterns
- Training recommendations

**Value**: Adds a qualitative dimension that photo-only analysis cannot capture. Requires careful privacy handling (see Risks section).

### 2.6 Real-Time Guidance During Walks (Phase 2)

**Scenario**: Evaluator streams video in real-time during the walk. AI provides live suggestions: "You haven't captured the restroom area yet," "The shelf you just passed appears to have inventory gaps — consider scoring Shelf Maintenance lower."

**AI Output**:
- Real-time prompts and reminders
- Live scoring suggestions
- Guidance on areas to revisit
- Completeness tracking (which sections have been covered)

**Value**: Transforms the walk from a manual checklist exercise into an AI-guided inspection, improving consistency across evaluators.

---

## 3. Technical Architecture

### 3.1 Current Architecture (Photos + Claude)

```
Mobile App (React PWA)
    |
    | [Photo capture per section/criterion]
    v
Django API (DRF)
    |
    | [Store to DigitalOcean Spaces]
    v
DO Spaces (S3-compatible CDN)
    |
    | [On walk completion]
    v
Celery Worker
    |
    | [Claude API: summary + photo analysis]
    v
Walk.ai_summary, WalkPhoto.caption
```

### 3.2 Proposed Architecture (Video + Gemini)

```
Mobile App (React PWA)
    |
    | [Video recording during walk, chunked upload]
    v
Django API (DRF)
    |
    | [Store video to DO Spaces, create WalkVideo record]
    v
DO Spaces (S3-compatible CDN)
    |
    | [On walk completion — Celery task]
    v
Celery Worker
    |
    +---> Google Gemini API (video analysis)
    |         |
    |         | [Upload video via File API, then multimodal prompt]
    |         v
    |     Structured analysis JSON
    |         |
    +---> Claude API (narrative summary, unchanged)
    |
    v
Walk.video_analysis (JSON), Walk.ai_summary (enhanced with video insights)
WalkVideoObservation records (timestamped findings)
ActionItem auto-generation (from video findings)
```

### 3.3 New Django Models

```python
class WalkVideo(TimestampedModel):
    """Video recording from a walk, stored in DO Spaces."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    walk = models.ForeignKey('Walk', on_delete=models.CASCADE, related_name='videos')
    organization = models.ForeignKey('stores.Organization', on_delete=models.CASCADE)
    file = models.FileField(upload_to=walk_video_path)  # DO Spaces
    duration_seconds = models.IntegerField(null=True, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    section = models.ForeignKey('ScoringSection', null=True, blank=True, on_delete=models.SET_NULL)
    analysis_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('processing', 'Processing'),
                 ('completed', 'Completed'), ('failed', 'Failed')],
        default='pending',
    )
    analysis_result = models.JSONField(null=True, blank=True)
    gemini_tokens_used = models.IntegerField(null=True, blank=True)
    analysis_cost_usd = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)

class WalkVideoObservation(TimestampedModel):
    """Individual AI observation from a video, with timestamp reference."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    video = models.ForeignKey(WalkVideo, on_delete=models.CASCADE, related_name='observations')
    walk = models.ForeignKey('Walk', on_delete=models.CASCADE, related_name='video_observations')
    timestamp_seconds = models.FloatField(help_text="Video timestamp of observation")
    section = models.ForeignKey('ScoringSection', null=True, blank=True, on_delete=models.SET_NULL)
    criterion = models.ForeignKey('Criterion', null=True, blank=True, on_delete=models.SET_NULL)
    observation_type = models.CharField(
        max_length=20,
        choices=[('issue', 'Issue'), ('positive', 'Positive'), ('suggestion', 'Suggestion')],
    )
    severity = models.CharField(
        max_length=20,
        choices=[('critical', 'Critical'), ('high', 'High'),
                 ('medium', 'Medium'), ('low', 'Low'), ('info', 'Info')],
        default='medium',
    )
    description = models.TextField()
    suggested_score = models.IntegerField(null=True, blank=True)
    thumbnail = models.ImageField(upload_to=observation_thumbnail_path, null=True, blank=True)
```

### 3.4 Processing Pipeline

1. **Upload**: Mobile app records video (WebRTC MediaRecorder API), uploads in chunks to `/api/v1/walks/{id}/videos/` endpoint
2. **Storage**: Django stores video in DO Spaces under `storescore/{org_slug}/{store_id}/videos/{walk_id}/{video_id}.webm`
3. **Trigger**: On walk completion (or manual trigger), Celery task `analyze_walk_video` fires
4. **Gemini Upload**: Task downloads video from DO Spaces, uploads to Gemini File API (supports files up to 2GB)
5. **Analysis**: Multimodal prompt sent to Gemini with:
   - The uploaded video reference
   - The scoring template (sections + criteria names)
   - SOP excerpts for relevant criteria
   - Prior walk scores for context ("Last walk scored 72% on Shelf Maintenance")
6. **Parse**: Structured JSON response parsed into `WalkVideoObservation` records
7. **Enhance Summary**: Video observations fed into Claude summary generation prompt (existing flow) for richer narrative
8. **Action Items**: High-severity video observations auto-generate `ActionItem` records (reusing existing action item system)

### 3.5 Gemini API Flow (Python)

```python
import google.genai as genai

# 1. Upload video file
client = genai.Client(api_key=settings.GEMINI_API_KEY)
video_file = client.files.upload(file=video_path)

# 2. Wait for processing
while video_file.state.name == "PROCESSING":
    time.sleep(5)
    video_file = client.files.get(name=video_file.name)

# 3. Analyze with multimodal prompt
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        video_file,
        f"""Analyze this retail store walk-through video.

        Scoring Template:
        {template_json}

        SOP Requirements:
        {sop_excerpts}

        Previous Walk Score: {previous_score}%

        For each section and criterion in the template, provide:
        1. A suggested score (1-5)
        2. Specific observations with video timestamps
        3. Issues found with severity (critical/high/medium/low)
        4. Positive findings worth noting

        Respond in structured JSON format."""
    ],
)
```

---

## 4. Pricing Analysis

### 4.1 Video Technical Specifications (from Official Gemini Docs)

**Supported formats**: `video/mp4`, `video/mpeg`, `video/mov`, `video/avi`, `video/x-flv`, `video/mpg`, `video/webm`, `video/wmv`, `video/3gpp`

**File size limits**:
- File API (recommended): **20GB** (paid tier) / 2GB (free tier)
- Inline data: <100MB
- **Duration**: Up to **1 hour** at default resolution, or **3 hours** at low resolution (1M context window models)

**Tokenization rates**:
- **Standard resolution**: 258 tokens/frame at 1 FPS = ~258 tokens/second video + 32 tokens/second audio = **~290 tokens/second**
- **Low resolution**: 66 tokens/frame at 1 FPS + 32 tokens/second audio = **~98 tokens/second**
- Audio track: **32 tokens per second** (included in both modes)

**Multi-video support**: Gemini 2.5+ supports **up to 10 videos per request** — useful for before/after comparisons or multi-section analysis.

**Timestamp referencing**: Use `MM:SS` format in prompts to ask about specific moments. Gemini can also reference timestamps in its responses.

**Video clipping**: Specify `start_offset` and `end_offset` in `videoMetadata` to analyze only a portion of a video without re-uploading.

### 4.2 Video Token Conversion

Gemini converts video input at approximately **258 tokens per second** of video at standard resolution. At low resolution, this drops to ~66 tokens/second (useful for cost optimization on longer videos where fine detail isn't critical).

### 4.3 Cost Per Walk Video

| Video Duration | Total Tokens | Gemini 2.5 Flash ($0.30/M) | Gemini 3 Flash Preview ($0.50/M) | Batch (2.5 Flash, $0.15/M) |
|---|---|---|---|---|
| 2 minutes | 30,960 | $0.009 | $0.015 | $0.005 |
| 5 minutes | 77,400 | $0.023 | $0.039 | $0.012 |
| 10 minutes | 154,800 | $0.046 | $0.077 | $0.023 |
| 15 minutes | 232,200 | $0.070 | $0.116 | $0.035 |
| 20 minutes | 309,600 | $0.093 | $0.155 | $0.046 |

**Note**: These costs are for video input tokens only. Text prompt tokens (template, SOP excerpts, prior scores) and output tokens add a small additional cost, typically $0.001-$0.005 per request.

### 4.4 Monthly Cost Projections (StoreScore Scale)

Current data: 16 stores, approximately 137 walks over 3 years = roughly 3.8 walks/month.

| Scenario | Walks/Month | Avg Video Length | Monthly Gemini Cost (2.5 Flash) | Monthly Gemini Cost (Batch) |
|---|---|---|---|---|
| Current scale (16 stores) | 4 | 5 min | $0.09 | $0.05 |
| Active usage (16 stores, 2x/month) | 32 | 5 min | $0.74 | $0.37 |
| Growth (50 stores) | 100 | 5 min | $2.32 | $1.16 |
| Scale (200 stores) | 400 | 7 min | $12.92 | $6.46 |
| Enterprise (1000 stores) | 2000 | 7 min | $64.58 | $32.29 |

### 4.5 Cost Comparison: Video Analysis vs Current Photo Analysis

| | Current (Claude Photo Analysis) | Proposed (Gemini Video Analysis) |
|---|---|---|
| Input per walk | 10-20 photos, ~300 tokens each | 5-min video, ~77,400 tokens |
| AI cost per walk | ~$0.02 (Claude Sonnet) | ~$0.023 (Gemini 2.5 Flash) |
| Information density | 10-20 discrete snapshots | ~7,500 frames of continuous footage |
| Coverage | Only what evaluator chose to photograph | Everything the camera captured |
| Cost increase | Baseline | ~15% increase for 375x more visual data |

**Key insight**: Video analysis costs roughly the same as photo analysis per walk, but provides orders of magnitude more visual information.

### 4.6 Context Caching for Repeated Analysis

For before/after comparisons where the same prior video is re-analyzed:

- **Cached input**: $0.03 per million tokens (vs $0.30 standard)
- **Storage**: $1.00 per million tokens per hour
- **Use case**: Cache the "before" video tokens for an hour while analyzing the "after" video. A 5-minute cached video costs $0.0023/hour to store, making before/after analysis cost roughly $0.026 total instead of $0.046.

### 4.7 Free Tier Considerations

Google offers a free tier for Gemini API. However, content submitted on the free tier may be used to improve Google products. For production use with customer store footage, the **paid tier is strongly recommended** to ensure data privacy.

---

## 5. Implementation Phases

### Phase 1: Post-Walk Video Upload + Analysis (MVP)

**Timeline**: 4-6 weeks
**Objective**: Evaluator records video, uploads after walk, receives AI analysis

**Backend Tasks**:
- [ ] Add `google-genai` Python SDK to requirements
- [ ] Create `WalkVideo` and `WalkVideoObservation` models + migrations
- [ ] Create `GEMINI_API_KEY` setting in Django config
- [ ] Build Celery task: `analyze_walk_video` (upload to Gemini File API, send prompt, parse response)
- [ ] Create API endpoints: `POST /api/v1/walks/{id}/videos/` (upload), `GET /api/v1/walks/{id}/videos/` (list), `GET /api/v1/walks/{id}/video-observations/` (analysis results)
- [ ] Integrate video observations into existing `generate_walk_summary()` prompt for enriched summaries
- [ ] Add video observations to action item auto-generation pipeline
- [ ] Track token usage and cost per analysis (for billing/monitoring)

**Frontend Tasks**:
- [ ] Video recording component using MediaRecorder API (WebM/MP4)
- [ ] Chunked upload with progress indicator
- [ ] Video playback in walk detail view
- [ ] Video observation timeline (click observation to jump to video timestamp)
- [ ] "AI Video Analysis" section on walk results page
- [ ] Suggested scores overlay (AI suggestions vs evaluator scores)

**Storage Tasks**:
- [ ] Configure DO Spaces path structure for videos
- [ ] Set file size limits (suggest 500MB max per video)
- [ ] Implement video compression on client side before upload (target 720p)

**Definition of Done**: Evaluator can record a walk video on mobile, upload it, and receive structured AI analysis with timestamped observations and suggested scores.

### Phase 2: Real-Time Video During Walks

**Timeline**: 6-8 weeks (after Phase 1)
**Objective**: Live AI guidance during walk execution

**Tasks**:
- [ ] WebSocket or Server-Sent Events connection for real-time communication
- [ ] Periodic frame capture from live video stream (every 5-10 seconds)
- [ ] Lightweight Gemini analysis on frame batches (quick turnaround)
- [ ] Real-time overlay: "You're in the Curb Appeal section — check parking lot condition"
- [ ] Section detection: AI identifies which section the evaluator is currently walking through
- [ ] Completeness tracker: "You haven't captured the backroom yet"
- [ ] Quick observation alerts: "Potential safety issue detected — blocked fire exit at [timestamp]"

**Technical Considerations**:
- Real-time requires streaming API or rapid polling with Gemini
- May need edge processing for low-latency section detection
- Mobile battery and bandwidth constraints
- Fallback to Phase 1 (post-walk upload) if connectivity is poor

### Phase 3: Automated Video Comparison Over Time

**Timeline**: 4-6 weeks (after Phase 2)
**Objective**: Compare walk videos across time periods for trend analysis

**Tasks**:
- [ ] Store comparison endpoint: `GET /api/v1/stores/{id}/video-comparison/?from={walk_id}&to={walk_id}`
- [ ] Gemini multi-video analysis prompt (compare two walk videos)
- [ ] Change detection: "Shelf in aisle 4 was fully stocked in January, now has 30% gaps"
- [ ] Improvement tracking: "End cap display quality improved from POOR to GOOD"
- [ ] Trend visualization: video comparison timeline on store scorecard
- [ ] Context caching implementation (cache prior video tokens for cost optimization)
- [ ] Monthly automated comparison reports
- [ ] Integration with scoring trends (existing Phase 4 analytics)

### Phase 4: Advanced Video Intelligence (Future)

**Timeline**: Ongoing
**Objective**: Deeper AI capabilities built on the video analysis foundation

**Tasks**:
- [ ] Multi-store video comparison ("Show me all stores with cluttered aisles")
- [ ] Video-based training content: auto-extract "best practice" clips from high-scoring walks
- [ ] Anomaly detection: alert when video shows sudden changes (e.g., construction, flood damage)
- [ ] Integration with security camera feeds (for participating stores)
- [ ] Gemini video generation (Veo): create "ideal store" reference videos from SOP documents
- [ ] Natural language video queries ("Show me the moment in the last walk where the backroom was filmed")

---

## 6. Competitive Advantage

### 6.1 No Competitor Offers AI Video Analysis

Based on our competitive analysis (see [COMPETITION.md](./COMPETITION.md)), **no platform in the store inspection space currently offers AI-powered video analysis**:

| Competitor | Photo Capture | AI Photo Analysis | Video Capture | AI Video Analysis |
|---|---|---|---|---|
| **StoreScore** | Yes | Yes (Claude) | Planned | **Planned (Gemini)** |
| SafetyCulture | Yes | No | No | No |
| Zenput | Yes | No | No | No |
| GoSpotCheck | Yes | Yes (shelf only) | No | No |
| monitorQA | Yes | No | No | No |
| FranConnect | Partial | No | No | No |
| Xenia | Yes | Partial | No | No |

### 6.2 Market Positioning

StoreScore is already differentiated by AI walk summaries and AI photo analysis. Adding video analysis creates a **two-generation technology lead** over competitors:

- **Generation 1** (current market): Manual photo capture + manual analysis
- **Generation 2** (StoreScore today): Photo capture + AI photo analysis + AI summaries
- **Generation 3** (StoreScore planned): Video capture + AI video analysis + AI-guided walks + temporal comparison

Competitors would need to simultaneously build video infrastructure AND AI integration, which typically takes 12-18 months for an established platform.

### 6.3 Sales & Marketing Impact

- "The only store inspection platform with AI video analysis" — powerful positioning for enterprise sales
- Demo-friendly: showing a walk video being analyzed in real-time is highly compelling
- Upsell opportunity: video analysis as a premium tier feature (Pro/Enterprise plans on pricing page)
- Press/media angle: "AI watches store walk-through videos to grade store quality"

---

## 7. Risks & Considerations

### 7.1 File Size & Storage

| Video Duration | Resolution | Approx. File Size | Monthly Storage Cost (DO Spaces, $0.02/GB) |
|---|---|---|---|
| 5 min | 720p | 150-300 MB | $0.003-$0.006 per video |
| 5 min | 1080p | 300-600 MB | $0.006-$0.012 per video |
| 10 min | 720p | 300-600 MB | $0.006-$0.012 per video |
| 10 min | 1080p | 600 MB - 1.2 GB | $0.012-$0.024 per video |

**At scale** (1000 stores, 2 walks/month, 5-min videos at 720p): ~300-600 GB/month = $6-12/month storage. Manageable.

**Mitigation**:
- Client-side compression before upload (target 720p, H.264)
- Configurable retention policy (e.g., keep videos for 90 days, then delete, keep observations permanently)
- Organization-level storage quota settings

### 7.2 Mobile Bandwidth & Upload

- 5-minute 720p video: ~200 MB upload
- On LTE/5G: 2-5 minutes upload time
- On slow connections: may be impractical

**Mitigation**:
- Chunked/resumable uploads (tus protocol or custom chunked upload)
- Background upload after walk completion (PWA background sync)
- Wi-Fi upload option (queue for upload when on Wi-Fi)
- Compression before upload (WebM VP9 or H.264)
- Option to fall back to photo-only mode when bandwidth is limited

### 7.3 Processing Time

- Gemini File API upload: 1-3 minutes for a 200 MB video
- Gemini processing/analysis: 30-90 seconds
- Total pipeline: 2-5 minutes per video

**Mitigation**:
- Async processing via Celery (already the pattern for walk completion)
- Status polling from frontend ("Your video is being analyzed...")
- Push notification when analysis is complete
- For Phase 2 (real-time), use frame batches rather than full video streaming

### 7.4 Privacy Concerns

**Employee faces on video** is the most significant risk:

- Employees may be identifiable in walk-through footage
- Some jurisdictions require consent for video recording in workplaces
- Store employees are not StoreScore users and haven't consented to AI analysis of their likeness

**Mitigation**:
- **Organizational toggle**: `OrgSettings.video_analysis_enabled` (default off, requires explicit opt-in)
- **Consent framework**: Organizations must confirm they have employee consent/notification processes
- **Face blurring option**: Pre-process video with face detection/blurring before sending to Gemini (adds processing time and cost)
- **Prompt engineering**: Instruct Gemini to NOT identify or describe individual people, focus only on store conditions
- **Data retention**: Auto-delete video files after analysis, keep only observations and thumbnails
- **Terms of service**: Clear language that organizations are responsible for employee notification

**Gemini data handling**:
- Paid API tier: Google does not use customer data to train models
- Free tier: Content may be used to improve products — **DO NOT use free tier for customer videos**

### 7.5 Video Quality Variability

- Shaky handheld video on mobile
- Poor lighting in some store areas (backroom, warehouse)
- Camera obstruction, rapid movement, out-of-focus segments

**Mitigation**:
- Gemini handles variable quality well (trained on real-world video)
- Prompt engineering: "If a section of video is unclear, note low confidence in that observation"
- Client-side stabilization hints (encourage steady walking pace)
- Quality indicator in analysis results ("Analysis confidence: High/Medium/Low" per section)

### 7.6 API Reliability & Quotas

- Google Gemini API has rate limits (requests per minute, tokens per minute)
- API outages would block video analysis

**Mitigation**:
- Celery retry with exponential backoff (already the pattern: `max_retries=3, default_retry_delay=30`)
- Queue-based processing (videos wait if rate limited)
- Graceful degradation: walk completion proceeds without video analysis; analysis runs when API is available
- Monitor API usage against quotas
- Consider requesting quota increase for production workloads

---

## 8. API Integration Notes

### 8.1 Google Gemini Python SDK

```bash
pip install google-genai
```

### 8.2 Key API Endpoints

**File API** (for uploading video before analysis):
```python
from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")

# Upload video file
video_file = client.files.upload(
    file="path/to/walk_video.mp4",
    config={"display_name": "Walk Video - Store 123 - 2026-02-15"}
)

# Check processing status
file_status = client.files.get(name=video_file.name)
# file_status.state: PROCESSING -> ACTIVE

# List uploaded files
files = client.files.list()

# Delete after analysis
client.files.delete(name=video_file.name)
```

**Generate Content** (multimodal video + text):
```python
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        video_file,  # Reference to uploaded file
        "Analyze this store walk-through video...",
    ],
    config={
        "response_mime_type": "application/json",
        "response_schema": VideoAnalysisSchema,  # Structured output
        "temperature": 0.2,  # Low temperature for consistent analysis
    },
)
```

### 8.3 Recommended Models

| Model | Best For | Cost (Input) | Context Window |
|---|---|---|---|
| **Gemini 2.5 Flash** | Production video analysis (best price/performance) | $0.30/M tokens | 1M tokens |
| **Gemini 3 Flash Preview** | Latest capabilities, testing | $0.50/M tokens | 1M tokens |

**Recommendation**: Use **Gemini 2.5 Flash** for production. At 258 tokens/second, a 5-minute video uses ~77,400 tokens — well within the 1M token context window, with room for lengthy prompts and prior walk context.

### 8.4 Structured Output Schema

```python
from pydantic import BaseModel
from typing import Optional

class VideoObservation(BaseModel):
    timestamp_seconds: float
    section_name: str
    criterion_name: Optional[str]
    observation_type: str  # "issue" | "positive" | "suggestion"
    severity: str  # "critical" | "high" | "medium" | "low" | "info"
    description: str
    suggested_score: Optional[int]  # 1-5
    confidence: float  # 0.0-1.0

class SectionAnalysis(BaseModel):
    section_name: str
    suggested_score_percentage: float
    observations: list[VideoObservation]
    summary: str

class VideoAnalysisResult(BaseModel):
    overall_score_percentage: float
    overall_summary: str
    sections: list[SectionAnalysis]
    safety_issues: list[VideoObservation]
    missed_areas: list[str]  # Areas not visible in the video
    analysis_confidence: str  # "high" | "medium" | "low"
```

### 8.5 Prompt Engineering for Store Walks

```python
WALK_VIDEO_ANALYSIS_PROMPT = """You are an expert retail store quality evaluator. Analyze this walk-through
video of a store inspection.

SCORING TEMPLATE:
{template_sections_and_criteria}

SOP REQUIREMENTS:
{sop_excerpts}

PREVIOUS WALK DATA:
- Last walk date: {last_walk_date}
- Last walk score: {last_walk_score}%
- Previous issues: {previous_issues}

INSTRUCTIONS:
1. Watch the entire video and identify which store sections are visible.
2. For each section in the scoring template, provide:
   - A suggested score (1-5) based on what you observe
   - Specific observations with video timestamps (in seconds)
   - Any issues found, classified by severity
   - Positive findings worth noting
3. Flag any safety hazards as CRITICAL observations.
4. Note any sections from the template that are NOT visible in the video.
5. Compare against SOP requirements where applicable.
6. DO NOT identify or describe individual people. Focus on store conditions only.

Respond in the structured JSON format specified."""
```

### 8.6 Integration with Existing Claude Pipeline

The video analysis does NOT replace the existing Claude integration. Instead, it enriches it:

```python
# In services.py, enhanced _build_walk_data():
def _build_walk_data(walk: Walk) -> dict:
    # ... existing photo/score data ...

    # Add video observations
    video_observations = WalkVideoObservation.objects.filter(
        walk=walk
    ).select_related('section', 'criterion')

    walk_data['video_observations'] = [
        {
            'section': obs.section.name if obs.section else 'General',
            'criterion': obs.criterion.name if obs.criterion else None,
            'type': obs.observation_type,
            'severity': obs.severity,
            'description': obs.description,
            'suggested_score': obs.suggested_score,
        }
        for obs in video_observations
    ]

    return walk_data
```

The Claude summary prompt would be updated to incorporate video observations, producing a richer narrative that references both evaluator scores and AI video findings.

---

## 9. ROI Projection

### 9.1 Cost Side

| Cost Item | Per Walk | Monthly (50 stores, 2x/mo) | Monthly (200 stores, 2x/mo) |
|---|---|---|---|
| Gemini API (2.5 Flash, 5-min video) | $0.023 | $2.32 | $9.28 |
| DO Spaces storage (720p, 90-day retention) | $0.006 | $1.80 | $7.20 |
| DO Spaces bandwidth (upload + CDN) | $0.002 | $0.20 | $0.80 |
| Additional Celery worker CPU | — | $5.00 | $10.00 |
| **Total incremental cost** | **~$0.03** | **~$9.32** | **~$27.28** |

### 9.2 Value Side

| Value Driver | Impact | Estimated Revenue Impact |
|---|---|---|
| **Premium feature (Pro/Enterprise tier)** | Video analysis as upsell from Starter plan | +$10-30/org/month |
| **Higher conversion rate** | Demo-able AI video analysis is a powerful sales tool | +15-25% demo-to-customer conversion |
| **Reduced walk time** | AI catches issues evaluator might miss, reducing re-walks | 10-15 min saved per walk |
| **Improved scoring consistency** | AI normalization across evaluators | Measurable: lower score variance between evaluators |
| **Faster issue resolution** | Auto-generated action items from video | 2-3 days faster corrective action initiation |
| **Client retention** | Feature lock-in: once organizations rely on video history, switching costs increase | Reduces churn by estimated 10-20% |

### 9.3 Break-Even Analysis

**Scenario**: StoreScore charges $10/month extra for video analysis on the Pro plan.

| Organizations Using Video | Monthly Revenue | Monthly Cost | Net | Break-Even? |
|---|---|---|---|---|
| 5 orgs (50 stores) | $50 | $9.32 | +$40.68 | Yes |
| 20 orgs (200 stores) | $200 | $27.28 | +$172.72 | Yes |
| 100 orgs (1000 stores) | $1,000 | $64.58 | +$935.42 | Yes |

**Video analysis is profitable from day one** — even a single organization using the feature covers API and storage costs.

### 9.4 Development Investment

| Phase | Estimated Effort | Cost (at $150/hr) |
|---|---|---|
| Phase 1 (Post-walk upload + analysis) | 160-240 hours | $24,000-$36,000 |
| Phase 2 (Real-time guidance) | 240-320 hours | $36,000-$48,000 |
| Phase 3 (Temporal comparison) | 120-180 hours | $18,000-$27,000 |
| **Total** | **520-740 hours** | **$78,000-$111,000** |

**Payback period**: With 20 organizations at $10/month premium, monthly net revenue is ~$173. Full development cost recovered in ~450-640 months at that scale. However, video analysis is primarily a **competitive moat and sales conversion driver** — its value is in winning deals against competitors who cannot offer it, not just incremental subscription revenue.

At 100 organizations (realistic within 12-18 months if the feature drives sales), monthly net is ~$935, and development cost is recovered in 83-119 months. The true ROI is in market positioning and enterprise deal sizes that video analysis enables ($500-2000/org/month at enterprise scale).

---

## References

- [COMPETITION.md](./COMPETITION.md) — Competitive landscape analysis
- [ROADMAP.md](./ROADMAP.md) — Product roadmap (Phase 9: AI Video Analysis)
- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs) — Official API docs
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — Current pricing tiers
- [Gemini Video Understanding](https://ai.google.dev/gemini-api/docs/vision) — Video capabilities documentation
- `backend/apps/walks/services.py` — Current Claude AI integration (summary generation, photo analysis)
- `backend/apps/walks/tasks.py` — Current Celery task pipeline (walk completion processing)
- `backend/apps/walks/models.py` — Current Walk, WalkPhoto, ActionItem models
