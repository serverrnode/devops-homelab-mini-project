# 🌤️ Weather Homelab App

A small weather web application built as a learning project while exploring DevOps fundamentals in my free time.

The app allows users to search for a city or country, select a location, and view the current weather and a simple forecast.

It is fully containerised with Docker and validated using GitHub Actions CI.

---

## Features
- Search for cities and countries
- Select from multiple matching locations
- View current weather conditions
- View a simple daily forecast
- Frontend + backend running in Docker containers

---

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (served with Nginx)
- **Backend**: Node.js (Express)
- **Weather data**: Open-Meteo (free, no API key required)
- **Containers**: Docker & Docker Compose
- **CI**: GitHub Actions

---

## Project Structure
```text
weather-homelab/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## Try it locally

### Prerequisites
You will need:
- Docker
- Docker Compose
- Git

### Run the app
```bash
git clone https://github.com/serverrnode/devops-homelab-mini-project.git
cd devops-homelab-mini-project/weather-homelab
docker compose up -d --build
```

Open in your browser:
```
http://localhost:8085
```

---

## API Endpoints
- `GET /api/geo?q=<city>`  
  Search for locations by name

- `GET /api/weather?lat=<lat>&lon=<lon>`  
  Returns current weather and a simple daily forecast

---

## CI (GitHub Actions)
A GitHub Actions workflow runs automatically on every push that affects this project.

The pipeline:
- Builds Docker images
- Starts the application using Docker Compose
- Performs basic smoke tests against the API
- Shuts everything down cleanly

This ensures the application builds and starts correctly on every change.

---

## Why Docker?
Docker is used so anyone can run the app locally without installing Node.js, Nginx, or other dependencies.
Everything needed to run the app is included in the containers.

---

## Notes
This project was built as a learning exercise while getting started with DevOps concepts.
The focus is on containerisation, CI pipelines, and running applications in a homelab environment.

---

## Future Improvements
- Automated deployment to a homelab server
- Monitoring and metrics
- Kubernetes deployment
