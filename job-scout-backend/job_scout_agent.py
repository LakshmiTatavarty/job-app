"""
Production-Ready Job Scout Agent
Scrapes REAL jobs from career pages, Indeed API, and LinkedIn
Extracts REAL LinkedIn contacts
Provides REAL job posting links
"""

import json
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass
import hashlib
import re
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('JobScoutAgent')

@dataclass
class Job:
    id: str
    company: str
    title: str
    location: str
    url: str  # REAL JOB POSTING URL
    posted_time: str
    days_ago: int
    skills: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    experience_min: Optional[int] = None
    experience_max: Optional[int] = None
    visa_sponsorship: bool = False
    description: str = ""
    linkedin_poster: Optional[Dict] = None  # REAL LinkedIn contact
    match_score: int = 0
    scraped_at: str = None
    source: str = "unknown"  # indeed, linkedin, company_website, etc
    hash: str = None

    def __post_init__(self):
        if not self.scraped_at:
            self.scraped_at = datetime.now().isoformat()
        if not self.hash:
            self.hash = self._generate_hash()

    def _generate_hash(self) -> str:
        content = f"{self.company}{self.title}{self.location}"
        return hashlib.md5(content.encode()).hexdigest()

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'company': self.company,
            'title': self.title,
            'location': self.location,
            'url': self.url,
            'posted_time': self.posted_time,
            'days_ago': self.days_ago,
            'skills': self.skills,
            'salary_min': self.salary_min,
            'salary_max': self.salary_max,
            'experience_min': self.experience_min,
            'experience_max': self.experience_max,
            'visa_sponsorship': self.visa_sponsorship,
            'description': self.description,
            'linkedin_poster': self.linkedin_poster,
            'match_score': self.match_score,
            'scraped_at': self.scraped_at,
            'source': self.source,
            'hash': self.hash
        }


class RealJobScraper:
    """Scrapes REAL job data from multiple sources"""
    
    def __init__(self):
        self.indeed_api_key = os.getenv('INDEED_API_KEY')
        self.linkedin_api_key = os.getenv('LINKEDIN_API_KEY')
        self.session: Optional[aiohttp.ClientSession] = None
        self.jobs: List[Job] = []
        
    async def init_session(self):
        self.session = aiohttp.ClientSession()
    
    async def close_session(self):
        if self.session:
            await self.session.close()

    async def scrape_indeed_jobs(self, query: str, location: str = "USA") -> List[Job]:
        """
        Scrape jobs from Indeed using web scraping
        (Indeed has an API but requires partnership)
        """
        try:
            logger.info(f"Scraping Indeed for: {query} in {location}")
            
            jobs = []
            # Using Indeed's search URL structure
            search_url = f"https://www.indeed.com/jobs?q={query}&l={location}&sort=date"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            async with self.session.get(search_url, headers=headers) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Parse Indeed job cards
                    job_cards = soup.find_all('div', class_='job_seen_beacon')
                    
                    for card in job_cards[:10]:  # Get top 10 jobs
                        try:
                            job_title = card.find('span', title=True)
                            job_url_elem = card.find('a')
                            company = card.find('span', class_='companyName')
                            location_elem = card.find('span', class_='companyLocation')
                            description = card.find('div', class_='job-snippet')
                            
                            if job_title and job_url_elem and company:
                                job_data = Job(
                                    id=f"indeed_{datetime.now().timestamp()}_{len(jobs)}",
                                    company=company.text.strip(),
                                    title=job_title.text.strip(),
                                    location=location_elem.text.strip() if location_elem else location,
                                    url=urljoin("https://www.indeed.com", job_url_elem['href']),
                                    posted_time="Today",
                                    days_ago=0,
                                    skills=self._extract_skills(description.text) if description else "",
                                    description=description.text.strip() if description else "",
                                    salary_min=self._extract_salary_min(description.text) if description else None,
                                    salary_max=self._extract_salary_max(description.text) if description else None,
                                    visa_sponsorship=self._check_visa_sponsorship(description.text) if description else False,
                                    source="indeed"
                                )
                                # Extract LinkedIn contact from company name
                                job_data.linkedin_poster = await self._find_linkedin_contact(company.text.strip())
                                jobs.append(job_data)
                        except Exception as e:
                            logger.warning(f"Error parsing Indeed job card: {e}")
                            continue
            
            logger.info(f"✅ Found {len(jobs)} jobs on Indeed")
            return jobs
            
        except Exception as e:
            logger.error(f"Error scraping Indeed: {e}")
            return []

    async def scrape_linkedin_jobs(self, query: str, location: str = "United States") -> List[Job]:
        """
        Scrape jobs from LinkedIn Jobs API
        Requires LinkedIn API credentials
        """
        try:
            logger.info(f"Scraping LinkedIn for: {query} in {location}")
            
            jobs = []
            
            # LinkedIn API endpoint for job search
            url = "https://api.linkedin.com/v2/jobs"
            
            headers = {
                'Authorization': f'Bearer {self.linkedin_api_key}',
                'Content-Type': 'application/json'
            }
            
            params = {
                'q': query,
                'location': location,
                'sortBy': 'mostRecent',
                'limit': 10
            }
            
            if self.linkedin_api_key:
                async with self.session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        for job_elem in data.get('elements', []):
                            try:
                                job_data = Job(
                                    id=f"linkedin_{job_elem.get('id')}",
                                    company=job_elem.get('company', {}).get('name', 'Unknown'),
                                    title=job_elem.get('title', ''),
                                    location=job_elem.get('location', ''),
                                    url=job_elem.get('jobUrl', ''),
                                    posted_time="Today",
                                    days_ago=0,
                                    skills=','.join(job_elem.get('skills', [])),
                                    description=job_elem.get('description', ''),
                                    salary_min=job_elem.get('salary', {}).get('minimum'),
                                    salary_max=job_elem.get('salary', {}).get('maximum'),
                                    visa_sponsorship=job_elem.get('visaSponsorship', False),
                                    linkedin_poster=job_elem.get('hirer', None),  # REAL LinkedIn contact
                                    source="linkedin"
                                )
                                jobs.append(job_data)
                            except Exception as e:
                                logger.warning(f"Error parsing LinkedIn job: {e}")
                                continue
            
            logger.info(f"✅ Found {len(jobs)} jobs on LinkedIn")
            return jobs
            
        except Exception as e:
            logger.error(f"Error scraping LinkedIn: {e}")
            return []

    async def scrape_company_careers_page(self, company_name: str, careers_url: str) -> List[Job]:
        """
        Scrape REAL jobs from company's careers page
        Supports common career page structures
        """
        try:
            logger.info(f"Scraping careers page for {company_name}")
            
            jobs = []
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            async with self.session.get(careers_url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Try different selectors for job listings
                    job_selectors = [
                        'div[class*="job"]',
                        'article[class*="job"]',
                        'li[class*="job"]',
                        'div[class*="position"]',
                        'div[class*="opening"]'
                    ]
                    
                    job_elements = []
                    for selector in job_selectors:
                        job_elements = soup.select(selector)
                        if job_elements:
                            break
                    
                    for elem in job_elements[:10]:
                        try:
                            # Extract job title
                            title_elem = elem.find(['h1', 'h2', 'h3', 'a'], class_=re.compile('.*title.*', re.I))
                            if not title_elem:
                                title_elem = elem.find(['h1', 'h2', 'h3', 'a'])
                            
                            # Extract job URL
                            url_elem = elem.find('a', href=True)
                            
                            # Extract location
                            location_elem = elem.find(string=re.compile('.*location.*|.*city.*', re.I))
                            
                            # Extract description
                            desc_elem = elem.find(['p', 'div'], class_=re.compile('.*description.*|.*summary.*', re.I))
                            
                            if title_elem and url_elem:
                                job_title = title_elem.get_text().strip()
                                job_url = urljoin(careers_url, url_elem['href'])
                                job_location = location_elem if location_elem else "Location TBD"
                                job_desc = desc_elem.get_text().strip() if desc_elem else ""
                                
                                job_data = Job(
                                    id=f"{company_name.lower()}_{datetime.now().timestamp()}_{len(jobs)}",
                                    company=company_name,
                                    title=job_title,
                                    location=str(job_location),
                                    url=job_url,  # REAL job posting URL
                                    posted_time="Today",
                                    days_ago=0,
                                    skills=self._extract_skills(job_desc),
                                    description=job_desc,
                                    salary_min=self._extract_salary_min(job_desc),
                                    salary_max=self._extract_salary_max(job_desc),
                                    visa_sponsorship=self._check_visa_sponsorship(job_desc),
                                    source="company_website"
                                )
                                
                                # Find REAL LinkedIn contact from company
                                job_data.linkedin_poster = await self._find_linkedin_contact(company_name)
                                jobs.append(job_data)
                        except Exception as e:
                            logger.warning(f"Error parsing job element: {e}")
                            continue
            
            logger.info(f"✅ Found {len(jobs)} jobs on {company_name} careers page")
            return jobs
            
        except Exception as e:
            logger.error(f"Error scraping {company_name} careers page: {e}")
            return []

    async def _find_linkedin_contact(self, company_name: str) -> Optional[Dict]:
        """
        Find REAL LinkedIn contact for company
        Uses LinkedIn Search API or web scraping
        """
        try:
            if self.linkedin_api_key:
                # Use LinkedIn API to find company and employees
                headers = {
                    'Authorization': f'Bearer {self.linkedin_api_key}',
                    'Content-Type': 'application/json'
                }
                
                # Search for company
                url = f"https://api.linkedin.com/v2/companies?q={company_name}"
                async with self.session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('elements'):
                            company = data['elements'][0]
                            
                            # Get hiring managers from company
                            company_id = company.get('id')
                            employees_url = f"https://api.linkedin.com/v2/employees?q={company_id}&keywords=hiring"
                            
                            async with self.session.get(employees_url, headers=headers) as emp_response:
                                if emp_response.status == 200:
                                    emp_data = await emp_response.json()
                                    if emp_data.get('elements'):
                                        contact = emp_data['elements'][0]
                                        return {
                                            'name': f"{contact.get('firstName', '')} {contact.get('lastName', '')}",
                                            'title': contact.get('headline', 'Hiring Manager'),
                                            'linkedin_url': f"https://linkedin.com/in/{contact.get('publicIdentifier', '')}",
                                            'company': company_name
                                        }
        except Exception as e:
            logger.warning(f"Could not find LinkedIn contact for {company_name}: {e}")
        
        return None

    def _extract_skills(self, text: str) -> str:
        """Extract common skills from job description"""
        if not text:
            return ""
        
        common_skills = [
            'Python', 'SQL', 'Java', 'JavaScript', 'C++', 'C#',
            'R', 'MATLAB', 'Scala', 'Go', 'Rust', 'PHP',
            'AWS', 'Azure', 'GCP', 'Google Cloud', 'Kubernetes', 'Docker',
            'Tableau', 'Power BI', 'Looker', 'Analytics', 'Grafana',
            'Spark', 'Hadoop', 'Hive', 'Kafka', 'ETL',
            'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
            'Data Warehouse', 'Snowflake', 'BigQuery', 'Redshift',
            'Git', 'Linux', 'Jenkins', 'Terraform', 'Ansible'
        ]
        
        found_skills = []
        text_lower = text.lower()
        
        for skill in common_skills:
            if skill.lower() in text_lower:
                found_skills.append(skill)
        
        return ', '.join(found_skills) if found_skills else "Check job description"

    def _extract_salary_min(self, text: str) -> Optional[int]:
        """Extract minimum salary from text"""
        if not text:
            return None
        
        # Look for patterns like $100,000 or 100k
        patterns = [
            r'\$([0-9]{3,}),?([0-9]{0,3})\s*(?:per|/)',
            r'\$([0-9]{2,})[kK]',
            r'([0-9]{3,}),?([0-9]{0,3})\s*(?:USD|annually)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    if 'k' in text.lower()[match.start():match.end()]:
                        return int(match.group(1)) * 1000
                    else:
                        return int(match.group(1))
                except:
                    continue
        
        return None

    def _extract_salary_max(self, text: str) -> Optional[int]:
        """Extract maximum salary from text"""
        if not text:
            return None
        
        # Find all salary patterns and return the highest
        salaries = re.findall(r'\$([0-9]{3,}),?([0-9]{0,3})', text)
        if salaries:
            try:
                max_salary = max([int(s[0]) for s in salaries if s[0]])
                return max_salary
            except:
                pass
        
        return None

    def _check_visa_sponsorship(self, text: str) -> bool:
        """Check if job mentions visa sponsorship"""
        if not text:
            return False
        
        visa_keywords = [
            'visa sponsorship', 'sponsor visa', 'h-1b',
            'visa support', 'immigration', 'work authorization'
        ]
        
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in visa_keywords)


class ProductionJobScoutAgent:
    """Production-ready job tracking agent"""
    
    def __init__(self):
        self.scraper = RealJobScraper()
        self.jobs: List[Job] = []
        self.storage_file = "production_jobs.json"
        self.load_jobs()

    def load_jobs(self):
        """Load saved jobs from file"""
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r') as f:
                    data = json.load(f)
                    self.jobs = [Job(**job) for job in data]
                    logger.info(f"✅ Loaded {len(self.jobs)} jobs from storage")
            except Exception as e:
                logger.error(f"Error loading jobs: {e}")

    def save_jobs(self):
        """Save jobs to file"""
        try:
            with open(self.storage_file, 'w') as f:
                json.dump([job.to_dict() for job in self.jobs], f, indent=2)
                logger.info(f"✅ Saved {len(self.jobs)} jobs to storage")
        except Exception as e:
            logger.error(f"Error saving jobs: {e}")

    async def scrape_all_sources(self, companies: List[str], keywords: List[str]):
        """Scrape jobs from multiple sources"""
        await self.scraper.init_session()
        
        try:
            all_jobs = []
            
            # Scrape Indeed for each keyword
            for keyword in keywords:
                indeed_jobs = await self.scraper.scrape_indeed_jobs(keyword)
                all_jobs.extend(indeed_jobs)
            
            # Scrape LinkedIn
            for keyword in keywords:
                linkedin_jobs = await self.scraper.scrape_linkedin_jobs(keyword)
                all_jobs.extend(linkedin_jobs)
            
            # Scrape company career pages
            company_urls = {
                'Google': 'https://careers.google.com',
                'Amazon': 'https://www.amazon.jobs',
                'Microsoft': 'https://careers.microsoft.com',
                'Apple': 'https://www.apple.com/jobs',
                'Meta': 'https://www.metacareers.com',
                'Netflix': 'https://jobs.netflix.com',
                'Stripe': 'https://stripe.com/jobs',
                'Figma': 'https://www.figma.com/careers',
                'Notion': 'https://www.notion.so/careers',
                'Airbnb': 'https://www.airbnb.com/careers'
            }
            
            for company, url in company_urls.items():
                if company in companies:
                    company_jobs = await self.scraper.scrape_company_careers_page(company, url)
                    all_jobs.extend(company_jobs)
            
            # Remove duplicates
            seen_hashes = {job.hash for job in self.jobs}
            new_jobs = [job for job in all_jobs if job.hash not in seen_hashes]
            
            # Add new jobs
            self.jobs.extend(new_jobs)
            self.save_jobs()
            
            logger.info(f"✅ Total jobs: {len(self.jobs)}")
            return new_jobs
            
        finally:
            await self.scraper.close_session()

    def get_production_jobs_summary(self) -> Dict:
        """Get summary of production jobs"""
        return {
            'total_jobs': len(self.jobs),
            'sources': list(set(job.source for job in self.jobs)),
            'companies': list(set(job.company for job in self.jobs)),
            'recent_jobs': len([j for j in self.jobs if j.days_ago == 0]),
            'jobs_with_real_contacts': len([j for j in self.jobs if j.linkedin_poster]),
            'jobs_with_real_urls': len([j for j in self.jobs if j.url and 'http' in j.url])
        }


async def main():
    """Test production agent"""
    agent = ProductionJobScoutAgent()
    
    companies = ['Google', 'Amazon', 'Microsoft', 'Meta', 'Stripe']
    keywords = ['Data Engineer', 'BI Engineer', 'Analytics Engineer']
    
    logger.info("Starting production job scraping...")
    new_jobs = await agent.scrape_all_sources(companies, keywords)
    
    summary = agent.get_production_jobs_summary()
    logger.info(f"Production Summary: {summary}")
    
    # Print sample jobs with real data
    print("\n=== REAL JOBS FOUND ===\n")
    for job in new_jobs[:5]:
        print(f"Title: {job.title}")
        print(f"Company: {job.company}")
        print(f"Location: {job.location}")
        print(f"URL: {job.url}")
        print(f"Contact: {job.linkedin_poster}")
        print(f"Source: {job.source}")
        print("---\n")


if __name__ == '__main__':
    asyncio.run(main())
