import { useState, useEffect, useRef } from 'react';

export default function AIAgent({ authToken, caseData, onPinEvidence, pinnedEvidenceIds }) {
  const [query, setQuery] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('aegis_gemini_key') || '');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('aegis_gemini_model') || 'gemini-2.5-flash');
  const [domesticCode, setDomesticCode] = useState('91');
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: `<h3>🛡️ Aegis Forensic Agent Initialized</h3>
             <p>Welcome, Investigating Officer. I am ready to analyze the extracted mobile database.</p>
             <p>You can run natural language searches on chat logs, call history, and telemetry. Try clicking one of the preset analysis queries on the left, or write your own specific inquiry below.</p>`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hits: null
    }
  ]);

  const chatEndRef = useRef(null);

  // Auto scroll to latest chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('aegis_gemini_key', key);
  };

  const saveAiModel = (model) => {
    setAiModel(model);
    localStorage.setItem('aegis_gemini_model', model);
  };

  const handlePresetQuery = (text) => {
    setQuery(text);
    executeSearch(text);
  };

  const executeSearch = async (searchQuery) => {
    const activeQuery = searchQuery || query;
    if (!activeQuery.trim()) return;

    setLoading(true);
    // Push user message to chat stream
    setMessages(prev => [...prev, {
      sender: 'user',
      text: activeQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setQuery('');

    try {
      const response = await fetch('https://aegis-backend-2fzl.onrender.com/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: activeQuery,
          domesticCode,
          apiKey,
          model: aiModel
        })
      });

      if (!response.ok) throw new Error('Search failed');
      const resData = await response.json();
      
      // Formulate display content
      let textContent = '';
      
      if (resData.ai_analysis) {
        // Convert markdown-ish text to basic HTML (simple replacer for display)
        textContent = resData.ai_analysis
          .replace(/\n\n/g, '<br><br>')
          .replace(/\n\* /g, '<br>• ')
          .replace(/\n- /g, '<br>• ')
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/\*(.*?)\*/g, '<i>$1</i>')
          .replace(/### (.*?)\n/g, '<h3>$1</h3>')
          .replace(/## (.*?)\n/g, '<h2>$1</h2>');
      } else if (resData.local_analysis) {
        textContent = resData.local_analysis;
      } else {
        const det = resData.deterministic || {};
        const chatsCount = det.flagged_chats?.length || 0;
        const callsCount = det.flagged_calls?.length || 0;
        const entities = det.extracted_entities || {};
        
        textContent = `<h3>🔍 Local Forensic Synthesis Results</h3>`;
        textContent += `<p>Natural language pattern matching scanned all extraction tables for: <b>"${activeQuery}"</b>.</p>`;
        
        if (chatsCount > 0 || callsCount > 0) {
          textContent += `<p>Found <b>${chatsCount} chat messages</b> and <b>${callsCount} calls</b> matching keywords or country anomalies.</p>`;
          
          if (entities.crypto_addresses?.length > 0) {
            textContent += `<div style="background: rgba(255, 196, 0, 0.05); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255, 196, 0, 0.2); margin: 0.75rem 0;">`;
            textContent += `<h4 style="color: var(--accent-amber); margin-bottom: 0.25rem;">💰 Extracted Crypto Wallets:</h4>`;
            entities.crypto_addresses.forEach(addr => {
              textContent += `• <code>${addr.address}</code> (${addr.coin})<br>`;
            });
            textContent += `</div>`;
          }
          
          if (entities.foreign_links?.length > 0) {
            textContent += `<div style="background: rgba(255, 23, 68, 0.05); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255, 23, 68, 0.2); margin: 0.75rem 0;">`;
            textContent += `<h4 style="color: var(--accent-rose); margin-bottom: 0.25rem;">🌐 International Links Detected:</h4>`;
            textContent += `• Communicating countries: <b>${entities.foreign_links.join(', ')}</b><br>`;
            textContent += `</div>`;
          }
        } else {
          textContent += `<p>No direct matches found in text or calls. Try broadening your keywords (e.g., search "crypto", "Dmitry", "Signal", or "wipe").</p>`;
        }
      }

      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: textContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hits: resData.deterministic
      }]);

    } catch (err) {
      console.warn("FastAPI search endpoint failed, loading client-side local fallback.", err);
      // Run client-side deterministic search fallback immediately
      simulateClientSideSearch(activeQuery);
    } finally {
      setLoading(false);
    }
  };

  const simulateClientSideSearch = (activeQuery) => {
    setTimeout(() => {
      // Direct JS filter mock to make UI functional with no backend
      const q = activeQuery.toLowerCase();
      const matchedChats = caseData?.chats?.filter(c => 
        c.body.toLowerCase().includes(q) || 
        c.sender.toLowerCase().includes(q) ||
        (q === 'crypto' && (c.body.includes('0x') || c.body.includes('bc1')))
      ) || [];

      let textContent = `<h3>🔍 Client-Side Forensics Simulator</h3>`;
      textContent += `<p>Offline search matched <b>${matchedChats.length} chat records</b> for query: "${activeQuery}".</p>`;
      
      if (q.includes('crypto') || q.includes('wallet') || q.includes('bitcoin')) {
        textContent += `<div style="background: rgba(255,196,0,0.05); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255,196,0,0.2); margin: 0.75rem 0;">`;
        textContent += `<h4>💸 Simulated Blockchain Identifiers:</h4>`;
        textContent += `• <code>0x3fC91A3afd05880f40F47A7F9a0D7fD298131341</code> (ETH/USDT)<br>`;
        textContent += `• <code>bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</code> (BTC)<br>`;
        textContent += `</div>`;
      }

      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: textContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hits: {
          flagged_chats: matchedChats.map(c => ({
            ...c,
            reasons: ["Offline regex string matched content"],
            entities: []
          })),
          flagged_calls: [],
          flagged_contacts: []
        }
      }]);
    }, 1000);
  };

  // Get the most recent assistant message's parsed database hits to list in interactive sub-panes
  const activeHits = messages.reduceRight((acc, m) => acc || m.hits, null);

  return (
    <div className="ai-agent-layout">
      {/* Sidebar presets panel */}
      <div className="sidebar-presets glass-card">
        <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          💡 Forensic Query Presets
        </h3>
        
        <button className="preset-query-btn" onClick={() => handlePresetQuery("Identify all cryptocurrency wallet addresses mentioned in chats")}>
          💸 Scan Crypto Wallets
        </button>
        <button className="preset-query-btn" onClick={() => handlePresetQuery("List all communication lines involving foreign or international numbers")}>
          🌐 Trace Foreign Connections
        </button>
        <button className="preset-query-btn" onClick={() => handlePresetQuery("Search for chats referencing cash deliveries, escrow, or secret border meeting dropoffs")}>
          💼 Find Financial/Border Leaks
        </button>
        <button className="preset-query-btn" onClick={() => handlePresetQuery("List any chats that were deleted or instructions discussing secure lines like Signal, VPN or Tor")}>
          🔒 Audit Deleted/Secure Chats
        </button>

        {/* Configuration Drawer Trigger */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
          <button 
            className="aegis-btn aegis-btn-secondary" 
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setShowConfig(!showConfig)}
          >
            ⚙️ AI & System Settings
          </button>
        </div>

        {/* Configuration Panel */}
        {showConfig && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Gemini API Key</label>
              <input 
                type="password" 
                className="chat-text-input" 
                style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'var(--bg-primary)', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                placeholder="Paste AI key..."
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Gemini Model</label>
              <select
                className="chat-text-input"
                style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'var(--bg-primary)', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                value={aiModel}
                onChange={(e) => saveAiModel(e.target.value)}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (legacy)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Domestic Code</label>
              <input 
                type="text" 
                className="chat-text-input" 
                style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'var(--bg-primary)', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                placeholder="e.g. 91"
                value={domesticCode}
                onChange={(e) => setDomesticCode(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              * The key is optional. Without it, Aegis uses local ranked forensic retrieval. With it, the backend asks Gemini to write a narrative analysis from the matched evidence.
            </div>
          </div>
        )}
      </div>

      {/* Main chat console and interactive results view */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr auto', height: '100%', gap: '1rem' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1rem', height: '100%', overflow: 'hidden' }}>
          
          {/* Chat Stream Panel */}
          <div className="glass-card chat-console" style={{ height: '100%', overflow: 'hidden' }}>
            <div className="chat-stream">
              {messages.map((m, idx) => (
                <div key={idx} className={`chat-bubble ${m.sender}`}>
                  <div dangerouslySetInnerHTML={{ __html: m.text }} />
                  <span className="timestamp">{m.timestamp}</span>
                </div>
              ))}
              
              {loading && (
                <div className="chat-bubble assistant" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ width: '6px', height: '6px', background: 'var(--accent-cyan)', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate' }}></div>
                  <div style={{ width: '6px', height: '6px', background: 'var(--accent-cyan)', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate 0.2s' }}></div>
                  <div style={{ width: '6px', height: '6px', background: 'var(--accent-cyan)', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate 0.4s' }}></div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Agent analyzing records...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="chat-input-bar">
              <input 
                type="text" 
                className="chat-text-input" 
                placeholder="Ask Aegis (e.g., 'show me chat records mentioning crypto addresses')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                disabled={loading}
              />
              <button 
                className="aegis-btn aegis-btn-primary" 
                onClick={() => executeSearch()}
                disabled={loading}
              >
                Send
              </button>
            </div>
          </div>

          {/* Interactive Extraction Hits Side-Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              🎯 Live Evidence References
            </h3>

            {activeHits && (activeHits.flagged_chats?.length > 0 || activeHits.flagged_calls?.length > 0 || activeHits.flagged_locations?.length > 0) ? (
              <div className="forensic-records-list" style={{ flex: 1 }}>
                
                {/* Loop Flagged Chats */}
                {activeHits.flagged_chats?.map((c, index) => {
                  const sig = `chat-${c.timestamp}-${c.sender.slice(0,3)}`;
                  const isPinned = pinnedEvidenceIds.includes(sig);
                  
                  return (
                    <div key={`chat-${index}`} className={`forensic-record-item ${c.is_deleted ? 'deleted' : 'flagged'}`}>
                      <div className="record-meta">
                        <span>💬 Chat Room: {c.chat_id}</span>
                        <span>{c.timestamp}</span>
                      </div>
                      <div className="record-party">
                        {c.sender} ➔ {c.recipient}
                      </div>
                      <div className="record-body">
                        {c.body}
                      </div>
                      
                      {c.reasons?.map((r, rIdx) => (
                        <div key={rIdx} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', marginTop: '0.25rem' }}>
                          ⚡ {r}
                        </div>
                      ))}

                      <button 
                        className={`pin-evidence-btn ${isPinned ? 'pinned' : ''}`}
                        onClick={() => onPinEvidence(sig)}
                        title="Pin this record as key forensic evidence"
                      >
                        {isPinned ? '📌' : '➕'}
                      </button>
                    </div>
                  );
                })}

                {/* Loop Flagged Calls */}
                {activeHits.flagged_calls?.map((cl, index) => {
                  const sig = `call-${cl.timestamp}-${cl.party.slice(0,3)}`;
                  const isPinned = pinnedEvidenceIds.includes(sig);
                  
                  return (
                    <div key={`call-${index}`} className="forensic-record-item flagged" style={{ borderLeftColor: 'var(--accent-blue)' }}>
                      <div className="record-meta">
                        <span>📞 {cl.direction} Call</span>
                        <span>{cl.timestamp}</span>
                      </div>
                      <div className="record-party">
                        {cl.party} ({cl.phone})
                      </div>
                      <div className="record-body" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        Duration: {cl.duration} | Country: {cl.country || "Domestic"}
                      </div>

                      <button 
                        className={`pin-evidence-btn ${isPinned ? 'pinned' : ''}`}
                        onClick={() => onPinEvidence(sig)}
                        title="Pin this call as key forensic evidence"
                      >
                        {isPinned ? '📌' : '➕'}
                      </button>
                    </div>
                  );
                })}

                {activeHits.flagged_locations?.map((loc, index) => {
                  const sig = `loc-${loc.timestamp}`;
                  const isPinned = pinnedEvidenceIds.includes(sig);

                  return (
                    <div key={`loc-${index}`} className="forensic-record-item flagged" style={{ borderLeftColor: 'var(--accent-emerald)' }}>
                      <div className="record-meta">
                        <span>GPS / Location</span>
                        <span>{loc.timestamp}</span>
                      </div>
                      <div className="record-party">{loc.source || 'Location artifact'}</div>
                      <div className="record-body" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {loc.latitude}, {loc.longitude}
                      </div>
                      {loc.reasons?.map((r, rIdx) => (
                        <div key={rIdx} style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', marginTop: '0.25rem' }}>
                          {r}
                        </div>
                      ))}
                      <button
                        className={`pin-evidence-btn ${isPinned ? 'pinned' : ''}`}
                        onClick={() => onPinEvidence(sig)}
                        title="Pin this location as key forensic evidence"
                      >
                        {isPinned ? 'PIN' : '+'}
                      </button>
                    </div>
                  );
                })}

              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🎯</span>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>No active search hits cataloged.</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Execute a search using the console to extract individual reference nodes here.
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
      
      {/* Styles for typing bounce animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce {
          to { transform: translateY(-4px); }
        }
      `}} />
    </div>
  );
}
