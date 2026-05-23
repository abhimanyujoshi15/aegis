import { useState } from 'react';

export default function TimelineView({ caseData, onPinEvidence, pinnedEvidenceIds }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All', 'Chat', 'Call', 'Location'
  const [showOnlyDeleted, setShowOnlyDeleted] = useState(false);

  const chats = caseData?.chats || [];
  const calls = caseData?.calls || [];
  const locations = caseData?.locations || [];

  // 1. Format and unify all data sources into a single timeline array
  const formattedChats = chats.map(c => ({
    ...c,
    type: 'Chat',
    sortTime: c.timestamp,
    party: `${c.sender} ➔ ${c.recipient}`,
    bodyText: c.body,
    deleted: c.is_deleted,
    signature: `chat-${c.timestamp}-${c.sender.slice(0,3)}`
  }));

  const formattedCalls = calls.map(cl => ({
    ...cl,
    type: 'Call',
    sortTime: cl.timestamp,
    party: `${cl.party} (${cl.phone})`,
    bodyText: `Direction: ${cl.direction} | Duration: ${cl.duration}`,
    deleted: false,
    signature: `call-${cl.timestamp}-${cl.party.slice(0,3)}`
  }));

  const formattedLocations = locations.map(loc => ({
    ...loc,
    type: 'Location',
    sortTime: loc.timestamp,
    party: `Location Fix (${loc.source})`,
    bodyText: `Latitude: ${loc.latitude} | Longitude: ${loc.longitude}`,
    deleted: false,
    signature: `loc-${loc.timestamp}`
  }));

  // 2. Combine and sort chronologically (oldest to newest, or newest to oldest. Forensics usually prefers oldest to newest to follow the trail!)
  const consolidatedTimeline = [
    ...formattedChats,
    ...formattedCalls,
    ...formattedLocations
  ].sort((a, b) => new Date(a.sortTime) - new Date(b.sortTime));

  // 3. Apply Filters
  const filteredTimeline = consolidatedTimeline.filter(item => {
    // Filter by type
    if (filterType !== 'All' && item.type !== filterType) return false;
    
    // Filter by deleted
    if (showOnlyDeleted && !item.deleted) return false;

    // Filter by search query
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchParty = item.party.toLowerCase().includes(q);
      const matchBody = item.bodyText.toLowerCase().includes(q);
      const matchTime = item.sortTime.includes(q);
      return matchParty || matchBody || matchTime;
    }

    return true;
  });

  return (
    <div className="glass-card highlight" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header controls bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📅 Chronological Event Sequencer</span>
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Reconstructs the suspect's timeline of interactions, call flows, and coordinate logs step-by-step.
          </div>
        </div>

        {/* Filters and search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          <input 
            type="text" 
            className="chat-text-input" 
            style={{ width: '220px', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-secondary)', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            placeholder="Filter by keyword / time..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select 
            className="chat-text-input"
            style={{ width: '130px', border: '1px solid var(--glass-border)', borderRadius: '6px', background: 'var(--bg-secondary)', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="All">All Entries</option>
            <option value="Chat">Chats Only</option>
            <option value="Call">Calls Only</option>
            <option value="Location">GPS Fixes</option>
          </select>

          <button 
            className={`aegis-btn ${showOnlyDeleted ? 'aegis-btn-danger' : 'aegis-btn-secondary'}`}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => setShowOnlyDeleted(!showOnlyDeleted)}
          >
            {showOnlyDeleted ? "⚠️ Showing Deleted Only" : "Scan Deleted Messages"}
          </button>
        </div>
      </div>

      {/* Dynamic timeline flow */}
      {filteredTimeline.length > 0 ? (
        <div className="timeline-scroller">
          {filteredTimeline.map((item, idx) => {
            const isPinned = pinnedEvidenceIds.includes(item.signature);
            
            return (
              <div key={idx} className={`timeline-node ${item.type}`}>
                {/* Visual marker dot */}
                <div className="timeline-marker"></div>

                {/* Event card details */}
                <div className="timeline-content-card" style={{
                  borderLeft: item.deleted ? '3px solid var(--accent-rose)' : (isPinned ? '3px solid var(--accent-amber)' : '1px solid var(--glass-border)'),
                  background: item.deleted ? 'rgba(255, 23, 68, 0.01)' : 'rgba(255, 255, 255, 0.01)',
                  position: 'relative'
                }}>
                  
                  {/* Pinned star flag */}
                  <button 
                    className={`pin-evidence-btn ${isPinned ? 'pinned' : ''}`}
                    style={{ top: '0.75rem', right: '0.75rem' }}
                    onClick={() => onPinEvidence(item.signature)}
                    title="Pin item as key report evidence"
                  >
                    {isPinned ? '📌' : '➕'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    {/* Source badge */}
                    <span className={`record-badge ${
                      item.type === 'Chat' ? 'badge-cyan' : 
                      item.type === 'Call' ? 'badge-cyan' : 'badge-emerald'
                    }`} style={{ 
                      background: item.type === 'Call' ? 'rgba(41, 121, 255, 0.15)' : '',
                      color: item.type === 'Call' ? 'var(--accent-blue)' : ''
                    }}>
                      {item.type}
                    </span>

                    {item.deleted && (
                      <span className="record-badge badge-rose">DELETED</span>
                    )}

                    {/* Timestamp */}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      🕒 {item.sortTime}
                    </span>
                  </div>

                  <div className="record-party" style={{ fontSize: '0.95rem', color: item.deleted ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                    {item.party}
                  </div>

                  <div className="record-body" style={{ marginTop: '0.25rem', fontFamily: item.type === 'Location' ? 'var(--font-mono)' : 'inherit', fontSize: item.type === 'Location' ? '0.85rem' : '0.9rem' }}>
                    {item.bodyText}
                  </div>
                  
                  {item.attachment && (
                    <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--glass-border)', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      📎 Attachment: <u>{item.attachment}</u>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-muted)', gap: '0.5rem' }}>
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <div>No events found matching current criteria.</div>
          <div style={{ fontSize: '0.8rem' }}>
            Try clearing your search filters or reloading the mock case to populate timeline items.
          </div>
        </div>
      )}

    </div>
  );
}
