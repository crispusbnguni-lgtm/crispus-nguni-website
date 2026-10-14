export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishedAt: string;
  featured: boolean;
};

export const articles: Article[] = [
  {
    id: "money-001",
    slug: "understanding-your-money",
    title: "Understanding Your Money",
    excerpt:
      "Before building wealth, understand how your income, spending, saving and financial decisions work together.",
    category: "Money Management",
    readTime: "6 min read",
    publishedAt: "2026-10-03",
    featured: true,
  },
  {
    id: "investing-001",
    slug: "before-you-invest",
    title: "Before You Invest, Understand What You Own",
    excerpt:
      "A practical introduction to thinking about investments, risk, ownership and long-term decision making.",
    category: "Investing",
    readTime: "7 min read",
    publishedAt: "2026-10-03",
    featured: true,
  },
  {
    id: "wealth-001",
    slug: "income-is-not-wealth",
    title: "Your Income Is Not the Same Thing as Your Wealth",
    excerpt:
      "Why earning more money and building lasting financial strength are related but different goals.",
    category: "Wealth",
    readTime: "5 min read",
    publishedAt: "2026-10-03",
    featured: false,
  },
];