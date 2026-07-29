import argparse
import json
import time
import datetime
import subprocess
import platform
import re
import asyncio
import os
import urllib.error
import urllib.request
from pysnmp.hlapi.asyncio import *


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_local_env(path):
    """Load simple KEY=VALUE entries without adding a Kali dependency."""
    if not os.path.isfile(path):
        return

    with open(path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                value = value[1:-1]
            if key and key.replace("_", "").isalnum():
                os.environ.setdefault(key, value)


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


load_local_env(os.path.join(BASE_DIR, ".env"))

RAW_SNMP_DEBUG = env_bool("RAW_SNMP_DEBUG", False)
PRINT_DEVICE_SUMMARY = env_bool("PRINT_DEVICE_SUMMARY", True)
VERBOSE_PROGRESS = env_bool("VERBOSE_PROGRESS", False)
DEMO_NORMALIZE_CPU = env_bool("DEMO_NORMALIZE_CPU", False)

# Cach chuan hoa cac thong so duong:
# - "minimum_one": chi doi 0 < gia tri < 1 thanh 1.0 (khuyen nghi)
# - "all_one": moi gia tri > 0 deu thanh 1.0 (se lam mat du lieu AI)
# - "off": giu nguyen gia tri SNMP
POSITIVE_METRIC_MODE = os.getenv("POSITIVE_METRIC_MODE", "off").strip().lower()
if POSITIVE_METRIC_MODE not in {"minimum_one", "all_one", "off"}:
    raise ValueError(
        "POSITIVE_METRIC_MODE must be minimum_one, all_one, or off"
    )

POST_TO_BACKEND = env_bool("POST_TO_BACKEND", True)
BACKEND_API_URL = os.getenv(
    "BACKEND_API_URL", "http://127.0.0.1:8000/api/v1"
).rstrip("/")
BACKEND_TIMEOUT_SECONDS = max(
    1.0, float(os.getenv("BACKEND_TIMEOUT_SECONDS", "10"))
)
LAB_SOURCE = os.getenv("LAB_SOURCE", "huynh_lab").strip() or "huynh_lab"
DATASET_LABEL = os.getenv("DATASET_LABEL", "normal").strip() or "normal"
DATASET_SCENARIO = os.getenv("DATASET_SCENARIO", "baseline").strip() or "baseline"
DATASET_OUTPUT = (
    os.getenv("DATASET_OUTPUT", "network_dataset.json").strip()
    or "network_dataset.json"
)

CPU_DEMO_RANGES = {
    "CORE": (1.0, 2.5),
    "SW": (0.8, 2.0),
    "ASAv": (1.0, 3.0),
    "DMZ-SERVER": (1.0, 3.5),
}

# ==========================================
# 1. CẤU HÌNH THÔNG SỐ VÀ TỪ ĐIỂN OID
# ==========================================

DEVICES = [
    {"name": "DIST", "ip": "10.0.3.254", "community": "public", "os_type": "mikrotik", "device_type": "router", "interface_name": "eth3"},
    {"name": "CORE", "ip": "10.0.2.1", "community": "public", "os_type": "mikrotik", "device_type": "router", "interface_name": "eth1"},
    {"name": "ASAv", "ip": "10.0.1.5", "community": "public", "os_type": "asa", "device_type": "firewall", "interface_name": "inside"},
    {"name": "DMZ-SERVER", "ip": "10.20.20.10", "community": "public", "os_type": "mikrotik", "device_type": "server", "interface_name": "ether1"},
    {"name": "SW", "ip": "10.0.10.2", "community": "public", "os_type": "mikrotik", "device_type": "switch", "interface_name": "bridge-lan"}
]

OIDS = {
    "common": {
        "uptime": "1.3.6.1.2.1.1.3.0",
        "ifStatus": "1.3.6.1.2.1.2.2.1.8"
    },
    "mikrotik": {
        # CPU: dùng hrProcessorLoad (HOST-RESOURCES-MIB) - OID chuẩn, đã kiểm chứng hoạt động trên RouterOS
        "cpu_5min": "1.3.6.1.2.1.25.3.3.1.2.1",
        # RAM: hrStorage (HOST-RESOURCES-MIB), index 65536 = RAM trên RouterOS
        "mem_total": "1.3.6.1.2.1.25.2.3.1.5.65536",
        "mem_used": "1.3.6.1.2.1.25.2.3.1.6.65536",
        "if_in": "1.3.6.1.2.1.31.1.1.1.6",
        "if_out": "1.3.6.1.2.1.31.1.1.1.10"
    },
    "asa": {
        "cpu_5sec": "1.3.6.1.4.1.9.9.109.1.1.1.1.6",
        "cpu_1min": "1.3.6.1.4.1.9.9.109.1.1.1.1.7",
        "cpu_5min": "1.3.6.1.4.1.9.9.109.1.1.1.1.8",
        "mem_name_walk": "1.3.6.1.4.1.9.9.48.1.1.1.2",
        "mem_used_base": "1.3.6.1.4.1.9.9.48.1.1.1.5",
        "mem_free_base": "1.3.6.1.4.1.9.9.48.1.1.1.6",
        "if_in": "1.3.6.1.2.1.31.1.1.1.6",
        "if_out": "1.3.6.1.2.1.31.1.1.1.10"
    },
    "ios": {
        "cpu_5min": "1.3.6.1.4.1.9.9.109.1.1.1.1.5.1",
        "mem_used": "1.3.6.1.4.1.9.9.48.1.1.1.5.1",
        "mem_free": "1.3.6.1.4.1.9.9.48.1.1.1.6.1",
        "if_in": "1.3.6.1.2.1.2.2.1.10",
        "if_out": "1.3.6.1.2.1.2.2.1.16"
    }
}

INTERVAL_SECONDS = max(0.5, float(os.getenv("COLLECTOR_INTERVAL_SECONDS", "1")))
TRAFFIC_SAMPLE_DELAY = max(0.5, float(os.getenv("TRAFFIC_SAMPLE_DELAY", "1")))

# Bật để in ra raw response từng OID -> giúp xác định OID sai hay thiết bị rớt gói
DEBUG = RAW_SNMP_DEBUG

# Giới hạn số phiên SNMP chạy đồng thời trên toàn hệ thống. ASAv/IOL trong lab
# ảo hoá rất dễ rớt gói nếu nhận nhiều SNMP request cùng lúc.
SNMP_CONCURRENCY = max(1, int(os.getenv("SNMP_CONCURRENCY", "4")))
SNMP_SEMAPHORE = asyncio.Semaphore(SNMP_CONCURRENCY)


def safe_float(value, default=0.0):
    """Chuyển an toàn sang float. Nếu SNMP trả None/rỗng/không hợp lệ (VD: OID sai,
    noSuchInstance, chuỗi rỗng b'') thì trả về giá trị mặc định thay vì crash."""
    if value is None:
        return default
    try:
        s = str(value).strip()
        if s == "":
            return default
        return float(s)
    except (ValueError, TypeError):
        return default


def normalize_positive_metric(value):
    """Chuan hoa metric duong theo POSITIVE_METRIC_MODE."""
    value = safe_float(value)

    if POSITIVE_METRIC_MODE == "all_one":
        return 1.0 if value > 0 else 0.0

    if POSITIVE_METRIC_MODE == "minimum_one":
        return 1.0 if 0 < value < 1 else value

    return value


def normalize_demo_cpu(device_name, cpu_percent):
    if not DEMO_NORMALIZE_CPU or cpu_percent > 0:
        return cpu_percent, "snmp"

    low, high = CPU_DEMO_RANGES.get(device_name, (1.0, 3.0))
    steps = int((high - low) * 10)
    if steps <= 0:
        return round(low, 1), "synthetic"

    bucket = int(time.time() // max(INTERVAL_SECONDS, 1))
    name_seed = sum(ord(ch) for ch in device_name)
    value = low + ((bucket + name_seed) % (steps + 1)) / 10
    return round(value, 1), "synthetic"


def post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(
        request, timeout=BACKEND_TIMEOUT_SECONDS
    ) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else None


async def ensure_backend_device(record):
    payload = {
        "name": record["device_name"],
        "ip_address": record["ip_address"],
        "location": record["lab_source"],
        "status": record["status"],
    }
    try:
        await asyncio.to_thread(post_json, f"{BACKEND_API_URL}/devices", payload)
        print(f"[API] created device {record['device_name']} ({record['ip_address']})")
    except urllib.error.HTTPError as error:
        if error.code != 409:
            raise


async def post_metric_to_backend(record):
    payload = {
        "ip_address": record["ip_address"],
        "latency_ms": record["latency_ms"],
        "packet_loss_percent": record["packet_loss_percent"],
        "cpu_percent": record["cpu_percent"],
        "memory_percent": record["memory_percent"],
        "traffic_in_mbps": record["traffic_in_mbps"],
        "traffic_out_mbps": record["traffic_out_mbps"],
        "bandwidth_mbps": round(record["traffic_in_mbps"] + record["traffic_out_mbps"], 2),
    }

    try:
        metric = await asyncio.to_thread(post_json, f"{BACKEND_API_URL}/metrics", payload)
        print(f"[API] metric #{metric['id']} -> {record['device_name']}")
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        await ensure_backend_device(record)
        metric = await asyncio.to_thread(post_json, f"{BACKEND_API_URL}/metrics", payload)
        print(f"[API] metric #{metric['id']} -> {record['device_name']} after device register")

# ==========================================
# 2. CÁC HÀM GIAO TIẾP SNMP (ASYNC/AWAIT)
# ==========================================

async def get_snmp_data(ip, oid, community="public", label=""):
    """Lấy 1 giá trị SNMP (GET). Trả về None nếu lỗi."""
    async with SNMP_SEMAPHORE:
        try:
            errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
                SnmpEngine(),
                CommunityData(community, mpModel=1),
                await UdpTransportTarget.create((ip, 161), timeout=3, retries=2),
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )

            if errorIndication or errorStatus:
                if DEBUG:
                    print(f"    [DEBUG] {ip} {label} OID={oid} -> LỖI: errorIndication={errorIndication} errorStatus={errorStatus}")
                return None

            for varBind in varBinds:
                value = varBind[1]
                if DEBUG:
                    print(f"    [DEBUG] {ip} {label} OID={oid} -> value={value!r} (type={type(value).__name__})")
                # Một số thiết bị trả noSuchInstance/noSuchObject NGAY TRONG giá trị
                # thay vì báo errorStatus -> phải bắt riêng, nếu không sẽ bị ép về 0 âm thầm
                if "NoSuch" in type(value).__name__:
                    return None
                return value
            return None
        except Exception as e:
            if DEBUG:
                print(f"    [DEBUG] {ip} {label} OID={oid} -> EXCEPTION: {e}")
            return None


async def get_snmp_walk(ip, base_oid, community="public", label=""):
    """Đi bộ (WALK) toàn bộ 1 nhánh OID. Trả về dict {index: value}."""
    results = {}
    async with SNMP_SEMAPHORE:
        try:
            transport = await UdpTransportTarget.create((ip, 161), timeout=3, retries=2)
            async for errorIndication, errorStatus, errorIndex, varBinds in walk_cmd(
                SnmpEngine(),
                CommunityData(community, mpModel=1),
                transport,
                ContextData(),
                ObjectType(ObjectIdentity(base_oid)),
                lexicographicMode=False
            ):
                if errorIndication or errorStatus:
                    if DEBUG:
                        print(f"    [DEBUG] {ip} {label} WALK {base_oid} -> LỖI: errorIndication={errorIndication} errorStatus={errorStatus}")
                    break
                for varBind in varBinds:
                    oid_str = str(varBind[0])
                    idx = oid_str.split('.')[-1]
                    results[idx] = varBind[1]
            if DEBUG:
                print(f"    [DEBUG] {ip} {label} WALK {base_oid} -> {len(results)} kết quả")
        except Exception as e:
            if DEBUG:
                print(f"    [DEBUG] {ip} {label} WALK {base_oid} -> EXCEPTION: {e}")
    return results


async def ping_device(ip):
    """Ping vẫn là lệnh blocking -> chạy trong thread riêng để không chặn event loop."""
    def _ping():
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        cmd = ['ping', param, '4', ip]
        latency, packet_loss, status = 0.0, 100.0, "DOWN"
        try:
            output = subprocess.check_output(cmd, stderr=subprocess.STDOUT, universal_newlines=True)
            status = "UP"
            if platform.system().lower() == 'windows':
                loss_match = re.search(r'\((\d+)% loss', output)
                if loss_match: packet_loss = float(loss_match.group(1))
                lat_match = re.search(r'Average = (\d+)ms', output)
                if lat_match: latency = float(lat_match.group(1))
            else:
                loss_match = re.search(r'(\d+)% packet loss', output)
                if loss_match: packet_loss = float(loss_match.group(1))
                lat_match = re.search(r'rtt min/avg/max/mdev = [\d\.]+/(.*?)/', output)
                if lat_match: latency = float(lat_match.group(1))
        except Exception:
            pass
        return status, latency, packet_loss

    return await asyncio.to_thread(_ping)


async def get_asa_memory_index(ip, community):
    mem_names = await get_snmp_walk(ip, OIDS['asa']['mem_name_walk'], community)
    for idx, name_obj in mem_names.items():
        if "System memory" in str(name_obj):
            return idx
    return "1"


async def get_first_walk_number(ip, base_oid, community, label=""):
    values = await get_snmp_walk(ip, base_oid, community, label=label)
    for idx in sorted(values, key=lambda x: int(x) if str(x).isdigit() else str(x)):
        value = safe_float(values[idx], default=None)
        if value is not None:
            return value, idx
    return None, None


async def get_interfaces_traffic_bytes(ip, community, os_type):
    statuses, in_octets, out_octets = await asyncio.gather(
        get_snmp_walk(ip, OIDS['common']['ifStatus'], community, label="IF_STATUS"),
        get_snmp_walk(ip, OIDS[os_type]['if_in'], community, label="IF_IN"),
        get_snmp_walk(ip, OIDS[os_type]['if_out'], community, label="IF_OUT")
    )

    total_in, total_out = 0, 0
    for idx, status in statuses.items():
        if int(status) == 1:
            total_in += int(in_octets.get(idx, 0))
            total_out += int(out_octets.get(idx, 0))
    return total_in, total_out


# ==========================================
# 3. XỬ LÝ THEO TỪNG LOẠI THIẾT BỊ (CPU/RAM)
# ==========================================

async def get_cpu_mem_mikrotik(ip, community):
    cpu_val, mem_total_val, mem_used_val = await asyncio.gather(
        get_snmp_data(ip, OIDS['mikrotik']['cpu_5min'], community, label="CPU"),
        get_snmp_data(ip, OIDS['mikrotik']['mem_total'], community, label="MEM_TOTAL"),
        get_snmp_data(ip, OIDS['mikrotik']['mem_used'], community, label="MEM_USED")
    )

    cpu_percent = safe_float(cpu_val)

    mem_total = safe_float(mem_total_val)
    mem_used = safe_float(mem_used_val)
    mem_percent = 0.0
    if mem_total > 0:
        mem_percent = round((mem_used / mem_total) * 100, 2)

    return cpu_percent, mem_percent


async def get_cpu_mem_asa(ip, community):
    cpu_percent, cpu_idx = await get_first_walk_number(ip, OIDS['asa']['cpu_5sec'], community, label="CPU_5SEC")
    cpu_source = "5sec"
    if cpu_percent is None:
        cpu_percent, cpu_idx = await get_first_walk_number(ip, OIDS['asa']['cpu_1min'], community, label="CPU_1MIN")
        cpu_source = "1min"
    if cpu_percent is None:
        cpu_percent, cpu_idx = await get_first_walk_number(ip, OIDS['asa']['cpu_5min'], community, label="CPU_5MIN")
        cpu_source = "5min"
    if cpu_percent is None:
        print(f"[WARN] {ip} ASAv CPU: khong doc duoc bang Cisco CPU, gan 0.0")
        cpu_percent = 0.0
    elif PRINT_DEVICE_SUMMARY:
        print(f"[CPU] {ip} ASAv CPU {cpu_source} index={cpu_idx} value={cpu_percent}%")

    mem_idx = await get_asa_memory_index(ip, community)
    mem_used_val, mem_free_val = await asyncio.gather(
        get_snmp_data(ip, f"{OIDS['asa']['mem_used_base']}.{mem_idx}", community, label="MEM_USED"),
        get_snmp_data(ip, f"{OIDS['asa']['mem_free_base']}.{mem_idx}", community, label="MEM_FREE")
    )
    mem_used = safe_float(mem_used_val)
    mem_free = safe_float(mem_free_val)

    mem_percent = 0.0
    if (mem_used + mem_free) > 0:
        mem_percent = round((mem_used / (mem_used + mem_free)) * 100, 2)

    return cpu_percent, mem_percent


async def get_cpu_mem_ios(ip, community):
    cpu_val, mem_used_val, mem_free_val = await asyncio.gather(
        get_snmp_data(ip, OIDS['ios']['cpu_5min'], community, label="CPU"),
        get_snmp_data(ip, OIDS['ios']['mem_used'], community, label="MEM_USED"),
        get_snmp_data(ip, OIDS['ios']['mem_free'], community, label="MEM_FREE")
    )

    cpu_percent = safe_float(cpu_val)
    mem_used = safe_float(mem_used_val)
    mem_free = safe_float(mem_free_val)

    mem_percent = 0.0
    if (mem_used + mem_free) > 0:
        mem_percent = round((mem_used / (mem_used + mem_free)) * 100, 2)

    return cpu_percent, mem_percent


CPU_MEM_HANDLERS = {
    "mikrotik": get_cpu_mem_mikrotik,
    "asa": get_cpu_mem_asa,
    "ios": get_cpu_mem_ios
}


# ==========================================
# 4. THU THẬP DỮ LIỆU CHO 1 THIẾT BỊ
# ==========================================

async def collect_device(dev, traffic_t0, timestamp):
    ip, comm, os_type = dev['ip'], dev['community'], dev['os_type']
    name, device_type, interface_name = dev['name'], dev['device_type'], dev['interface_name']
    if VERBOSE_PROGRESS:
        print(f"[*] Dang xu ly: {name} ({ip})")

    try:
        status, latency, pkt_loss = await ping_device(ip)

        if status != "UP":
            record = {
                "lab_source": LAB_SOURCE,
                "device_name": name,
                "device_type": device_type,
                "ip_address": ip,
                "interface_name": interface_name,
                "status": "offline",
                "cpu_percent": 0.0,
                "memory_percent": 0.0,
                "traffic_in_mbps": 0.0,
                "traffic_out_mbps": 0.0,
                "latency_ms": latency,
                "packet_loss_percent": pkt_loss,
                "uptime_seconds": 0,
                "scenario": DATASET_SCENARIO,
                "label": DATASET_LABEL,
                "collected_at": timestamp
            }
            if PRINT_DEVICE_SUMMARY:
                print(
                    f"[OK] {name:<10} {ip:<13} status={record['status']:<7} "
                    f"cpu={record['cpu_percent']:>5.1f}%(ping) mem={record['memory_percent']:>6.2f}% "
                    f"in={record['traffic_in_mbps']:>7.2f}Mbps out={record['traffic_out_mbps']:>7.2f}Mbps "
                    f"loss={record['packet_loss_percent']:>5.1f}% uptime={record['uptime_seconds']}s"
                )
            return record

        uptime_ticks = await get_snmp_data(ip, OIDS['common']['uptime'], comm)
        uptime_seconds = safe_float(uptime_ticks) / 100

        handler = CPU_MEM_HANDLERS[os_type]
        cpu_percent, mem_percent = await handler(ip, comm)
        cpu_percent, cpu_source = normalize_demo_cpu(name, cpu_percent)

        in_bytes_t1, out_bytes_t1 = await get_interfaces_traffic_bytes(ip, comm, os_type)
        time_delta = time.time() - traffic_t0[ip]['time']
        time_delta = time_delta if time_delta > 0 else 1

        traffic_in_mbps = round(max(0, (in_bytes_t1 - traffic_t0[ip]['in']) * 8 / time_delta / 1000000), 2)
        traffic_out_mbps = round(max(0, (out_bytes_t1 - traffic_t0[ip]['out']) * 8 / time_delta / 1000000), 2)

        # Chuan hoa 6 feature truoc khi luu JSON va gui len Backend.
        cpu_percent = normalize_positive_metric(cpu_percent)
        mem_percent = normalize_positive_metric(mem_percent)
        traffic_in_mbps = normalize_positive_metric(traffic_in_mbps)
        traffic_out_mbps = normalize_positive_metric(traffic_out_mbps)
        latency = normalize_positive_metric(latency)
        pkt_loss = normalize_positive_metric(pkt_loss)

        record = {
            "lab_source": LAB_SOURCE,
            "device_name": name,
            "device_type": device_type,
            "ip_address": ip,
            "interface_name": interface_name,
            "status": "online" if status == "UP" else "offline",
            "cpu_percent": cpu_percent,
            "memory_percent": mem_percent,
            "traffic_in_mbps": traffic_in_mbps,
            "traffic_out_mbps": traffic_out_mbps,
            "latency_ms": latency,
            "packet_loss_percent": pkt_loss,
            "uptime_seconds": round(uptime_seconds),
            "scenario": DATASET_SCENARIO,
            "label": DATASET_LABEL,
            "collected_at": timestamp
        }

        if PRINT_DEVICE_SUMMARY:
            print(
                f"[OK] {name:<10} {ip:<13} status={record['status']:<7} "
                f"cpu={record['cpu_percent']:>5.1f}%({cpu_source}) mem={record['memory_percent']:>6.2f}% "
                f"in={record['traffic_in_mbps']:>7.2f}Mbps out={record['traffic_out_mbps']:>7.2f}Mbps "
                f"loss={record['packet_loss_percent']:>5.1f}% uptime={record['uptime_seconds']}s"
            )

        return record
    except Exception as e:
        print(f"[ERR] {name} ({ip}) loi khi truy van SNMP: {e}")
        return None


# ==========================================
# 5. CHƯƠNG TRÌNH CHÍNH (ASYNC)
# ==========================================

async def run_collection_cycle():
    timestamp = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"\n=== Thu thap dataset luc {timestamp} ===")

    # Đo octet lần 1 cho tất cả thiết bị (song song)
    traffic_results_t0 = await asyncio.gather(
        *[get_interfaces_traffic_bytes(dev['ip'], dev['community'], dev['os_type']) for dev in DEVICES]
    )
    traffic_t0 = {}
    for dev, (in_bytes, out_bytes) in zip(DEVICES, traffic_results_t0):
        traffic_t0[dev['ip']] = {"in": in_bytes, "out": out_bytes, "time": time.time()}

    if VERBOSE_PROGRESS:
        print(f"[*] Cho {TRAFFIC_SAMPLE_DELAY} giay de tinh toc do Mbps...")
    await asyncio.sleep(TRAFFIC_SAMPLE_DELAY)

    # Thu thập toàn bộ thông tin cho từng thiết bị (song song)
    records = await asyncio.gather(
        *[collect_device(dev, traffic_t0, timestamp) for dev in DEVICES]
    )
    dataset = [r for r in records if r is not None]

    filename = DATASET_OUTPUT
    if not os.path.isabs(filename):
        filename = os.path.join(BASE_DIR, filename)
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing_data = []

    existing_data.extend(dataset)
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=4, ensure_ascii=False)

    if POST_TO_BACKEND and dataset:
        try:
            await asyncio.gather(*[post_metric_to_backend(record) for record in dataset])
        except Exception as error:
            print(f"[API_ERR] khong gui duoc metric len backend: {error}")

    online_count = sum(1 for r in dataset if r["status"] == "online")
    print(f"[DONE] Da them {len(dataset)} ban ghi vao {filename}; online={online_count}/{len(dataset)}")


async def main_loop():
    print("=== BAT DAU TIEN TRINH THU THAP LIEN TUC (huynh_lab) ===")
    print(f"Dataset label={DATASET_LABEL}, scenario={DATASET_SCENARIO}, output={DATASET_OUTPUT}")
    print("Nhan Ctrl + C de dung.\n")
    while True:
        await run_collection_cycle()
        print(f"-> Doi {INTERVAL_SECONDS} giay truoc lan quet tiep theo...\n")
        await asyncio.sleep(INTERVAL_SECONDS)


def parse_args():
    parser = argparse.ArgumentParser(description="Collect lab network metrics into a JSON dataset.")
    parser.add_argument(
        "--label",
        choices=["normal", "abnormal"],
        default=DATASET_LABEL,
        help="Ground-truth label for this collection run.",
    )
    parser.add_argument(
        "--scenario",
        default=DATASET_SCENARIO,
        help="Collection scenario, for example baseline, stress_cpu, high_traffic, attack_test.",
    )
    parser.add_argument(
        "--output",
        default=DATASET_OUTPUT,
        help="Dataset JSON output path. Relative paths are saved inside the collector folder.",
    )
    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()
    DATASET_LABEL = args.label
    DATASET_SCENARIO = args.scenario
    DATASET_OUTPUT = args.output
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        print("\n\n=== DA DUNG TIEN TRINH AN TOAN ===")
