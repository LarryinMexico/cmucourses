import { SkillID } from "../taxonomy/skills";

/**
 * The only hand-curated fact in this file: which skills a course teaches. Everything else
 * (which careers a course serves, course recommendations) is derived from this plus
 * careerSkills.ts — see mapping/index.ts.
 *
 * DRAFT for team review, checked against the live course catalog on 2026-09-14 (courseID and
 * course name both verified against https://course.apis.scottylabs.org/courses/all — the name
 * in each comment is what that check returned, so a stale comment here is a sign the course was
 * renumbered or renamed upstream). Coverage is intentionally uneven: this is a first pass over
 * ~90 well-known courses, weighted toward SCS/ECE/Statistics with a smaller pass over Heinz,
 * Tepper and EPP for the less technical careers (product management, consulting,
 * entrepreneurship, tech policy) where SKILLS has no dedicated ids yet — those use the closest
 * available skills (product-strategy, leadership, technical-writing) as a proxy.
 *
 * Keys are canonical courseIDs ("NN-NNN"); run scripts/check-course-ids.ts after editing to
 * confirm every key still exists in the live catalog, and scripts/suggest-courses.ts to find
 * more candidates for a skill.
 */
export const COURSE_SKILLS = {
  "04-617": ["product-strategy", "leadership"], // Foundations of Entrepreneurship
  "05-319": ["data-visualization"], // Data Visualization
  "05-391": ["ui-ux-design"], // Designing Human Centered Software
  "05-410": ["user-research"], // User-Centered Research and Evaluation
  "05-431": ["ui-ux-design"], // Software Structures for User Interfaces
  "05-610": ["user-research"], // User-Centered Research and Evaluation
  "05-619": ["data-visualization"], // Data Visualization
  "05-833": ["ui-ux-design", "user-research"], // Gadgets, Sensors and Activity Recognition in HCI
  "05-891": ["ui-ux-design"], // Designing Human Centered Software
  "10-301": ["machine-learning", "statistics", "probability"], // Introduction to Machine Learning
  "10-315": ["machine-learning", "statistics"], // Introduction to Machine Learning (SCS Majors)
  "10-403": ["reinforcement-learning", "deep-learning"], // Deep Reinforcement Learning & Control
  "10-417": ["deep-learning"], // Intermediate Deep Learning
  "10-601": ["machine-learning", "statistics", "probability"], // Introduction to Machine Learning
  "10-605": ["machine-learning", "distributed-systems"], // Machine Learning with Large Datasets
  "10-617": ["deep-learning"], // Intermediate Deep Learning
  "10-703": ["reinforcement-learning", "controls"], // Deep Reinforcement Learning & Control
  "10-708": ["probability", "machine-learning"], // Probabilistic Graphical Models
  "10-725": ["optimization"], // Optimization for Machine Learning
  "11-411": ["nlp"], // Natural Language Processing
  "11-604": ["python", "data-visualization"], // Python for Data Science I
  "11-611": ["nlp"], // Natural Language Processing
  "14-741": ["security-fundamentals"], // Introduction to Information Security
  "14-828": ["security-fundamentals", "networking"], // Browser Security
  "14-848": ["cloud-devops"], // Cloud Infrastructure and Services
  "15-122": ["algorithms", "c-cpp"], // Principles of Imperative Computation
  "15-150": ["functional-programming"], // Principles of Functional Programming
  "15-210": ["algorithms", "functional-programming"], // Parallel and Sequential Data Structures and Algorithms
  "15-213": ["c-cpp", "systems-programming", "computer-architecture"], // Introduction to Computer Systems
  "15-251": ["algorithms"], // Great Ideas in Theoretical Computer Science
  "15-319": ["cloud-devops"], // Cloud Computing
  "15-356": ["cryptography"], // Introduction to Cryptography
  "15-388": ["python", "machine-learning", "data-visualization"], // Practical Data Science
  "15-390": ["product-strategy", "financial-modeling"], // Entrepreneurship for Computer Science
  "15-410": ["operating-systems", "systems-programming", "c-cpp"], // Operating System Design and Implementation
  "15-411": ["systems-programming", "c-cpp"], // Compiler Design
  "15-415": ["databases", "sql"], // Database Applications
  "15-440": ["distributed-systems", "systems-programming"], // Distributed Systems
  "15-441": ["networking"], // Networking and the Internet
  "15-445": ["databases", "sql"], // Database Systems
  "15-451": ["algorithms"], // Algorithm Design and Analysis
  "15-619": ["cloud-devops", "distributed-systems"], // Cloud Computing
  "15-645": ["databases", "sql"], // Database Systems
  "15-712": ["distributed-systems", "operating-systems"], // Advanced Operating Systems and Distributed Systems
  "16-299": ["controls"], // Introduction to Feedback Control Systems
  "16-311": ["controls"], // Introduction to Robotics
  "16-362": ["controls", "embedded-systems"], // Mobile Robot Algorithms Laboratory
  "16-385": ["computer-vision"], // Computer Vision
  "16-720": ["computer-vision"], // Computer Vision
  "17-313": ["leadership", "technical-writing"], // Foundations of Software Engineering
  "17-423": ["systems-programming", "java"], // Software System Design
  "17-437": ["web-development", "javascript-typescript"], // Web Application Development
  "17-493": ["leadership"], // Hands-on Negotiations for Technology Leaders
  "17-619": ["product-strategy", "user-research"], // Product Management Essentials I
  "17-629": ["product-strategy", "user-research"], // Product Management Essentials II
  "17-632": ["leadership", "technical-writing"], // Software Project Management
  "17-637": ["web-development", "javascript-typescript"], // Web Application Development
  "17-692": ["product-strategy", "user-research"], // Product Management Essentials
  "18-335": ["security-fundamentals", "systems-programming"], // Secure Software Systems
  "18-349": ["embedded-systems", "c-cpp"], // Introduction to Embedded Systems
  "18-447": ["computer-architecture"], // Introduction to Computer Architecture
  "18-730": ["security-fundamentals"], // Introduction to Computer Security
  "18-733": ["cryptography"], // Applied Cryptography
  "19-201": ["technical-writing", "leadership"], // Professional Issues in Engineering, Science, Technology and Public Policy
  "19-351": ["data-visualization", "statistics"], // Applied Methods for Technology-Policy Analysis
  "19-433": ["data-visualization", "statistics", "python"], // Data Science for Technology, Innovation and Policy
  "21-241": ["linear-algebra"], // Matrices and Linear Transformations
  "21-270": ["financial-modeling", "probability"], // Introduction to Mathematical Finance
  "21-341": ["linear-algebra"], // Linear Algebra
  "21-370": ["financial-modeling", "probability"], // Discrete Time Finance
  "24-451": ["controls"], // Feedback Control Systems
  "36-225": ["probability"], // Introduction to Probability Theory
  "36-226": ["statistics"], // Introduction to Statistical Inference
  "36-350": ["statistics", "data-visualization", "python"], // Statistical Computing
  "36-401": ["statistics"], // Modern Regression
  "36-462": ["machine-learning", "statistics"], // Special Topics: Statistical Machine Learning
  "36-613": ["data-visualization", "statistics"], // Data Visualization
  "36-640": ["statistics", "probability"], // Probability & Statistics for Data Science
  "45-730": ["product-strategy", "leadership"], // Marketing Management
  "45-885": ["data-visualization"], // Data Visualization
  "67-331": ["leadership", "technical-writing", "product-strategy"], // Technology Consulting in the Global Community
  "67-443": ["mobile-development"], // Mobile Application Design and Development
  "67-743": ["mobile-development"], // Mobile Application Design and Development
  "70-453": ["product-strategy", "leadership"], // Business Technology for Consulting
  "70-493": ["financial-modeling"], // Valuation and Financial Modeling
  "90-732": ["sql", "databases"], // SQL Fundamentals
  "90-812": ["python"], // Python Programming I
  "90-819": ["python"], // Python Programming II
  "95-706": ["java", "systems-programming"], // Object Oriented Analysis and Design
  "95-712": ["java"], // Object Oriented Programming in JAVA
  "95-749": ["cryptography"], // Cryptography
  "95-819": ["statistics", "data-visualization"], // A/B Testing, Design and Analysis
  "95-828": ["machine-learning", "statistics"], // Machine Learning for Problem Solving
  "95-891": ["machine-learning", "algorithms"], // Introduction to Artificial Intelligence
} as const satisfies Record<string, readonly SkillID[]>;
