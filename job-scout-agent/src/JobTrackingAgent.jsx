import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, ExternalLink, Linkedin, CheckCircle, Clock, AlertCircle, Settings, Bell, BarChart3, Search, ChevronDown, Copy, RefreshCw } from 'lucide-react';

// Storage Helper
const StorageManager = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? { key, value } : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (error) {
      console.error('Storage set error:', error);
      return null;
    }
  },
};

const JobTrackingAgent = () => {
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [newCompany, setNewCompany] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [userProfile, setUserProfile] = useState({
    targetRoles: 'BI Engineer, Data Engineer, Analytics Engineer',
    skills: 'Python, SQL, Tableau, Power BI, AWS',
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

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const companiesData = await StorageManager.get('job_companies');
        const jobsData = await StorageManager.get('job_listings');
        const appliedData = await StorageManager.get('applied_jobs');
        const profileData = await StorageManager.get('user_profile');
        
        if (companiesData) setCompanies(JSON.parse(companiesData.value));
        if (jobsData) setJobs(JSON.parse(jobsData.value));
        if (appliedData) setAppliedJobs(JSON.parse(appliedData.value));
        if (profileData) setUserProfile(JSON.parse(profileData.value));
        
        console.log('✅ Data loaded from storage');
      } catch (error) {
        console.log('First load - initializing with defaults');
      }
    };
    loadData();
  }, []);

  // Save data when it changes
  useEffect(() => {
    if (companies.length > 0) {
      StorageManager.set('job_companies', JSON.stringify(companies));
    }
  }, [companies]);

  useEffect(() => {
    if (jobs.length > 0) {
      StorageManager.set('job_listings', JSON.stringify(jobs));
    }
  }, [jobs]);

  useEffect(() => {
    if (appliedJobs.length > 0) {
      StorageManager.set('applied_jobs', JSON.stringify(appliedJobs));
    }
  }, [appliedJobs]);

  useEffect(() => {
    StorageManager.set('user_profile', JSON.stringify(userProfile));
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

    if (userProfile.visaRequired === job.visaSponsorship) {
      matchScore += weights.visa;
    }

    return Math.round(matchScore);
  }, [userProfile]);

  // Scrape jobs
  const simulateScrape = useCallback(async () => {
    setScrapeStatus('scraping');
    addNotification('Started scraping job listings...', 'info');

    const mockJobs = [
      {
        id: `job_${Date.now()}_1`,
        company: selectedCompany || (companies[0]?.name || 'Google'),
        title: 'Senior Data Engineer - Analytics',
        location: 'San Francisco, CA / Remote',
        url: 'https://careers.example.com/jobs/senior-data-engineer',
        postedTime: 'Today',
        daysAgo: 0,
        skills: 'Python, SQL, AWS, Data Modeling, ETL, Spark',
        salary: { min: 180000, max: 230000 },
        experienceMin: 5,
        experienceMax: 7,
        visaSponsorship: true,
        description: 'Design data pipelines, optimize ETL processes, build analytics infrastructure',
        linkedinPoster: {
          name: 'Sarah Chen',
          title: 'Data Engineering Team Lead',
          linkedinUrl: 'https://linkedin.com/in/sarahchen-engineering',
          company: selectedCompany || (companies[0]?.name || 'Google')
        }
      },
      {
        id: `job_${Date.now()}_2`,
        company: selectedCompany || (companies[0]?.name || 'Google'),
        title: 'Analytics Engineer',
        location: 'Remote',
        url: 'https://careers.example.com/jobs/analytics-engineer',
        postedTime: 'Today',
        daysAgo: 0,
        skills: 'SQL, Python, Tableau, Analytics, Data Modeling',
        salary: { min: 140000, max: 190000 },
        experienceMin: 4,
        experienceMax: 6,
        visaSponsorship: true,
        description: 'Build BI infrastructure, create dashboards, optimize queries',
        linkedinPoster: {
          name: 'Marcus Johnson',
          title: 'Analytics Manager',
          linkedinUrl: 'https://linkedin.com/in/mjohnson-analytics',
          company: selectedCompany || (companies[0]?.name || 'Google')
        }
      },
      {
        id: `job_${Date.now()}_3`,
        company: selectedCompany || (companies[0]?.name || 'Google'),
        title: 'Power BI Developer',
        location: 'Hybrid',
        url: 'https://careers.example.com/jobs/power-bi-developer',
        postedTime: 'Today',
        daysAgo: 0,
        skills: 'Power BI, DAX, SQL Server, Azure',
        salary: { min: 160000, max: 210000 },
        experienceMin: 4,
        experienceMax: 6,
        visaSponsorship: true,
        description: 'Develop interactive dashboards, optimize Power Query',
        linkedinPoster: {
          name: 'Emily Rodriguez',
          title: 'BI Engineering Manager',
          linkedinUrl: 'https://linkedin.com/in/erodriguez-bi',
          company: selectedCompany || (companies[0]?.name || 'Google')
        }
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 2000));

    const enrichedJobs = mockJobs.map(job => ({
      ...job,
      matchScore: calculateMatch(job),
      salaryMin: job.salary.min,
      salaryMax: job.salary.max
    }));

    setJobs(prev => [...enrichedJobs, ...prev].slice(0, 50));
    setLastScrapeTime(new Date());
    setScrapeStatus('idle');
    addNotification(`Found ${enrichedJobs.length} new jobs!`, 'success');
  }, [selectedCompany, companies, calculateMatch]);

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
    addNotification(`Added ${companyName} to tracking!`, 'success');
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
    addNotification(`Applied to ${job.title} at ${job.company}!`, 'success');
  }, [jobs]);

  // Undo application
  const undoApplication = useCallback((jobId) => {
    const appliedJob = appliedJobs.find(j => j.id === jobId);
    if (!appliedJob) return;

    setAppliedJobs(prev => prev.filter(j => j.id !== jobId));
    setJobs(prev => [...prev, appliedJob]);
    addNotification('Application marked as not applied', 'info');
  }, [appliedJobs]);

  // Add notification
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type, timestamp: new Date() };
    setNotifications(prev => [notification, ...prev].slice(0, 20));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Get stats
  const stats = {
    totalCompanies: companies.length,
    activeListings: jobs.length,
    applied: appliedJobs.length,
    pendingReview: jobs.filter(j => j.matchScore >= 80).length,
    averageMatch: jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.matchScore, 0) / jobs.length) : 0
  };

  // Render Dashboard
  const renderDashboard = () => (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Dashboard</h2>
      
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard title="Companies" value={stats.totalCompanies} color="#3b82f6" />
        <StatCard title="Active Listings" value={stats.activeListings} color="#f59e0b" />
        <StatCard title="Applied" value={stats.applied} color="#10b981" />
        <StatCard title="High Match (80%+)" value={stats.pendingReview} color="#8b5cf6" />
        <StatCard title="Avg Match %" value={`${stats.averageMatch}%`} color="#06b6d4" />
      </div>

      {/* Scrape Button */}
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
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Job Scraper Status</h3>
          <p style={{ opacity: 0.9 }}>
            {lastScrapeTime ? `Last updated: ${lastScrapeTime.toLocaleTimeString()}` : 'No scrapes yet - Click button to start'}
          </p>
        </div>
        <button
          onClick={simulateScrape}
          disabled={scrapeStatus === 'scraping'}
          style={{
            background: 'white',
            color: '#4f46e5',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: scrapeStatus === 'scraping' ? 'not-allowed' : 'pointer',
            opacity: scrapeStatus === 'scraping' ? 0.5 : 1,
          }}
        >
          {scrapeStatus === 'scraping' ? '⏳ Scraping...' : '🔄 Scrape Now'}
        </button>
      </div>
    </div>
  );

  // Render Companies Tab
  const renderCompanies = () => (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Companies</h2>
      
      {/* Add Company Form */}
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
            placeholder="Enter company name (e.g., Google, Amazon, Microsoft)"
            style={{
              flex: 1,
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
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
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Companies List */}
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
            No companies added yet. Add your first company above!
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
              <div style={{ flex: 1 }}>
                <h4 style={{ fontWeight: 'bold', color: '#111827' }}>{company.name}</h4>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{company.careersUrl}</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  Added: {new Date(company.addedDate).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setSelectedCompany(company.name);
                    addNotification(`Selected ${company.name} for scraping`, 'info');
                  }}
                  style={{
                    background: '#dbeafe',
                    color: '#1e40af',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Scrape
                </button>
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
                    cursor: 'pointer',
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

  // Render Job Listings Tab
  const renderJobListings = () => (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>New Job Listings ({jobs.length})</h2>
      
      {jobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: '#f3f4f6',
          borderRadius: '8px',
          color: '#6b7280'
        }}>
          No job listings yet. Add companies and click "Scrape Now" to get started!
        </div>
      ) : (
        jobs.sort((a, b) => b.matchScore - a.matchScore).map(job => (
          <JobCard
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
          placeholder="e.g., BI Engineer, Data Engineer, Analytics Engineer"
        />

        <InputField
          label="Key Skills (comma-separated)"
          value={userProfile.skills}
          onChange={(val) => setUserProfile(prev => ({ ...prev, skills: val }))}
          placeholder="e.g., Python, SQL, Tableau, Power BI, AWS"
        />

        <InputField
          label="Years of Experience"
          type="number"
          value={userProfile.experience}
          onChange={(val) => setUserProfile(prev => ({ ...prev, experience: val }))}
          placeholder="10"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <InputField
            label="Min Salary"
            type="number"
            value={userProfile.desiredSalaryMin}
            onChange={(val) => setUserProfile(prev => ({ ...prev, desiredSalaryMin: parseInt(val) }))}
            placeholder="140000"
          />
          <InputField
            label="Max Salary"
            type="number"
            value={userProfile.desiredSalaryMax}
            onChange={(val) => setUserProfile(prev => ({ ...prev, desiredSalaryMax: parseInt(val) }))}
            placeholder="280000"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
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
            StorageManager.set('user_profile', JSON.stringify(userProfile));
            addNotification('Profile saved successfully!', 'success');
          }}
          style={{
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '14px',
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
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>🤖 Job Scout Agent</h1>
        <div style={{ fontSize: '24px' }}>👤</div>
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
              borderRadius: '8px 8px 0 0',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === tab ? '#4f46e5' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
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

const StatCard = ({ title, value, color }) => (
  <div style={{
    background: 'white',
    border: `2px solid ${color}`,
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  }}>
    <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>{title}</p>
    <p style={{ fontSize: '28px', fontWeight: 'bold', color }}>{value}</p>
  </div>
);

const InputField = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box'
      }}
    />
  </div>
);

const JobCard = ({ job, onApply, isExpanded, onToggleExpand }) => (
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
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
          {job.company} • {job.location}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {job.skills.split(',').slice(0, 3).map((skill, i) => (
            <span key={i} style={{
              fontSize: '11px',
              background: '#f3f4f6',
              color: '#374151',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              {skill.trim()}
            </span>
          ))}
        </div>
      </div>
      <span style={{ fontSize: '20px', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
    </div>

    {isExpanded && (
      <div style={{
        borderTop: '1px solid #e5e7eb',
        padding: '16px',
        background: '#f9fafb'
      }}>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{job.description}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
          <div>
            <p style={{ color: '#6b7280', fontWeight: 'bold' }}>Salary</p>
            <p>${(job.salaryMin / 1000).toFixed(0)}K - ${(job.salaryMax / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontWeight: 'bold' }}>Experience</p>
            <p>{job.experienceMin}-{job.experienceMax} years</p>
          </div>
        </div>
        
        {job.linkedinPoster && (
          <div style={{
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '12px',
            fontSize: '12px'
          }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>LinkedIn Contact</p>
            <p style={{ color: '#111827' }}>{job.linkedinPoster.name}</p>
            <p style={{ color: '#6b7280', fontSize: '11px' }}>{job.linkedinPoster.title}</p>
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
            ✓ Mark as Applied
          </button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              background: '#dbeafe',
              color: '#1e40af',
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
            🔗 View Job
          </a>
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
          <span style={{ fontSize: '20px' }}>✓</span>
          <h3 style={{ fontWeight: 'bold', fontSize: '16px', color: '#111827' }}>{job.title}</h3>
          <span style={{
            background: '#dcfce7',
            color: '#166534',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            {job.matchScore}%
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280' }}>
          {job.company} • {job.location}
        </p>
        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Applied: {new Date(job.appliedDate).toLocaleDateString()}
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
          Mark as Not Applied
        </button>
      </div>
    )}
  </div>
);

export default JobTrackingAgent;
