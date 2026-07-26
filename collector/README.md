# Collector

Thu muc nay chua collector gui metric ve backend `POST /api/v1/metrics`.

Collector dung cho lab EVE hien tai. Script thu thap ping, SNMP CPU/RAM/traffic tu DIST, CORE, ASAv, DMZ-SERVER, SW; ghi vao `network_dataset.json`; dong thoi POST metric ve backend.

Chay backend truoc tai `http://localhost:8000`, sau do:

```powershell
cd C:\Users\huuhu\Desktop\TTTN-M10-Network-Monitoring-AI\collector
python -m pip install -r requirements.txt
python collectorH.py
```

Thu dataset AI theo tung kich ban:

```powershell
python collectorH.py --label normal --scenario baseline --output normal_train.json
python collectorH.py --label abnormal --scenario attack_test --output abnormal_train.json
python collectorH.py --label normal --scenario baseline --output normal_test.json
python collectorH.py --label abnormal --scenario attack_test --output abnormal_test.json
```

`label` la nhan dung de train AI (`normal` hoac `abnormal`). `scenario` la mo ta kich ban thu du lieu, vi du `baseline`, `stress_cpu`, `high_traffic`, `attack_test`.

## Tao tai that cho lab

`lab_load_generator.py` tao tai control-plane that bang ping va SNMP GET vao cac thiet bi EVE. Dung script nay khi can CPU/traffic nhay that tren dashboard. Mac dinh script chi target CORE, DIST, ASAv, SW va khong ban DMZ-SERVER de tranh lam server packet loss 100%.

Chay muc nhe:

```powershell
cd C:\Users\huuhu\Desktop\TTTN-M10-Network-Monitoring-AI\collector
python lab_load_generator.py --mode mixed --workers 10 --sleep 0.05
```

Neu muon an toan hon, chi tao SNMP load:

```powershell
python lab_load_generator.py --mode snmp --workers 20 --sleep 0.05
```

Tang len muc vua neu CPU van qua thap:

```powershell
python lab_load_generator.py --mode snmp --workers 40 --sleep 0.03
```

Muc manh, chi chay ngan 1-2 phut de tao bat thuong:

```powershell
python lab_load_generator.py --mode mixed --workers 50 --sleep 0.02 --duration 120
```

Chi target mot thiet bi de test tung buoc:

```powershell
python lab_load_generator.py --mode snmp --targets ASAv --workers 30 --sleep 0.03 --duration 60
python lab_load_generator.py --mode snmp --targets CORE --workers 30 --sleep 0.03 --duration 60
```

Dung bang `Ctrl + C`. Nen tang tu tu de tranh lam treo EVE. Neu script thay node bat dau mat ping, guard se tu pause tai trong 20 giay.

Neu backend dung URL khac:

```powershell
$env:BACKEND_API_URL="http://localhost:8000/api/v1"
python collectorH.py
```
