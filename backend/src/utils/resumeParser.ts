/**
 * Resume Parser Utility
 * Extracts skills, job titles, and education from PDF/DOCX resumes.
 * Uses pdf-parse v2 (PDFParse class) and mammoth.
 */

// pdf-parse v2 uses a class-based API; @types/pdf-parse covers v1,
// so we use a require cast to avoid the type mismatch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> } };
import mammoth from 'mammoth';

export interface ParsedResume {
  rawText: string;
  skills: string[];
  titles: string[];
  education: string[];
}

const SKILL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'swift', 'kotlin',
  'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt', 'remix',
  'node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel',
  'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'elasticsearch',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible',
  'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab ci',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn',
  'data analysis', 'pandas', 'numpy', 'spark', 'hadoop',
  'rest api', 'graphql', 'grpc', 'microservices', 'kafka', 'rabbitmq',
  'agile', 'scrum', 'kanban', 'linux', 'html', 'css', 'tailwind', 'sass',
  'figma', 'photoshop', 'cybersecurity', 'penetration testing', 'owasp',
  'blockchain', 'solidity', 'web3', 'ios', 'android', 'react native', 'flutter',
];

const TITLE_KEYWORDS = [
  'software engineer', 'software developer', 'frontend developer', 'backend developer',
  'full stack', 'fullstack', 'full-stack',
  'data scientist', 'data analyst', 'data engineer',
  'machine learning engineer', 'ml engineer', 'ai engineer',
  'devops engineer', 'platform engineer', 'site reliability engineer', 'sre',
  'cloud engineer', 'cloud architect', 'solutions architect',
  'security engineer', 'security analyst', 'penetration tester',
  'product manager', 'project manager', 'program manager',
  'tech lead', 'technical lead', 'engineering manager',
  'senior engineer', 'senior developer', 'staff engineer', 'principal engineer',
  'junior developer', 'associate developer', 'intern', 'software intern',
  'architect', 'cto', 'vp engineering', 'head of engineering',
  'mobile developer', 'ios developer', 'android developer',
  'qa engineer', 'quality assurance', 'test engineer',
];

const EDUCATION_KEYWORDS = [
  'bachelor', "bachelor's", 'b.s.', 'b.e.', 'b.tech', 'b.sc',
  'master', "master's", 'm.s.', 'm.e.', 'm.tech', 'm.sc', 'mba',
  'phd', 'ph.d', 'doctorate',
  'computer science', 'information technology', 'information systems',
  'software engineering', 'electrical engineering', 'computer engineering',
  'mathematics', 'statistics', 'data science', 'cybersecurity',
];

export async function parseResume(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume> {
  let rawText = '';

  try {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: fileBuffer });
      const result = await parser.getText();
      rawText = result.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      rawText = result.value;
    }
  } catch (err) {
    console.error('Resume parse error:', err);
    return { rawText: '', skills: [], titles: [], education: [] };
  }

  if (!rawText.trim()) {
    return { rawText: '', skills: [], titles: [], education: [] };
  }

  const lower = rawText.toLowerCase();

  const skills = SKILL_KEYWORDS.filter((s) => lower.includes(s));
  const titles = TITLE_KEYWORDS.filter((t) => lower.includes(t));
  const education = EDUCATION_KEYWORDS.filter((e) => lower.includes(e));

  return {
    rawText: rawText.slice(0, 5000),
    skills,
    titles,
    education,
  };
}
