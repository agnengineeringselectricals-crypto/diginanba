import { db } from './db';

export type DiscoveryCategory = { name: string; icon: string; matches: string[]; searchTerms: string[] };
export type DiscoveryNeed = { label: string; icon: string; categories: string[] };
export type DiscoveryRow = { key: string; title: string; subtitle: string; categories: string[] };

const defaultCategories: DiscoveryCategory[] = [
  { icon: '📚', name: 'Ebooks & Guides', matches: ['Ebooks & Guides'], searchTerms: ['books', 'guide', 'reading'] },
  { icon: '📊', name: 'Excel / Google Sheets', matches: ['Excel / Google Sheets', 'Excel & Sheets'], searchTerms: ['spreadsheet', 'budget', 'accounting', 'invoice', 'calculator'] },
  { icon: '📄', name: 'Templates & Documents', matches: ['Templates & Documents'], searchTerms: ['resume', 'résumé', 'cv', 'project management', 'documents', 'checklist'] },
  { icon: '🎨', name: 'Design Assets', matches: ['Design Assets'], searchTerms: ['instagram', 'social media', 'logo', 'creative', 'graphics'] },
  { icon: '📣', name: 'Marketing & Sales', matches: ['Marketing & Sales'], searchTerms: ['instagram', 'seo', 'advertising', 'promotion', 'sales'] },
  { icon: '🤖', name: 'AI & Automation', matches: ['AI & Automation'], searchTerms: ['artificial intelligence', 'workflow', 'automate', 'productivity'] },
  { icon: '🚀', name: 'Business & Entrepreneurship', matches: ['Business & Entrepreneurship'], searchTerms: ['business plan', 'startup', 'entrepreneur', 'company'] },
  { icon: '🎓', name: 'Education & Learning', matches: ['Education & Learning'], searchTerms: ['learn', 'course', 'python', 'skill', 'training'] },
  { icon: '💻', name: 'Software / Code', matches: ['Software / Code'], searchTerms: ['app', 'application', 'python', 'coding', 'software', 'programming'] },
  { icon: '📐', name: 'CAD / Engineering', matches: ['CAD / Engineering', 'CAD & Engineering'], searchTerms: ['drawing', 'technical', 'engineering', 'design'] },
  { icon: '💰', name: 'Finance & Accounting', matches: ['Finance & Accounting'], searchTerms: ['accounting', 'budget', 'invoice', 'cashflow', 'cash flow', 'finance'] },
  { icon: '💼', name: 'Career & Professional', matches: ['Career & Professional'], searchTerms: ['resume', 'résumé', 'cv', 'job', 'career', 'cover letter'] },
  { icon: '🎥', name: 'Video / Audio', matches: ['Video / Audio', 'Video & Audio'], searchTerms: ['video', 'audio', 'content', 'creator', 'podcast'] },
  { icon: '📷', name: 'Photography', matches: ['Photography'], searchTerms: ['photo', 'photography', 'image', 'picture'] },
  { icon: '🖨️', name: 'Printables', matches: ['Printables'], searchTerms: ['printable', 'planner', 'worksheet'] },
  { icon: '🌿', name: 'Personal / Lifestyle', matches: ['Personal / Lifestyle', 'Personal & Lifestyle'], searchTerms: ['personal', 'goals', 'habits', 'wellness', 'routine'] },
];

const defaultNeeds: DiscoveryNeed[] = [
  { icon: '🚀', label: 'Start a business', categories: ['Business & Entrepreneurship', 'Ebooks & Guides'] },
  { icon: '💰', label: 'Manage finances', categories: ['Finance & Accounting', 'Excel / Google Sheets'] },
  { icon: '📈', label: 'Grow sales', categories: ['Marketing & Sales', 'Business & Entrepreneurship'] },
  { icon: '🎬', label: 'Create content', categories: ['Video / Audio', 'Marketing & Sales', 'Design Assets'] },
  { icon: '🎓', label: 'Learn a skill', categories: ['Education & Learning', 'Ebooks & Guides'] },
  { icon: '💼', label: 'Get a job', categories: ['Career & Professional'] },
  { icon: '🗂️', label: 'Manage projects', categories: ['Templates & Documents', 'Excel / Google Sheets'] },
  { icon: '⚙️', label: 'Automate work', categories: ['AI & Automation', 'Software / Code'] },
  { icon: '🎨', label: 'Design something', categories: ['Design Assets', 'Photography', 'Printables'] },
  { icon: '💻', label: 'Build an app', categories: ['Software / Code', 'CAD / Engineering'] },
];

const defaultRows: DiscoveryRow[] = [
  { key: 'work-smarter', title: 'Work smarter', subtitle: 'Useful resources for business, planning and productivity.', categories: ['Business & Entrepreneurship', 'Finance & Accounting', 'Excel & Sheets', 'Marketing & Sales', 'AI & Automation'] },
  { key: 'learn-grow', title: 'Learn and grow', subtitle: 'Build practical skills and take the next step in your career.', categories: ['Ebooks & Guides', 'Education & Learning', 'Career & Professional', 'Software / Code', 'Business & Entrepreneurship'] },
  { key: 'create-build', title: 'Create and build', subtitle: 'Bring creative ideas and new projects to life.', categories: ['Design Assets', 'Video / Audio', 'CAD / Engineering', 'Photography', 'Printables', 'Personal / Lifestyle', 'Templates & Documents', 'Marketing & Sales', 'Excel & Sheets'] },
];

export async function getHomepageDiscovery() {
  try {
    const [categoryResult, needsResult, rowsResult] = await Promise.all([
      db.query<{ name: string; sort_order: number; search_terms: string[] }>(
        'SELECT name, sort_order, search_terms FROM categories WHERE enabled=true ORDER BY sort_order, name'
      ),
      db.query<{ label: string; icon: string; category_names: string[] }>(
        'SELECT label, icon, category_names FROM marketplace_needs WHERE enabled=true ORDER BY sort_order, label'
      ),
      db.query<{ key: string; title: string; subtitle: string; category_names: string[] }>(
        'SELECT key, title, subtitle, category_names FROM discovery_rows WHERE enabled=true ORDER BY sort_order, title'
      ),
    ]);

    const customCategories = categoryResult.rows.map((row) => ({
      name: row.name,
      icon: defaultCategories.find((category) => category.matches.includes(row.name))?.icon ?? '✦',
      matches: [row.name],
      searchTerms: row.search_terms?.length
        ? row.search_terms
        : defaultCategories.find((category) => category.matches.includes(row.name))?.searchTerms ?? [],
    }));
    const legacyCategoryNames = ['Business & Entrepreneurship', 'Finance & Accounting', 'AI & Automation', 'Career & Professional', 'Excel & Sheets', 'Marketing & Sales', 'Templates & Documents'];
    const isLegacySeed = categoryResult.rows.length === legacyCategoryNames.length &&
      legacyCategoryNames.every((name) => categoryResult.rows.some((row) => row.name === name));
    const categories = isLegacySeed
      ? [...defaultCategories, ...customCategories.filter((item) => !defaultCategories.some((base) => base.matches.includes(item.name)))]
      : customCategories;
    const needs = needsResult.rows.map((row) => ({ label: row.label, icon: row.icon, categories: row.category_names }));
    const rows = rowsResult.rows.map((row) => ({ key: row.key, title: row.title, subtitle: row.subtitle, categories: row.category_names }));

    return {
      categories: categoryResult.rows.length ? categories : defaultCategories,
      needs: needsResult.rows.length || categoryResult.rows.length ? needs : defaultNeeds,
      rows: rowsResult.rows.length || categoryResult.rows.length ? rows : defaultRows,
    };
  } catch {
    return { categories: defaultCategories, needs: defaultNeeds, rows: defaultRows };
  }
}
