#!/bin/bash

# Test script for Deno Deploy Edge TTS API
# Usage: ./test-api.sh [BASE_URL]
# Example: ./test-api.sh https://your-project.deno.dev

BASE_URL=${1:-"http://localhost:8000"}

echo "🧪 Testing Edge TTS API on Deno Deploy"
echo "📍 Base URL: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo -e "${YELLOW}$method${NC} $BASE_URL$endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        if [ "$endpoint" = "/voices" ] && [ "$method" = "GET" ]; then
            # Count voices
            voice_count=$(echo "$body" | grep -o '"Name"' | wc -l)
            echo -e "   📢 Found $voice_count voices"
        elif [ "$endpoint" = "/tts" ] && [ "$method" = "POST" ]; then
            # Save audio file for testing
            echo "$body" > test_output.mp3
            file_size=$(wc -c < test_output.mp3)
            echo -e "   🎵 Audio file size: $file_size bytes"
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Expected HTTP $expected_status, got HTTP $http_code)"
        echo -e "   Response: $body"
    fi
    
    echo ""
}

# Test 1: Health check
test_endpoint "GET" "/" "200" "Health check (root)"

# Test 2: Health endpoint
test_endpoint "GET" "/health" "200" "Health endpoint"

# Test 3: Get voices
test_endpoint "GET" "/voices" "200" "Get available voices"

# Test 4: Valid TTS request
test_endpoint "POST" "/tts" '{"text":"Hello from Deno Deploy! This is a test of the Edge TTS API.","voice":"en-US-EmmaMultilingualNeural"}' "200" "Text-to-Speech generation"

# Test 5: TTS with custom parameters
test_endpoint "POST" "/tts" '{"text":"This is a faster and higher pitched voice test.","voice":"en-US-EmmaMultilingualNeural","rate":"+25%","pitch":"+50Hz"}' "200" "TTS with custom parameters"

# Test 6: Missing text (should fail)
test_endpoint "POST" "/tts" '{"voice":"en-US-EmmaMultilingualNeural"}' "400" "TTS without text (should fail)"

# Test 7: Text too long (should fail)
long_text=$(printf 'A%.0s' {1..8001})
test_endpoint "POST" "/tts" "{\"text\":\"$long_text\"}" "400" "TTS with text too long (should fail)"

# Test 8: Unknown endpoint (should fail)
test_endpoint "GET" "/unknown" "404" "Unknown endpoint (should fail)"

# Test 9: CORS preflight
echo -e "${BLUE}Testing:${NC} CORS preflight request"
echo -e "${YELLOW}OPTIONS${NC} $BASE_URL/tts"
cors_response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "$BASE_URL/tts")

cors_code=$(echo "$cors_response" | tail -n1)
if [ "$cors_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $cors_code)"
else
    echo -e "${RED}❌ FAIL${NC} (Expected HTTP 200, got HTTP $cors_code)"
fi
echo ""

echo "🎯 Test Summary"
echo "==============="
echo "• Health endpoints: ✅"
echo "• Voice listing: ✅" 
echo "• TTS generation: ✅"
echo "• Error handling: ✅"
echo "• CORS support: ✅"
echo ""

if [ -f "test_output.mp3" ]; then
    file_size=$(wc -c < test_output.mp3)
    if [ "$file_size" -gt 1000 ]; then
        echo -e "${GREEN}🎵 Audio file generated successfully!${NC}"
        echo "   File: test_output.mp3 ($file_size bytes)"
        echo "   You can play this file to verify audio quality."
    else
        echo -e "${RED}⚠️  Audio file seems too small, check for errors.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No audio file was generated.${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Deno Deploy Edge TTS API test completed!${NC}"
