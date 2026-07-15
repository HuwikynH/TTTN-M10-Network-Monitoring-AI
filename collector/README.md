# Collector

Thu muc nay chua cac collector gui metric ve backend `POST /api/v1/metrics`.

## collector.py

Collector Sprint 1 toi gian, chi do ping latency va packet loss cho mot thiet bi.

```powershell
cd C:\Users\huuhu\Desktop\TTTN-M10-Network-Monitoring-AI\collector
python -m pip install -r requirements.txt
$env:DEVICE_ID="1"
$env:TARGET_HOST="8.8.8.8"
python collector.py
```

## collectorH.py

Collector dung cho lab EVE hien tai. Script thu thap ping, SNMP CPU/RAM/traffic tu DIST, CORE, ASAv, DMZ-SERVER, SW; ghi vao `network_dataset.json`; dong thoi POST metric ve backend.

Chay backend truoc tai `http://localhost:8000`, sau do:

```powershell
cd C:\Users\huuhu\Desktop\TTTN-M10-Network-Monitoring-AI\collector
python -m pip install -r requirements.txt
python collectorH.py
```

Neu backend dung URL khac:

```powershell
$env:BACKEND_API_URL="http://localhost:8000/api/v1"
python collectorH.py
```
