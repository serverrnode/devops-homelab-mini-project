import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

// Enhanced metrics tracking
let metrics = {
  requestCount: 0,
  requestsByEndpoint: {
    '/health': 0,
    '/api/geo': 0,
    '/api/weather': 0,
    '/api/weather/historical': 0,
    '/api/weather/compare': 0
  },
  // NEW: Track errors by endpoint
  errorsByEndpoint: {
    '/health': 0,
    '/api/geo': 0,
    '/api/weather': 0,
    '/api/weather/historical': 0,
    '/api/weather/compare': 0
  },
  // NEW: Track errors by status code
  errorsByStatus: {
    '400': 0,  // Bad request
    '429': 0,  // Rate limited
    '500': 0,  // Server error
    '502': 0,  // Bad gateway (upstream failure)
    '503': 0   // Service unavailable
  },
  // NEW: Track upstream API health
  upstreamStatus: {
    'open-meteo': {
      successCount: 0,
      errorCount: 0,
      lastError: null,
      lastSuccess: null
    },
    'geocoding': {
      successCount: 0,
      errorCount: 0,
      lastError: null,
      lastSuccess: null
    }
  },
  responseTimes: [],
  errors: 0,
  startTime: Date.now()
};

// Middleware to track requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  metrics.requestCount++;
  if (metrics.requestsByEndpoint[req.path] !== undefined) {
    metrics.requestsByEndpoint[req.path]++;
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.responseTimes.push(duration);
    
    // Keep only last 100 response times
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes.shift();
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.errors++;
      
      // Track by endpoint
      if (metrics.errorsByEndpoint[req.path] !== undefined) {
        metrics.errorsByEndpoint[req.path]++;
      }
      
      // Track by status code
      const statusKey = String(res.statusCode);
      if (metrics.errorsByStatus[statusKey] !== undefined) {
        metrics.errorsByStatus[statusKey]++;
      } else {
        // Track other error codes under 'other'
        if (!metrics.errorsByStatus['other']) {
          metrics.errorsByStatus['other'] = 0;
        }
        metrics.errorsByStatus['other']++;
      }
    }
  });
  
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Enhanced metrics endpoint for Prometheus
app.get("/metrics", (_req, res) => {
  const uptime = (Date.now() - metrics.startTime) / 1000; // seconds
  const avgResponseTime = metrics.responseTimes.length > 0
    ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
    : 0;
  
  // Prometheus format
  let prometheusMetrics = `
# HELP weather_app_requests_total Total number of requests
# TYPE weather_app_requests_total counter
weather_app_requests_total ${metrics.requestCount}

# HELP weather_app_requests_by_endpoint Requests per endpoint
# TYPE weather_app_requests_by_endpoint counter
weather_app_requests_by_endpoint{endpoint="/health"} ${metrics.requestsByEndpoint['/health']}
weather_app_requests_by_endpoint{endpoint="/api/geo"} ${metrics.requestsByEndpoint['/api/geo']}
weather_app_requests_by_endpoint{endpoint="/api/weather"} ${metrics.requestsByEndpoint['/api/weather']}
weather_app_requests_by_endpoint{endpoint="/api/weather/historical"} ${metrics.requestsByEndpoint['/api/weather/historical']}
weather_app_requests_by_endpoint{endpoint="/api/weather/compare"} ${metrics.requestsByEndpoint['/api/weather/compare']}

# HELP weather_app_errors_total Total number of errors (4xx, 5xx)
# TYPE weather_app_errors_total counter
weather_app_errors_total ${metrics.errors}

# HELP weather_app_errors_by_endpoint Errors per endpoint
# TYPE weather_app_errors_by_endpoint counter
weather_app_errors_by_endpoint{endpoint="/health"} ${metrics.errorsByEndpoint['/health']}
weather_app_errors_by_endpoint{endpoint="/api/geo"} ${metrics.errorsByEndpoint['/api/geo']}
weather_app_errors_by_endpoint{endpoint="/api/weather"} ${metrics.errorsByEndpoint['/api/weather']}
weather_app_errors_by_endpoint{endpoint="/api/weather/historical"} ${metrics.errorsByEndpoint['/api/weather/historical']}
weather_app_errors_by_endpoint{endpoint="/api/weather/compare"} ${metrics.errorsByEndpoint['/api/weather/compare']}

# HELP weather_app_errors_by_status Errors by HTTP status code
# TYPE weather_app_errors_by_status counter
weather_app_errors_by_status{status="400"} ${metrics.errorsByStatus['400']}
weather_app_errors_by_status{status="429"} ${metrics.errorsByStatus['429']}
weather_app_errors_by_status{status="500"} ${metrics.errorsByStatus['500']}
weather_app_errors_by_status{status="502"} ${metrics.errorsByStatus['502']}
weather_app_errors_by_status{status="503"} ${metrics.errorsByStatus['503']}
weather_app_errors_by_status{status="other"} ${metrics.errorsByStatus['other'] || 0}

# HELP weather_app_upstream_requests_total Upstream API requests
# TYPE weather_app_upstream_requests_total counter
weather_app_upstream_requests_total{upstream="open-meteo",status="success"} ${metrics.upstreamStatus['open-meteo'].successCount}
weather_app_upstream_requests_total{upstream="open-meteo",status="error"} ${metrics.upstreamStatus['open-meteo'].errorCount}
weather_app_upstream_requests_total{upstream="geocoding",status="success"} ${metrics.upstreamStatus['geocoding'].successCount}
weather_app_upstream_requests_total{upstream="geocoding",status="error"} ${metrics.upstreamStatus['geocoding'].errorCount}

# HELP weather_app_response_time_ms Average response time in milliseconds
# TYPE weather_app_response_time_ms gauge
weather_app_response_time_ms ${avgResponseTime.toFixed(2)}

# HELP weather_app_uptime_seconds Uptime in seconds
# TYPE weather_app_uptime_seconds gauge
weather_app_uptime_seconds ${uptime.toFixed(0)}

# HELP nodejs_memory_usage_bytes Node.js memory usage
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}
nodejs_memory_usage_bytes{type="external"} ${process.memoryUsage().external}
`;
  
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(prometheusMetrics.trim());
});

// Helper to track upstream calls
function trackUpstream(service, success, error = null) {
  if (success) {
    metrics.upstreamStatus[service].successCount++;
    metrics.upstreamStatus[service].lastSuccess = Date.now();
  } else {
    metrics.upstreamStatus[service].errorCount++;
    metrics.upstreamStatus[service].lastError = Date.now();
  }
}

// Geocoding endpoint
app.get("/api/geo", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "Missing query param: q" });

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const r = await fetch(url);
    if (!r.ok) {
      trackUpstream('geocoding', false);
      return res.status(502).json({ error: "Geocoding upstream failed" });
    }
    const data = await r.json();
    
    // Check for rate limit in response
    if (data.error) {
      trackUpstream('geocoding', false);
      return res.status(429).json({ 
        error: "Rate limit exceeded",
        details: data.reason || "Geocoding API rate limited"
      });
    }
    
    trackUpstream('geocoding', true);
    res.json(data);
  } catch (error) {
    trackUpstream('geocoding', false);
    res.status(502).json({ error: "Geocoding upstream failed" });
  }
});

// Enhanced weather endpoint with upstream tracking
app.get("/api/weather", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const days = Number(req.query.days) || 7;
  
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Provide numeric lat and lon" });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", 
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,uv_index"
  );
  url.searchParams.set("daily", 
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,wind_speed_10m_max"
  );
  url.searchParams.set("hourly",
    "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,uv_index"
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(days));

  try {
    const r = await fetch(url);
    if (!r.ok) {
      trackUpstream('open-meteo', false);
      const errorData = await r.json().catch(() => ({}));
      return res.status(502).json({ 
        error: "Weather upstream failed",
        details: errorData.reason || errorData.error || "Unknown error"
      });
    }
    const data = await r.json();
    
    // Check if API returned an error in the data (rate limit)
    if (data.error) {
      trackUpstream('open-meteo', false);
      return res.status(429).json({ 
        error: "Rate limit exceeded",
        details: data.reason || "Weather API request limit reached. Please try again later."
      });
    }
    
    trackUpstream('open-meteo', true);
    res.json(data);
  } catch (error) {
    trackUpstream('open-meteo', false);
    res.status(502).json({ 
      error: "Weather upstream failed",
      details: error.message 
    });
  }
});

// Historical weather endpoint with upstream tracking
app.get("/api/weather/historical", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Provide numeric lat and lon" });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Provide start_date and end_date (YYYY-MM-DD)" });
  }

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", 
    "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
  );
  url.searchParams.set("hourly",
    "temperature_2m,relative_humidity_2m"
  );
  url.searchParams.set("timezone", "auto");

  try {
    const r = await fetch(url);
    if (!r.ok) {
      trackUpstream('open-meteo', false);
      const errorData = await r.json().catch(() => ({}));
      return res.status(502).json({ 
        error: "Historical weather upstream failed",
        details: errorData.reason || errorData.error || "Unknown error"
      });
    }
    const data = await r.json();
    
    if (data.error) {
      trackUpstream('open-meteo', false);
      return res.status(429).json({ 
        error: "Rate limit exceeded",
        details: data.reason || "Historical API rate limited"
      });
    }
    
    trackUpstream('open-meteo', true);
    res.json(data);
  } catch (error) {
    trackUpstream('open-meteo', false);
    res.status(502).json({ 
      error: "Historical weather upstream failed",
      details: error.message 
    });
  }
});

// Multi-location comparison endpoint with upstream tracking
app.get("/api/weather/compare", async (req, res) => {
  const locations = req.query.locations;
  
  if (!locations) {
    return res.status(400).json({ error: "Provide locations parameter" });
  }

  const coords = locations.split(';').map(pair => {
    const [lat, lon] = pair.split(',').map(Number);
    return { lat, lon };
  });

  if (coords.some(c => !Number.isFinite(c.lat) || !Number.isFinite(c.lon))) {
    return res.status(400).json({ error: "Invalid coordinates format" });
  }

  try {
    const weatherPromises = coords.map(async ({ lat, lon }) => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("current", "temperature_2m,wind_speed_10m");
      url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "7");

      const r = await fetch(url);
      if (!r.ok) {
        trackUpstream('open-meteo', false);
        throw new Error("Weather fetch failed");
      }
      
      const data = await r.json();
      
      if (data.error) {
        trackUpstream('open-meteo', false);
        throw new Error("Rate limit exceeded");
      }
      
      trackUpstream('open-meteo', true);
      
      return {
        latitude: lat,
        longitude: lon,
        data: data
      };
    });

    const results = await Promise.all(weatherPromises);
    res.json({ locations: results });
  } catch (error) {
    if (error.message.includes("Rate limit")) {
      return res.status(429).json({ 
        error: "Rate limit exceeded",
        details: "Comparison API rate limited"
      });
    }
    res.status(502).json({ error: "Comparison fetch failed" });
  }
});

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));