import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/health", (_req, res) => res.status(200).send("ok"));

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

app.get("/api/weather", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Provide numeric lat and lon" });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");

  const r = await fetch(url);
  if (!r.ok) return res.status(502).json({ error: "Weather upstream failed" });

  const data = await r.json();
  res.json(data);
});

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
