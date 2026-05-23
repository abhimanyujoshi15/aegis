import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from parser import parse_ufdr


REPORT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<report>
  <metadata>
    <case_name>Regression Case</case_name>
    <examiner>QA Officer</examiner>
  </metadata>
  <device_info>
    <model>Samsung Galaxy S24</model>
    <os>Android 14</os>
    <phone_number>+91 90000 11111</phone_number>
    <imei>351234567890123</imei>
    <serial>RG-ANDROID-001</serial>
    <extraction_time>2026-05-23 10:00:00</extraction_time>
  </device_info>
  <model name="Contacts">
    <row><field name="Name">Anika Source</field><field name="Phone">+91 90000 22222</field></row>
  </model>
  <model name="Calls">
    <row><field name="Party">Anika Source</field><field name="Phone">+91 90000 22222</field><field name="Direction">Incoming</field><field name="Date">2026-05-23 10:30:00</field><field name="Duration">00:03:00</field></row>
  </model>
</report>
"""

MESSAGES_XML = """<?xml version="1.0" encoding="UTF-8"?>
<root>
  <model name="Messages">
    <row>
      <field name="Chat_Id">Signal_A</field>
      <field name="Sender">Self</field>
      <field name="Recipient">Anika Source</field>
      <field name="Body">Bring the external drive and delete this message.</field>
      <field name="Date">2026-05-23 11:00:00</field>
      <field name="Deleted">true</field>
    </row>
  </model>
  <model name="Locations">
    <row><field name="Latitude">12.9716</field><field name="Longitude">77.5946</field><field name="Date">2026-05-23 11:02:00</field><field name="Source">GPS</field></row>
  </model>
</root>
"""


class ParserRegressionTests(unittest.TestCase):
    def make_archive(self, members):
        tmp = tempfile.NamedTemporaryFile(suffix=".ufdr", delete=False)
        tmp.close()
        with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
            for name, content in members.items():
                if isinstance(content, (dict, list)):
                    content = json.dumps(content)
                zf.writestr(name, content)
        return Path(tmp.name)

    def test_merges_multiple_xml_artifacts(self):
        path = self.make_archive({
            "report.xml": REPORT_XML,
            "data/messages.xml": MESSAGES_XML,
            "readme.txt": "not parsed",
        })
        data = parse_ufdr(str(path))

        self.assertEqual(data["device_info"]["model"], "Samsung Galaxy S24")
        self.assertEqual(len(data["contacts"]), 1)
        self.assertEqual(len(data["calls"]), 1)
        self.assertEqual(len(data["chats"]), 1)
        self.assertEqual(len(data["locations"]), 1)
        self.assertEqual(len(data["_diagnostics"]["files_parsed"]), 2)

    def test_reads_json_records_inside_archive(self):
        path = self.make_archive({
            "mobile/records.json": {
                "records": [
                    {"type": "contact", "name": "JSON Contact", "phone": "+1 202-555-0101"},
                    {"type": "sms", "sender": "JSON Contact", "to": "Self", "text": "JSON message body", "date": "2026-05-23 12:00:00"},
                ]
            }
        })
        data = parse_ufdr(str(path))

        self.assertEqual(len(data["contacts"]), 1)
        self.assertEqual(len(data["chats"]), 1)
        self.assertEqual(data["chats"][0]["body"], "JSON message body")

    def test_reads_html_fallback_when_xml_is_absent(self):
        path = self.make_archive({
            "report/index.html": """
            <html><body>
              <p>Model: Pixel 9</p>
              <p>Contact Ravi +91 98888 77777</p>
              <p>2026-05-23 13:00:00 WhatsApp message: meet at 12.9716, 77.5946</p>
            </body></html>
            """
        })
        data = parse_ufdr(str(path))

        self.assertEqual(data["device_info"]["model"], "Pixel 9")
        self.assertEqual(len(data["contacts"]), 1)
        self.assertGreaterEqual(len(data["chats"]) + len(data["locations"]), 1)

    def test_rejects_archive_without_supported_reports(self):
        path = self.make_archive({"notes.txt": "nothing useful"})
        with self.assertRaises(ValueError):
            parse_ufdr(str(path))


if __name__ == "__main__":
    unittest.main()
