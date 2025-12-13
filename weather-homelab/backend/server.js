import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/health", (_req, res) => res.status(200).send("ok"));

// Geocoding endpoint
app.get("/api/geo", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "Missing query param: q" });

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const r = await fetch(url);
  if (!r.ok) return res.status(502).json({ error: "Geocoding upstream failed" });

  const data = await r.json();
  res.json(data);
});

// Enhanced weather endpoint with more data
app.get("/api/weather", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Provide numeric lat and lon" });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  
  // Current weather with more details
  url.searchParams.set("current", 
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,uv_index"
  );
  
  // Daily forecast with more details
  url.searchParams.set("daily", 
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,wind_speed_10m_max"
  );
  
  // Hourly data for detailed charts
  url.searchParams.set("hourly",
    "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,uv_index"
  );
  
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const r = await fetch(url);
  if (!r.ok) return res.status(502).json({ error: "Weather upstream failed" });

  const data = await r.json();
  res.json(data);
});

// Historical weather endpoint - "Weather on this day last year"
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

  const r = await fetch(url);
  if (!r.ok) return res.status(502).json({ error: "Historical weather upstream failed" });

  const data = await r.json();
  res.json(data);
});

// Multi-location comparison endpoint
app.get("/api/weather/compare", async (req, res) => {
  const locations = req.query.locations; // Expected format: "lat1,lon1;lat2,lon2;lat3,lon3"
  
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
      if (!r.ok) throw new Error("Weather fetch failed");
      
      return {
        latitude: lat,
        longitude: lon,
        data: await r.json()
      };
    });

    const results = await Promise.all(weatherPromises);
    res.json({ locations: results });
  } catch (error) {
    res.status(502).json({ error: "Comparison fetch failed" });
  }
});

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));