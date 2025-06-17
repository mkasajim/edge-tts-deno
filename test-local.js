#!/usr/bin/env node

// Simple test to verify TTS functionality locally
async function testTTS() {
    const baseUrl = 'https://mksajim-edge-tts-de-77.deno.dev';
    
    console.log('🧪 Testing TTS API...');
    
    try {
        // Test 1: Health check
        console.log('📡 Checking health...');
        const healthResponse = await fetch(`${baseUrl}/health`);
        console.log('Health status:', healthResponse.status);
        
        // Test 2: Get voices
        console.log('🎤 Getting voices...');
        const voicesResponse = await fetch(`${baseUrl}/voices`);
        const voices = await voicesResponse.json();
        console.log(`Found ${voices.length} voices`);
        
        // Test 3: Generate TTS
        console.log('🗣️ Generating speech...');
        const ttsResponse = await fetch(`${baseUrl}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Hello, this is a test of the text to speech API.',
                voice: 'en-US-EmmaMultilingualNeural'
            })
        });
        
        console.log('TTS response status:', ttsResponse.status);
        console.log('TTS response headers:', Object.fromEntries(ttsResponse.headers.entries()));
        
        if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer();
            console.log(`✅ Generated audio: ${audioBuffer.byteLength} bytes`);
            
            // Save to file
            const fs = require('fs');
            fs.writeFileSync('test_local_output.mp3', Buffer.from(audioBuffer));
            console.log('💾 Saved to test_local_output.mp3');
        } else {
            const errorText = await ttsResponse.text();
            console.log('❌ Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testTTS();
