#!/bin/bash
# traffic-simulator-dynamic.sh
# Generates realistic traffic to the weather app using actual API responses

# Configuration
FRONTEND_URL="http://localhost:8085"
BACKEND_URL="http://localhost:8080"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
REQUEST_COUNT=0
ERROR_COUNT=0
SUCCESS_COUNT=0
GEO_COUNT=0
WEATHER_COUNT=0
HISTORICAL_COUNT=0
COMPARE_COUNT=0

echo "🚀 Dynamic Weather App Traffic Simulator"
echo "========================================"
echo "Target: $FRONTEND_URL"
echo "Mode: Realistic user behavior with actual API data"
echo "Press Ctrl+C to stop"
echo ""

# Expanded city list for more variety
CITIES=(
  "London" "Paris" "Tokyo" "New York" "Sydney" "Berlin" "Mumbai" "Toronto"
  "Dubai" "Singapore" "Moscow" "Cairo" "Rome" "Madrid" "Amsterdam" "Bangkok"
  "Seoul" "Mexico City" "Istanbul" "Rio de Janeiro" "Los Angeles" "Chicago"
  "Barcelona" "Vienna" "Athens" "Prague" "Dublin" "Copenhagen" "Stockholm"
  "Oslo" "Helsinki" "Lisbon" "Brussels" "Zurich" "Vancouver" "Montreal"
  "San Francisco" "Boston" "Miami" "Seattle" "Austin" "Denver" "Portland"
)

# Cache for city coordinates (to avoid repeated geocoding)
declare -A CITY_CACHE

# Function to get real coordinates from geocoding API
get_city_coordinates() {
  local city="$1"
  
  # Check cache first
  if [[ -n "${CITY_CACHE[$city]}" ]]; then
    echo "${CITY_CACHE[$city]}"
    return 0
  fi
  
  # Fetch from API
  local response=$(curl -s "${FRONTEND_URL}/api/geo?q=${city}")
  
  # Parse JSON to get first result's coordinates
  local lat=$(echo "$response" | grep -o '"latitude":[^,]*' | head -1 | cut -d':' -f2)
  local lon=$(echo "$response" | grep -o '"longitude":[^,]*' | head -1 | cut -d':' -f2)
  
  if [[ -n "$lat" && -n "$lon" ]]; then
    CITY_CACHE[$city]="${lat},${lon}"
    echo "${lat},${lon}"
    return 0
  else
    return 1
  fi
}

# Function to make a geocoding request
make_geo_request() {
  ((REQUEST_COUNT++))
  local city="${CITIES[$RANDOM % ${#CITIES[@]}]}"
  
  local response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/geo?q=${city}")
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d')
  
  ((GEO_COUNT++))
  
  if [[ "$http_code" == "200" ]]; then
    ((SUCCESS_COUNT++))
    echo -e "${GREEN}✓${NC} Geo #$REQUEST_COUNT: ${city} (HTTP $http_code)"
  else
    ((ERROR_COUNT++))
    echo -e "${RED}✗${NC} Geo #$REQUEST_COUNT: ${city} (HTTP $http_code)"
  fi
}

# Function to make a weather request with dynamic coordinates
make_weather_request() {
  ((REQUEST_COUNT++))
  local city="${CITIES[$RANDOM % ${#CITIES[@]}]}"
  local coords=$(get_city_coordinates "$city")
  
  if [[ -z "$coords" ]]; then
    echo -e "${YELLOW}⚠${NC} Request #$REQUEST_COUNT: Could not geocode ${city}"
    ((ERROR_COUNT++))
    return
  fi
  
  local lat=$(echo "$coords" | cut -d',' -f1)
  local lon=$(echo "$coords" | cut -d',' -f2)
  
  # Randomly vary forecast days
  local days_options=(7 14 15)
  local days=${days_options[$RANDOM % ${#days_options[@]}]}
  
  local response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/weather?lat=${lat}&lon=${lon}&days=${days}")
  local http_code=$(echo "$response" | tail -n1)
  
  ((WEATHER_COUNT++))
  
  if [[ "$http_code" == "200" ]]; then
    ((SUCCESS_COUNT++))
    echo -e "${GREEN}✓${NC} Weather #$REQUEST_COUNT: ${city} (${lat}, ${lon}) - ${days} days (HTTP $http_code)"
  else
    ((ERROR_COUNT++))
    echo -e "${RED}✗${NC} Weather #$REQUEST_COUNT: ${city} (HTTP $http_code)"
  fi
}

# Function to make historical weather request
make_historical_request() {
  ((REQUEST_COUNT++))
  local city="${CITIES[$RANDOM % ${#CITIES[@]}]}"
  local coords=$(get_city_coordinates "$city")
  
  if [[ -z "$coords" ]]; then
    ((ERROR_COUNT++))
    return
  fi
  
  local lat=$(echo "$coords" | cut -d',' -f1)
  local lon=$(echo "$coords" | cut -d',' -f2)
  
  # Get a date from last year (random day in past 365 days)
  local days_ago=$((RANDOM % 365 + 1))
  local start_date=$(date -d "-${days_ago} days" +%Y-%m-%d)
  local end_date=$start_date
  
  local response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/weather/historical?lat=${lat}&lon=${lon}&start_date=${start_date}&end_date=${end_date}")
  local http_code=$(echo "$response" | tail -n1)
  
  ((HISTORICAL_COUNT++))
  
  if [[ "$http_code" == "200" ]]; then
    ((SUCCESS_COUNT++))
    echo -e "${BLUE}✓${NC} Historical #$REQUEST_COUNT: ${city} on ${start_date} (HTTP $http_code)"
  else
    ((ERROR_COUNT++))
    echo -e "${RED}✗${NC} Historical #$REQUEST_COUNT: ${city} (HTTP $http_code)"
  fi
}

# Function to make comparison request (multiple locations)
make_compare_request() {
  ((REQUEST_COUNT++))
  local num_cities=$((RANDOM % 3 + 2))  # 2-4 cities
  local locations=""
  
  for ((i=0; i<num_cities; i++)); do
    local city="${CITIES[$RANDOM % ${#CITIES[@]}]}"
    local coords=$(get_city_coordinates "$city")
    
    if [[ -n "$coords" ]]; then
      local lat=$(echo "$coords" | cut -d',' -f1)
      local lon=$(echo "$coords" | cut -d',' -f2)
      
      if [[ -z "$locations" ]]; then
        locations="${lat},${lon}"
      else
        locations="${locations};${lat},${lon}"
      fi
    fi
  done
  
  if [[ -z "$locations" ]]; then
    ((ERROR_COUNT++))
    return
  fi
  
  local response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/weather/compare?locations=${locations}")
  local http_code=$(echo "$response" | tail -n1)
  
  ((COMPARE_COUNT++))
  
  if [[ "$http_code" == "200" ]]; then
    ((SUCCESS_COUNT++))
    echo -e "${BLUE}✓${NC} Compare #$REQUEST_COUNT: ${num_cities} cities (HTTP $http_code)"
  else
    ((ERROR_COUNT++))
    echo -e "${RED}✗${NC} Compare #$REQUEST_COUNT: (HTTP $http_code)"
  fi
}

# Function to make an error request (intentional bad data)
make_error_request() {
  ((REQUEST_COUNT++))
  local error_type=$((RANDOM % 6))
  
  case $error_type in
    0)
      curl -s "${FRONTEND_URL}/api/geo?q=" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Empty geocoding query (400 error)"
      ;;
    1)
      curl -s "${FRONTEND_URL}/api/weather?lat=invalid&lon=bad" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Invalid coordinates (400 error)"
      ;;
    2)
      curl -s "${FRONTEND_URL}/api/weather" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Missing weather params (400 error)"
      ;;
    3)
      curl -s "${FRONTEND_URL}/api/nonexistent" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Non-existent endpoint (404 error)"
      ;;
    4)
      curl -s "${FRONTEND_URL}/api/weather?lat=999&lon=999" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Out of range coords (502 error)"
      ;;
    5)
      curl -s "${FRONTEND_URL}/api/weather/historical?lat=50&lon=0" > /dev/null 2>&1
      echo -e "${RED}✗${NC} Request #$REQUEST_COUNT: Missing date params (400 error)"
      ;;
  esac
  
  ((ERROR_COUNT++))
}

# Function to simulate realistic user session
simulate_user_session() {
  # Most users start with a search
  make_geo_request
  sleep $((RANDOM % 2 + 1))
  
  # Then check the weather
  make_weather_request
  sleep $((RANDOM % 3 + 1))
  
  # 30% chance user checks historical data
  if [ $((RANDOM % 100)) -lt 30 ]; then
    make_historical_request
    sleep $((RANDOM % 2 + 1))
  fi
  
  # 20% chance user compares multiple locations
  if [ $((RANDOM % 100)) -lt 20 ]; then
    make_compare_request
    sleep $((RANDOM % 2 + 1))
  fi
  
  # 10% chance user searches another city
  if [ $((RANDOM % 100)) -lt 10 ]; then
    make_geo_request
    sleep $((RANDOM % 2 + 1))
    make_weather_request
  fi
}

# Show detailed statistics
show_stats() {
  uptime=$SECONDS
  req_per_min=$(awk "BEGIN {printf \"%.2f\", $REQUEST_COUNT * 60 / $uptime}")
  error_rate=$(awk "BEGIN {printf \"%.2f\", $ERROR_COUNT * 100 / $REQUEST_COUNT}")
  cache_size=${#CITY_CACHE[@]}
  
  echo ""
  echo "📊 Traffic Statistics"
  echo "═══════════════════════════════════════"
  echo "Runtime: ${uptime}s ($(date -d@${uptime} -u +%H:%M:%S))"
  echo "Total Requests: $REQUEST_COUNT"
  echo "  ├─ Successful: $SUCCESS_COUNT"
  echo "  └─ Errors: $ERROR_COUNT"
  echo ""
  echo "Requests by Type:"
  echo "  ├─ Geocoding: $GEO_COUNT"
  echo "  ├─ Weather: $WEATHER_COUNT"
  echo "  ├─ Historical: $HISTORICAL_COUNT"
  echo "  └─ Comparison: $COMPARE_COUNT"
  echo ""
  echo "Performance:"
  echo "  ├─ Requests/min: $req_per_min"
  echo "  ├─ Error rate: ${error_rate}%"
  echo "  └─ Cached cities: $cache_size"
  echo "═══════════════════════════════════════"
  echo ""
}

# Trap Ctrl+C to show stats before exit
trap 'echo ""; echo "Stopping..."; show_stats; exit 0' INT

# Pre-populate cache with popular cities
echo "🔄 Pre-populating city cache..."
for city in "London" "Paris" "Tokyo" "New York" "Sydney"; do
  get_city_coordinates "$city" > /dev/null
done
echo "✓ Cache initialized with ${#CITY_CACHE[@]} cities"
echo ""

# Main loop with time-based variation
while true; do
  # Determine request type based on realistic distribution
  random=$((RANDOM % 100))
  
  if [[ $random -lt 10 ]]; then
    # 10% intentional errors (for testing error handling)
    make_error_request
  elif [[ $random -lt 85 ]]; then
    # 75% normal user sessions
    simulate_user_session
  elif [[ $random -lt 95 ]]; then
    # 10% just weather lookups (returning users)
    make_weather_request
  else
    # 5% advanced features
    if [[ $((RANDOM % 2)) -eq 0 ]]; then
      make_historical_request
    else
      make_compare_request
    fi
  fi
  
  # Show stats every 50 requests
  if [ $((REQUEST_COUNT % 50)) -eq 0 ]; then
    show_stats
  fi
  
  # Variable delay based on time of day (simulate peak hours)
  hour=$(date +%H)
  if [[ $hour -ge 9 && $hour -le 17 ]]; then
    # Peak hours: faster requests (1-5 seconds)
    sleep $((RANDOM % 4 + 1))
  else
    # Off-peak: slower requests (3-10 seconds)
    sleep $((RANDOM % 7 + 3))
  fi
done