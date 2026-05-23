import { useState } from 'react';

export default function NetworkGraph({ caseData, onSelectContact }) {
  const [selectedNode, setSelectedNode] = useState(null);
  
  const contacts = caseData?.contacts || [];
  const calls = caseData?.calls || [];
  const chats = caseData?.chats || [];

  // 1. Calculate communication volumes per contact to weight links
  const contactStats = contacts.map(c => {
    const name = c.name;
    const phone = c.phone;
    
    // Count matches in calls and chats
    const contactCalls = calls.filter(cl => cl.party === name || cl.phone === phone);
    const contactChats = chats.filter(ch => ch.sender === name || ch.recipient === name);
    const totalVolume = contactCalls.length + contactChats.length;

    // Check if foreign number
    const isForeign = phone.startsWith('+') && !phone.startsWith('+91') && !phone.startsWith('+1');
    const country = isForeign ? (phone.startsWith('+7') ? "Russia" : (phone.startsWith('+44') ? "United Kingdom" : "International")) : "Domestic";

    return {
      ...c,
      callsCount: contactCalls.length,
      chatsCount: contactChats.length,
      totalVolume,
      isForeign,
      country
    };
  });

  // Center coordinates of our SVG
  const width = 500;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;
  const radialRadius = 160;

  // Calculate SVG positions for all active contacts
  const positionedNodes = contactStats.map((c, index) => {
    const angle = (2 * Math.PI * index) / contactStats.length;
    const x = cx + radialRadius * Math.cos(angle);
    const y = cy + radialRadius * Math.sin(angle);
    return {
      ...c,
      x,
      y,
      angle
    };
  });

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (onSelectContact) {
      onSelectContact(node.name);
    }
  };

  return (
    <div className="network-layout">
      {/* Left Pane: Interactive SVG Graph */}
      <div className="glass-card highlight" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🔗 Visual Link Analysis Map</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Linkages</span>
        </h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Select connection nodes to isolate communications. Line thickness represents interaction volume.
        </div>

        <div className="graph-canvas-container" style={{ flex: 1 }}>
          <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`}>
            {/* Definitions for Gradients and Clean Shadows */}
            <defs>
              <radialGradient id="suspectGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                <stop offset="80%" stopColor="#1e3a8a" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="contactGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#94a3b8" />
              </radialGradient>
              <radialGradient id="foreignGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fee2e2" />
                <stop offset="100%" stopColor="#b91c1c" />
              </radialGradient>
            </defs>

            {/* Link lines first so nodes render on top */}
            {positionedNodes.map((node, idx) => {
              // Weight link thickness based on communication frequency
              const strokeWidth = Math.max(1, Math.min(8, node.totalVolume * 0.7));
              const isSelected = selectedNode?.name === node.name;
              
              return (
                <g key={`link-${idx}`}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={node.x}
                    y2={node.y}
                    className={`link-line ${node.isForeign ? 'suspicious' : ''}`}
                    style={{
                      strokeWidth: isSelected ? strokeWidth + 2 : strokeWidth,
                      stroke: isSelected ? 'var(--accent-blue)' : (node.isForeign ? 'var(--accent-rose)' : 'var(--text-muted)'),
                      opacity: selectedNode ? (isSelected ? 1.0 : 0.2) : 0.5
                    }}
                  />
                  
                  {/* Floating transmission packet count indicator along the line */}
                  <circle
                    cx={cx + (node.x - cx) * 0.45}
                    cy={cy + (node.y - cy) * 0.45}
                    r="9.5"
                    fill="#e2e8f0"
                    stroke={node.isForeign ? 'var(--accent-rose)' : 'var(--text-muted)'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={cx + (node.x - cx) * 0.45}
                    y={cy + (node.y - cy) * 0.45 + 3.5}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="8.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="bold"
                  >
                    {node.totalVolume}
                  </text>
                </g>
              );
            })}

            {/* Suspect Target Node in Center */}
            <g transform={`translate(${cx}, ${cy})`} onClick={() => setSelectedNode(null)} className="node-suspect" style={{ filter: 'drop-shadow(0px 2px 4px rgba(30, 58, 138, 0.15))' }}>
              <circle r="36" fill="rgba(30, 58, 138, 0.08)" stroke="var(--accent-cyan)" strokeWidth="2.5" />
              <circle r="26" fill="url(#suspectGrad)" />
              <circle r="12" fill="#ffffff" stroke="var(--accent-cyan)" strokeWidth="1" />
              <text y="3.5" textAnchor="middle" fill="rgb(0,0,0)" fontSize="9" fontWeight="bold" fontFamily="var(--font-headings)">
                TARGET
              </text>
            </g>

            {/* Contacts Nodes distributed orbitally */}
            {positionedNodes.map((node, idx) => {
              const isSelected = selectedNode?.name === node.name;
              const textYOffset = node.y > cy ? 25 : -15;
              
              return (
                <g 
                  key={`node-${idx}`} 
                  transform={`translate(${node.x}, ${node.y})`}
                  className="node-contact"
                  onClick={() => handleNodeClick(node)}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle r="24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeDasharray="3,3" />
                  )}
                  
                  {/* Outer Ring */}
                  <circle 
                    r="16" 
                    fill="#ffffff" 
                    stroke={node.isForeign ? 'var(--accent-rose)' : 'var(--text-muted)'} 
                    strokeWidth={isSelected ? "2.5" : "1.5"} 
                  />
                  
                  {/* Core Node */}
                  <circle 
                    r="11" 
                    fill={node.isForeign ? "url(#foreignGrad)" : "url(#contactGrad)"} 
                  />

                  {/* Initials */}
                  <text 
                    y="3" 
                    textAnchor="middle" 
                    fill={node.isForeign ? "#ffffff" : "var(--text-primary)"} 
                    fontSize="8.5" 
                    fontWeight="bold"
                    fontFamily="var(--font-headings)"
                  >
                    {node.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </text>

                  {/* Label */}
                  <text
                    y={textYOffset}
                    textAnchor="middle"
                    fill={isSelected ? "var(--accent-blue)" : "var(--text-primary)"}
                    fontSize="9"
                    fontWeight={isSelected ? "800" : "600"}
                    fontFamily="var(--font-body)"
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* SVG Canvas Map Legend */}
          <div className="graph-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--accent-cyan)' }}></div>
              <span>Subject Device (Core Node)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--text-muted)' }}></div>
              <span>Domestic Linkage</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--accent-rose)' }}></div>
              <span>Suspicious International Link</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Selected Node Profile Dossier */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 style={{ fontSize: '1.2rem', borderBottom: '2px solid var(--accent-cyan)', paddingBottom: '0.5rem' }}>
          🔎 Entity Profile Dossier
        </h2>

        {selectedNode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
            
            {/* Header info */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span className="record-party" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  {selectedNode.name}
                </span>
                <span className={`record-badge ${selectedNode.isForeign ? 'badge-rose' : 'badge-cyan'}`} style={{ border: '1px solid' }}>
                  {selectedNode.country}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                📞 {selectedNode.phone}
              </div>
              {selectedNode.email && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  ✉️ {selectedNode.email}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--bg-tertiary)', borderRadius: '4px', padding: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                Investigator Case Notes
              </div>
              <div style={{ color: 'var(--text-primary)', fontStyle: selectedNode.notes ? 'normal' : 'italic' }}>
                {selectedNode.notes || "No custom intelligence notes logged for this contact yet."}
              </div>
            </div>

            {/* Stats dials */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Calls Records</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>{selectedNode.callsCount}</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Chats Swapped</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>{selectedNode.chatsCount}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                * Selecting this node isolates communication streams in the Timeline and Chat consoles.
              </div>
              <button 
                className="aegis-btn aegis-btn-secondary" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setSelectedNode(null)}
              >
                Clear Filter Focus
              </button>
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.25rem' }}>🗺️</span>
            <div style={{ fontWeight: '600' }}>No contact node selected.</div>
            <div style={{ fontSize: '0.8rem' }}>
              Select any contact node in the map web to load their forensic intelligence profile.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
