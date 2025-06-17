# Edge TTS API - Deno Deploy

A Text-to-Speech API implementation using Microsoft Edge TTS service, deployed on Deno Deploy.

## Features

- ✅ **Full WebSocket Support**: Unlike Cloudflare Workers, Deno Deploy supports outbound WebSocket connections
- ✅ **Real-time TTS Generation**: Generate high-quality speech from text
- ✅ **Voice Management**: Get list of available voices with metadata
- ✅ **Global Edge Network**: Deployed on Deno Deploy's worldwide edge locations
- ✅ **TypeScript Native**: Written in TypeScript with full type safety

## Endpoints

### Health Check
```
GET /
GET /health
```

Returns service status and health information.

### Get Available Voices
```
GET /voices
```

Returns a list of all available voices with their metadata including:
- Voice name and language
- Gender and age
- Voice personalities and categories
- Supported locales

### Text-to-Speech
```
POST /tts
Content-Type: application/json

{
  "text": "Hello world!",
  "voice": "en-US-EmmaMultilingualNeural",
  "rate": "+0%",
  "volume": "+0%",
  "pitch": "+0Hz"
}
```

**Parameters:**
- `text` (required): Text to convert to speech (max 8000 characters)
- `voice` (optional): Voice to use (default: en-US-EmmaMultilingualNeural)
- `rate` (optional): Speech rate (e.g., "+50%", "-20%", default: "+0%")
- `volume` (optional): Volume level (e.g., "+50%", "-20%", default: "+0%")
- `pitch` (optional): Pitch adjustment (e.g., "+50Hz", "-100Hz", default: "+0Hz")

Returns audio/mpeg (MP3) file.

## Deployment

### Option 1: Deploy via GitHub Integration

1. Push this code to a GitHub repository
2. Go to [Deno Deploy](https://dash.deno.com/)
3. Click "New Project"
4. Connect your GitHub repository
5. Set the entry point to `main.ts`
6. Deploy!

### Option 2: Deploy via CLI

1. Install the Deno CLI:
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. Install deployctl:
   ```bash
   deno install --allow-read --allow-write --allow-env --allow-net --allow-run --no-check -r -f https://deno.land/x/deploy/deployctl.ts
   ```

3. Deploy:
   ```bash
   deployctl deploy --project=edge-tts-api main.ts
   ```

### Option 3: Deploy via Web Editor

1. Go to [Deno Deploy Playground](https://dash.deno.com/playground)
2. Copy the contents of `main.ts`
3. Paste and deploy

## Configuration

The service uses the following default configuration:
- **Default Voice**: `en-US-EmmaMultilingualNeural`
- **Audio Format**: MP3, 24kHz, 48kbit/s, mono
- **Max Text Length**: 8000 characters
- **Request Timeout**: 30 seconds

## Free Tier Limits

Deno Deploy free tier includes:
- 100,000 requests per day
- 1000 KB/s bandwidth
- Global edge locations
- No cold starts

## Example Usage

### JavaScript/Node.js
```javascript
// Get available voices
const voicesResponse = await fetch('https://your-project.deno.dev/voices');
const voices = await voicesResponse.json();

// Generate speech
const ttsResponse = await fetch('https://your-project.deno.dev/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello from Deno Deploy!',
    voice: 'en-US-EmmaMultilingualNeural',
    rate: '+10%'
  })
});

const audioBuffer = await ttsResponse.arrayBuffer();
// Save or play the audio
```

### Python
```python
import requests

# Generate speech
response = requests.post('https://your-project.deno.dev/tts', json={
    'text': 'Hello from Deno Deploy!',
    'voice': 'en-US-EmmaMultilingualNeural'
})

with open('speech.mp3', 'wb') as f:
    f.write(response.content)
```

### cURL
```bash
# Get voices
curl https://your-project.deno.dev/voices

# Generate speech
curl -X POST https://your-project.deno.dev/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world!","voice":"en-US-EmmaMultilingualNeural"}' \
  --output speech.mp3
```

## Advantages over Other Platforms

| Feature | Deno Deploy | Cloudflare Workers | Vercel | Netlify |
|---------|-------------|-------------------|--------|---------|
| WebSocket Support | ✅ Full | ❌ Limited | ✅ Yes | ✅ Yes |
| TypeScript Native | ✅ Built-in | ⚠️ Build step | ⚠️ Build step | ⚠️ Build step |
| Edge Locations | ✅ Global | ✅ Global | ✅ Global | ✅ Global |
| Cold Starts | ✅ None | ✅ Minimal | ❌ Yes | ❌ Yes |
| Free Tier | ✅ 100k req/day | ✅ 100k req/day | ✅ 100 GB-hours | ✅ 100k req/month |

## Troubleshooting

### Common Issues

1. **Request timeout**: The service has a 30-second timeout. For very long texts, consider splitting them.

2. **Invalid voice**: Check the `/voices` endpoint for available voices and their exact names.

3. **Text too long**: Maximum text length is 8000 characters per request.

### Error Responses

All errors return JSON with the following structure:
```json
{
  "error": "Error description",
  "details": "Detailed error message"
}
```

## Development

To run locally:
```bash
deno run --allow-net --allow-env main.ts
```

To test the API:
```bash
# Test health endpoint
curl http://localhost:8000/health

# Test voices endpoint
curl http://localhost:8000/voices

# Test TTS endpoint
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello Deno!"}' \
  --output test.mp3
```

## License

This implementation is provided as-is for educational and development purposes. Make sure to comply with Microsoft's terms of service when using their Edge TTS service.
