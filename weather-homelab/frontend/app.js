const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationSelectGroup = document.getElementById('locationSelectGroup');
const locationSelect = document.getElementById('locationSelect');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const weatherCard = document.getElementById('weatherCard');

let locations = [];
let temperatureChart = null;
let precipitationChart = null;

function formatLocationLabel(location) {
  const parts = [location.name, location.admin1, location.country].filter(Boolean);
  return parts.join(', ');
}

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

    if (locations.length === 0) {
      weatherCard.innerHTML = `
        <div class="no-results">
          <p>No locations found for "<strong>${query}</strong>"</p>
          <p style="margin-top: 10px; color: #94a3b8;">Try searching for a different city or country</p>
        </div>
      `;
      weatherCard.classList.remove('hidden');
      locationSelectGroup.style.display = 'none';
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
  } finally {
    searchBtn.textContent = 'Search';
    searchBtn.disabled = false;
  }
}

async function getWeather() {
  const selectedIndex = locationSelect.value;
  if (selectedIndex === '') return;

  const location = locations[selectedIndex];

  try {
    getWeatherBtn.textContent = 'Loading...';
    getWeatherBtn.disabled = true;

    weatherCard.innerHTML = '<div class="loading">Loading weather data...</div>';
    weatherCard.classList.remove('hidden');

    const response = await fetch(
      `/api/weather?lat=${location.latitude}&lon=${location.longitude}`
    );
    const data = await response.json();

    displayWeather(location, data);

  } catch (error) {
    weatherCard.innerHTML = `
      <div class="error">
        <strong>Error:</strong> Failed to fetch weather data. Please try again.
      </div>
    `;
  } finally {
    getWeatherBtn.textContent = 'Get Weather';
    getWeatherBtn.disabled = false;
  }
}

function displayWeather(location, data) {
  const { current, daily } = data;

  const forecastHTML = daily.time.map((date, index) => `
    <div class="forecast-day">
      <div class="forecast-date">${formatDate(date)}</div>
      <div class="forecast-temp">
        ${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°
      </div>
      <div class="forecast-rain">
        💧 ${daily.precipitation_sum[index]} mm
      </div>
    </div>
  `).join('');

  weatherCard.innerHTML = `
    <div class="weather-header">
      <div class="location-name">
        📍 ${formatLocationLabel(location)}
      </div>
    </div>

    <div class="current-weather">
      <div class="current-temp">${Math.round(current.temperature_2m)}°C</div>
      <div class="weather-details">
        <div class="weather-detail">
          <span class="detail-icon">💧</span>
          <span>${current.relative_humidity_2m}% Humidity</span>
        </div>
        <div class="weather-detail">
          <span class="detail-icon">💨</span>
          <span>${Math.round(current.wind_speed_10m)} km/h Wind</span>
        </div>
      </div>
    </div>

    <div class="charts-section">
      <div class="chart-container">
        <div class="chart-title">🌡️ Temperature Forecast</div>
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
    </div>

    <div class="forecast-section">
      <div class="forecast-title">📅 7-Day Summary</div>
      <div class="forecast-grid">
        ${forecastHTML}
      </div>
    </div>
  `;

  weatherCard.classList.remove('hidden');

  // Create charts after DOM is updated
  setTimeout(() => {
    createTemperatureChart(daily);
    createPrecipitationChart(daily);
  }, 100);
}

function createTemperatureChart(daily) {
  const ctx = document.getElementById('temperatureChart');
  if (!ctx) return;

  // Destroy existing chart if it exists
  if (temperatureChart) {
    temperatureChart.destroy();
  }

  const labels = daily.time.map(date => formatDate(date));

  temperatureChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Max Temperature',
          data: daily.temperature_2m_max,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        },
        {
          label: 'Min Temperature',
          data: daily.temperature_2m_min,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }
      ]
    },
    options: {
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
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + Math.round(context.parsed.y) + '°C';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            callback: function(value) {
              return value + '°C';
            },
            font: {
              size: 11
            }
          }
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11
            }
          }
        }
      }
    }
  });
}

function createPrecipitationChart(daily) {
  const ctx = document.getElementById('precipitationChart');
  if (!ctx) return;

  // Destroy existing chart if it exists
  if (precipitationChart) {
    precipitationChart.destroy();
  }

  const labels = daily.time.map(date => formatDate(date));

  precipitationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Precipitation',
        data: daily.precipitation_sum,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              return 'Precipitation: ' + context.parsed.y + ' mm';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            callback: function(value) {
              return value + ' mm';
            },
            font: {
              size: 11
            }
          }
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11
            }
          }
        }
      }
    }
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

// Event listeners
searchBtn.addEventListener('click', searchLocations);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchLocations();
});
getWeatherBtn.addEventListener('click', getWeather);
locationSelect.addEventListener('change', () => {
  getWeatherBtn.disabled = locationSelect.value === '';
});