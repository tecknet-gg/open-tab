# Open Tab API

Base URL: `http://localhost:3000`

---

## GET /api/search

Search Songsterr for tabs.

**Query Parameters:**

| Param | Type   | Required | Description          |
|-------|--------|----------|----------------------|
| `q`   | string | Yes      | Search query (e.g. `scott street`) |

**Response:** `200 OK`

```json
[
  {
    "songId": 613477,
    "title": "Scott Street",
    "artist": "Phoebe Bridgers",
    "source": "songsterr",
    "tracks": [
      {
        "instrumentId": 25,
        "instrument": "Acoustic Guitar (steel)",
        "tuning": [64, 59, 55, 50, 45, 40],
        "difficulty": 2,
        "hash": "guitar_ShPQAFDe"
      }
    ]
  }
]
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Missing required query parameter: q |

---

## POST /api/download

Download a tab as GP7/MIDI, with optional audio from YouTube.

**Request Body:**

| Field        | Type    | Required | Default | Description |
|--------------|---------|----------|---------|-------------|
| `songId`     | number  | Yes      | —       | Songsterr song ID (from search results) |
| `revisionId` | number  | No       | latest  | Specific revision ID. Omit to use latest. |
| `format`     | string  | No       | `gp7`   | `gp7` or `midi` |
| `video`      | boolean | No       | `false` | If `true`, downloads synced audio as MP3 via yt-dlp |

**Request Example:**

```json
{
  "songId": 613477,
  "video": true
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "dir": "/Users/you/Documents/tabs/Phoebe Bridgers/Scott Street",
  "files": ["Scott Street.gp", "metadata.json", "Scott Street.mp3"],
  "artist": "Phoebe Bridgers",
  "title": "Scott Street",
  "trackCount": 8,
  "hasSync": true,
  "videoFile": "Scott Street.mp3",
  "format": "gp7",
  "sizeBytes": 155092,
  "durationMs": 5026
}
```

**Output Structure:**

```
~/Documents/tabs/{Artist}/{Song}/
├── {Song}.gp          # Tab file (or .mid)
├── metadata.json      # Song info + sync points
└── {Song}.mp3         # Only if video: true
```

**metadata.json:**

```json
{
  "songId": 613477,
  "revisionId": 7094005,
  "title": "Scott Street",
  "artist": "Phoebe Bridgers",
  "artistId": 89672,
  "source": "songsterr",
  "format": "gp7",
  "tracks": [
    {
      "instrumentId": 25,
      "instrument": "Acoustic Guitar (steel)",
      "tuning": [64, 59, 55, 50, 45, 40],
      "hash": "guitar_ShPQAFDe"
    }
  ],
  "sync": {
    "videoId": "W-Khe7DInxo",
    "points": [0, 1.86, 3.62, 5.39, ...],
    "feature": null
  }
}
```

- `sync.points[i]` = timestamp in seconds where beat `i` occurs in the YouTube video
- `sync.feature` = `null` for main audio, `"backing"` / `"solo"` / `"alternative"` for variants
- `sync` is `null` if no sync data available

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Missing required field: songId |
| 404 | Unable to fetch any revision payloads for songId {id} |
| 500 | Failed to download tab / yt-dlp failed: {reason} |

---

## Dependencies

- **yt-dlp** — required for `video: true`. Must be installed and available on PATH.
- **ffmpeg** — required by yt-dlp for MP3 conversion.
