import argparse
import asyncio
import platform
import random
import subprocess
import time

from pysnmp.hlapi.asyncio import (
    CommunityData,
    ContextData,
    ObjectIdentity,
    ObjectType,
    SnmpEngine,
    UdpTransportTarget,
    get_cmd,
)


TARGETS = [
    {"name": "DIST", "ip": "10.0.3.254", "community": "public"},
    {"name": "CORE", "ip": "10.0.2.1", "community": "public"},
    {"name": "ASAv", "ip": "10.0.1.5", "community": "public"},
    {"name": "DMZ-SERVER", "ip": "10.20.20.10", "community": "public"},
    {"name": "SW", "ip": "10.0.10.2", "community": "public"},
]
DEFAULT_TARGET_NAMES = {"DIST", "CORE", "ASAv", "SW"}

SNMP_OIDS = [
    "1.3.6.1.2.1.1.3.0",  # sysUpTime
    "1.3.6.1.2.1.1.5.0",  # sysName
    "1.3.6.1.2.1.2.1.0",  # ifNumber
    "1.3.6.1.2.1.25.3.3.1.2.1",  # hrProcessorLoad, often works on MikroTik
    "1.3.6.1.4.1.9.9.109.1.1.1.1.7.1",  # Cisco CPU 1 minute, often works on ASA/IOS
]


def ping_once(ip: str, timeout_ms: int) -> bool:
    if platform.system().lower() == "windows":
        command = ["ping", "-n", "1", "-w", str(timeout_ms), ip]
    else:
        command = ["ping", "-c", "1", "-W", str(max(1, timeout_ms // 1000)), ip]

    completed = subprocess.run(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return completed.returncode == 0


async def snmp_get_once(ip: str, community: str, timeout: float) -> None:
    oid = random.choice(SNMP_OIDS)
    try:
        await get_cmd(
            SnmpEngine(),
            CommunityData(community, mpModel=1),
            await UdpTransportTarget.create((ip, 161), timeout=timeout, retries=0),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
        )
    except Exception:
        pass


def select_targets(names_csv: str) -> list[dict[str, str]]:
    if names_csv.strip().lower() == "default":
        names = DEFAULT_TARGET_NAMES
    elif names_csv.strip().lower() == "all":
        names = {target["name"] for target in TARGETS}
    else:
        names = {name.strip() for name in names_csv.split(",") if name.strip()}

    selected = [target for target in TARGETS if target["name"] in names]
    if not selected:
        valid_names = ", ".join(target["name"] for target in TARGETS)
        raise SystemExit(f"No valid target selected. Valid names: {valid_names}")
    return selected


async def health_guard(
    selected_targets: list[dict[str, str]],
    args: argparse.Namespace,
    state: dict[str, float],
) -> None:
    while True:
        await asyncio.sleep(args.health_interval)
        failed = []
        for target in selected_targets:
            ok = await asyncio.to_thread(ping_once, target["ip"], args.ping_timeout_ms)
            if not ok:
                failed.append(target["name"])

        if failed:
            state["pause_until"] = time.monotonic() + args.pause_seconds
            print(
                f"[GUARD] loss detected on {','.join(failed)}; "
                f"pausing load for {args.pause_seconds}s"
            )


async def worker(
    worker_id: int,
    args: argparse.Namespace,
    stats: dict[str, int],
    selected_targets: list[dict[str, str]],
    state: dict[str, float],
) -> None:
    end_at = time.monotonic() + args.duration if args.duration > 0 else None
    local_random = random.Random(worker_id)

    while end_at is None or time.monotonic() < end_at:
        pause_for = state["pause_until"] - time.monotonic()
        if pause_for > 0:
            await asyncio.sleep(min(pause_for, 1.0))
            continue

        target = local_random.choice(selected_targets)

        if args.mode in ("ping", "mixed"):
            await asyncio.to_thread(ping_once, target["ip"], args.ping_timeout_ms)
            stats["ping"] += 1

        if args.mode in ("snmp", "mixed"):
            await snmp_get_once(target["ip"], target["community"], args.snmp_timeout)
            stats["snmp"] += 1

        await asyncio.sleep(args.sleep)


async def reporter(stats: dict[str, int], args: argparse.Namespace, selected_targets: list[dict[str, str]]) -> None:
    previous_ping = 0
    previous_snmp = 0
    while True:
        await asyncio.sleep(5)
        ping_delta = stats["ping"] - previous_ping
        snmp_delta = stats["snmp"] - previous_snmp
        previous_ping = stats["ping"]
        previous_snmp = stats["snmp"]
        print(
            f"[LOAD] workers={args.workers} mode={args.mode} "
            f"targets={','.join(target['name'] for target in selected_targets)} "
            f"ping={stats['ping']} (+{ping_delta}/5s) "
            f"snmp={stats['snmp']} (+{snmp_delta}/5s)"
        )


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate controlled real control-plane load for the EVE monitoring lab."
    )
    parser.add_argument("--mode", choices=["ping", "snmp", "mixed"], default="mixed")
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--sleep", type=float, default=0.05)
    parser.add_argument("--duration", type=int, default=0, help="Seconds. 0 means run until Ctrl+C.")
    parser.add_argument("--ping-timeout-ms", type=int, default=500)
    parser.add_argument("--snmp-timeout", type=float, default=0.5)
    parser.add_argument(
        "--targets",
        default="default",
        help="Comma-separated target names, 'default' means CORE,DIST,ASAv,SW; 'all' includes DMZ-SERVER.",
    )
    parser.add_argument("--health-interval", type=int, default=5)
    parser.add_argument("--pause-seconds", type=int, default=20)
    args = parser.parse_args()

    selected_targets = select_targets(args.targets)
    stats = {"ping": 0, "snmp": 0}
    state = {"pause_until": 0.0}
    print(
        f"Starting lab load: mode={args.mode}, workers={args.workers}, "
        f"sleep={args.sleep}s, duration={'until Ctrl+C' if args.duration == 0 else args.duration}"
    )
    print(f"Targets: {', '.join(target['name'] for target in selected_targets)}")
    print("Start low. Increase workers gradually if CPU is still too low.")

    tasks = [
        asyncio.create_task(worker(index, args, stats, selected_targets, state))
        for index in range(args.workers)
    ]
    tasks.append(asyncio.create_task(health_guard(selected_targets, args, state)))
    tasks.append(asyncio.create_task(reporter(stats, args, selected_targets)))

    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        pass
    finally:
        for task in tasks:
            task.cancel()


if __name__ == "__main__":
    asyncio.run(main())
