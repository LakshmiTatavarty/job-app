"""
Flask API Backend for Production Job Scout Agent
Exposes job scraping functionality to React frontend
Handles real job scraping from Indeed, LinkedIn, and company career pages
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import asyncio
import json
import os
from datetime import datetime
from job_scout_agent import (
    ProductionJobScoutAgent,
    RealJobScraper
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize agent
agent = ProductionJobScoutAgent()

@app.route('/api/health', methods=['GET'])
def health():
    """Check if backend is running"""
    return jsonify({
        'status': 'ok',
        'message': 'Production Job Scout Agent Backend Running',
        'version': '1.0'
    })

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    """Get all jobs currently stored"""
    return jsonify({
        'jobs': [job.to_dict() for job in agent.jobs],
        'total': len(agent.jobs),
        'summary': agent.get_production_jobs_summary()
    })

@app.route('/api/scrape', methods=['POST'])
def scrape_jobs():
    """
    Scrape real jobs from multiple sources
    
    Request body:
    {
        "companies": ["Google", "Amazon", "Microsoft"],
        "keywords": ["Data Engineer", "BI Engineer"]
    }
    
    Response:
    {
        "jobs": [...],
        "new_jobs_count": 15,
        "sources": ["indeed", "linkedin", "company_website"],
        "summary": {...}
    }
    """
    try:
        data = request.json
        companies = data.get('companies', [])
        keywords = data.get('keywords', [])
        
        if not companies or not keywords:
            return jsonify({
                'error': 'Please provide companies and keywords',
                'companies_needed': True,
                'keywords_needed': True
            }), 400
        
        logger.info(f"Starting scrape: companies={companies}, keywords={keywords}")
        
        # Run async scraping
        new_jobs = asyncio.run(agent.scrape_all_sources(companies, keywords))
        
        # Add match scores
        for job in new_jobs:
            job.match_score = calculateMatch(job)
        
        summary = agent.get_production_jobs_summary()
        
        return jsonify({
            'status': 'success',
            'jobs': [job.to_dict() for job in new_jobs],
            'new_jobs_count': len(new_jobs),
            'total_jobs': len(agent.jobs),
            'sources': summary.get('sources', []),
            'summary': summary
        })
    
    except Exception as e:
        logger.error(f"Scraping error: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'error': 'Failed to scrape jobs. Make sure Indeed and LinkedIn are accessible.'
        }), 500

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    """Get details of a specific job"""
    job = next((j for j in agent.jobs if j.id == job_id), None)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(job.to_dict())

@app.route('/api/jobs/search', methods=['POST'])
def search_jobs():
    """
    Search jobs with filters
    
    Request body:
    {
        "query": "Data Engineer",
        "company": "Google",
        "min_salary": 150000,
        "max_salary": 250000,
        "visa_sponsorship": true,
        "min_match": 80
    }
    """
    try:
        filters = request.json
        results = agent.jobs
        
        # Apply filters
        if 'query' in filters and filters['query']:
            query = filters['query'].lower()
            results = [j for j in results if query in j.title.lower()]
        
        if 'company' in filters and filters['company']:
            results = [j for j in results if filters['company'].lower() in j.company.lower()]
        
        if 'min_salary' in filters and filters['min_salary']:
            results = [j for j in results if j.salary_min and j.salary_min >= filters['min_salary']]
        
        if 'max_salary' in filters and filters['max_salary']:
            results = [j for j in results if j.salary_max and j.salary_max <= filters['max_salary']]
        
        if 'visa_sponsorship' in filters and filters['visa_sponsorship']:
            results = [j for j in results if j.visa_sponsorship]
        
        if 'min_match' in filters and filters['min_match']:
            results = [j for j in results if j.match_score >= filters['min_match']]
        
        return jsonify({
            'results': [j.to_dict() for j in results],
            'count': len(results),
            'filters': filters
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get job statistics"""
    summary = agent.get_production_jobs_summary()
    
    # Calculate additional stats
    salary_stats = {
        'min': min([j.salary_min for j in agent.jobs if j.salary_min], default=None),
        'max': max([j.salary_max for j in agent.jobs if j.salary_max], default=None),
        'average': sum([j.salary_min + j.salary_max for j in agent.jobs if j.salary_min and j.salary_max]) / (len([j for j in agent.jobs if j.salary_min and j.salary_max]) * 2) if agent.jobs else None
    }
    
    match_stats = {
        'average': round(sum([j.match_score for j in agent.jobs]) / len(agent.jobs)) if agent.jobs else 0,
        'above_90': len([j for j in agent.jobs if j.match_score >= 90]),
        'above_80': len([j for j in agent.jobs if j.match_score >= 80]),
        'above_70': len([j for j in agent.jobs if j.match_score >= 70])
    }
    
    return jsonify({
        'summary': summary,
        'salary_stats': salary_stats,
        'match_stats': match_stats,
        'scraped_at': datetime.now().isoformat()
    })

@app.route('/api/companies', methods=['GET'])
def get_companies():
    """Get list of unique companies in database"""
    companies = list(set(j.company for j in agent.jobs))
    return jsonify({
        'companies': sorted(companies),
        'total': len(companies)
    })

@app.route('/api/sources', methods=['GET'])
def get_sources():
    """Get breakdown by source (Indeed, LinkedIn, etc)"""
    sources = {}
    for job in agent.jobs:
        if job.source not in sources:
            sources[job.source] = 0
        sources[job.source] += 1
    
    return jsonify(sources)

@app.route('/api/linkedin-contacts', methods=['GET'])
def get_linkedin_contacts():
    """Get all LinkedIn contacts"""
    contacts = [j.linkedin_poster for j in agent.jobs if j.linkedin_poster]
    return jsonify({
        'contacts': contacts,
        'total': len(contacts),
        'unique_people': len(set(c.get('name') for c in contacts))
    })

def calculateMatch(job):
    """Calculate match score (basic version without user profile)"""
    # Default user profile
    user_profile = {
        'targetRoles': 'Data Engineer, BI Engineer, Analytics Engineer',
        'skills': 'Python, SQL, Tableau, Power BI, AWS, Spark',
        'experience': '10',
        'desiredSalaryMin': 140000,
        'desiredSalaryMax': 280000,
        'visaRequired': True
    }
    
    matchScore = 0
    weights = {'role': 25, 'skills': 30, 'experience': 20, 'salary': 15, 'visa': 10}
    
    targetRolesArray = [r.strip().lower() for r in user_profile['targetRoles'].split(',')]
    if any(role in job.title.lower() for role in targetRolesArray):
        matchScore += weights['role']
    
    userSkillsArray = [s.strip().lower() for s in user_profile['skills'].split(',')]
    jobSkillsStr = (job.skills or '').lower()
    skillMatches = sum(1 for skill in userSkillsArray if skill in jobSkillsStr)
    matchScore += (skillMatches / len(userSkillsArray)) * weights['skills'] if userSkillsArray else 0
    
    userExp = int(user_profile['experience'])
    jobExpMin = job.experience_min or 0
    jobExpMax = job.experience_max or 10
    if jobExpMin <= userExp <= jobExpMax:
        matchScore += weights['experience']
    elif userExp > jobExpMax:
        matchScore += weights['experience'] * 0.8
    
    if job.salary_min and job.salary_max:
        jobSalaryMid = (job.salary_min + job.salary_max) / 2
        userSalaryMid = (user_profile['desiredSalaryMin'] + user_profile['desiredSalaryMax']) / 2
        if abs(jobSalaryMid - userSalaryMid) / userSalaryMid < 0.3:
            matchScore += weights['salary']
    
    if user_profile.get('visaRequired') == job.visa_sponsorship:
        matchScore += weights['visa']
    
    return round(matchScore)

if __name__ == '__main__':
    logger.info("🚀 Starting Production Job Scout Agent Backend")
    logger.info("Available endpoints:")
    logger.info("  GET  /api/health - Check backend status")
    logger.info("  GET  /api/jobs - Get all jobs")
    logger.info("  POST /api/scrape - Scrape new jobs")
    logger.info("  POST /api/jobs/search - Search jobs with filters")
    logger.info("  GET  /api/stats - Get statistics")
    logger.info("  GET  /api/companies - Get unique companies")
    logger.info("  GET  /api/sources - Get job sources breakdown")
    logger.info("  GET  /api/linkedin-contacts - Get LinkedIn contacts")
    
    app.run(
        host='localhost',
        port=5000,
        debug=True
    )
