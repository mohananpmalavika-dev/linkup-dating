# 📹 Icebreaker Videos - Quick Reference

## API Endpoints

### Upload & Management

```
POST /api/icebreaker-videos/upload
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  videoUrl: string (S3 URL or blob)
  videoKey: string (S3 object key)
  durationSeconds: number (1-5)
  thumbnailUrl: string (optional)
  title: string (optional, max 100)

Response:
  {
    success: true,
    message: "Video uploaded successfully",
    video: {
      id: "uuid",
      user_id: "uuid",
      video_url: "https://...",
      duration_seconds: 5,
      thumbnail_url: "https://...",
      title: "My intro",
      is_active: true,
      view_count: 0,
      average_rating: 0,
      authenticity_score: 0,
      created_at: "2026-04-28T..."
    }
  }
```

```
GET /api/icebreaker-videos/my-videos
Headers: Authorization: Bearer {token}

Response:
  {
    success: true,
    videos: [
      {
        id: "uuid",
        title: "My intro",
        duration_seconds: 5,
        is_active: true,
        view_count: 45,
        average_rating: 4.2,
        authenticity_score: 82,
        created_at: "2026-04-28T..."
      }
    ],
    count: 1
  }
```

```
GET /api/icebreaker-videos/my-active
Headers: Authorization: Bearer {token}

Response:
  {
    success: true,
    video: {
      id: "uuid",
      video_url: "https://...",
      title: "My intro",
      duration_seconds: 5,
      created_at: "2026-04-28T..."
    }
  }
```

```
DELETE /api/icebreaker-videos/{videoId}
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body: { videoKey: "s3-object-key" }

Response: { success: true, message: "Video deleted successfully" }
```

### View & Rate

```
GET /api/icebreaker-videos/match/{userId}
Headers: Authorization: Bearer {token}

Requires: Your account must be matched with this user

Response:
  {
    success: true,
    video: {
      id: "uuid",
      user: { id: "uuid", name: "John Doe" },
      video_url: "https://...",
      thumbnail_url: "https://...",
      title: "Why I'm here",
      view_count: 142,
      average_rating: 4.5,
      authenticity_score: 88,
      created_at: "2026-04-28T..."
    }
  }
```

```
POST /api/icebreaker-videos/{videoId}/rate
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
  {
    rating: 4,                           // Required: 1-5
    authenticity_rating: 5,              // Optional: 1-5
    reaction: "love",                    // Optional: like|love|funny|wow|inspiring
    is_helpful: true,                    // Optional: boolean
    would_match: true,                   // Optional: boolean
    comment: "Great video!"              // Optional: max 200 chars
  }

Response:
  {
    success: true,
    message: "Rating saved successfully",
    rating: {
      id: "uuid",
      video_id: "uuid",
      viewer_user_id: "uuid",
      rating: 4,
      authenticity_rating: 5,
      reaction: "love",
      created_at: "2026-04-28T..."
    }
  }
```

```
GET /api/icebreaker-videos/{videoId}/stats
Headers: Authorization: Bearer {token}

Requires: You must own this video

Response:
  {
    success: true,
    stats: {
      videoId: "uuid",
      title: "My intro",
      viewCount: 143,
      likeCount: 78,
      averageRating: 4.5,
      authenticity_score: 88,
      totalRatings: 32,
      reactions: {
        like: 8,
        love: 12,
        funny: 2,
        wow: 5,
        inspiring: 5
      },
      ratingDistribution: {
        1: 0,
        2: 1,
        3: 3,
        4: 10,
        5: 18
      },
      authenticityDistribution: {
        1: 0,
        2: 0,
        3: 2,
        4: 8,
        5: 22
      },
      helpfulCount: 28,
      wouldMatchCount: 26,
      averageCommentLength: 45
    }
  }
```

### Discovery (Public)

```
GET /api/icebreaker-videos/featured?limit=12
No auth required

Response:
  {
    success: true,
    videos: [
      {
        id: "uuid",
        user: { id: "uuid", name: "Jane Smith" },
        title: "Looking for genuine connection",
        thumbnail_url: "https://...",
        view_count: 5000,
        average_rating: 4.8,
        authenticity_score: 94,
        created_at: "2026-04-28T..."
      }
    ],
    count: 12
  }
```

```
GET /api/icebreaker-videos/trending?limit=20&daysBack=7
No auth required

Response:
  {
    success: true,
    videos: [...]
  }
```

---

## Frontend Usage

### Import Components

```jsx
import IcebreakerVideoRecorder from './components/IcebreakerVideoRecorder';
import IcebreakerVideoPlayer from './components/IcebreakerVideoPlayer';
import IcebreakerVideoGallery from './components/IcebreakerVideoGallery';
import './styles/IcebreakerVideos.css';
```

### Record New Video

```jsx
<IcebreakerVideoRecorder
  onUploadSuccess={(video) => {
    console.log('Video uploaded:', video);
    // Refresh gallery
  }}
  onError={(error) => {
    console.error('Upload failed:', error);
  }}
/>
```

### View & Rate Video

```jsx
<IcebreakerVideoPlayer
  videoId="uuid"
  userId="matched-user-uuid"
  onClose={() => {
    // Handle close
  }}
  onRatingSubmitted={() => {
    // Refresh stats
  }}
/>
```

### Manage Gallery

```jsx
<IcebreakerVideoGallery
  userId="current-user-uuid"
  onVideoDeleted={() => {
    // Refresh
  }}
/>
```

---

## Data Models

### IcebreakerVideo

```javascript
{
  id: UUID,
  user_id: UUID,
  video_url: String,
  video_key: String,
  duration_seconds: Number (1-5),
  thumbnail_url: String,
  title: String,
  prompt: String ("Why I'm looking for someone"),
  is_active: Boolean,
  view_count: Number,
  like_count: Number,
  share_count: Number,
  average_rating: Float (0-5),
  authenticity_score: Float (0-100),
  is_featured: Boolean,
  created_at: DateTime,
  updated_at: DateTime
}
```

### IcebreakerVideoRating

```javascript
{
  id: UUID,
  video_id: UUID,
  viewer_user_id: UUID,
  rating: Number (1-5),
  authenticity_rating: Number (1-5),
  comment: String,
  reaction: String ('like'|'love'|'funny'|'wow'|'inspiring'),
  is_helpful: Boolean,
  would_match: Boolean,
  created_at: DateTime
}
```

---

## Service Methods

### Backend (icebreakerVideoService.js)

```javascript
// Upload
uploadIcebreakerVideo(userId, videoUrl, videoKey, duration, thumbnail, title)

// Retrieve
getIcebreakerVideo(videoId, viewerUserId)
getUserActiveVideo(userId)
getUserVideos(userId)
getMatchVideoForViewing(userId, viewerUserId)

// Rate & Engage
rateIcebreakerVideo(videoId, viewerUserId, ratingData)
recordVideoView(videoId, viewerUserId)

// Analytics
getVideoAnalytics(videoId)
updateVideoStats(videoId)
getVideoViewStats(videoId, userId)

// Discovery
getFeaturedVideos(limit)
getTrendingVideos(limit, daysBack)

// Manage
deleteIcebreakerVideo(videoId, userId, videoKey)
```

### Frontend (icebreakerVideoService.js)

```javascript
// Upload
uploadVideo(videoData)

// Retrieve
getMyVideos()
getMyActiveVideo()
getMatchVideo(userId)
getVideo(videoId)

// Engage
rateVideo(videoId, ratingData)
deleteVideo(videoId, videoKey)

// Analytics
getVideoStats(videoId)

// Discovery
getFeaturedVideos(limit)
getTrendingVideos(limit, daysBack)
```

---

## Middleware

### Premium Feature Gate

All upload/management endpoints require:
- `authenticateToken` - Valid JWT token
- `requirePremium` - Active subscription

```javascript
app.post('/api/icebreaker-videos/upload',
  authenticateToken,
  requirePremium,
  uploadIcebreakerVideo
);
```

View endpoints only require `authenticateToken`.

---

## Error Codes

```
400 - Invalid video duration (must be 1-5 seconds)
400 - Invalid rating (must be 1-5)
401 - Unauthorized (invalid/expired token)
403 - Forbidden (not premium subscriber or not video owner)
404 - Video not found
404 - Users not matched (can't view video)
409 - Already rated this video
500 - Server error
```

---

## Common Tasks

### Upload a 5-second video

```jsx
const recorderRef = useRef();
const handleUploadClick = () => {
  recorderRef.current.startRecording();
};
```

### Get matched user's video

```jsx
useEffect(() => {
  icebreakerVideoService.getMatchVideo(matchedUserId)
    .then(video => setVideo(video))
    .catch(err => console.error(err));
}, [matchedUserId]);
```

### Rate a video

```jsx
const handleSubmitRating = async (ratingData) => {
  await icebreakerVideoService.rateVideo(videoId, {
    rating: ratingData.stars,
    authenticity_rating: ratingData.authenticity,
    reaction: ratingData.reaction,
    is_helpful: ratingData.helpful,
    would_match: ratingData.wouldMatch,
    comment: ratingData.comment
  });
};
```

### View user's videos

```jsx
const [videos, setVideos] = useState([]);

useEffect(() => {
  icebreakerVideoService.getMyVideos()
    .then(res => setVideos(res.videos))
    .catch(err => console.error(err));
}, []);

return (
  <IcebreakerVideoGallery
    videos={videos}
    onDelete={(videoId) => {
      setVideos(videos.filter(v => v.id !== videoId));
    }}
  />
);
```

---

## Testing Checklist

- [ ] Record a 5-second video
- [ ] Upload video successfully
- [ ] Video appears in gallery
- [ ] Can set video as active
- [ ] Can delete video
- [ ] Matched user can view video
- [ ] Can rate video (1-5 stars)
- [ ] Can select reaction
- [ ] Can add comment
- [ ] Stats update after rating
- [ ] Authenticity score calculates
- [ ] Cannot upload > 5 seconds
- [ ] Premium gate blocks non-subscribers
- [ ] Mobile responsive layout
- [ ] Camera permission prompt works

---

## Customization Points

**Video Duration:** Change 5-second limit in `IcebreakerVideoRecorder.js` line 45
```javascript
const MAX_DURATION = 5; // Change this
```

**Prompt Text:** Change in `IcebreakerVideoRecorder.js` line 120
```javascript
<h3>Why I'm looking for someone</h3> {/* Change prompt */}
```

**Color Theme:** Modify in `IcebreakerVideos.css` primary color variables
```css
--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

**Reactions:** Add/remove in `IcebreakerVideoPlayer.js` line 180
```javascript
const reactions = ['like', 'love', 'funny', 'wow', 'inspiring']; // Edit array
```

**Authenticity Algorithm:** Update in `icebreakerVideoService.js` backend line 250
```javascript
const score = (auth * 0.5) + (helpful * 0.25) + (wouldMatch * 0.25); // Weights
```

---

**Status:** ✅ **READY FOR PRODUCTION**
