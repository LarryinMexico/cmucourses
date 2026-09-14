import { TaxonomyItem } from "./types";

// DRAFT for team review. Ids are permanent once shipped; see TaxonomyItem.
export const CAREERS = [
  { id: "swe", label: "Software Engineering" },
  { id: "ml-ai", label: "Machine Learning / AI" },
  { id: "data-science", label: "Data Science & Analytics" },
  { id: "systems-infra", label: "Systems & Infrastructure" },
  { id: "security", label: "Security" },
  { id: "quant-finance", label: "Quantitative Finance" },
  { id: "product-management", label: "Product Management" },
  { id: "ux-design", label: "UX / Product Design" },
  { id: "robotics", label: "Robotics & Autonomous Systems" },
  { id: "hardware-embedded", label: "Hardware & Embedded Systems" },
  { id: "research", label: "Research / PhD" },
  { id: "consulting", label: "Consulting & Strategy" },
  { id: "entrepreneurship", label: "Entrepreneurship / Startups" },
  { id: "tech-policy", label: "Technology Policy" },
] as const satisfies readonly TaxonomyItem[];

export type CareerID = (typeof CAREERS)[number]["id"];
