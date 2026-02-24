Vibe coding
Job Scout Agent is an intelligent, agentic job tracking and notification system designed to automate the job search process for data and analytics professionals. It continuously scrapes company career pages, analyzes job listings, extracts LinkedIn contacts, and delivers actionable daily notifications and insights.

Key Features
Automated Job Scraping: Continuously monitors and scrapes multiple company career pages for new job postings.
Profile Matching: Calculates a personalized match score for each job based on your skills, experience, and preferences.
LinkedIn Contact Extraction: Identifies and extracts relevant LinkedIn contacts for each job listing.
Daily Notifications: Sends daily reports with new job opportunities and actionable insights (e.g., skill gaps, salary trends).
Duplicate Detection: Prevents redundant notifications by tracking previously seen jobs.
Extensible & Modular: Easily add new companies or customize scraping logic.
Tech Stack
Backend: Python 3, asyncio, dataclasses, JSON storage
Web Scraping: (Pluggable) BeautifulSoup, Selenium, aiohttp (mocked in demo)
Frontend: React (job-scout-agent, optional)
Notifications: Console, with hooks for email, Slack, or SMS
How It Works
Tracks a list of target companies and their career pages.
Scrapes and analyzes new job postings.
Matches jobs to your profile and calculates a match score.
Extracts recruiter or hiring manager contacts from LinkedIn.
Sends daily notifications with top jobs and insights.
Usage
Configure your user profile and tracked companies.
Run the agent to receive daily job reports and insights.
Extend with real scraping and notification integrations as needed.



