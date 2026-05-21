import subprocess
import time
import re
import json
import os
from datetime import datetime


class IntentRecord:
    """Represents a structured Android Broadcast Intent for researcher audit."""

    def __init__(self, obj_id=None, action=None, target_component=None, sender_package=None, extras=None):
        self.id = obj_id or "unknown"
        self.timestamp = datetime.now().isoformat()
        self.action = action or "unknown"
        self.target_component = target_component or "unknown"
        self.sender_package = sender_package or "unknown"
        self.extras = extras  # Will hold raw extras string or parsed token maps

    def to_dict(self):
        """Converts the object properties to a dictionary for JSON/DB ingestion."""
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "action": self.action,
            "target_component": self.target_component,
            "sender_package": self.sender_package,
            "extras": self.extras
        }

    def get_uniqueness_key(self):
        """Creates a signature to prevent duplicate logging across poll intervals."""
        return f"{self.id}|{self.action}|{self.target_component}"


def check_adb_connection():
    """Verifies that adb is available and a target emulator is active."""
    try:
        result = subprocess.run(['adb', 'devices'], capture_output=True, text=True, check=True)
        lines = [line for line in result.stdout.strip().split('\n')[1:] if line.strip()]
        if not lines:
            print("[!] Warning: No active devices detected. Boot your emulator.")
            return False
        return True
    except FileNotFoundError:
        print("[!] Error: 'adb' command not found in system PATH.")
        return False


def parse_dumpsys_broadcasts(raw_text):
    """
    Advanced parser extracting real OS timestamps, mapping system UIDs,
    and handling historical vs sticky intent variations.
    """
    intents_list = []
    current_intent = None

    # Regex definitions for exact extraction
    hash_re = re.compile(r'BroadcastRecord{([0-9a-fA-F]+)')
    act_re = re.compile(r'act=([^\s}]+)')
    cmp_re = re.compile(r'cmp=([^\s}]+)')
    caller_re = re.compile(r'caller=([^\s:]+)')
    uid_re = re.compile(r'originalCallingUid:\s*(\d+)')
    extras_re = re.compile(r'extras:\s*Bundle\[\{(.*?)\}\]')

    # Timestamps can appear in two formats within historical lists
    enq_short_re = re.compile(r'enq=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})')
    enq_long_re = re.compile(r'enqueueClockTime=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})')

    for line in raw_text.splitlines():
        stripped = line.strip()

        # Identify boundaries for records
        is_record_start = "BroadcastRecord{" in stripped or "Sticky action" in stripped
        is_intent_line = stripped.startswith("Intent:") or stripped.startswith("#") and "act=" in stripped

        if is_record_start or is_intent_line:
            if current_intent and current_intent.action != "unknown":
                intents_list.append(current_intent)

            current_intent = IntentRecord()
            # Clear our placeholder timestamp so we know if we find an authentic OS one
            current_intent.timestamp = None

        if not current_intent:
            continue

        # 1. Capture BroadcastRecord object hash
        if "BroadcastRecord{" in stripped:
            hash_match = hash_re.search(stripped)
            if hash_match:
                current_intent.id = hash_match.group(1)

        # 2. Extract Intent features (Action and Target)
        if "act=" in stripped:
            act_match = act_re.search(stripped)
            if act_match:
                current_intent.action = act_match.group(1)
            cmp_match = cmp_re.search(stripped)
            if cmp_match:
                current_intent.target_component = cmp_match.group(1)

        # 3. Extract Sender Package or fall back to system UIDs
        if "caller=" in stripped:
            caller_match = caller_re.search(stripped)
            if caller_match:
                current_intent.sender_package = caller_match.group(1)
        elif "originalCallingUid:" in stripped:
            uid_match = uid_re.search(stripped)
            if uid_match:
                uid = uid_match.group(1)
                current_intent.sender_package = f"system_server (UID {uid})" if uid == "1000" else f"UID {uid}"

        # 4. Extract Real OS Enqueue Timestamps
        if "enq=" in stripped:
            ts_match = enq_short_re.search(stripped)
            if ts_match:
                current_intent.timestamp = ts_match.group(1)
        elif "enqueueClockTime" in stripped:
            ts_match = enq_long_re.search(stripped)
            if ts_match:
                current_intent.timestamp = ts_match.group(1)

        # 5. Extract Extras
        if "extras:" in stripped:
            extras_match = extras_re.search(stripped)
            if extras_match:
                current_intent.extras = extras_match.group(1)
            elif "Bundle" in stripped:
                current_intent.extras = "Present (Unparsed)"

    # Catch final open block
    if current_intent and current_intent.action != "unknown":
        if not current_intent.timestamp:
            current_intent.timestamp = datetime.now().isoformat() + " (Poll Local)"
        intents_list.append(current_intent)

    # Secondary sweep to ensure all items have at least a local execution timestamp backup
    for intent in intents_list:
        if not intent.timestamp:
            intent.timestamp = datetime.now().isoformat() + " (Poll Local)"

    return intents_list


def get_stream_fingerprint(record):
    """
    Creates a unique content-based signature.
    If an intent has an authentic OS timestamp, we lock onto that.
    If it's a sticky intent (no OS timestamp), we lock onto its state data
    so it only prints again if its values actually change.
    """
    # If it's a local fallback timestamp, exclude it from the fingerprint calculations
    ts_marker = record.timestamp if "Poll Local" not in record.timestamp else "sticky"
    return f"{record.id}|{record.action}|{record.sender_package}|{record.extras}|{ts_marker}"


def poll_system_intents(interval_ms=500):
    """Streams new or mutated intents sequentially to the terminal, acting like tail -f."""
    if not check_adb_connection():
        return

    print(f"[*] IntentStream Auditor initialized in streaming mode [tail -f].")
    print(f"[*] Polling interval: {interval_ms}ms. Monitoring system-wide broadcasts...\n" + "=" * 70)

    # Track historical fingerprints across ticks
    seen_fingerprints = set()
    interval_seconds = interval_ms / 1000.0

    # Priming phase: Eat the baseline system dump so we don't dump 200 old entries on boot
    try:
        init_result = subprocess.run(['adb', 'shell', 'dumpsys', 'activity', 'broadcasts'], capture_output=True,
                                     text=True)
        if init_result.returncode == 0:
            for record in parse_dumpsys_broadcasts(init_result.stdout):
                seen_fingerprints.add(get_stream_fingerprint(record))
        print("[*] Baseline system state captured. Listening for new live events...")
    except Exception as e:
        print(f"[!] Initialization priming warning: {e}")

    try:
        while True:
            result = subprocess.run(
                ['adb', 'shell', 'dumpsys', 'activity', 'broadcasts'],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                found_records = parse_dumpsys_broadcasts(result.stdout)

                for record in found_records:
                    fingerprint = get_stream_fingerprint(record)

                    # Only print if this specific intent structure or state has never been seen
                    if fingerprint not in seen_fingerprints:
                        seen_fingerprints.add(fingerprint)

                        # Print cleanly to stdout (appends down the screen like a log tail)
                        print(json.dumps(record.to_dict(), indent=2))
                        print("-" * 50, flush=True)
            else:
                print(f"[!] Target device read failure: {result.stderr}")

            time.sleep(interval_seconds)

    except KeyboardInterrupt:
        print("\n[*] Auditing session suspended safely.")


if __name__ == "__main__":
    poll_system_intents(interval_ms=500)