/**
 * Deno Deploy Implementation for Edge TTS
 * 
 * This implementation uses Deno's built-in WebSocket support to connect
 * to Microsoft's Edge TTS service and provide real-time audio synthesis.
 */

// Constants from edge-tts (updated to match latest implementation)
const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const CHROMIUM_MAJOR_VERSION = '130';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural';

// Headers for voice list API
const BASE_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9'
};

const VOICE_HEADERS = {
  'Authority': 'speech.platform.bing.com',
  'Sec-CH-UA': `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
  'Sec-CH-UA-Mobile': '?0',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  ...BASE_HEADERS
};

// Headers for WebSocket connection
const WSS_HEADERS = {
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9'
};

/**
 * Generate a UUID without dashes
 */
function generateConnectId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generate date string in the format required by Edge TTS
 */
function dateToString(): string {
  return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

/**
 * Remove incompatible characters that the TTS service doesn't support
 */
function removeIncompatibleCharacters(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

/**
 * Escape XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Create SSML from text and voice parameters
 */
function createSSML(
  text: string,
  voice: string = DEFAULT_VOICE,
  rate: string = '+0%',
  volume: string = '+0%',
  pitch: string = '+0Hz'
): string {
  const escapedText = escapeXml(removeIncompatibleCharacters(text));
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapedText}</prosody></voice></speak>`;
}

/**
 * Generate Sec-MS-GEC header value
 */
function generateSecMsGec(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}`);
  
  // Use btoa for base64 encoding in Deno
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  
  return btoa(binary);
}

/**
 * Handle TTS request using WebSocket
 */
async function handleTTSRequest(
  text: string,
  voice: string,
  rate: string,
  volume: string,
  pitch: string
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const connectId = generateConnectId();
    const audioData: Uint8Array[] = [];
    
    // Create WebSocket connection with proper URL and headers
    const wsUrl = new URL(WSS_URL);
    const ws = new WebSocket(wsUrl.toString());
    
    // Set up timeout
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('TTS request timed out'));
    }, 30000);
    
    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      
      // Send configuration message
      const configMessage = `X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      console.log('Sending config message');
      ws.send(configMessage);
      
      // Send SSML message
      const ssml = createSSML(text, voice, rate, volume, pitch);
      console.log('Generated SSML:', ssml.substring(0, 200) + (ssml.length > 200 ? '...' : ''));
      const ssmlMessage = `X-RequestId:${connectId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}\r\nPath:ssml\r\n\r\n${ssml}`;
      console.log('Sending SSML message');
      ws.send(ssmlMessage);
    };
    
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Text message (metadata)
        console.log('Received text message:', event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''));
        
        if (event.data.includes('Path:turn.end')) {
          // End of stream
          clearTimeout(timeout);
          ws.close();
          
          // Combine all audio data
          const totalLength = audioData.reduce((sum, chunk) => sum + chunk.length, 0);
          console.log(`Combining ${audioData.length} audio chunks, total length: ${totalLength} bytes`);
          
          if (totalLength === 0) {
            reject(new Error('No audio data received from TTS service'));
            return;
          }
          
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of audioData) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          
          resolve(combined);
        }
      } else {
        // Binary message (audio data)
        const arrayBuffer = event.data as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log(`Received binary message: ${uint8Array.length} bytes`);
        
        // Skip the header and get audio data
        const headerEndIndex = findHeaderEnd(uint8Array);
        if (headerEndIndex !== -1) {
          const audioChunk = uint8Array.slice(headerEndIndex);
          console.log(`Extracted audio chunk: ${audioChunk.length} bytes (after ${headerEndIndex} byte header)`);
          audioData.push(audioChunk);
        } else {
          console.log('No header separator found, treating entire message as audio data');
          audioData.push(uint8Array);
        }
      }
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.error('WebSocket error:', error);
      reject(new Error('WebSocket connection failed'));
    };
    
    ws.onclose = () => {
      clearTimeout(timeout);
      console.log('WebSocket closed');
    };
  });
}

/**
 * Find the end of the header in binary data
 */
function findHeaderEnd(data: Uint8Array): number {
  // Look for \r\n\r\n sequence
  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] === 0x0D && data[i + 1] === 0x0A && 
        data[i + 2] === 0x0D && data[i + 3] === 0x0A) {
      return i + 4;
    }
  }
  return -1;
}

/**
 * Fetch available voices
 */
async function fetchVoices(): Promise<any[]> {
  try {
    const response = await fetch(VOICE_LIST_URL, {
      headers: VOICE_HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }
    
    const voices = await response.json();
    
    // Process voices like in the Python version
    return voices.map((voice: any) => {
      // Add Language field from Locale
      if (voice.Locale) {
        voice.Language = voice.Locale.split('-')[0];
      }
      
      // Clean ContentCategories and VoicePersonalities
      if (voice.VoiceTag) {
        if (voice.VoiceTag.ContentCategories) {
          voice.VoiceTag.ContentCategories = voice.VoiceTag.ContentCategories.map((cat: string) => cat.trim());
        }
        if (voice.VoiceTag.VoicePersonalities) {
          voice.VoiceTag.VoicePersonalities = voice.VoiceTag.VoicePersonalities.map((pers: string) => pers.trim());
        }
      }
      
      return voice;
    });
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw error;
  }
}

/**
 * CORS headers
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Main request handler
 */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Health check endpoint
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'edge-tts-api',
        platform: 'deno-deploy',
        timestamp: new Date().toISOString()
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    // Voices endpoint
    if (path === '/voices' && request.method === 'GET') {
      const voices = await fetchVoices();
      return new Response(JSON.stringify(voices), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    // TTS endpoint
    if (path === '/tts' && request.method === 'POST') {
      const body = await request.json();
      
      const {
        text,
        voice = DEFAULT_VOICE,
        rate = '+0%',
        volume = '+0%',
        pitch = '+0Hz'
      } = body;
      
      if (!text) {
        return new Response(JSON.stringify({ error: 'Text is required' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      // Validate text length (max ~8000 characters for single request)
      if (typeof text === 'string' && text.length > 8000) {
        return new Response(JSON.stringify({ error: 'Text too long. Maximum 8000 characters.' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      try {
        console.log(`Starting TTS generation for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" with voice: ${voice}`);
        const audioData = await handleTTSRequest(text, voice, rate, volume, pitch);
        
        console.log(`TTS generation completed. Audio size: ${audioData.length} bytes`);
        return new Response(audioData, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioData.length.toString(),
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error('TTS Error:', error);
        return new Response(JSON.stringify({ 
          error: 'TTS generation failed', 
          details: error.message 
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
    }
    
    // 404 for unknown endpoints
    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
    
  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
}

// Export handler for Deno Deploy
export default { fetch: handler };
