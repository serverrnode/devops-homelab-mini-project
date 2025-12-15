// Global state
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationSelectGroup = document.getElementById('locationSelectGroup');
const locationSelect = document.getElementById('locationSelect');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const weatherCard = document.getElementById('weatherCard');

let forecastDays = 7;
let currentWeatherData = null;
let locations = [];
let currentLocation = null;
let charts = {
  temperature: null,
  precipitation: null,
  humidity: null,
  uvIndex: null,
  wind: null,
  feelsLike: null
};
let map = null;
let markers = [];

function getWindDirection(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// Search locations
async function searchLocations() {
  const query = searchInput.value.trim();
  if (!query) return;

  try {
    searchBtn.textContent = 'Searching...';
    searchBtn.disabled = true;

    const response = await fetch(`/api/geo?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    locations = data.results || [];
    locationSelect.innerHTML = '<option value="">Choose a location...</option>';
    locationSelect.disabled = false; // Enable the dropdown

    if (locations.length === 0) {
      weatherCard.innerHTML = `
        <div class="no-results">
          <p>No locations found for "<strong>${query}</strong>"</p>
          <p style="margin-top: 10px; color: #94a3b8;">Try searching for a different city or country</p>
        </div>
      `;
      weatherCard.classList.remove('hidden');
      weatherCard.style.display = 'block';
      locationSelectGroup.style.display = 'none';
      locationSelect.disabled = true;
      getWeatherBtn.disabled = true;
      return;
    }

    locations.forEach((location, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = formatLocationLabel(location);
      locationSelect.appendChild(option);
    });

    locationSelectGroup.style.display = 'block';
    getWeatherBtn.disabled = false;
    weatherCard.classList.add('hidden');

  } catch (error) {
    weatherCard.innerHTML = `
      <div class="error">
        <strong>Error:</strong> Failed to search locations. Please try again.
      </div>
    `;
    weatherCard.classList.remove('hidden');
    weatherCard.style.display = 'block';
  } finally {
    searchBtn.textContent = 'Search';
    searchBtn.disabled = false;
  }
}

// Get weather data
async function getWeather(days = forecastDays) {
  const selectedIndex = locationSelect.value;
  if (selectedIndex === '') return;

  const location = locations[selectedIndex];
  currentLocation = location;
  forecastDays = days;

  try {
    getWeatherBtn.textContent = 'Loading...';
    getWeatherBtn.disabled = true;

    weatherCard.innerHTML = '<div class="loading">Loading weather data...</div>';
    weatherCard.classList.remove('hidden');
    weatherCard.style.display = 'block';

    const response = await fetch(
      `/api/weather?lat=${location.latitude}&lon=${location.longitude}&days=${days}`
    );
    const data = await response.json();
    currentWeatherData = data;

    // Get historical data for "this day last year"
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const lastYearStr = lastYear.toISOString().split('T')[0];
    
    const historicalResponse = await fetch(
      `/api/weather/historical?lat=${location.latitude}&lon=${location.longitude}&start_date=${lastYearStr}&end_date=${lastYearStr}`
    );
    const historicalData = await historicalResponse.json();

    displayWeather(location, data, historicalData);

  } catch (error) {
    weatherCard.innerHTML = `
      <div class="error">
        <strong>Error:</strong> Failed to fetch weather data. Please try again.
      </div>
    `;
    weatherCard.classList.remove('hidden');
    weatherCard.style.display = 'block';
  } finally {
    getWeatherBtn.textContent = 'Get Weather';
    getWeatherBtn.disabled = false;
  }
}

// Display weather
function displayWeather(location, data, historicalData) {
  const { current, daily, hourly } = data;
  
  // Historical comparison
  let historicalHTML = '';
  if (historicalData && historicalData.daily && historicalData.daily.temperature_2m_max && historicalData.daily.temperature_2m_max[0]) {
    const lastYearMax = Math.round(historicalData.daily.temperature_2m_max[0]);
    const lastYearMin = Math.round(historicalData.daily.temperature_2m_min[0]);
    historicalHTML = `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">
        <div style="font-size: 0.9rem; opacity: 0.9;">This day last year:</div>
        <div style="font-size: 1.2rem; font-weight: 600; margin-top: 5px;">
          ${lastYearMax}°C / ${lastYearMin}°C
        </div>
      </div>
    `;
  }

  const forecastHTML = daily.time.map((date, index) => `
    <div class="forecast-day" onclick="showDayDetails(${index})" style="cursor: pointer;">
      <div class="forecast-date">${formatDate(date)}</div>
      <div class="forecast-temp">
        ${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°
      </div>
      <div class="forecast-rain">
        💧 ${daily.precipitation_sum[index]} mm
      </div>
      <div style="font-size: 0.85rem; color: #64748b; margin-top: 5px;">
        ☀️ UV ${daily.uv_index_max[index] || 0}
      </div>
      <div style="font-size: 0.75rem; color: #667eea; margin-top: 8px; font-weight: 600;">
        Click for details →
      </div>
    </div>
  `).join('');

  const periodSelector = `
    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
      <button class="btn-period ${forecastDays === 7 ? 'active' : ''}" onclick="changeForecastPeriod(7)">7 Days</button>
      <button class="btn-period ${forecastDays === 14 ? 'active' : ''}" onclick="changeForecastPeriod(14)">14 Days</button>
      <button class="btn-period ${forecastDays === 16 ? 'active' : ''}" onclick="changeForecastPeriod(16)">16 Days</button>
    </div>
  `;

  weatherCard.innerHTML = `
    <div class="weather-header">
      <div class="location-name">
        📍 ${formatLocationLabel(location)}
      </div>
    </div>

    ${periodSelector}

    <!-- Tabs for different views -->
    <div class="tabs">
      <button class="tab active" data-tab="forecast">Forecast</button>
      <button class="tab" data-tab="hourly">Hourly Details</button>
      <button class="tab" data-tab="map">Map View</button>
    </div>

    <!-- Forecast Tab -->
    <div id="forecastTab" class="tab-content active">
      <div class="current-weather">
        <div class="current-temp">${Math.round(current.temperature_2m)}°C</div>
        <div style="font-size: 1.2rem; margin-bottom: 15px;">
          Feels like ${Math.round(current.apparent_temperature)}°C
        </div>
        <div class="weather-details">
          <div class="weather-detail">
            <span class="detail-icon">💧</span>
            <span>${current.relative_humidity_2m}% Humidity</span>
          </div>
          <div class="weather-detail">
            <span class="detail-icon">💨</span>
            <span>${Math.round(current.wind_speed_10m)} km/h ${getWindDirection(current.wind_direction_10m)}</span>
          </div>
          <div class="weather-detail">
            <span class="detail-icon">☀️</span>
            <span>UV Index ${current.uv_index || 0}</span>
          </div>
          ${current.precipitation ? `
          <div class="weather-detail">
            <span class="detail-icon">🌧️</span>
            <span>${current.precipitation} mm Rain</span>
          </div>
          ` : ''}
        </div>
        ${historicalHTML}
      </div>

      <div class="charts-section">
        <div class="chart-container">
          <div class="chart-title">🌡️ Temperature Forecast (${forecastDays} Days)</div>
          <div class="chart-wrapper">
            <canvas id="temperatureChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">💧 Precipitation Forecast</div>
          <div class="chart-wrapper">
            <canvas id="precipitationChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">☀️ UV Index</div>
          <div class="chart-wrapper">
            <canvas id="uvChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">🌅 Sunrise & Sunset Times</div>
          <div id="sunTimesContainer" class="sun-times-grid"></div>
        </div>
      </div>

      <div class="forecast-section">
        <div class="forecast-title">📅 ${forecastDays}-Day Summary (Click any day for details)</div>
        <div class="forecast-grid">
          ${forecastHTML}
        </div>
      </div>
    </div>

    <!-- Hourly Tab -->
    <div id="hourlyTab" class="tab-content">
      <div class="charts-section">
        <div class="chart-container">
          <div class="chart-title">🌡️ Hourly Temperature (Next 48 Hours)</div>
          <div class="chart-wrapper large">
            <canvas id="hourlyTempChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">💧 Hourly Humidity (Next 48 Hours)</div>
          <div class="chart-wrapper large">
            <canvas id="hourlyHumidityChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">💨 Wind Speed & Direction (Next 48 Hours)</div>
          <div class="chart-wrapper large">
            <canvas id="hourlyWindChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">🌡️ Feels Like Temperature (Next 48 Hours)</div>
          <div class="chart-wrapper large">
            <canvas id="feelsLikeChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Tab -->
    <div id="mapTab" class="tab-content">
      <div id="map"></div>
      <p style="margin-top: 15px; color: #64748b; text-align: center;">
        Click anywhere on the map to see weather at that location
      </p>
    </div>

    <!-- Day Details Modal -->
    <div id="dayModal" class="modal hidden">
      <div class="modal-content">
        <span class="modal-close" onclick="closeDayModal()">&times;</span>
        <div id="dayModalContent"></div>
      </div>
    </div>
  `;

  weatherCard.classList.remove('hidden');
  weatherCard.style.display = 'block';

  // Setup tabs
  setupTabs();

  // Create charts after DOM is updated
  setTimeout(() => {
    createTemperatureChart(daily);
    createPrecipitationChart(daily);
    createUVChart(daily);
    createSunTimesDisplay(daily);
    createHourlyCharts(hourly);
    initializeMap(location);
  }, 100);
}

// Setup tab switching
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active to clicked tab
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      document.getElementById(`${tabName}Tab`).classList.add('active');
      
      // Invalidate map size if switching to map tab
      if (tabName === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
      }
    });
  });
}

// Initialize Leaflet map
function initializeMap(location) {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  // Clear existing map
  if (map) {
    map.remove();
  }

  // Create map
  map = L.map('map').setView([location.latitude, location.longitude], 10);

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Add marker for selected location
  const marker = L.marker([location.latitude, location.longitude]).addTo(map);
  marker.bindPopup(`
    <div class="popup-location">${formatLocationLabel(location)}</div>
    <div class="popup-details">Click anywhere on the map to check weather</div>
  `).openPopup();

  markers.push(marker);

  // Add click handler for map
  map.on('click', async function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    try {
      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const data = await response.json();

      const newMarker = L.marker([lat, lon]).addTo(map);
      newMarker.bindPopup(`
        <div class="popup-location">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</div>
        <div class="popup-temp">${Math.round(data.current.temperature_2m)}°C</div>
        <div class="popup-details">
          Feels like: ${Math.round(data.current.apparent_temperature)}°C<br>
          Humidity: ${data.current.relative_humidity_2m}%<br>
          Wind: ${Math.round(data.current.wind_speed_10m)} km/h
        </div>
      `).openPopup();

      markers.push(newMarker);
    } catch (error) {
      console.error('Failed to fetch weather for map location:', error);
    }
  });
}

// Show day details in modal
window.showDayDetails = function(dayIndex) {
  if (!currentWeatherData) return;
  
  const { daily, hourly } = currentWeatherData;
  const dayDate = daily.time[dayIndex];
  
  // Get hourly data for this specific day
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  const dayHourlyLabels = [];
  const dayHourlyTemp = [];
  const dayHourlyHumidity = [];
  const dayHourlyWind = [];
  
  hourly.time.forEach((time, i) => {
    const timeDate = new Date(time);
    if (timeDate >= dayStart && timeDate <= dayEnd) {
      dayHourlyLabels.push(formatTime(time));
      dayHourlyTemp.push(hourly.temperature_2m[i]);
      dayHourlyHumidity.push(hourly.relative_humidity_2m[i]);
      dayHourlyWind.push(hourly.wind_speed_10m[i]);
    }
  });

  const modal = document.getElementById('dayModal');
  const content = document.getElementById('dayModalContent');
  
  content.innerHTML = `
    <h2 style="margin-bottom: 20px; color: #1e293b;">📅 ${formatDateFull(dayDate)}</h2>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white; margin-bottom: 25px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px;">
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">High</div>
          <div style="font-size: 2rem; font-weight: 700;">${Math.round(daily.temperature_2m_max[dayIndex])}°C</div>
        </div>
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Low</div>
          <div style="font-size: 2rem; font-weight: 700;">${Math.round(daily.temperature_2m_min[dayIndex])}°C</div>
        </div>
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Precipitation</div>
          <div style="font-size: 2rem; font-weight: 700;">${daily.precipitation_sum[dayIndex]} mm</div>
        </div>
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">UV Index</div>
          <div style="font-size: 2rem; font-weight: 700;">${daily.uv_index_max[dayIndex] || 0}</div>
        </div>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3);">
        <div style="display: flex; gap: 30px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 0.9rem; opacity: 0.9;">🌅 Sunrise:</span>
            <span style="font-weight: 600; margin-left: 8px;">${new Date(daily.sunrise[dayIndex]).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</span>
          </div>
          <div>
            <span style="font-size: 0.9rem; opacity: 0.9;">🌇 Sunset:</span>
            <span style="font-weight: 600; margin-left: 8px;">${new Date(daily.sunset[dayIndex]).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</span>
          </div>
          <div>
            <span style="font-size: 0.9rem; opacity: 0.9;">💨 Max Wind:</span>
            <span style="font-weight: 600; margin-left: 8px;">${Math.round(daily.wind_speed_10m_max[dayIndex])} km/h</span>
          </div>
        </div>
      </div>
    </div>
    
    ${dayHourlyLabels.length > 0 ? `
      <div class="chart-container">
        <div class="chart-title">🌡️ Hourly Temperature</div>
        <div class="chart-wrapper">
          <canvas id="dayTempChart"></canvas>
        </div>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">💧 Hourly Humidity</div>
        <div class="chart-wrapper">
          <canvas id="dayHumidityChart"></canvas>
        </div>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">💨 Hourly Wind Speed</div>
        <div class="chart-wrapper">
          <canvas id="dayWindChart"></canvas>
        </div>
      </div>
    ` : '<p style="text-align: center; color: #64748b;">Hourly data not available for this day</p>'}
  `;
  
  modal.classList.remove('hidden');
  
  // Create day-specific charts
  if (dayHourlyLabels.length > 0) {
    setTimeout(() => {
      createDayChart('dayTempChart', dayHourlyLabels, dayHourlyTemp, '°C', '#667eea');
      createDayChart('dayHumidityChart', dayHourlyLabels, dayHourlyHumidity, '%', '#3b82f6');
      createDayChart('dayWindChart', dayHourlyLabels, dayHourlyWind, ' km/h', '#10b981');
    }, 100);
  }
};

// Close day modal
window.closeDayModal = function() {
  document.getElementById('dayModal').classList.add('hidden');
};

// Change forecast period
window.changeForecastPeriod = function(days) {
  forecastDays = days;
  getWeather(days);
};

// Event listeners
searchBtn.addEventListener('click', searchLocations);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchLocations();
});
getWeatherBtn.addEventListener('click', () => getWeather());
locationSelect.addEventListener('change', () => {
  getWeatherBtn.disabled = locationSelect.value === '';
});