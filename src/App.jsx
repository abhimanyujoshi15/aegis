import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import AIAgent from './components/AIAgent';
import NetworkGraph from './components/NetworkGraph';
import TimelineView from './components/TimelineView';
import ReportGenerator from './components/ReportGenerator';

const API_BASE = 'http://127.0.0.1:8000';

function AuthGate({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: '' });

  const submitAuth = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: '' });

    try {
      const response = await fetch(`${API_BASE}/api/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Authentication failed.');
      }

      localStorage.setItem('aegis_auth_token', result.token);
      localStorage.setItem('aegis_user', JSON.stringify(result.user));
      onAuthenticated(result.token, result.user, null);
    } catch (err) {
      setStatus({ loading: false, error: err.message });
      return;
    }

    setStatus({ loading: false, error: '' });
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div>
          <div className="auth-kicker">Secure investigator access</div>
          <h1>Aegis Forensics</h1>
          <p>
            Sign in before opening the forensic workspace. Every session keeps its active UFDR
            extraction isolated to the authenticated investigator.
          </p>
        </div>

        <form onSubmit={submitAuth} className="auth-form">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Login
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Register
            </button>
          </div>

          {mode === 'register' && (
            <label>
              Investigator name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Inspector A. Sharma"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="investigator@example.gov"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
          </label>

          {status.error && <div className="auth-error">{status.error}</div>}

          <button className="aegis-btn aegis-btn-primary" type="submit" disabled={status.loading}>
            {status.loading ? 'Authenticating...' : mode === 'login' ? 'Login to workspace' : 'Create investigator account'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [caseData, setCaseData] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('aegis_auth_token') || '');
  const [investigator, setInvestigator] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aegis_user') || 'null');
    } catch {
      return null;
    }
  });
  const [pinnedEvidenceIds, setPinnedEvidenceIds] = useState([]);
  const [selectedContactFocus, setSelectedContactFocus] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('aegis_auth_token');
    localStorage.removeItem('aegis_user');
    setAuthToken('');
    setInvestigator(null);
    setCaseData(null);
    setPinnedEvidenceIds([]);
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (!authToken) return;

    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Session check failed.');
        setInvestigator(result.user);
        setCaseData(result.case_data || null);
      })
      .catch(() => handleLogout());
  }, [authToken]);

  const handleAuthenticated = (token, user, activeCase) => {
    setAuthToken(token);
    setInvestigator(user);
    setCaseData(activeCase);
    setActiveTab('dashboard');
  };

  const handleUploadSuccess = (fileName, parsedResult) => {
    setCaseData(parsedResult.case_data || parsedResult);
    setPinnedEvidenceIds([]);
    setActiveTab('dashboard');
  };

  const guardedTabClick = (tab) => {
    if (!caseData && tab !== 'dashboard') {
      setActiveTab('dashboard');
      return;
    }
    setActiveTab(tab);
  };

  const togglePinEvidence = (sig) => {
    setPinnedEvidenceIds(prev =>
      prev.includes(sig) ? prev.filter(id => id !== sig) : [...prev, sig]
    );
  };

  const removePinEvidence = (sig) => {
    setPinnedEvidenceIds(prev => prev.filter(id => id !== sig));
  };

  const handleSelectContactNode = (contactName) => {
    setSelectedContactFocus(contactName);
    setActiveTab('chat');
  };

  if (!authToken || !investigator) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  const targetName = caseData?.device_info?.model?.split(' ')[0] || 'Awaiting UFDR';

  return (
    <div className="aegis-container">
      <header className="aegis-header">
        <div className="aegis-brand">
          <h1>Aegis Forensics</h1>
          <span>UFDR Agent v1.0</span>
        </div>

        <nav className="aegis-nav-tabs">
          <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => guardedTabClick('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => guardedTabClick('chat')} disabled={!caseData}>
            NL Search & AI
          </button>
          <button className={`nav-tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => guardedTabClick('network')} disabled={!caseData}>
            Link Analysis
          </button>
          <button className={`nav-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => guardedTabClick('timeline')} disabled={!caseData}>
            Timeline
          </button>
          <button className={`nav-tab ${activeTab === 'report' ? 'active' : ''}`} onClick={() => guardedTabClick('report')} disabled={!caseData}>
            Report
            {pinnedEvidenceIds.length > 0 && <span className="nav-count">{pinnedEvidenceIds.length}</span>}
          </button>
        </nav>

        <div className="aegis-header-actions">
          <span>Target: <b>{targetName}</b></span>
          <span>Investigator: <b>{investigator.name}</b></span>
          <button className="aegis-btn aegis-btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="aegis-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            authToken={authToken}
            caseData={caseData}
            investigator={investigator}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {caseData && activeTab === 'chat' && (
          <AIAgent
            authToken={authToken}
            caseData={caseData}
            selectedContactFocus={selectedContactFocus}
            onPinEvidence={togglePinEvidence}
            pinnedEvidenceIds={pinnedEvidenceIds}
          />
        )}

        {caseData && activeTab === 'network' && (
          <NetworkGraph
            caseData={caseData}
            onSelectContact={handleSelectContactNode}
          />
        )}

        {caseData && activeTab === 'timeline' && (
          <TimelineView
            caseData={caseData}
            onPinEvidence={togglePinEvidence}
            pinnedEvidenceIds={pinnedEvidenceIds}
          />
        )}

        {caseData && activeTab === 'report' && (
          <ReportGenerator
            caseData={caseData}
            pinnedEvidenceIds={pinnedEvidenceIds}
            onRemovePin={removePinEvidence}
          />
        )}
      </main>
    </div>
  );
}
