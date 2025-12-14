# 🚦 24/7 Traffic Simulator Setup Guide

## What This Does
Generates realistic traffic to your weather app **24/7**:

- ✅ 20 different cities randomly searched  
- ✅ 85% successful requests (realistic user behavior)  
- ❌ 15% error requests (bad data, missing params)  
- ⏱️ Realistic delays (2–10 seconds between sessions)  
- 📊 Live statistics every 50 requests  
- 🔁 Runs forever via **systemd** (auto-restart on crash)

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Upload Script
```bash
scp traffic-simulator.sh ubuntu@YOUR_SERVER:~/
chmod +x ~/traffic-simulator.sh
```

### Step 2: Test It
```bash
~/traffic-simulator.sh
# Press Ctrl+C to stop
```

### Step 3: Install as a Service
```bash
sudo cp ~/traffic-simulator.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable traffic-simulator
sudo systemctl start traffic-simulator
```

### Step 4: Verify
```bash
sudo systemctl status traffic-simulator
sudo journalctl -u traffic-simulator -f
```

---

## 🎛️ Useful Commands

```bash
# View logs
sudo journalctl -u traffic-simulator -f

# Stop service
sudo systemctl stop traffic-simulator

# Start service
sudo systemctl start traffic-simulator

# Restart service
sudo systemctl restart traffic-simulator
```

---

## 📊 What You'll See in Grafana

- **Total Requests:** Increasing ~6–10 req/min  
- **Error Rate:** Steady ~15%  
- **Response Time:** 50–200ms average  
- **Request Rate:** Smooth, consistent line  

Perfect for demos, dashboards, and alert testing.

---

## ⚙️ Customization

Edit `traffic-simulator.sh` to tune behavior.

### Increase Traffic
```bash
sleep $((RANDOM % 3 + 1))  # 1–3 seconds
```

### Increase Errors
```bash
if [ $((RANDOM % 100)) -lt 70 ]; then  # 70% success
```

---

## 📈 Enjoy Your Live Dashboard!
Your metrics should now look alive, realistic, and production-like.
