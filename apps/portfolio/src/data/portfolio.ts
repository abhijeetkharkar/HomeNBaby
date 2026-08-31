export const meta = {
  name: 'Abhijeet Kharkar',
  title: 'Senior Software Engineer I',
  summary:
    'I build distributed systems, cloud-native microservices, and modern web platforms — and the automation that ships them safely. 12+ years across the full stack, from React Server Components and GraphQL BFF layers down to serverless event pipelines and infrastructure as code.',
  pills: ['12+ Years Experience', 'Full-Stack', 'React · Next.js · Angular', '.NET · Node.js', 'AWS', 'TypeScript'],
  github: 'https://github.com/abhijeetkharkar',
  linkedin: 'https://www.linkedin.com/in/abhijeetkharkar/',
};

export interface Project {
  name: string;
  description: string;
  url: string;
  wip?: boolean;
  tech: string[];
}

export const projects: Project[] = [
  {
    name: 'HomeNBaby — Baby Tracker',
    description:
      'A full-stack monorepo app for tracking a newborn\'s daily activity — feedings, sleep, diaper changes. Built for real parents to share with family. React + AWS Lambda + DynamoDB, deployed on CloudFront.',
    url: 'https://github.com/abhijeetkharkar/HomeNBaby',
    tech: ['React 18', 'TypeScript', 'AWS CDK', 'Lambda', 'DynamoDB', 'Cognito'],
  },
  {
    name: 'Cinema Manager',
    description:
      'A web app for managing movie collections, watchlists, and ratings. Full-stack with a React frontend and a Node.js backend backed by a database. Work in progress.',
    url: 'https://github.com/abhijeetkharkar/cinema-manager',
    wip: true,
    tech: ['React', 'Node.js', 'TypeScript'],
  },
  {
    name: 'This Portfolio',
    description:
      'Built as part of a HomeNBaby monorepo. Static React app deployed to S3 + CloudFront via AWS CDK. Zero-dependency markdown rendering, dark-theme design.',
    url: 'https://github.com/abhijeetkharkar/HomeNBaby',
    tech: ['React 19', 'TypeScript', 'Vite', 'AWS CDK', 'CloudFront'],
  },
];

export interface WorkEntry {
  company: string;
  companyNote?: string;
  companyUrl?: string;
  location: string;
  period: string;
  role: string;
  highlight?: boolean;
  items: Array<{
    name: string;
    meta?: string;
    bullets: string[];
    tech?: string;
  }>;
}

export const workExperience: WorkEntry[] = [
  {
    company: 'Rocket Companies',
    companyNote: 'formerly Rocket Central · Rocket Mortgage · Quicken Loans',
    location: 'Detroit, MI',
    period: '2019 – Present',
    role: 'Associate SE → SE → Senior SE I',
    highlight: true,
    items: [
      {
        name: 'CI/CD & Release Automation Platform',
        meta: 'Solo build · Company-wide Technology MVP · 2025–present',
        bullets: [
          'Eliminated 1–2 hrs/day of manual release toil — pipeline now handles versioning, staged rollout, approval gating, and change-management filings automatically',
          '2× daily deployments with zero engineer babysitting; compliance audit trail writes itself on every release',
          'Chat-ops bot routes notifications, announces canary progress, and links engineers directly to failure logs',
          'Now expanding the system enterprise-wide with 2 additional engineers',
        ],
        tech: 'TypeScript · GitHub Actions · Kubernetes · Observability & change-management integrations',
      },
      {
        name: 'Rocket Mortgage Servicing — Next.js Platform',
        meta: '~500K monthly active users · 2025–present',
        bullets: [
          'Redesigned the A/B offers system so product teams launch time-sensitive promotions (e.g. rate drops) in 5 min — previously required an engineering ticket and a Sitecore/Adobe Target dependency',
          '5–10 live experiments running at any time via Optimizely; product teams add, update, or remove offers with zero code changes',
          'Moved offer eligibility to server-side rendering, reducing client JS and improving load performance',
          'Authored 50+ changes across the React frontend, GraphQL BFF, and platform layers',
        ],
        tech: 'Next.js · React 19 · React Relay · GraphQL · TypeScript · Tailwind CSS · Optimizely',
      },
      {
        name: 'My Rocket Dashboard — Angular SPA + NestJS BFF',
        meta: '1.6M+ clients · Senior Engineer & Tech Lead · 2022–2025',
        bullets: [
          'Continuous tech lead and go-to for architecture, production debugging, and unblocking delivery across a team of 6 engineers',
          'Built the centralized onboarding flow from scratch — multi-step wizard, eligibility routing, auto-pay setup, CDN config, and end-to-end tests; launched to the full 1.6M+ client base',
          'Implemented the early-access experience for newly acquired clients end-to-end: data schema, API endpoints, route guards, multi-loan support, and load testing; solved a fundamental layout blocker under pressure that was stalling the launch',
          'Migrated the platform off legacy A/B testing (Adobe Target) to a self-hosted experimentation system delivered via CDN — giving product full control over audience management',
          'Authored ~1,500 changes and reviewed 1,800+ across my Rocket tenure',
        ],
        tech: 'Angular · NestJS · TypeScript · Sitecore CMS · Cypress · CDN/edge config · C#/.NET',
      },
      {
        name: 'Servicing Integration Platform (SIP)',
        meta: 'Co-built from scratch · 15–30 downstream consumers · 2019–2022',
        bullets: [
          'Co-designed and built the SIP gateway from the ground up with one partner — the sole cloud-facing entry point to all loan-servicing data for 15–30 downstream applications',
          'Replaced a legacy on-prem gateway; handled peak load well above production traffic in load testing',
          'Designed the domain models and data contracts (payments, escrow, HELOC, borrower profiles) that downstream teams built on',
          '20+ serverless endpoints across synchronous and asynchronous modes; platform responsibly decommissioned after the Mr. Cooper acquisition as part of migration to LSAMS/Sagent',
        ],
        tech: 'C#/.NET Core · AWS Lambda · API Gateway · SQS · Kinesis · Terraform',
      },
      {
        name: 'Document-Automation Platform & Event Streaming',
        bullets: [
          'Built two core serverless processors for a loan-audit automation platform — highest-volume repositories in this era, with 85–94% unit-test coverage',
          'Built a real-time Kinesis event pipeline with configurable routing and a missed-event recovery processor so transient failures never meant lost data',
        ],
        tech: 'C#/.NET Core · AWS Lambda · SQS · Kinesis · S3 · RDS · Terraform · 170+ IaC changes',
      },
    ],
  },
  {
    company: 'University of Iowa',
    location: 'Iowa City, IA',
    period: '2017 – 2019',
    role: 'Graduate Research & Teaching Assistant · M.S. Computer Science',
    items: [
      {
        name: 'CourseHub — Full-Stack Academic Platform',
        meta: 'Led architecture with one collaborator',
        bullets: [
          'Co-led the full architecture of CourseHub — database schema, API/backend, frontend, auth, and deployment — as the capstone project for my graduate program',
        ],
        tech: 'Full-stack web · Auth · Deployment',
      },
      {
        name: 'Research & Teaching',
        bullets: [
          'Graduate Research Assistant: Computational Epidemiology — modeled hospital disease spread using mote-sensor data and Python simulations (NSF-funded)',
          'Teaching Assistant: led labs and office hours for an introductory Python course',
        ],
      },
    ],
  },
  {
    company: 'Cognizant Technology Solutions @ HDFC Bank',
    location: 'Mumbai, India',
    period: '2013 – 2017',
    role: 'Software Developer',
    items: [
      {
        name: 'Performance Analyser',
        meta: 'Saved 100+ ops hrs/week · Best Performer award',
        bullets: [
          'Built in my first year: a Java desktop app that automatically computed CPU/memory utilization across Windows and UNIX bank servers and generated reports — eliminating 100+ hours of manual weekly ops work',
          'First automation of its kind at the client site; recognized with Best Performer, Banking & Finance Services (Asia Pacific) two consecutive quarters',
        ],
        tech: 'Java · Windows/UNIX system APIs · Automated reporting',
      },
      {
        name: 'Production Support & Application Development',
        bullets: [
          'Moved from IT production support into software development; built a JSF/PrimeFaces project dashboard with rollup reporting and Excel/PDF export',
          'Freelanced on static web projects for 1–2 clients in parallel',
        ],
        tech: 'Java · JSF · PrimeFaces · MySQL',
      },
    ],
  },
];

export const education = [
  {
    degree: 'M.S., Computer Science',
    institution: 'University of Iowa',
    year: '2019',
    gpa: '3.62',
  },
  {
    degree: 'B.E., Information Technology',
    institution: 'University of Mumbai',
    year: '2013',
    gpa: '3.33',
  },
];

export const recognition = [
  'Company-wide Technology MVP — Rocket Companies',
  'Consistent "Exceeds Expectations" performance ratings',
  'Dozens of peer-recognition awards; multiple internal hackathon wins',
  'Best Performer, Banking & Finance Services (Asia Pacific) — two consecutive quarters at Cognizant',
];
