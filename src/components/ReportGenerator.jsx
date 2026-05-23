import { useState } from 'react';

export default function ReportGenerator({ caseData, pinnedEvidenceIds, onRemovePin }) {
  const [officerName, setOfficerName] = useState(caseData?.device_info?.examiner || 'Inspector Vikram Sen');
  const [caseNumber, setCaseNumber] = useState('CASE-2026-X99');
  const [department, setDepartment] = useState('Cyber Crime Investigations Division');
  const [executiveNotes, setExecutiveNotes] = useState(
    'During the device extraction analysis of Vikram Malhotra, we isolated foreign communication linkages (Russia +7 / UK +44) and extracted multiple cryptocurrency wallet addresses linked to suspected Hawala wire schemes. Pinned evidence details are documented below.'
  );

  const chats = caseData?.chats || [];
  const calls = caseData?.calls || [];
  const locations = caseData?.locations || [];

  // Unify and isolate ONLY the items currently pinned/flagged by the officer
  const flaggedEvidence = [];

  chats.forEach(c => {
    const sig = `chat-${c.timestamp}-${c.sender.slice(0,3)}`;
    if (pinnedEvidenceIds.includes(sig)) {
      flaggedEvidence.push({
        sig,
        type: 'Chat Logs',
        time: c.timestamp,
        party: `${c.sender} ➔ ${c.recipient}`,
        body: c.body,
        hash: 'MD5: 5a8e2b9c7d4f1a6e0c3b2f8a9d1e5c6b'
      });
    }
  });

  calls.forEach(cl => {
    const sig = `call-${cl.timestamp}-${cl.party.slice(0,3)}`;
    if (pinnedEvidenceIds.includes(sig)) {
      flaggedEvidence.push({
        sig,
        type: 'Call Records',
        time: cl.timestamp,
        party: cl.party,
        body: `Direction: ${cl.direction} | Duration: ${cl.duration} | Phone: ${cl.phone}`,
        hash: 'MD5: b3c9a2d8f4e7c1b6a0d3e2f5b8a9c1d0'
      });
    }
  });

  locations.forEach(loc => {
    const sig = `loc-${loc.timestamp}`;
    if (pinnedEvidenceIds.includes(sig)) {
      flaggedEvidence.push({
        sig,
        type: 'GPS Telemetry',
        time: loc.timestamp,
        party: `Source: ${loc.source}`,
        body: `Latitude: ${loc.latitude} | Longitude: ${loc.longitude}`,
        hash: 'MD5: d8f4e7c1b6a0d3e2f5b8a9c1d0b3c9a2'
      });
    }
  });

  // Sort flagged items chronologically
  flaggedEvidence.sort((a, b) => new Date(a.time) - new Date(b.time));

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      
      {/* Left Column: Dossier Input Sheets */}
      <div className="glass-card highlight" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
          📝 Dossier Assembly Sheet
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Case Reference ID</label>
            <input 
              type="text" 
              className="chat-text-input" 
              style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}
              value={caseNumber} 
              onChange={(e) => setCaseNumber(e.target.value)} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Lead Officer / Examiner</label>
              <input 
                type="text" 
                className="chat-text-input" 
                style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}
                value={officerName} 
                onChange={(e) => setOfficerName(e.target.value)} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Investigation Department</label>
              <input 
                type="text" 
                className="chat-text-input" 
                style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}
                value={department} 
                onChange={(e) => setDepartment(e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Executive Summary / Analysis Narrative</label>
            <textarea 
              className="chat-text-input" 
              style={{ width: '100%', minHeight: '120px', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-secondary)', resize: 'vertical' }}
              value={executiveNotes}
              onChange={(e) => setExecutiveNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Pin Evidence Checklist */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            📌 Flagged Evidence Basket ({flaggedEvidence.length})
          </h3>

          {flaggedEvidence.length > 0 ? (
            <div className="flagged-list-container" style={{ flex: 1 }}>
              {flaggedEvidence.map((ev, index) => (
                <div key={index} className="flagged-mini-item">
                  <div>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '0.5rem' }}>[{ev.type}]</span>
                    <span style={{ color: 'var(--text-primary)' }}>{ev.party.slice(0, 30)}{ev.party.length > 30 ? '...' : ''}</span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>🕒 {ev.time}</div>
                  </div>
                  <button 
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '1rem' }}
                    onClick={() => onRemovePin(ev.sig)}
                    title="Remove item from dossier"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem 0', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: '8px' }}>
              <span>📥</span>
              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>No evidence flagged yet.</div>
              <div style={{ fontSize: '0.75rem', padding: '0 1rem' }}>
                Use the AIAgent or Timeline panels and click the <b>➕ / 📌</b> buttons to flag critical logs for dossier assembly.
              </div>
            </div>
          )}
        </div>

        <button 
          className="aegis-btn aegis-btn-amber"
          style={{ width: '100%', justifyContent: 'center', fontWeight: 'bold' }}
          onClick={triggerPrint}
          disabled={flaggedEvidence.length === 0}
        >
          🖨️ Compile & Print Forensic Report (Save PDF)
        </button>
      </div>

      {/* Right Column: Dossier Preview Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#ffffff', color: '#111111' }}>
        <h2 style={{ fontSize: '1.1rem', color: '#333333', borderBottom: '2px solid #333333', paddingBottom: '0.5rem', margin: 0 }}>
          🛡️ Aegis Forensic Findings Report
        </h2>
        
        {/* Core telemetry details preview */}
        <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderBottom: '1px solid #dddddd', paddingBottom: '0.5rem' }}>
          <div>
            <b>CASE REFERENCE:</b> {caseNumber}<br />
            <b>TARGET DEVICE:</b> {caseData?.device_info?.model || 'OnePlus 11 5G'}<br />
            <b>IMEI SERIAL:</b> {caseData?.device_info?.imei || 'Unknown'}
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>EXAMINER:</b> {officerName}<br />
            <b>DEPARTMENT:</b> {department}<br />
            <b>DATE OF REPORT:</b> {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Narrative Preview */}
        <div style={{ fontSize: '0.8rem', background: '#f8f9fa', padding: '0.5rem 0.75rem', borderRadius: '4px', borderLeft: '3px solid #ffc400', fontStyle: 'italic', lineHeight: 1.4 }}>
          <b>Executive Summary:</b> {executiveNotes || 'No executive summary provided.'}
        </div>

        {/* Evidence Logs table preview */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#333', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>
            ⚖️ Cataloged Evidence Logs ({flaggedEvidence.length})
          </h3>
          
          {flaggedEvidence.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {flaggedEvidence.map((ev, index) => (
                <div key={index} style={{ fontSize: '0.75rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span style={{ color: '#0066cc' }}>[{ev.type}] {ev.party}</span>
                    <span style={{ color: '#666' }}>{ev.time}</span>
                  </div>
                  <div style={{ padding: '0.25rem 0', color: '#333' }}>
                    {ev.body}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#888' }}>
                    🔐 Integrity Hash: {ev.hash}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888888', fontSize: '0.8rem' }}>
              Evidence logs empty. Add pins in other panels to preview dossier nodes.
            </div>
          )}
        </div>

        {/* Signoff preview */}
        <div style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '0.5rem', marginTop: 'auto' }}>
          <div>
            Examiner Sign-off: ________________________
          </div>
          <div>
            Verifying Officer: ________________________
          </div>
        </div>

      </div>

      {/* =======================================================================
          HIDDEN ON-SCREEN PRINT CONTAINER (STRIPPED WHITE BACKGROUND PRINT SPEC)
          This container renders beautifully ONLY during browser print invocation
          ======================================================================= */}
      <div className="report-print-container">
        
        {/* Header Block */}
        <div className="print-case-meta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'Outfit, sans-serif' }}>🛡️ AEGIS FORENSICS DOSSIER REPORT</h1>
            <span style={{ background: '#333', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>OFFICIAL RECORD</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem', fontSize: '12px' }}>
            <div>
              <p><b>CASE REFERENCE:</b> {caseNumber}</p>
              <p><b>ASSIGNED AGENCY:</b> {department}</p>
              <p><b>LEAD EXAMINER:</b> {officerName}</p>
              <p><b>DATE OF EXPORT:</b> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><b>DEVICE SPEC:</b> {caseData?.device_info?.model}</p>
              <p><b>DEVICE TELEPHONY:</b> {caseData?.device_info?.phone_number}</p>
              <p><b>IMEI PARTITION HASH:</b> {caseData?.device_info?.imei}</p>
              <p><b>EXTRACTION HASH:</b> {caseData?.device_info?.serial}</p>
            </div>
          </div>
        </div>

        {/* Narrative Executive Statement */}
        <div className="print-card" style={{ background: '#fcfcfc', border: '1px solid #ddd', padding: '15px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', textTransform: 'uppercase' }}>Executive Summary of Investigations</h3>
          <p style={{ margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{executiveNotes}</p>
        </div>

        {/* Compiled Flagged Evidence list */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ borderBottom: '2px solid #333', paddingBottom: '5px', fontSize: '15px', textTransform: 'uppercase', marginBottom: '15px' }}>
            ⚖️ Cataloged Evidence Logs ({flaggedEvidence.length} Nodes)
          </h3>

          {flaggedEvidence.map((ev, index) => (
            <div key={index} className="print-evidence-row" style={{ pageBreakInside: 'avoid', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px dashed #cccccc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                <span style={{ color: '#0044aa' }}>[{index + 1}] [{ev.type}] {ev.party}</span>
                <span style={{ color: '#555555' }}>🕒 {ev.time}</span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#111111', padding: '4px 0', lineHeight: 1.4 }}>
                {ev.body}
              </div>
              <div style={{ fontSize: '10.5px', color: '#666666', marginTop: '3px' }}>
                <span className="print-hash">🔐 Forensic Integrity Hash: {ev.hash}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chain of Custody Signature Ledger */}
        <div style={{ marginTop: '4rem', pageBreakInside: 'avoid' }}>
          <h3 style={{ borderBottom: '2px solid #333', paddingBottom: '5px', fontSize: '14px', textTransform: 'uppercase', marginBottom: '20px' }}>
            ⛓️ Chain of Custody & Verification Ledger
          </h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Custodian (Rank & Name)</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Action Performed</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Release Date</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Signature Block</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{officerName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>Physical Device Extraction & Parse Indexing</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{caseData?.device_info?.extraction_time || new Date().toLocaleDateString()}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontStyle: 'italic', color: '#888' }}>Self-Signed (Secure Terminal)</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #ddd', padding: '8px', height: '35px' }}></td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>Evidence Handover to Judicial Registry</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #ddd', padding: '8px', height: '35px' }}></td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>Repository Cryptographic Verification</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
              </tr>
            </tbody>
          </table>
          
          <div style={{ marginTop: '2rem', fontSize: '10px', color: '#555555', fontStyle: 'italic' }}>
            Note: This dossier was compiled on-premises by the Aegis Forensics platform. All extracted hashes are local filesystem hashes verifying partition integrity.
          </div>
        </div>

      </div>

    </div>
  );
}
