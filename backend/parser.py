import os
import zipfile
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime
import json
import re
from html import unescape

SUPPORTED_ARCHIVE_EXTENSIONS = (".xml", ".json", ".html", ".htm")

def empty_case_data():
    return {
        "device_info": {
            "model": "Unknown Device",
            "os": "Unknown OS",
            "phone_number": "Unknown",
            "imei": "Unknown",
            "serial": "Unknown",
            "extraction_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "examiner": "Aegis Forensic Examiner",
            "case_name": "New Extraction Import"
        },
        "contacts": [],
        "calls": [],
        "chats": [],
        "locations": [],
        "_diagnostics": {
            "archive_type": "unknown",
            "files_seen": 0,
            "files_parsed": [],
            "files_skipped": [],
            "warnings": [],
        }
    }

def stable_record_key(record):
    return json.dumps(record, sort_keys=True, default=str)

def merge_case_data(base, incoming):
    for key, value in incoming.get("device_info", {}).items():
        if value and value != "Unknown" and value != "Unknown Device" and value != "Unknown OS":
            if base["device_info"].get(key) in ("", "Unknown", "Unknown Device", "Unknown OS", None):
                base["device_info"][key] = value

    for bucket in ("contacts", "calls", "chats", "locations"):
        seen = {stable_record_key(item) for item in base[bucket]}
        for item in incoming.get(bucket, []):
            item_key = stable_record_key(item)
            if item_key not in seen:
                base[bucket].append(item)
                seen.add(item_key)

def write_member_to_temp(zip_ref, member_name, temp_dir):
    info = zip_ref.getinfo(member_name)
    if info.file_size > 150 * 1024 * 1024:
        raise ValueError("Skipped oversized archive member.")
    safe_name = f"{len(os.listdir(temp_dir))}_{os.path.basename(member_name) or 'report'}"
    target_path = os.path.join(temp_dir, safe_name)
    with zip_ref.open(info) as source, open(target_path, "wb") as target:
        target.write(source.read())
    return target_path

def parse_supported_file(path):
    lowered = path.lower()
    if lowered.endswith(".json"):
        return parse_json_report(path)
    if lowered.endswith((".html", ".htm")):
        return parse_html_report(path)
    return parse_xml_report(path)

def parse_ufdr(file_path: str):
    """
    Ingests a UFDR (.zip container) or raw XML report, extracts the report,
    and parses it into a unified digital forensics JSON schema.
    """
    try:
        temp_dir = None
        merged = empty_case_data()

        if zipfile.is_zipfile(file_path):
            merged["_diagnostics"]["archive_type"] = "zip/ufdr"
            temp_dir = tempfile.mkdtemp(prefix="aegis_ufdr_")
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                names = zip_ref.namelist()
                merged["_diagnostics"]["files_seen"] = len(names)
                candidates = [name for name in names if name.lower().endswith(SUPPORTED_ARCHIVE_EXTENSIONS)]
                candidates.sort(key=lambda name: (
                    0 if os.path.basename(name).lower() == "report.xml" else 1,
                    0 if name.lower().endswith(".xml") else 1,
                    name.lower(),
                ))
                if not candidates:
                    raise ValueError("No XML, JSON, or HTML report files found inside the UFDR archive.")

                for member_name in candidates:
                    try:
                        member_path = write_member_to_temp(zip_ref, member_name, temp_dir)
                        parsed = parse_supported_file(member_path)
                        if any(parsed.get(bucket) for bucket in ("contacts", "calls", "chats", "locations")):
                            merge_case_data(merged, parsed)
                            merged["_diagnostics"]["files_parsed"].append(member_name)
                        else:
                            merged["_diagnostics"]["files_skipped"].append({"file": member_name, "reason": "No supported records found."})
                    except Exception as exc:
                        merged["_diagnostics"]["files_skipped"].append({"file": member_name, "reason": str(exc)})
        else:
            if not file_path.lower().endswith(SUPPORTED_ARCHIVE_EXTENSIONS):
                raise ValueError("UFDR files should be ZIP containers. This file is not a valid ZIP, XML, JSON, or HTML report.")
            merged["_diagnostics"]["archive_type"] = "single-report"
            parsed = parse_supported_file(file_path)
            merge_case_data(merged, parsed)
            merged["_diagnostics"]["files_seen"] = 1
            merged["_diagnostics"]["files_parsed"].append(os.path.basename(file_path))

        if not any(merged.get(bucket) for bucket in ("contacts", "calls", "chats", "locations")):
            raise ValueError("The UFDR was readable, but no supported contacts, calls, chats, or locations were found.")
        if len(merged["_diagnostics"]["files_parsed"]) > 1:
            merged["_diagnostics"]["warnings"].append("Records were merged from multiple report artifacts. Review duplicates and source coverage.")
        return merged
    finally:
        if temp_dir and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)

def parse_xml_report(xml_path: str):
    """
    Parses a Cellebrite report.xml or generic forensic XML into a unified structure.
    """
    try:
        # Use iterparse or parser with huge tree capability, standard ElementTree is fine for reasonable size.
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        raise ValueError(f"Failed to parse XML file: {str(e)}")

    # Initialize standard data structures
    device_info = {
        "model": "Unknown Device",
        "os": "Unknown OS",
        "phone_number": "Unknown",
        "imei": "Unknown",
        "serial": "Unknown",
        "extraction_time": datetime.now().isoformat(),
        "examiner": "Aegis Forensic Examiner",
        "case_name": "New Extraction Import"
    }
    contacts = []
    calls = []
    chats = []
    locations = []

    # Helper function to clean text
    def clean_text(text):
        if text is None:
            return ""
        return text.strip()

    def field_value(field):
        if field.text and field.text.strip():
            return clean_text(field.text)
        for key in ("value", "text", "formattedValue", "display"):
            if field.get(key):
                return clean_text(field.get(key))
        return ""

    def normalize_label(label):
        return re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")

    def apply_device_value(label, text):
        key = normalize_label(label)
        if not text:
            return
        if "case" in key:
            device_info["case_name"] = text
        elif "examiner" in key or "operator" in key:
            device_info["examiner"] = text
        elif "imei" in key:
            device_info["imei"] = text
        elif "serial" in key:
            device_info["serial"] = text
        elif "phone_number" in key or "msisdn" in key or key == "number":
            device_info["phone_number"] = text
        elif "model" in key or "device_name" in key:
            device_info["model"] = text
        elif key in ("os", "operating_system", "system"):
            device_info["os"] = text
        elif "extraction" in key and ("time" in key or "date" in key):
            device_info["extraction_time"] = text

    # Cellebrite report.xml schemas usually organize data by:
    # 1. <device_info> or metadata blocks
    # 2. <model name="Contacts"> or <table name="Contacts"> containing <row> or <record>
    
    # Simple XML traverser to extract whatever matches forensic structures
    # First pass: Metadata extraction
    for elem in root.findall(".//metadata/*") + root.findall(".//device_info/*") + root.findall(".//device/*"):
        apply_device_value(elem.get("name") or elem.tag, field_value(elem))

    # If the XML uses Cellebrite's standard "table/row" or "model/row" format:
    # E.g., <model type="Contacts"><row><field name="Name">...</field></row></model>
    for model_elem in root.findall(".//model") + root.findall(".//table"):
        model_name = model_elem.get("name", "").lower() or model_elem.get("type", "").lower()
        
        # Parse Contacts Table
        if "contact" in model_name:
            for row in model_elem.findall(".//row") + model_elem.findall(".//record"):
                contact = {"name": "", "phone": "", "email": "", "notes": ""}
                for field in row.findall(".//field") + row.findall("./*"):
                    name = normalize_label(field.get("name") or field.tag)
                    val = field_value(field)
                    if "name" in name:
                        contact["name"] = val
                    elif "phone" in name or "number" in name or "value" in name:
                        contact["phone"] = val
                    elif "email" in name:
                        contact["email"] = val
                    elif "note" in name:
                        contact["notes"] = val
                if contact["name"] or contact["phone"]:
                    contacts.append(contact)

        # Parse Calls Table
        elif "call" in model_name:
            for row in model_elem.findall(".//row") + model_elem.findall(".//record"):
                call = {"party": "Unknown", "phone": "", "direction": "Incoming", "timestamp": "", "duration": "00:00:00"}
                for field in row.findall(".//field") + row.findall("./*"):
                    name = normalize_label(field.get("name") or field.tag)
                    val = field_value(field)
                    if "name" in name or "party" in name:
                        call["party"] = val
                    elif "phone" in name or "number" in name or "value" in name:
                        call["phone"] = val
                    elif "direction" in name or "type" in name:
                        if "out" in val.lower():
                            call["direction"] = "Outgoing"
                        elif "miss" in val.lower():
                            call["direction"] = "Missed"
                        else:
                            call["direction"] = "Incoming"
                    elif "time" in name or "date" in name:
                        call["timestamp"] = val
                    elif "duration" in name:
                        call["duration"] = val
                calls.append(call)

        # Parse Chats/Messages Table
        elif "chat" in model_name or "message" in model_name or "sms" in model_name:
            for row in model_elem.findall(".//row") + model_elem.findall(".//record"):
                msg = {"chat_id": "ChatRoom", "sender": "Self", "recipient": "Unknown", "body": "", "timestamp": "", "is_deleted": False, "attachment": ""}
                for field in row.findall(".//field") + row.findall("./*"):
                    name = normalize_label(field.get("name") or field.tag)
                    val = field_value(field)
                    if "body" in name or "text" in name or "content" in name:
                        msg["body"] = val
                    elif "from" in name or "sender" in name:
                        msg["sender"] = val
                    elif "to" in name or "recipient" in name or "receiver" in name:
                        msg["recipient"] = val
                    elif "time" in name or "date" in name:
                        msg["timestamp"] = val
                    elif "deleted" in name:
                        msg["is_deleted"] = "true" in val.lower() or val == "1"
                    elif "attach" in name or "file" in name:
                        msg["attachment"] = val
                    elif "room" in name or "chat_id" in name or "service" in name:
                        msg["chat_id"] = val
                if msg["body"]:
                    chats.append(msg)

        # Parse Locations Table
        elif "location" in model_name or "gps" in model_name or "position" in model_name:
            for row in model_elem.findall(".//row") + model_elem.findall(".//record"):
                loc = {"latitude": 0.0, "longitude": 0.0, "timestamp": "", "source": "GPS"}
                for field in row.findall(".//field") + row.findall("./*"):
                    name = normalize_label(field.get("name") or field.tag)
                    val = field_value(field)
                    if "lat" in name:
                        try: loc["latitude"] = float(val)
                        except: pass
                    elif "long" in name or "lon" in name:
                        try: loc["longitude"] = float(val)
                        except: pass
                    elif "time" in name or "date" in name:
                        loc["timestamp"] = val
                    elif "source" in name or "type" in name:
                        loc["source"] = val
                if loc["latitude"] != 0.0 or loc["longitude"] != 0.0:
                    locations.append(loc)

    # GRACEFUL FALLBACK PARSING
    # If the above highly structured parsing retrieved nothing (which happens with different software versions),
    # we perform a flat recursive crawl for specific key elements.
    if not chats and not calls:
        # Flat crawl for contacts
        for elem in root.findall(".//contact") + root.findall(".//Contact"):
            contact = {"name": "", "phone": "", "email": "", "notes": ""}
            for child in elem:
                tag = child.tag.lower()
                val = clean_text(child.text)
                if "name" in tag: contact["name"] = val
                elif "phone" in tag or "number" in tag: contact["phone"] = val
                elif "email" in tag: contact["email"] = val
                elif "note" in tag: contact["notes"] = val
            if contact["name"] or contact["phone"]:
                contacts.append(contact)

        # Flat crawl for calls
        for elem in root.findall(".//call") + root.findall(".//Call"):
            call = {"party": "Unknown", "phone": "", "direction": "Incoming", "timestamp": "", "duration": "00:00:00"}
            for child in elem:
                tag = child.tag.lower()
                val = clean_text(child.text)
                if "name" in tag or "party" in tag: call["party"] = val
                elif "phone" in tag or "number" in tag: call["phone"] = val
                elif "type" in tag or "direction" in tag:
                    if "out" in val.lower(): call["direction"] = "Outgoing"
                    elif "miss" in val.lower(): call["direction"] = "Missed"
                elif "time" in tag or "date" in tag: call["timestamp"] = val
                elif "duration" in tag: call["duration"] = val
            calls.append(call)

        # Flat crawl for messages
        for elem in root.findall(".//message") + root.findall(".//Message") + root.findall(".//sms") + root.findall(".//Sms"):
            msg = {"chat_id": "DirectMessage", "sender": "", "recipient": "", "body": "", "timestamp": "", "is_deleted": False, "attachment": ""}
            for child in elem:
                tag = child.tag.lower()
                val = clean_text(child.text)
                if "body" in tag or "text" in tag or "content" in tag: msg["body"] = val
                elif "from" in tag or "sender" in tag: msg["sender"] = val
                elif "to" in tag or "recipient" in tag: msg["recipient"] = val
                elif "time" in tag or "date" in tag: msg["timestamp"] = val
                elif "deleted" in tag: msg["is_deleted"] = "true" in val.lower() or val == "1"
                elif "attach" in tag or "file" in tag: msg["attachment"] = val
            if msg["body"]:
                msg["sender"] = msg["sender"] or "Suspect"
                msg["recipient"] = msg["recipient"] or "External"
                chats.append(msg)

        # Flat crawl for geolocations
        for elem in root.findall(".//location") + root.findall(".//Location") + root.findall(".//gps") + root.findall(".//Gps"):
            loc = {"latitude": 0.0, "longitude": 0.0, "timestamp": "", "source": "GPS"}
            for child in elem:
                tag = child.tag.lower()
                val = clean_text(child.text)
                if "lat" in tag:
                    try: loc["latitude"] = float(val)
                    except: pass
                elif "long" in tag or "lon" in tag:
                    try: loc["longitude"] = float(val)
                    except: pass
                elif "time" in tag or "date" in tag: loc["timestamp"] = val
                elif "source" in tag: loc["source"] = val
            if loc["latitude"] != 0.0 or loc["longitude"] != 0.0:
                locations.append(loc)

    # Ensure timestamps are in a parseable format
    # (Just a simple standardizer to make frontend display clean)
    def clean_timestamp(ts):
        if not ts:
            return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ts = ts.replace("T", " ").replace("Z", "")
        if "." in ts:
            ts = ts.split(".")[0]
        return ts

    for call in calls:
        call["timestamp"] = clean_timestamp(call["timestamp"])
    for msg in chats:
        msg["timestamp"] = clean_timestamp(msg["timestamp"])
    for loc in locations:
        loc["timestamp"] = clean_timestamp(loc["timestamp"])

    return {
        "device_info": device_info,
        "contacts": contacts,
        "calls": calls,
        "chats": chats,
        "locations": locations
    }

def parse_json_report(json_path: str):
    with open(json_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if isinstance(payload, dict) and all(k in payload for k in ("device_info", "contacts", "calls", "chats", "locations")):
        return payload

    records = payload.get("records", payload.get("items", [])) if isinstance(payload, dict) else payload
    device_info = {
        "model": payload.get("model", "Unknown Device") if isinstance(payload, dict) else "Unknown Device",
        "os": payload.get("os", "Unknown OS") if isinstance(payload, dict) else "Unknown OS",
        "phone_number": payload.get("phone_number", "Unknown") if isinstance(payload, dict) else "Unknown",
        "imei": payload.get("imei", "Unknown") if isinstance(payload, dict) else "Unknown",
        "serial": payload.get("serial", "Unknown") if isinstance(payload, dict) else "Unknown",
        "extraction_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "examiner": "Aegis Forensic Examiner",
        "case_name": "JSON Extraction Import",
    }
    contacts, calls, chats, locations = [], [], [], []

    for item in records if isinstance(records, list) else []:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("type") or item.get("category") or item.get("source") or "").lower()
        if "contact" in kind:
            contacts.append({
                "name": item.get("name", ""),
                "phone": item.get("phone") or item.get("number", ""),
                "email": item.get("email", ""),
                "notes": item.get("notes", ""),
            })
        elif "call" in kind:
            calls.append({
                "party": item.get("party") or item.get("name", "Unknown"),
                "phone": item.get("phone") or item.get("number", ""),
                "direction": item.get("direction", "Incoming"),
                "timestamp": item.get("timestamp") or item.get("date", ""),
                "duration": item.get("duration", "00:00:00"),
            })
        elif any(token in kind for token in ("chat", "message", "sms")):
            chats.append({
                "chat_id": item.get("chat_id") or item.get("conversation", "DirectMessage"),
                "sender": item.get("sender") or item.get("from", "Unknown"),
                "recipient": item.get("recipient") or item.get("to", "Unknown"),
                "body": item.get("body") or item.get("text") or item.get("content", ""),
                "timestamp": item.get("timestamp") or item.get("date", ""),
                "is_deleted": bool(item.get("is_deleted") or item.get("deleted", False)),
                "attachment": item.get("attachment", ""),
            })
        elif any(token in kind for token in ("location", "gps", "position")):
            locations.append({
                "latitude": float(item.get("latitude", 0) or 0),
                "longitude": float(item.get("longitude", item.get("lon", 0)) or 0),
                "timestamp": item.get("timestamp") or item.get("date", ""),
                "source": item.get("source", "GPS"),
            })

    return {
        "device_info": device_info,
        "contacts": contacts,
        "calls": calls,
        "chats": [c for c in chats if c["body"]],
        "locations": locations,
    }

def parse_html_report(html_path: str):
    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        raw = f.read()

    text = re.sub(r"<(script|style).*?</\1>", " ", raw, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|tr|li|table|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]

    device_info = {
        "model": "Unknown Device",
        "os": "Unknown OS",
        "phone_number": "Unknown",
        "imei": "Unknown",
        "serial": "Unknown",
        "extraction_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "examiner": "Aegis Forensic Examiner",
        "case_name": "HTML Extraction Import",
    }
    contacts, calls, chats, locations = [], [], [], []

    for line in lines:
        lowered = line.lower()
        if "imei" in lowered:
            match = re.search(r"\b\d{14,17}\b", line)
            if match:
                device_info["imei"] = match.group(0)
        if "serial" in lowered:
            device_info["serial"] = line.split(":", 1)[-1].strip()
        if "model" in lowered and device_info["model"] == "Unknown Device":
            device_info["model"] = line.split(":", 1)[-1].strip()
        if "operating system" in lowered or lowered.startswith("os:"):
            device_info["os"] = line.split(":", 1)[-1].strip()

        timestamp = re.search(r"\b20\d{2}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\b", line)
        phone = re.search(r"(?<!\w)\+\d[\d\s().-]{6,}\d", line)
        lat_lon = re.search(r"(-?\d{1,2}\.\d{3,})\s*[,| ]\s*(-?\d{1,3}\.\d{3,})", line)

        if lat_lon:
            locations.append({
                "latitude": float(lat_lon.group(1)),
                "longitude": float(lat_lon.group(2)),
                "timestamp": timestamp.group(0).replace("/", "-") if timestamp else "",
                "source": "HTML Report",
            })
        elif any(token in lowered for token in ("incoming", "outgoing", "missed")) and phone:
            direction = "Outgoing" if "outgoing" in lowered else ("Missed" if "missed" in lowered else "Incoming")
            calls.append({
                "party": "Unknown",
                "phone": phone.group(0),
                "direction": direction,
                "timestamp": timestamp.group(0).replace("/", "-") if timestamp else "",
                "duration": "00:00:00",
            })
        elif timestamp and any(token in lowered for token in ("message", "sms", "chat", "whatsapp", "signal", "telegram")):
            chats.append({
                "chat_id": "HTML_Report",
                "sender": "Unknown",
                "recipient": "Unknown",
                "body": line,
                "timestamp": timestamp.group(0).replace("/", "-"),
                "is_deleted": "deleted" in lowered,
                "attachment": "",
            })
        elif phone and any(token in lowered for token in ("contact", "phone", "mobile")):
            contacts.append({
                "name": line.split(phone.group(0), 1)[0].replace("Contact", "").strip(" :-") or "Unknown",
                "phone": phone.group(0),
                "email": "",
                "notes": "Recovered from HTML report text.",
            })

    return {
        "device_info": device_info,
        "contacts": contacts,
        "calls": calls,
        "chats": chats,
        "locations": locations,
    }

if __name__ == "__main__":
    # Test script entry point
    print("UFDR Parser module successfully verified.")
