#!/bin/bash
# traffic-simulator-fixed.sh
# FIXED: Now generates REAL upstream API errors that show in Grafana

FRONTEND_URL="http://localhost:8085"

# Rate limiting
BASE_SESSION_DELAY=35
MAX_SESSION_DELAY=55

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Counters
TOTAL_SESSIONS=0
SUCCESSFUL_SESSIONS=0
FAILED_SESSIONS=0
FRONTEND_REQUESTS=0
BACKEND_REQUESTS=0
EXTERNAL_API_CALLS=0
GEO_CALLS=0
WEATHER_CALLS=0
ERROR_SCENARIOS=0
UPSTREAM_ERRORS=0

START_TIME=$(date +%s)

# Cities
POPULAR_CITIES=("London" "Paris" "Tokyo" "New York" "Sydney" "Berlin" "Mumbai" "Toronto" "Dubai" "Singapore")
COMMON_CITIES=("Rome" "Madrid" "Chicago" "Miami" "Barcelona" "Amsterdam" "Seoul" "Vienna")
RARE_CITIES=("Reykjavik" "Oslo" "Helsinki" "Auckland" "Prague" "Athens" "Lisbon" "Dublin" "Copenhagen")
ALL_CITIES=("${POPULAR_CITIES[@]}" "${COMMON_CITIES[@]}" "${RARE_CITIES[@]}")

# NEW: Invalid locations that will cause UPSTREAM errors (502)
INVALID_COORDS=(
  "999,999"           # Out of range
  "200,-200"          # Invalid lat/lon
  "-999,500"          # Extreme values
  "91,181"            # Just outside valid range
)

PATTERN_MULTIPLIER=1.0

echo "🌐 FIXED Traffic Simulator - Generates Real Upstream Errors"
echo "=========================================="
echo "👥 Simulates real user behavior"
echo "🎯 Target: <5,000 external API calls/day"
echo "⚡ NOW INCLUDES: Real upstream API failures!"
echo ""
echo "Press Ctrl+C to stop"
echo ""

get_traffic_pattern() {
  local hour=$(date +%H)
  local day=$(date +%u)
  
  if [[ $day -ge 6 ]]; then
    PATTERN_MULTIPLIER=1.3
    return
  fi
  
  if [[ $hour -ge 7 && $hour -lt 9 ]]; then
    PATTERN_MULTIPLIER=0.9
  elif [[ $hour -ge 9 && $hour -lt 12 ]]; then
    PATTERN_MULTIPLIER=0.85
  elif [[ $hour -ge 12 && $hour -lt 14 ]]; then
    PATTERN_MULTIPLIER=1.0
  elif [[ $hour -ge 14 && $hour -lt 18 ]]; then
    PATTERN_MULTIPLIER=0.9
  elif [[ $hour -ge 18 && $hour -lt 22 ]]; then
    PATTERN_MULTIPLIER=1.1
  else
    PATTERN_MULTIPLIER=1.6
  fi
}

check_rate_limit() {
  local current_time=$(date +%s)
  local elapsed=$((current_time - START_TIME))
  
  if [[ $elapsed -lt 120 ]]; then
    return 0
  fi
  
  local hours=$(awk "BEGIN {print $elapsed / 3600}")
  if (( $(awk "BEGIN {print ($hours > 0.1)}") )); then
    local api_per_hour=$(awk "BEGIN {print $EXTERNAL_API_CALLS / $hours}")
    
    if (( $(awk "BEGIN {print ($api_per_hour > 185)}") )); then
      echo -e "${RED}⚠️  Rate protection: ${api_per_hour%.0f} API/hr (pausing 2min)${NC}"
      sleep 120
      return 1
    fi
  fi
  
  return 0
}

get_random_city() {
  local rand=$((RANDOM % 100))
  
  if [[ $rand -lt 60 ]]; then
    echo "${POPULAR_CITIES[$RANDOM % ${#POPULAR_CITIES[@]}]}"
  elif [[ $rand -lt 90 ]]; then
    echo "${COMMON_CITIES[$RANDOM % ${#COMMON_CITIES[@]}]}"
  else
    echo "${RARE_CITIES[$RANDOM % ${#RARE_CITIES[@]}]}"
  fi
}

simulate_user_session() {
  ((TOTAL_SESSIONS++))
  
  local session_type=$((RANDOM % 100))
  
  if [[ $session_type -lt 15 ]]; then
    # 15% - Error scenarios (INCREASED from 10%)
    simulate_error_session
  elif [[ $session_type -lt 85 ]]; then
    # 70% - Normal weather lookup
    simulate_normal_session
  else
    # 15% - Advanced features
    simulate_advanced_session
  fi
}

simulate_normal_session() {
  if ! check_rate_limit; then
    return 1
  fi
  
  local city=$(get_random_city)
  
  echo -e "${CYAN}👤 User Session #$TOTAL_SESSIONS${NC}"
  
  ((FRONTEND_REQUESTS++))
  echo -e "  ${BLUE}→${NC} Loading homepage..."
  curl -s "${FRONTEND_URL}/" > /dev/null 2>&1
  sleep $((RANDOM % 2 + 1))
  
  ((FRONTEND_REQUESTS++))
  ((BACKEND_REQUESTS++))
  ((EXTERNAL_API_CALLS++))
  ((GEO_CALLS++))
  echo -e "  ${CYAN}🔍${NC} Searching for '${city}'..."
  
  local geo_response=$(curl -s "${FRONTEND_URL}/api/geo?q=${city}" 2>/dev/null)
  
  if ! echo "$geo_response" | grep -q '"results"'; then
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}✗${NC} No results found for '${city}'"
    return 1
  fi
  
  sleep $((RANDOM % 3 + 2))
  
  ((FRONTEND_REQUESTS++))
  ((BACKEND_REQUESTS++))
  ((EXTERNAL_API_CALLS++))
  ((WEATHER_CALLS++))
  
  local lat=$(echo "$geo_response" | grep -o '"latitude":[^,]*' | head -1 | cut -d':' -f2)
  local lon=$(echo "$geo_response" | grep -o '"longitude":[^,]*' | head -1 | cut -d':' -f2)
  
  if [[ -z "$lat" || -z "$lon" ]]; then
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}✗${NC} Failed to extract coordinates"
    return 1
  fi
  
  local days=7
  local rand=$((RANDOM % 100))
  if [[ $rand -lt 10 ]]; then
    days=14
  elif [[ $rand -lt 15 ]]; then
    days=16
  fi
  
  echo -e "  ${GREEN}✓${NC} Getting ${days}-day forecast for ${city}..."
  
  local weather_response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/weather?lat=${lat}&lon=${lon}&days=${days}" 2>/dev/null)
  local http_code=$(echo "$weather_response" | tail -n1)
  local body=$(echo "$weather_response" | sed '$d')
  
  if echo "$body" | grep -qi "rate limit\|limit exceeded\|429"; then
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}🚫 RATE LIMITED${NC}"
    sleep 600
    return 1
  fi
  
  if [[ "$http_code" == "200" ]]; then
    ((SUCCESSFUL_SESSIONS++))
    echo -e "  ${GREEN}✓${NC} Success! User viewing weather for ${city}"
    echo -e "  ${MAGENTA}📊 APIs: ${EXTERNAL_API_CALLS} (Geo: ${GEO_CALLS}, Weather: ${WEATHER_CALLS})${NC}"
    sleep $((RANDOM % 3 + 2))
  elif [[ "$http_code" == "502" ]]; then
    ((FAILED_SESSIONS++))
    ((UPSTREAM_ERRORS++))
    echo -e "  ${YELLOW}⚠${NC} Upstream API error (502) - This shows in Grafana!"
  else
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}✗${NC} Request failed (HTTP ${http_code})"
  fi
}

simulate_advanced_session() {
  if ! check_rate_limit; then
    return 1
  fi
  
  echo -e "${MAGENTA}👤 Power User Session #$TOTAL_SESSIONS${NC}"
  
  local rand=$((RANDOM % 100))
  
  if [[ $rand -lt 60 ]]; then
    local city1=$(get_random_city)
    local city2=$(get_random_city)
    
    while [[ "$city1" == "$city2" ]]; do
      city2=$(get_random_city)
    done
    
    ((FRONTEND_REQUESTS+=2))
    ((BACKEND_REQUESTS+=2))
    ((EXTERNAL_API_CALLS+=2))
    ((GEO_CALLS+=2))
    
    echo -e "  ${CYAN}🔍${NC} Searching for '${city1}'..."
    local geo1=$(curl -s "${FRONTEND_URL}/api/geo?q=${city1}" 2>/dev/null)
    sleep 1
    
    echo -e "  ${CYAN}🔍${NC} Searching for '${city2}'..."
    local geo2=$(curl -s "${FRONTEND_URL}/api/geo?q=${city2}" 2>/dev/null)
    sleep 2
    
    local lat1=$(echo "$geo1" | grep -o '"latitude":[^,]*' | head -1 | cut -d':' -f2)
    local lon1=$(echo "$geo1" | grep -o '"longitude":[^,]*' | head -1 | cut -d':' -f2)
    local lat2=$(echo "$geo2" | grep -o '"latitude":[^,]*' | head -1 | cut -d':' -f2)
    local lon2=$(echo "$geo2" | grep -o '"longitude":[^,]*' | head -1 | cut -d':' -f2)
    
    if [[ -n "$lat1" && -n "$lon1" && -n "$lat2" && -n "$lon2" ]]; then
      ((BACKEND_REQUESTS++))
      ((EXTERNAL_API_CALLS+=2))
      ((WEATHER_CALLS+=2))
      
      echo -e "  ${BLUE}🔀${NC} Comparing ${city1} vs ${city2}..."
      local locations="${lat1},${lon1};${lat2},${lon2}"
      curl -s "${FRONTEND_URL}/api/weather/compare?locations=${locations}" > /dev/null 2>&1
      
      ((SUCCESSFUL_SESSIONS++))
      echo -e "  ${GREEN}✓${NC} Comparison complete"
      echo -e "  ${MAGENTA}📊 APIs: ${EXTERNAL_API_CALLS} (Geo: ${GEO_CALLS}, Weather: ${WEATHER_CALLS})${NC}"
    else
      ((FAILED_SESSIONS++))
      echo -e "  ${RED}✗${NC} Failed to geocode cities"
    fi
  else
    local city=$(get_random_city)
    
    ((FRONTEND_REQUESTS++))
    ((BACKEND_REQUESTS++))
    ((EXTERNAL_API_CALLS++))
    ((GEO_CALLS++))
    
    echo -e "  ${CYAN}🔍${NC} Searching for '${city}'..."
    local geo=$(curl -s "${FRONTEND_URL}/api/geo?q=${city}" 2>/dev/null)
    sleep 1
    
    local lat=$(echo "$geo" | grep -o '"latitude":[^,]*' | head -1 | cut -d':' -f2)
    local lon=$(echo "$geo" | grep -o '"longitude":[^,]*' | head -1 | cut -d':' -f2)
    
    if [[ -n "$lat" && -n "$lon" ]]; then
      ((BACKEND_REQUESTS++))
      ((EXTERNAL_API_CALLS++))
      
      local days_ago=$((RANDOM % 60 + 300))
      local date=$(date -d "-${days_ago} days" +%Y-%m-%d)
      
      echo -e "  ${BLUE}📅${NC} Getting historical data for ${city} (${date})..."
      curl -s "${FRONTEND_URL}/api/weather/historical?lat=${lat}&lon=${lon}&start_date=${date}&end_date=${date}" > /dev/null 2>&1
      
      ((SUCCESSFUL_SESSIONS++))
      echo -e "  ${GREEN}✓${NC} Historical data retrieved"
      echo -e "  ${MAGENTA}📊 APIs: ${EXTERNAL_API_CALLS} (Geo: ${GEO_CALLS})${NC}"
    else
      ((FAILED_SESSIONS++))
      echo -e "  ${RED}✗${NC} Failed to geocode"
    fi
  fi
}

# FIXED ERROR SESSION: Now generates REAL upstream errors
simulate_error_session() {
  ((ERROR_SCENARIOS++))
  echo -e "${RED}👤 Error Session #$TOTAL_SESSIONS${NC}"
  
  local error_type=$((RANDOM % 100))
  
  if [[ $error_type -lt 20 ]]; then
    # 20% - Empty search (400 error, not upstream)
    ((FRONTEND_REQUESTS++))
    ((BACKEND_REQUESTS++))
    echo -e "  ${YELLOW}⚠${NC} User submitted empty search"
    curl -s "${FRONTEND_URL}/api/geo?q=" > /dev/null 2>&1
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}✗${NC} Error: Empty query (400)"
    
  elif [[ $error_type -lt 35 ]]; then
    # 15% - Invalid coordinates (generates 502 upstream error!)
    ((FRONTEND_REQUESTS++))
    ((BACKEND_REQUESTS++))
    ((EXTERNAL_API_CALLS++))
    ((WEATHER_CALLS++))
    
    local invalid_coord="${INVALID_COORDS[$RANDOM % ${#INVALID_COORDS[@]}]}"
    local lat=$(echo "$invalid_coord" | cut -d',' -f1)
    local lon=$(echo "$invalid_coord" | cut -d',' -f2)
    
    echo -e "  ${YELLOW}⚠${NC} User provided invalid coordinates: ${lat},${lon}"
    local response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/weather?lat=${lat}&lon=${lon}" 2>/dev/null)
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "502" ]]; then
      ((UPSTREAM_ERRORS++))
      echo -e "  ${RED}🔥 UPSTREAM ERROR (502)${NC} - Open-Meteo rejected invalid coords!"
      echo -e "  ${CYAN}➜ This appears in Grafana as 'open-meteo error'${NC}"
    fi
    
    ((FAILED_SESSIONS++))
    echo -e "  ${MAGENTA}📊 APIs: ${EXTERNAL_API_CALLS} (Weather: ${WEATHER_CALLS})${NC}"
    
  elif [[ $error_type -lt 50 ]]; then
    # 15% - Malformed request (400, not upstream)
    ((FRONTEND_REQUESTS++))
    ((BACKEND_REQUESTS++))
    echo -e "  ${YELLOW}⚠${NC} Direct weather request without params"
    curl -s "${FRONTEND_URL}/api/weather" > /dev/null 2>&1
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}✗${NC} Error: Missing parameters (400)"
    
  elif [[ $error_type -lt 70 ]]; then
    # 20% - Extreme invalid coordinates (502 upstream error!)
    ((FRONTEND_REQUESTS++))
    ((BACKEND_REQUESTS++))
    ((EXTERNAL_API_CALLS++))
    ((WEATHER_CALLS++))
    
    local extreme_lat=$((RANDOM % 200 + 100))  # Way out of range
    local extreme_lon=$((RANDOM % 400 - 200))
    
    echo -e "  ${YELLOW}⚠${NC} Extreme invalid coords: ${extreme_lat},${extreme_lon}"
    local response=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/weather?lat=${extreme_lat}&lon=${extreme_lon}" 2>/dev/null)
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "502" ]]; then
      ((UPSTREAM_ERRORS++))
      echo -e "  ${RED}🔥 UPSTREAM ERROR (502)${NC} - Weather API failure!"
      echo -e "  ${CYAN}➜ Grafana: open-meteo error counter +1${NC}"
    fi
    
    ((FAILED_SESSIONS++))
    echo -e "  ${MAGENTA}📊 APIs: ${EXTERNAL_API_CALLS} (Weather: ${WEATHER_CALLS})${NC}"
    
  else
    # 30% - 404 (not found, not upstream)
    ((FRONTEND_REQUESTS++))
    echo -e "  ${YELLOW}⚠${NC} User accessed wrong URL"
    curl -s "${FRONTEND_URL}/api/forecast" > /dev/null 2>&1
    ((FAILED_SESSIONS++))
    echo -e "  ${RED}✗${NC} Error: Not found (404)"
  fi
}

show_stats() {
  local current_time=$(date +%s)
  local uptime=$((current_time - START_TIME))
  
  local sessions_per_min=0
  local api_per_min=0
  local api_per_hour=0
  local projected_daily=0
  local success_rate=0
  local upstream_error_rate=0
  
  if [[ $uptime -gt 0 ]]; then
    sessions_per_min=$(awk "BEGIN {printf \"%.2f\", $TOTAL_SESSIONS * 60 / $uptime}")
    api_per_min=$(awk "BEGIN {printf \"%.2f\", $EXTERNAL_API_CALLS * 60 / $uptime}")
    api_per_hour=$(awk "BEGIN {printf \"%.1f\", $EXTERNAL_API_CALLS * 3600 / $uptime}")
    projected_daily=$(awk "BEGIN {printf \"%.0f\", $EXTERNAL_API_CALLS * 86400 / $uptime}")
  fi
  
  if [[ $TOTAL_SESSIONS -gt 0 ]]; then
    success_rate=$(awk "BEGIN {printf \"%.1f\", $SUCCESSFUL_SESSIONS * 100 / $TOTAL_SESSIONS}")
  fi
  
  if [[ $ERROR_SCENARIOS -gt 0 ]]; then
    upstream_error_rate=$(awk "BEGIN {printf \"%.1f\", $UPSTREAM_ERRORS * 100 / $ERROR_SCENARIOS}")
  fi
  
  local runtime=$(date -u -d @${uptime} +"%H:%M:%S")
  
  echo ""
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║         📊 Traffic Statistics                      ║"
  echo "╠═══════════════════════════════════════════════════╣"
  echo "║ ⏱️  Runtime: $runtime                              "
  echo "╠═══════════════════════════════════════════════════╣"
  echo "║ 👥 User Sessions:                                  "
  echo "║    Total: $TOTAL_SESSIONS                          "
  echo "║    ├─ Successful: $SUCCESSFUL_SESSIONS ($success_rate%)"
  echo "║    ├─ Failed: $FAILED_SESSIONS                     "
  echo "║    └─ Error scenarios: $ERROR_SCENARIOS            "
  echo "╠═══════════════════════════════════════════════════╣"
  echo "║ 🔥 UPSTREAM ERRORS (Grafana metrics):             "
  echo "║    Total upstream failures: $UPSTREAM_ERRORS       "
  echo "║    Rate: ${upstream_error_rate}% of error scenarios"
  echo "║    ${CYAN}➜ Check 'Upstream API Health' in Grafana!${NC}  "
  echo "╠═══════════════════════════════════════════════════╣"
  echo "║ 📡 Request Breakdown:                              "
  echo "║    Frontend requests: $FRONTEND_REQUESTS           "
  echo "║    Backend API calls: $BACKEND_REQUESTS            "
  echo "║    External API calls: $EXTERNAL_API_CALLS         "
  echo "║    ├─ Geocoding: $GEO_CALLS                        "
  echo "║    └─ Weather: $WEATHER_CALLS                      "
  echo "╠═══════════════════════════════════════════════════╣"
  echo "║ ⚡ Performance:                                     "
  echo "║    Sessions/min: $sessions_per_min                 "
  echo "║    API calls/min: $api_per_min                     "
  echo "║    API calls/hour: $api_per_hour                   "
  echo "║    Projected daily: $projected_daily               "
  echo "╠═══════════════════════════════════════════════════╣"
  
  if [[ $projected_daily -lt 5000 ]]; then
    echo "║ ✅ Status: ${GREEN}SAFE${NC} (well under 5k limit)       "
  elif [[ $projected_daily -lt 8000 ]]; then
    echo "║ ⚠️  Status: ${YELLOW}CAUTION${NC} (approaching limit)     "
  else
    echo "║ 🚨 Status: ${RED}DANGER${NC} (too high!)                "
  fi
  
  echo "╚═══════════════════════════════════════════════════╝"
  echo ""
}

trap 'echo ""; echo "🛑 Stopping simulator..."; show_stats; exit 0' INT

echo "🚀 Starting FIXED traffic simulation..."
echo "👥 Simulating real user behavior"
echo "🔥 NOW GENERATING: Real upstream API errors!"
echo ""

SESSION_COUNT=0
LAST_PATTERN_UPDATE=0

while true; do
  ((SESSION_COUNT++))
  current_time=$(date +%s)
  
  if [[ $((current_time - LAST_PATTERN_UPDATE)) -ge 600 ]]; then
    get_traffic_pattern
    LAST_PATTERN_UPDATE=$current_time
  fi
  
  simulate_user_session
  
  if [[ $((SESSION_COUNT % 8)) -eq 0 ]]; then
    show_stats
  fi
  
  session_delay=$(awk "BEGIN {print int(($BASE_SESSION_DELAY + $RANDOM % ($MAX_SESSION_DELAY - $BASE_SESSION_DELAY)) * $PATTERN_MULTIPLIER)}")
  
  echo -e "${CYAN}⏳ Next session in ${session_delay}s...${NC}"
  echo ""
  sleep $session_delay
done