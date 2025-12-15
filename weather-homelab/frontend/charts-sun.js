// charts-sun.js
// Sun timeline cards (sunrise/sunset with visual daylight bar)

function createSunTimesDisplay(daily) {
  const container = document.getElementById('sunTimesContainer');
  if (!container) return;
  
  const html = daily.time.map((date, index) => {
    const sunrise = new Date(daily.sunrise[index]);
    const sunset = new Date(daily.sunset[index]);
    
    // Calculate daylight duration
    const daylightMs = sunset - sunrise;
    const hours = Math.floor(daylightMs / (1000 * 60 * 60));
    const minutes = Math.floor((daylightMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Calculate position on 24-hour timeline (0-1440 minutes)
    const sunriseMinutes = sunrise.getHours() * 60 + sunrise.getMinutes();
    const sunsetMinutes = sunset.getHours() * 60 + sunset.getMinutes();
    const leftPercent = (sunriseMinutes / 1440) * 100;
    const widthPercent = ((sunsetMinutes - sunriseMinutes) / 1440) * 100;
    
    return `
      <div class="sun-card">
        <div class="sun-date">${formatDate(date)}</div>
        <div class="timeline-bar">
          <div class="daylight-bar" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
        </div>
        <div class="sun-info">
          <span class="sun-time">ðŸŒ… ${sunrise.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</span>
          <span class="daylight-duration">${hours}h ${minutes}m</span>
          <span class="sun-time">ðŸŒ‡ ${sunset.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</span>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}