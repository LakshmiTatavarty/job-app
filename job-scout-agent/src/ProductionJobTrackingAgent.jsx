import React, { useState, useEffect, useCallback } from 'react';

// Production-Ready Job Tracking Agent Component
// Integrates with real job data from backend
// Links to actual job postings and LinkedIn profiles

const ProductionJobTrackingAgent = () => {
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [newCompany, setNewCompany] = useState('');
  const [userProfile, setUserProfile] = useState({
    targetRoles: 'Data Engineer, BI Engineer, Analytics Engineer',
    skills: 'Python, SQL, Tableau, Power BI, AWS, Spark, dbt',
    experience: '10',
    desiredSalaryMin: 140000,
    desiredSalaryMax: 280000,
    visaRequired: true
  });
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scrapeStatus, setScrapeStatus] = useState('idle');
  const [lastScrapeTime, setLastScrapeTime] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [backendUrl] = useState('http://localhost:5000'); // Flask backend URL

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const companiesData = localStorage.getItem('job_companies');
      const jobsData = localStorage.getItem('job_listings');
      const appliedData = localStorage.getItem('applied_jobs');
      const profileData = localStorage.getItem('user_profile');
      
      if (companiesData) setCompanies(JSON.parse(companiesData));
      if (jobsData) setJobs(JSON.parse(jobsData));
      if (appliedData) setAppliedJobs(JSON.parse(appliedData));
      if (profileData) setUserProfile(JSON.parse(profileData));
      
      // Try to load from backend
      await fetchJobsFromBackend();
    } catch (error) {
      console.log('First load or error:', error);
      addNotification('Welcome to Production Job Scout Agent!', 'info');
    }
  };

  const fetchJobsFromBackend = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
        addNotification(`✅ Loaded ${data.jobs?.length || 0} REAL jobs from backend!`, 'success');
        localStorage.setItem('job_listings', JSON.stringify(data.jobs || []));
      }
    } catch (error) {
      console.log('Backend not available yet. Using local storage.');
    }
  };

  // Save data when it changes
  useEffect(() => {
    if (companies.length > 0) {
      localStorage.setItem('job_companies', JSON.stringify(companies));
    }
  }, [companies]);

  useEffect(() => {
    if (jobs.length > 0) {
      localStorage.setItem('job_listings', JSON.stringify(jobs));
    }
  }, [jobs]);

  useEffect(() => {
    if (appliedJobs.length > 0) {
      localStorage.setItem('applied_jobs', JSON.stringify(appliedJobs));
    }
  }, [appliedJobs]);

  useEffect(() => {
    localStorage.setItem('user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Calculate match score
  const calculateMatch = useCallback((job) => {
    let matchScore = 0;
    const weights = { role: 25, skills: 30, experience: 20, salary: 15, visa: 10 };

    const targetRolesArray = userProfile.targetRoles.toLowerCase().split(',').map(r => r.trim());
    if (targetRolesArray.some(role => job.title.toLowerCase().includes(role))) {
      matchScore += weights.role;
    }

    const userSkillsArray = userProfile.skills.toLowerCase().split(',').map(s => s.trim());
    const jobSkillsStr = (job.skills || '').toLowerCase();
    const skillMatches = userSkillsArray.filter(skill => jobSkillsStr.includes(skill)).length;
    matchScore += (skillMatches / userSkillsArray.length) * weights.skills;

    const userExp = parseInt(userProfile.experience);
    const jobExpMin = parseInt(job.experienceMin) || 0;
    const jobExpMax = parseInt(job.experienceMax) || 10;
    if (userExp >= jobExpMin && userExp <= jobExpMax) {
      matchScore += weights.experience;
    } else if (userExp > jobExpMax) {
      matchScore += weights.experience * 0.8;
    }

    if (job.salaryMin && job.salaryMax) {
      const jobSalaryMid = (job.salaryMin + job.salaryMax) / 2;
      const userSalaryMid = (userProfile.desiredSalaryMin + userProfile.desiredSalaryMax) / 2;
      if (Math.abs(jobSalaryMid - userSalaryMid) / userSalaryMid < 0.3) {
        matchScore += weights.salary;
      }
    }

    if (userProfile.visaRequired === job.visa_sponsorship) {
      matchScore += weights.visa;
    }

    return Math.round(matchScore);
  }, [userProfile]);

  // Scrape jobs from backend
  const scrapeJobs = async () => {
    setScrapeStatus('scraping');
    addNotification('🔍 Starting real job scraping from Indeed, LinkedIn, and career pages...', 'info');

    try {
      const response = await fetch(`${backendUrl}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: companies.map(c => c.name),
          keywords: userProfile.targetRoles.split(',').map(r => r.trim())
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newJobs = data.jobs || [];
        
        // Add match scores
        const enrichedJobs = newJobs.map(job => ({
          ...job,
          matchScore: calculateMatch(job)
        }));

        setJobs(prev => [...enrichedJobs, ...prev].slice(0, 100));
        setLastScrapeTime(new Date());
        addNotification(`✅ Found ${newJobs.length} REAL jobs! Data scraped from: ${data.sources?.join(', ')}`, 'success');
      } else {
        addNotification('⚠️ Backend not running. Make sure to start: python production_job_scout_agent.py', 'warning');
      }
    } catch (error) {
      addNotification('❌ Could not connect to backend. Run Python agent to scrape real jobs.', 'error');
      console.error('Scrape error:', error);
    } finally {
      setScrapeStatus('idle');
    }
  };

  // Add company
  const addCompany = useCallback((companyName) => {
    if (!companyName.trim()) {
      addNotification('Please enter a company name', 'warning');
      return;
    }
    
    if (companies.some(c => c.name.toLowerCase() === companyName.toLowerCase())) {
      addNotification(`${companyName} already added!`, 'warning');
      return;
    }

    const newComp = {
      id: `company_${Date.now()}`,
      name: companyName,
      careersUrl: `https://careers.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      addedDate: new Date().toISOString(),
      enabled: true,
      lastScraped: null
    };

    setCompanies(prev => [...prev, newComp]);
    setNewCompany('');
    addNotification(`✅ Added ${companyName} to tracking!`, 'success');
  }, [companies]);

  // Remove company
  const removeCompany = useCallback((companyId) => {
    const company = companies.find(c => c.id === companyId);
    setCompanies(prev => prev.filter(c => c.id !== companyId));
    setJobs(prev => prev.filter(j => j.company !== company?.name));
    addNotification(`Removed ${company?.name}`, 'info');
  }, [companies]);

  // Mark as applied
  const markAsApplied = useCallback((jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setAppliedJobs(prev => [...prev, { ...job, appliedDate: new Date().toISOString() }]);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    addNotification(`✅ Marked "${job.title}" at ${job.company} as applied!`, 'success');
  }, [jobs]);

  // Undo application
  const undoApplication = useCallback((jobId) => {
    const appliedJob = appliedJobs.find(j => j.id === jobId);
    if (!appliedJob) return;

    setAppliedJobs(prev => prev.filter(j => j.id !== jobId));
    setJobs(prev => [...prev, appliedJob]);
    addNotification('↩️ Application marked as not applied', 'info');
  }, [appliedJobs]);

  // Add notification
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type, timestamp: new Date() };
    setNotifications(prev => [notification, ...prev].slice(0, 20));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  // Get stats
  const stats = {
    totalCompanies: companies.length,
    activeListings: jobs.length,
    applied: appliedJobs.length,
    pendingReview: jobs.filter(j => j.matchScore >= 80).length,
    averageMatch: jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.matchScore, 0) / jobs.length) : 0,
    realJobs: jobs.filter(j => j.url && j.url.includes('http')).length,
    withLinkedIn: jobs.filter(j => j.linkedin_poster).length
  };

  // Render Dashboard
  const renderDashboard = () => (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Production Dashboard</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard title="Companies Tracked" value={stats.totalCompanies} color="#3b82f6" />
        <StatCard title="REAL Job Listings" value={stats.activeListings} color="#f59e0b" icon="🔍" />
        <StatCard title="Applied" value={stats.applied} color="#10b981" />
        <StatCard title="High Match (80%+)" value={stats.pendingReview} color="#8b5cf6" />
        <StatCard title="Jobs with LinkedIn" value={stats.withLinkedIn} color="#06b6d4" icon="💼" />
      </div>

      <div style={{
        background: 'linear-gradient(to right, #4f46e5, #7c3aed)',
        color: 'white',
        padding: '24px',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '24px'
      }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>🤖 Production Job Scraper</h3>
          <p style={{ opacity: 0.9 }}>
            Scrapes REAL jobs from Indeed, LinkedIn API, and company career pages
          </p>
          <p style={{ opacity: 0.8, fontSize: '12px', marginTop: '4px' }}>
            {lastScrapeTime ? `Last updated: ${lastScrapeTime.toLocaleTimeString()}` : 'No scrapes yet'}
          </p>
        </div>
        <button
          onClick={scrapeJobs}
          disabled={scrapeStatus === 'scraping'}
          style={{
            background: 'white',
            color: '#4f46e5',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: scrapeStatus === 'scraping' ? 'not-allowed' : 'pointer',
            opacity: scrapeStatus === 'scraping' ? 0.5 : 1,
            fontSize: '14px'
          }}
        >
          {scrapeStatus === 'scraping' ? '⏳ Scraping REAL Jobs...' : '🔄 Scrape Real Jobs'}
        </button>
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: '#e0f2fe', borderRadius: '8px', borderLeft: '4px solid #0284c7' }}>
        <h3 style={{ color: '#0c4a6e', fontWeight: 'bold' }}>⚙️ Setup Required</h3>
        <p style={{ color: '#0c4a6e', fontSize: '12px', marginTop: '8px' }}>
          To scrape REAL jobs from Indeed, LinkedIn, and company career pages, you need to:
        </p>
        <ol style={{ color: '#0c4a6e', fontSize: '12px', marginTop: '8px', marginLeft: '20px' }}>
          <li>Install Python dependencies: <code>pip install -r requirements.txt</code></li>
          <li>Run Python backend: <code>python production_job_scout_agent.py</code></li>
          <li>Or start Flask app: <code>python app.py</code> (use provided app.py)</li>
          <li>Click "Scrape Real Jobs" button above</li>
          <li>Jobs will populate from real sources with actual LinkedIn contacts and job URLs</li>
        </ol>
      </div>
    </div>
  );

  // Render Companies Tab
  const renderCompanies = () => (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Companies to Track</h2>
      
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Add Company</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCompany(newCompany)}
            placeholder="e.g., Google, Amazon, Microsoft, Meta, Stripe..."
            style={{
              flex: 1,
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={() => addCompany(newCompany)}
            style={{
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            + Add
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Tracked Companies ({companies.length})</h3>
        {companies.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            background: '#f3f4f6',
            borderRadius: '8px',
            color: '#6b7280'
          }}>
            No companies added. Add companies above to scrape from their career pages!
          </div>
        ) : (
          companies.map(company => (
            <div
              key={company.id}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h4 style={{ fontWeight: 'bold', color: '#111827' }}>{company.name}</h4>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Will scrape from career page</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => removeCompany(company.id)}
                  style={{
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render Job Listings Tab - WITH REAL URLS AND LINKEDIN CONTACTS
  const renderJobListings = () => (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>REAL Job Listings ({jobs.length})</h2>
      
      <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#92400e' }}>
          💡 All job links below are <strong>REAL URLs</strong> to actual job postings on Indeed, LinkedIn, or company career pages
        </p>
      </div>

      {jobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: '#f3f4f6',
          borderRadius: '8px',
          color: '#6b7280'
        }}>
          No jobs yet. <br/>Add companies above and click <strong>"Scrape Real Jobs"</strong> to load actual job postings!
        </div>
      ) : (
        jobs.sort((a, b) => b.matchScore - a.matchScore).map(job => (
          <RealJobCard
            key={job.id}
            job={job}
            onApply={markAsApplied}
            isExpanded={expandedJob === job.id}
            onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
          />
        ))
      )}
    </div>
  );

  // Render Applied Tab
  const renderAppliedJobs = () => (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Applied Jobs ({appliedJobs.length})</h2>
      
      {appliedJobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: '#f3f4f6',
          borderRadius: '8px',
          color: '#6b7280'
        }}>
          You haven't applied to any jobs yet!
        </div>
      ) : (
        appliedJobs.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)).map(job => (
          <AppliedJobCard
            key={job.id}
            job={job}
            onUndo={undoApplication}
            isExpanded={expandedJob === job.id}
            onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
          />
        ))
      )}
    </div>
  );

  // Render Profile Tab
  const renderProfile = () => (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Your Profile</h2>
      
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <InputField
          label="Target Roles (comma-separated)"
          value={userProfile.targetRoles}
          onChange={(val) => setUserProfile(prev => ({ ...prev, targetRoles: val }))}
        />

        <InputField
          label="Key Skills (comma-separated)"
          value={userProfile.skills}
          onChange={(val) => setUserProfile(prev => ({ ...prev, skills: val }))}
        />

        <InputField
          label="Years of Experience"
          type="number"
          value={userProfile.experience}
          onChange={(val) => setUserProfile(prev => ({ ...prev, experience: val }))}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <InputField
            label="Min Salary"
            type="number"
            value={userProfile.desiredSalaryMin}
            onChange={(val) => setUserProfile(prev => ({ ...prev, desiredSalaryMin: parseInt(val) }))}
          />
          <InputField
            label="Max Salary"
            type="number"
            value={userProfile.desiredSalaryMax}
            onChange={(val) => setUserProfile(prev => ({ ...prev, desiredSalaryMax: parseInt(val) }))}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="checkbox"
            id="visaRequired"
            checked={userProfile.visaRequired}
            onChange={(e) => setUserProfile(prev => ({ ...prev, visaRequired: e.target.checked }))}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="visaRequired" style={{ fontSize: '14px', fontWeight: 'bold' }}>
            Visa Sponsorship Required
          </label>
        </div>

        <button
          onClick={() => {
            localStorage.setItem('user_profile', JSON.stringify(userProfile));
            addNotification('✅ Profile saved!', 'success');
          }}
          style={{
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '8px'
          }}
        >
          Save Profile
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>🚀 Production Job Scout Agent</h1>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          {notifications.length > 0 && (
            <div style={{ background: '#dbeafe', color: '#1e40af', padding: '8px 12px', borderRadius: '4px' }}>
              {notifications[0].message}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        overflowX: 'auto',
        background: '#ffffff'
      }}>
        {['dashboard', 'listings', 'companies', 'applied', 'profile'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === tab ? '#4f46e5' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              whiteSpace: 'nowrap'
            }}
          >
            {tab === 'dashboard' && '📊'} {tab === 'listings' && '🔍'} {tab === 'companies' && '🏢'} {tab === 'applied' && '✅'} {tab === 'profile' && '👤'} {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ minHeight: 'calc(100vh - 200px)' }}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'listings' && renderJobListings()}
        {activeTab === 'companies' && renderCompanies()}
        {activeTab === 'applied' && renderAppliedJobs()}
        {activeTab === 'profile' && renderProfile()}
      </main>
    </div>
  );
};

const StatCard = ({ title, value, color, icon }) => (
  <div style={{
    background: 'white',
    border: `2px solid ${color}`,
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  }}>
    <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>{icon} {title}</p>
    <p style={{ fontSize: '28px', fontWeight: 'bold', color }}>{value}</p>
  </div>
);

const InputField = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box'
      }}
    />
  </div>
);

const RealJobCard = ({ job, onApply, isExpanded, onToggleExpand }) => (
  <div style={{
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginBottom: '12px',
    overflow: 'hidden'
  }}>
    <div
      onClick={onToggleExpand}
      style={{
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        background: isExpanded ? '#f3f4f6' : 'white'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '16px', color: '#111827' }}>{job.title}</h3>
          <span style={{
            background: '#dbeafe',
            color: '#1e40af',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            {job.matchScore}%
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
          {job.company} • {job.location}
        </p>
        <p style={{ fontSize: '10px', color: '#9ca3af' }}>
          📍 Source: {job.source === 'indeed' ? 'Indeed' : job.source === 'linkedin' ? 'LinkedIn' : 'Company Website'}
        </p>
      </div>
      <span style={{ fontSize: '20px', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
    </div>

    {isExpanded && (
      <div style={{
        borderTop: '1px solid #e5e7eb',
        padding: '16px',
        background: '#f9fafb'
      }}>
        <p style={{ fontSize: '12px', color: '#374151', marginBottom: '12px' }}>{job.description}</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
          <div>
            <p style={{ color: '#6b7280', fontWeight: 'bold' }}>Salary</p>
            <p>{job.salaryMin ? `$${(job.salaryMin / 1000).toFixed(0)}K - $${(job.salaryMax / 1000).toFixed(0)}K` : 'Not specified'}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontWeight: 'bold' }}>Experience</p>
            <p>{job.experienceMin ? `${job.experienceMin}-${job.experienceMax} years` : 'Not specified'}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontWeight: 'bold' }}>Visa Sponsorship</p>
            <p>{job.visa_sponsorship ? '✅ Yes' : '❌ Not mentioned'}</p>
          </div>
        </div>

        {job.linkedin_poster && (
          <div style={{
            background: '#e7f5ff',
            border: '1px solid #74c0fc',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '12px',
            fontSize: '12px'
          }}>
            <p style={{ fontWeight: 'bold', color: '#1971c2', marginBottom: '6px' }}>💼 REAL LinkedIn Contact</p>
            <p style={{ color: '#111827', fontWeight: 'bold' }}>{job.linkedin_poster.name}</p>
            <p style={{ color: '#6b7280', fontSize: '11px' }}>{job.linkedin_poster.title}</p>
            {job.linkedin_poster.linkedin_url && (
              <a
                href={job.linkedin_poster.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '6px',
                  color: '#0a66c2',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '11px'
                }}
              >
                🔗 Visit LinkedIn Profile →
              </a>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onApply(job.id)}
            style={{
              flex: 1,
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✅ Mark as Applied
          </button>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🔗 View REAL Job Post →
            </a>
          )}
        </div>
      </div>
    )}
  </div>
);

const AppliedJobCard = ({ job, onUndo, isExpanded, onToggleExpand }) => (
  <div style={{
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '8px',
    marginBottom: '12px',
    overflow: 'hidden'
  }}>
    <div
      onClick={onToggleExpand}
      style={{
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
          <span>✅</span>
          <h3 style={{ fontWeight: 'bold', fontSize: '16px', color: '#111827' }}>{job.title}</h3>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280' }}>
          {job.company} • {job.location}
        </p>
      </div>
    </div>

    {isExpanded && (
      <div style={{
        borderTop: '1px solid #86efac',
        padding: '16px',
        background: 'white'
      }}>
        <button
          onClick={() => onUndo(job.id)}
          style={{
            width: '100%',
            background: '#fef08a',
            color: '#854d0e',
            border: 'none',
            padding: '10px',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ↩️ Mark as Not Applied
        </button>
      </div>
    )}
  </div>
);

export default ProductionJobTrackingAgent;
