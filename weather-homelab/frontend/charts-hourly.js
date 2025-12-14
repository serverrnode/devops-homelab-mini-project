function createHourlyCharts(hourly) {
  // Limit to next 48 hours
  const next48Hours = 48;
  const labels = hourly.time.slice(0, next48Hours).map(time => formatTime(time));
  
  // Hourly temperature
  const tempCtx = document.getElementById('hourlyTempChart');
  if (tempCtx) {
    if (charts.hourlyTemp) charts.hourlyTemp.destroy();
    
    charts.hourlyTemp = new Chart(tempCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Temperature',
          data: hourly.temperature_2m.slice(0, next48Hours),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        }]
      },
      options: getHourlyChartOptions('°C')
    });
  }

  // Hourly humidity
  const humidityCtx = document.getElementById('hourlyHumidityChart');
  if (humidityCtx) {
    if (charts.humidity) charts.humidity.destroy();
    
    charts.humidity = new Chart(humidityCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Humidity',
          data: hourly.relative_humidity_2m.slice(0, next48Hours),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        }]
      },
      options: getHourlyChartOptions('%')
    });
  }

  // Hourly wind
  const windCtx = document.getElementById('hourlyWindChart');
  if (windCtx) {
    if (charts.wind) charts.wind.destroy();
    
    charts.wind = new Chart(windCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Wind Speed',
          data: hourly.wind_speed_10m.slice(0, next48Hours),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        }]
      },
      options: getHourlyChartOptions('km/h')
    });
  }

  // Feels like temperature
  const feelsLikeCtx = document.getElementById('feelsLikeChart');
  if (feelsLikeCtx) {
    if (charts.feelsLike) charts.feelsLike.destroy();
    
    charts.feelsLike = new Chart(feelsLikeCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Actual Temperature',
            data: hourly.temperature_2m.slice(0, next48Hours),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 2,
          },
          {
            label: 'Feels Like',
            data: hourly.apparent_temperature.slice(0, next48Hours),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 2,
          }
        ]
      },
      options: getHourlyChartOptions('°C')
    });
  }
}

function getHourlyChartOptions(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
      }
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value) {
            return value + unit;
          },
          font: {
            size: 10
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 9
          }
        }
      }
    }
  };
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