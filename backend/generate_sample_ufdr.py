import os
import zipfile
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

def generate_ufdr_file():
    print("Initializing forensic case generator: Operation Intel-Leak...")
    
    # 1. Define target case XML content in Cellebrite standard schema
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
<report>
  <metadata>
    <case_name>Operation Intel-Leak</case_name>
    <examiner>Officer Amanda Pierce</examiner>
  </metadata>
  
  <device_info>
    <model>Apple iPhone 14 Pro (A2890)</model>
    <os>iOS 16.5 (20F66)</os>
    <phone_number>+1 202-555-0144</phone_number>
    <imei>358902849204928</imei>
    <serial>F17X99A82D09</serial>
    <extraction_time>2026-05-23 09:15:00</extraction_time>
  </device_info>

  <model name="Contacts">
    <row>
      <field name="Name">Marcus (Competitor Handler)</field>
      <field name="Phone">+49 170 1234567</field>
      <field name="Email">marcus.h@munich-genomics.de</field>
      <field name="Notes">Germany division handler. Suspected corporate espionage liaison. Coordinates OTC payouts.</field>
    </row>
    <row>
      <field name="Name">Linus (Courier)</field>
      <field name="Phone">+49 89 234567</field>
      <field name="Email">linus.drop@securesmtp.eu</field>
      <field name="Notes">Local dropoff courier in Berlin area. Delivers hardware sequence keys.</field>
    </row>
    <row>
      <field name="Name">Dr. Aris (Co-conspirator)</field>
      <field name="Phone">+1 202-555-0188</field>
      <field name="Email">aris.genomics@biotech-labs.org</field>
      <field name="Notes">Lab partner. Assisted in downloading sequence blocks from server backups.</field>
    </row>
  </model>

  <model name="Calls">
    <row>
      <field name="Party">Marcus (Competitor Handler)</field>
      <field name="Phone">+49 170 1234567</field>
      <field name="Direction">Incoming</field>
      <field name="Date">2026-05-21 16:20:00</field>
      <field name="Duration">00:08:42</field>
    </row>
    <row>
      <field name="Party">Dr. Aris (Co-conspirator)</field>
      <field name="Phone">+1 202-555-0188</field>
      <field name="Direction">Outgoing</field>
      <field name="Date">2026-05-21 21:05:00</field>
      <field name="Duration">00:02:15</field>
    </row>
    <row>
      <field name="Party">Linus (Courier)</field>
      <field name="Phone">+49 89 234567</field>
      <field name="Direction">Incoming</field>
      <field name="Date">2026-05-22 10:11:00</field>
      <field name="Duration">00:01:30</field>
    </row>
    <row>
      <field name="Party">Marcus (Competitor Handler)</field>
      <field name="Phone">+49 170 1234567</field>
      <field name="Direction">Missed</field>
      <field name="Date">2026-05-22 23:45:00</field>
      <field name="Duration">00:00:00</field>
    </row>
  </model>

  <model name="Chats">
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Marcus (Competitor Handler)</field>
      <field name="Recipient">Self</field>
      <field name="Body">Gregory, did you extract the DNA synthesis draft file? We need the genome sequence profile before the lab server locks.</field>
      <field name="Date">2026-05-21 16:30:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Self</field>
      <field name="Recipient">Marcus (Competitor Handler)</field>
      <field name="Body">Yes, downloaded the entire genome sequence profile. Extracted the sequence mapping parameters. Transferring now.</field>
      <field name="Date">2026-05-21 16:32:15</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Marcus (Competitor Handler)</field>
      <field name="Recipient">Self</field>
      <field name="Body">Excellent. What is your digital payment address for the 2.5 BTC escrow release?</field>
      <field name="Date">2026-05-21 16:35:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Self</field>
      <field name="Recipient">Marcus (Competitor Handler)</field>
      <field name="Body">Send the payment of 2.5 BTC to my secure ledger wallet address: bc1qy8y9z4x6n6u8v7p9q0a3c2e1f5g4h3j2k1l0m. Let me know once chain confirms.</field>
      <field name="Date">2026-05-21 16:38:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Marcus (Competitor Handler)</field>
      <field name="Recipient">Self</field>
      <field name="Body">USDT transfer is alternative if BTC fees are high. Make sure to delete these chats. Don't keep any logs on your mobile phone.</field>
      <field name="Date">2026-05-21 16:42:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Dr_Aris_Signal</field>
      <field name="Sender">Dr. Aris (Co-conspirator)</field>
      <field name="Recipient">Self</field>
      <field name="Body">Gregory, be careful. The board is auditing the lab servers. Wiping my Signal logs and secure partition now. Enable secure VPN.</field>
      <field name="Date">2026-05-21 21:10:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Self</field>
      <field name="Recipient">Marcus (Competitor Handler)</field>
      <field name="Body">Linus, drop the physical prototype key at coordinates: 52.5200 N, 13.4050 E near Berlin center. Hide it under the bench.</field>
      <field name="Date">2026-05-22 10:15:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Linus (Courier)</field>
      <field name="Recipient">Self</field>
      <field name="Body">Confirmed. Drop completed. The package is hidden under the secure spot near the plaza.</field>
      <field name="Date">2026-05-22 10:20:00</field>
      <field name="Deleted">false</field>
    </row>
    <row>
      <field name="Chat_Id">Marcus_iMessage</field>
      <field name="Sender">Self</field>
      <field name="Recipient">Marcus (Competitor Handler)</field>
      <field name="Body">Use Dmitry's private escrow. He will handle the cash convert.</field>
      <field name="Date">2026-05-22 14:05:00</field>
      <field name="Deleted">true</field>
    </row>
  </model>

  <model name="Locations">
    <row>
      <field name="Latitude">38.9072</field>
      <field name="Longitude">-77.0369</field>
      <field name="Date">2026-05-21 16:30:00</field>
      <field name="Source">Cell Tower Washington DC</field>
    </row>
    <row>
      <field name="Latitude">52.5200</field>
      <field name="Longitude">13.4050</field>
      <field name="Date">2026-05-22 10:20:00</field>
      <field name="Source">Google Maps Cache Berlin</field>
    </row>
  </model>
</report>
"""

    # 2. Create a temporary folder to write the report.xml file
    with tempfile.TemporaryDirectory() as temp_dir:
        xml_file_path = os.path.join(temp_dir, "report.xml")
        with open(xml_file_path, "w", encoding="utf-8") as f:
            f.write(xml_content)

        extra_xml_path = os.path.join(temp_dir, "signal_extra.xml")
        with open(extra_xml_path, "w", encoding="utf-8") as f:
            f.write("""<?xml version="1.0" encoding="UTF-8"?>
<root>
  <model name="Messages">
    <row>
      <field name="Chat_Id">Dr_Aris_Signal</field>
      <field name="Sender">Self</field>
      <field name="Recipient">Dr. Aris (Co-conspirator)</field>
      <field name="Body">Secondary app artifact recovered: remove the USB key from lab locker 4 before the audit.</field>
      <field name="Date">2026-05-22 18:15:00</field>
      <field name="Deleted">false</field>
    </row>
  </model>
  <model name="Locations">
    <row>
      <field name="Latitude">38.8899</field>
      <field name="Longitude">-77.0091</field>
      <field name="Date">2026-05-22 18:20:00</field>
      <field name="Source">Secondary App Location Cache</field>
    </row>
  </model>
</root>
""")

        manifest_path = os.path.join(temp_dir, "manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write('{"tool":"Aegis UFDR fixture","purpose":"parser compatibility smoke test"}')
        
        # 3. Zip the file to form the sample_intel_leak.ufdr
        project_root = Path(__file__).resolve().parents[1]
        output_zip_path = project_root / "public" / "sample_intel_leak.ufdr"
        with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.write(xml_file_path, "report.xml")
            zip_file.write(extra_xml_path, "artifacts/signal_extra.xml")
            zip_file.write(manifest_path, "manifest.json")
            
        print(f"Extraction packaging complete! File saved to: {output_zip_path}")
        print("Integrity checksum MD5 placeholder generated: [Case #2026-IP-88]")

if __name__ == "__main__":
    generate_ufdr_file()
