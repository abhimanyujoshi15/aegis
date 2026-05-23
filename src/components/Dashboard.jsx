import { useState } from 'react';

export default function Dashboard({ authToken, caseData, investigator, onUploadSuccess }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ loading: false, error: null });

  const device = caseData?.device_info || {};
  const stats = {
    contacts: caseData?.contacts?.length || 0,
    calls: caseData?.calls?.length || 0,
    chats: caseData?.chats?.length || 0,
    locations: caseData?.locations?.length || 0,
  };
  const diagnostics = caseData?._diagnostics;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files?.[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    setUploadStatus({ loading: true, error: null });
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.detail || 'Failed to parse the forensic file.');
      }

      onUploadSuccess(file.name, resData);
      setUploadStatus({ loading: false, error: null });
    } catch (err) {
      setUploadStatus({ loading: false, error: err.message || 'Could not upload and parse this file.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {!caseData && (
        <div className="ingestion-required">
          <div>
            <h2>Upload a UFDR file to begin analysis</h2>
            <p>
              The application now requires investigator login first, then UFDR ingestion. Loading,
              search, link analysis, timeline, and reporting unlock after a successful upload.
            </p>
          </div>
          <a className="aegis-btn aegis-btn-secondary" href="/sample_intel_leak.ufdr" download>
            Download sample UFDR
          </a>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="glass-card dashboard-stats-card highlight">
          <div className="stat-info">
            <h3>Extracted Chats</h3>
            <div className="stat-value">{stats.chats}</div>
          </div>
          <div className="stat-icon">MSG</div>
        </div>

        <div className="glass-card dashboard-stats-card">
          <div className="stat-info">
            <h3>Call Records</h3>
            <div className="stat-value">{stats.calls}</div>
          </div>
          <div className="stat-icon">CALL</div>
        </div>

        <div className="glass-card dashboard-stats-card">
          <div className="stat-info">
            <h3>Associated Contacts</h3>
            <div className="stat-value">{stats.contacts}</div>
          </div>
          <div className="stat-icon">ID</div>
        </div>

        <div className="glass-card dashboard-stats-card">
          <div className="stat-info">
            <h3>Geolocation Logs</h3>
            <div className="stat-value">{stats.locations}</div>
          </div>
          <div className="stat-icon">GPS</div>
        </div>
      </div>

      <div className="dashboard-meta-grid">
        <div className="glass-card highlight" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Active Target Device Profile</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Case: {device.case_name || 'No UFDR loaded'}</span>
          </h2>

          <table className="meta-table">
            <tbody>
              <tr>
                <td className="label">Device Name / Model</td>
                <td className="val" style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{device.model || 'Awaiting upload'}</td>
              </tr>
              <tr>
                <td className="label">Operating System</td>
                <td className="val">{device.os || '-'}</td>
              </tr>
              <tr>
                <td className="label">IMEI Number</td>
                <td className="val">{device.imei || '-'}</td>
              </tr>
              <tr>
                <td className="label">Hardware Serial</td>
                <td className="val">{device.serial || '-'}</td>
              </tr>
              <tr>
                <td className="label">Device Phone Number</td>
                <td className="val" style={{ color: 'var(--accent-amber)' }}>{device.phone_number || '-'}</td>
              </tr>
              <tr>
                <td className="label">Extraction Timestamp</td>
                <td className="val">{device.extraction_time || '-'}</td>
              </tr>
              <tr>
                <td className="label">Assigned Examiner</td>
                <td className="val">{device.examiner || investigator?.name || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>
            <b>Examiner Directives:</b> Confirm chain of custody before upload. Keep analysis disabled until the extracted report has been parsed into the active case.
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Forensic Ingestion Center</h2>

          <form
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            style={{ width: '100%' }}
          >
            <input
              type="file"
              id="file-upload-input"
              style={{ display: 'none' }}
              accept=".ufdr,.xml,.zip,.json"
              onChange={handleFileInput}
            />
            <label
              htmlFor="file-upload-input"
              className={`upload-dropzone ${isDragActive ? 'active' : ''}`}
            >
              <div className="upload-icon">UFDR</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
                {uploadStatus.loading ? 'Parsing extraction data...' : 'Drag and drop forensic report'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Supports UFDR/ZIP archives, XML exports, and JSON report fixtures
              </div>
              <span className="aegis-btn aegis-btn-secondary" style={{ marginTop: '0.5rem' }}>
                Browse Files
              </span>
            </label>
          </form>

          {uploadStatus.error && (
            <div style={{ padding: '0.5rem', background: 'rgba(255,23,68,0.1)', color: 'var(--accent-rose)', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', border: '1px solid rgba(255,23,68,0.2)' }}>
              Error: {uploadStatus.error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
            <a
              className="aegis-btn aegis-btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              href="/sample_intel_leak.ufdr"
              download
            >
              Download sample UFDR for testing
            </a>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Signed in as {investigator?.name || 'Investigator'}. Upload this file to unlock analysis.
            </div>
          </div>
        </div>
      </div>

      {diagnostics && (
        <div className="glass-card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>UFDR Import Diagnostics</h2>
          <div className="diagnostics-grid">
            <div>
              <span className="diag-label">Archive type</span>
              <b>{diagnostics.archive_type || 'unknown'}</b>
            </div>
            <div>
              <span className="diag-label">Files seen</span>
              <b>{diagnostics.files_seen ?? 0}</b>
            </div>
            <div>
              <span className="diag-label">Files parsed</span>
              <b>{diagnostics.files_parsed?.length || 0}</b>
            </div>
            <div>
              <span className="diag-label">Files skipped</span>
              <b>{diagnostics.files_skipped?.length || 0}</b>
            </div>
          </div>
          {diagnostics.files_parsed?.length > 0 && (
            <div className="diag-detail">
              <b>Parsed:</b> {diagnostics.files_parsed.join(', ')}
            </div>
          )}
          {diagnostics.files_skipped?.length > 0 && (
            <div className="diag-detail">
              <b>Skipped:</b> {diagnostics.files_skipped.map(item => `${item.file} (${item.reason})`).join('; ')}
            </div>
          )}
          {diagnostics.warnings?.map((warning, index) => (
            <div className="diag-warning" key={index}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
