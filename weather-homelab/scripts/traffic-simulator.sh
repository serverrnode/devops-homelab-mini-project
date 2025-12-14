#!/bin/bash
# traffic-simulator.sh
# Generates realistic traffic to the weather app for monitoring

# Configuration
FRONTEND_URL="http://localhost:8085"
BACKEND_URL="http://localhost:8080"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counter
REQUEST_COUNT=0
ERROR_COUNT=0
SUCCESS_COUNT=0

echo "🚀 Weather App Traffic Simulator"
echo "================================"
echo "Target: $FRONTEND_URL"
echo "Starting continuous traffic generation..."
echo "Press Ctrl+C to stop"
echo ""

# Cities to simulate searches for
CITIES=(
  "London" "Paris" "Tokyo" "New York" "Sydney"
  "Berlin" "Mumbai" "Toronto" "Dubai" "Singapore"
  "Moscow" "Cairo" "Rome" "Madrid" "Amsterdam"
  "Bangkok" "Seoul" "Mexico City" "Istanbul" "Rio de Janeiro"
)

# Function to make a successful request
make_good_request() {
  local city="${CITIES[$RANDOM % ${#CITIES[@]}]}"
  
  # Random coordinates (approximate)
  case $city in
    "London") LAT=51.5074; LON=-0.1278 ;;
    "Paris") LAT=48.8566; LON=2.3522 ;;
    "Tokyo") LAT=35.6762; LON=139.6503 ;;
    "New York") LAT=40.7128; LON=-74.0060 ;;
    "Sydney") LAT=-33.8688; LON=151.2093 ;;
    "Berlin") LAT=52.5200; LON=13.4050 ;;
    "Mumbai") LAT=19.0760; LON=72.8777 ;;
    "Toronto") LAT=43.6532; LON=-79.3832 ;;
    "Dubai") LAT=25.2048; LON=55.2708 ;;
    "Singapore") LAT=1.3521; LON=103.8198 ;;
    *) LAT=$((RANDOM % 180 - 90)); LON=$((RANDOM % 360 - 180)) ;;
  esac
  
  # Geocoding request
  curl -s "${FRONTEND_URL}/api/geo?q=${city}" > /dev/null 2>&1
  
  # Weather request
  curl -s "${FRONTEND_URL}/api/weather?lat=${LAT}&lon=${LON}" > /dev/null 2>&1
  
  ((SUCCESS_COUNT++))
  echo -e "${GREEN}✓${NC} Request #$REQUEST_COUNT: ${city} (${LAT}, ${LON})"
}

# Function to make an error request (bad data)
make_error_request() {
  local error_type=$((RANDOM % 5))
  
  case $error_type in
    0)
      # Empty query parameter
      curl -s "${FRONTEND_URL}/api/geo?q=" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Empty geocoding query (400 error)"
      ;;
    1)
      # Invalid coordinates
      curl -s "${FRONTEND_URL}/api/weather?lat=invalid&lon=bad" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Invalid coordinates (400 error)"
      ;;
    2)
      # Missing parameters
      curl -s "${FRONTEND_URL}/api/weather" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Missing weather params (400 error)"
      ;;
    3)
      # Non-existent endpoint
      curl -s "${FRONTEND_URL}/api/nonexistent" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Non-existent endpoint (404 error)"
      ;;
    4)
      # Out of range coordinates
      curl -s "${FRONTEND_URL}/api/weather?lat=999&lon=999" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Out of range coords (502 error)"
      ;;
  esac
  
  ((ERROR_COUNT++))
}

# Function to simulate user behavior
simulate_user_session() {
  # User searches for a city
  make_good_request
  sleep $((RANDOM % 3 + 1))  # 1-3 seconds thinking time
  
  # User might make another search
  if [ $((RANDOM % 3)) -eq 0 ]; then
    make_good_request
    sleep $((RANDOM % 2 + 1))
  fi
}

# Show statistics
show_stats() {
  local uptime=$SECONDS
  local req_per_min=$(awk "BEGIN {printf \"%.2f\", $REQUEST_COUNT * 60 / $uptime}")
  local error_rate=$(awk "BEGIN {printf \"%.2f\", $ERROR_COUNT * 100 / $REQUEST_COUNT}")
  
  echo ""
  echo "📊 Statistics"
  echo "─────────────────────────────"
  echo "Running time: ${uptime}s"
  echo "Total requests: $REQUEST_COUNT"
  echo "Successful: $SUCCESS_COUNT"
  echo "Errors: $ERROR_COUNT"
  echo "Requests/min: $req_per_min"
  echo "Error rate: ${error_rate}%"
  echo "─────────────────────────────"
  echo ""
}

# Trap Ctrl+C to show stats before exit
trap 'echo ""; echo "Stopping..."; show_stats; exit 0' INT

# Main loop
while true; do
  ((REQUEST_COUNT++))
  
  # 85% good requests, 15% errors (realistic ratio)
  if [ $((RANDOM % 100)) -lt 85 ]; then
    simulate_user_session
  else
    make_error_request
  fi
  
  # Show stats every 50 requests
  if [ $((REQUEST_COUNT % 50)) -eq 0 ]; then
    show_stats
  fi
  
  # Random delay between sessions (2-10 seconds)
  sleep $((RANDOM % 8 + 2))
done
