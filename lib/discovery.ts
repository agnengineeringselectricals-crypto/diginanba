import { db } from './db';

export type DiscoverySubcategory = { key: string; slug: string; name: string; searchTerms: string[] };
export type DiscoveryCategory = { id?: string; slug: string; name: string; icon: string; matches: string[]; searchTerms: string[]; subcategories: DiscoverySubcategory[] };
export type DiscoveryNeed = { label: string; icon: string; categories: string[] };
export type DiscoveryRow = { key: string; title: string; subtitle: string; categories: string[] };

const defaultSubcategoryDefinitions: Record<string, { slug: string; name: string; searchTerms: string[] }[]> = {
  'ebooks-guides': [
    { slug: 'business-guides', name: 'Business Guides', searchTerms: ['business guide', 'entrepreneur'] },
    { slug: 'how-to-guides', name: 'How-to Guides', searchTerms: ['how to', 'step by step'] },
    { slug: 'self-help', name: 'Self-Help', searchTerms: ['self help', 'personal growth'] },
    { slug: 'technical-guides', name: 'Technical Guides', searchTerms: ['technical', 'engineering'] },
    { slug: 'exam-preparation', name: 'Exam Preparation', searchTerms: ['exam', 'test prep'] },
  ],
  'excel-sheets': [
    { slug: 'finance-accounting', name: 'Finance & Accounting', searchTerms: ['finance', 'accounting', 'cashflow', 'invoice'] },
    { slug: 'budgeting', name: 'Budgeting', searchTerms: ['budget', 'budgeting'] },
    { slug: 'business-templates', name: 'Business Templates', searchTerms: ['business template', 'business spreadsheet'] },
    { slug: 'dashboards', name: 'Dashboards', searchTerms: ['dashboard', 'kpi'] },
    { slug: 'data-analysis', name: 'Data Analysis', searchTerms: ['data analysis', 'analytics'] },
  ],
  'templates-documents': [
    { slug: 'business-documents', name: 'Business Documents', searchTerms: ['business', 'proposal', 'onboarding'] },
    { slug: 'project-management', name: 'Project Management', searchTerms: ['project', 'management'] },
    { slug: 'resumes-cvs', name: 'Resumes & CVs', searchTerms: ['resume', 'résumé', 'cv'] },
    { slug: 'checklists', name: 'Checklists', searchTerms: ['checklist', 'sop'] },
    { slug: 'planners', name: 'Planners', searchTerms: ['planner', 'planning'] },
  ],
  'design-assets': [
    { slug: 'social-media-design', name: 'Social Media Design', searchTerms: ['social media', 'instagram'] },
    { slug: 'brand-identity', name: 'Brand Identity', searchTerms: ['brand', 'logo'] },
    { slug: 'presentations', name: 'Presentations', searchTerms: ['presentation', 'slides'] },
    { slug: 'ui-ux-assets', name: 'UI / UX Assets', searchTerms: ['ui', 'ux', 'interface'] },
    { slug: 'creative-templates', name: 'Creative Templates', searchTerms: ['design kit', 'creative'] },
  ],
  'marketing-sales': [
    { slug: 'social-media', name: 'Social Media', searchTerms: ['social media', 'instagram', 'content calendar'] },
    { slug: 'seo', name: 'SEO', searchTerms: ['seo', 'search engine'] },
    { slug: 'email-marketing', name: 'Email Marketing', searchTerms: ['email', 'newsletter'] },
    { slug: 'sales-templates', name: 'Sales Templates', searchTerms: ['sales', 'proposal'] },
    { slug: 'advertising', name: 'Advertising', searchTerms: ['advertising', 'ads', 'promotion'] },
  ],
  'ai-automation': [
    { slug: 'ai-prompts', name: 'AI Prompts', searchTerms: ['prompt', 'prompts'] },
    { slug: 'ai-agents', name: 'AI Agents', searchTerms: ['agent', 'agents'] },
    { slug: 'ai-workflows', name: 'AI Workflows', searchTerms: ['workflow', 'workflows'] },
    { slug: 'automation-templates', name: 'Automation Templates', searchTerms: ['automation', 'automate'] },
    { slug: 'productivity', name: 'Productivity', searchTerms: ['productivity', 'task'] },
  ],
  'business-entrepreneurship': [
    { slug: 'business-plans', name: 'Business Plans', searchTerms: ['business plan', 'growth planner'] },
    { slug: 'starting-a-business', name: 'Starting a Business', searchTerms: ['startup', 'launch'] },
    { slug: 'business-operations', name: 'Business Operations', searchTerms: ['operations', 'sop'] },
    { slug: 'freelancing', name: 'Freelancing', searchTerms: ['freelance', 'client'] },
    { slug: 'business-growth', name: 'Business Growth', searchTerms: ['growth', 'sales'] },
  ],
  'education-learning': [
    { slug: 'online-courses', name: 'Online Courses', searchTerms: ['course', 'training'] },
    { slug: 'study-guides', name: 'Study Guides', searchTerms: ['study', 'learning guide'] },
    { slug: 'exam-prep', name: 'Exam Preparation', searchTerms: ['exam', 'test prep'] },
    { slug: 'skill-roadmaps', name: 'Skill Roadmaps', searchTerms: ['roadmap', 'skill'] },
    { slug: 'coding-education', name: 'Coding', searchTerms: ['coding', 'programming', 'python'] },
  ],
  'software-code': [
    { slug: 'app-starter-kits', name: 'App Starter Kits', searchTerms: ['app', 'application'] },
    { slug: 'web-development', name: 'Web Development', searchTerms: ['web', 'website', 'frontend'] },
    { slug: 'python', name: 'Python', searchTerms: ['python'] },
    { slug: 'no-code-tools', name: 'No-code Tools', searchTerms: ['no code', 'nocode'] },
    { slug: 'developer-resources', name: 'Developer Resources', searchTerms: ['developer', 'software', 'code'] },
  ],
  'cad-engineering': [
    { slug: 'autocad', name: 'AutoCAD', searchTerms: ['autocad', 'cad'] },
    { slug: 'electrical-engineering', name: 'Electrical', searchTerms: ['electrical', 'circuit'] },
    { slug: 'mechanical-engineering', name: 'Mechanical', searchTerms: ['mechanical'] },
    { slug: 'civil-engineering', name: 'Civil', searchTerms: ['civil', 'structural'] },
    { slug: 'engineering-calculations', name: 'Engineering Calculations', searchTerms: ['calculation', 'calculator'] },
  ],
  'finance-accounting': [
    { slug: 'personal-finance', name: 'Personal Finance', searchTerms: ['personal finance', 'budget'] },
    { slug: 'bookkeeping', name: 'Bookkeeping', searchTerms: ['bookkeeping', 'accounting'] },
    { slug: 'invoicing', name: 'Invoicing', searchTerms: ['invoice', 'invoicing'] },
    { slug: 'cash-flow', name: 'Cash Flow', searchTerms: ['cashflow', 'cash flow'] },
    { slug: 'tax-planning', name: 'Tax Planning', searchTerms: ['tax'] },
  ],
  'career-professional': [
    { slug: 'resumes-cvs', name: 'Resumes & CVs', searchTerms: ['resume', 'résumé', 'cv'] },
    { slug: 'job-search', name: 'Job Search', searchTerms: ['job', 'career'] },
    { slug: 'interview-prep', name: 'Interview Preparation', searchTerms: ['interview'] },
    { slug: 'freelance-career', name: 'Freelance Career', searchTerms: ['freelance', 'proposal'] },
    { slug: 'professional-development', name: 'Professional Development', searchTerms: ['professional', 'development'] },
  ],
  'video-audio': [
    { slug: 'video-editing', name: 'Video Editing', searchTerms: ['video', 'editing'] },
    { slug: 'video-scripts', name: 'Scripts & Storyboards', searchTerms: ['script', 'storyboard'] },
    { slug: 'audio-resources', name: 'Audio Resources', searchTerms: ['audio', 'sound'] },
    { slug: 'podcasting', name: 'Podcasting', searchTerms: ['podcast'] },
    { slug: 'content-production', name: 'Content Production', searchTerms: ['content', 'creator'] },
  ],
  photography: [
    { slug: 'photo-editing', name: 'Photo Editing', searchTerms: ['photo editing', 'lightroom'] },
    { slug: 'presets', name: 'Presets', searchTerms: ['preset'] },
    { slug: 'stock-photography', name: 'Stock Photography', searchTerms: ['stock photo', 'image'] },
    { slug: 'photo-planning', name: 'Session Planning', searchTerms: ['photo session', 'shot list'] },
    { slug: 'lighting', name: 'Lighting', searchTerms: ['lighting', 'studio'] },
  ],
  printables: [
    { slug: 'printable-planners', name: 'Planners', searchTerms: ['planner'] },
    { slug: 'worksheets', name: 'Worksheets', searchTerms: ['worksheet'] },
    { slug: 'trackers', name: 'Trackers', searchTerms: ['tracker'] },
    { slug: 'kids-printables', name: 'Kids & Classroom', searchTerms: ['kids', 'classroom'] },
    { slug: 'home-printables', name: 'Home & Lifestyle', searchTerms: ['home', 'lifestyle'] },
  ],
  'personal-lifestyle': [
    { slug: 'habits-goals', name: 'Habits & Goals', searchTerms: ['habit', 'goal'] },
    { slug: 'wellness', name: 'Wellness', searchTerms: ['wellness', 'health'] },
    { slug: 'journals', name: 'Journals', searchTerms: ['journal'] },
    { slug: 'personal-productivity', name: 'Personal Productivity', searchTerms: ['productivity', 'routine'] },
    { slug: 'hobbies', name: 'Hobbies', searchTerms: ['hobby', 'hobbies'] },
  ],
};

const defaultCategoryDefinitions = [
  { slug: 'ebooks-guides', icon: '📚', name: 'Ebooks & Guides', matches: ['Ebooks & Guides'], searchTerms: ['books', 'guide', 'reading'] },
  { slug: 'excel-sheets', icon: '📊', name: 'Excel / Google Sheets', matches: ['Excel / Google Sheets', 'Excel & Sheets'], searchTerms: ['spreadsheet', 'budget', 'accounting', 'invoice', 'calculator'] },
  { slug: 'templates-documents', icon: '📄', name: 'Templates & Documents', matches: ['Templates & Documents'], searchTerms: ['resume', 'résumé', 'cv', 'project management', 'documents', 'checklist'] },
  { slug: 'design-assets', icon: '🎨', name: 'Design Assets', matches: ['Design Assets'], searchTerms: ['instagram', 'social media', 'logo', 'creative', 'graphics'] },
  { slug: 'marketing-sales', icon: '📣', name: 'Marketing & Sales', matches: ['Marketing & Sales'], searchTerms: ['instagram', 'seo', 'advertising', 'promotion', 'sales'] },
  { slug: 'ai-automation', icon: '🤖', name: 'AI & Automation', matches: ['AI & Automation'], searchTerms: ['artificial intelligence', 'workflow', 'automate', 'productivity'] },
  { slug: 'business-entrepreneurship', icon: '🚀', name: 'Business & Entrepreneurship', matches: ['Business & Entrepreneurship'], searchTerms: ['business plan', 'startup', 'entrepreneur', 'company'] },
  { slug: 'education-learning', icon: '🎓', name: 'Education & Learning', matches: ['Education & Learning'], searchTerms: ['learn', 'course', 'python', 'skill', 'training'] },
  { slug: 'software-code', icon: '💻', name: 'Software / Code', matches: ['Software / Code'], searchTerms: ['app', 'application', 'python', 'coding', 'software', 'programming'] },
  { slug: 'cad-engineering', icon: '📐', name: 'CAD / Engineering', matches: ['CAD / Engineering', 'CAD & Engineering'], searchTerms: ['drawing', 'technical', 'engineering', 'design'] },
  { slug: 'finance-accounting', icon: '💰', name: 'Finance & Accounting', matches: ['Finance & Accounting'], searchTerms: ['accounting', 'budget', 'invoice', 'cashflow', 'cash flow', 'finance'] },
  { slug: 'career-professional', icon: '💼', name: 'Career & Professional', matches: ['Career & Professional'], searchTerms: ['resume', 'résumé', 'cv', 'job', 'career', 'cover letter'] },
  { slug: 'video-audio', icon: '🎥', name: 'Video / Audio', matches: ['Video / Audio', 'Video & Audio'], searchTerms: ['video', 'audio', 'content', 'creator', 'podcast'] },
  { slug: 'photography', icon: '📷', name: 'Photography', matches: ['Photography'], searchTerms: ['photo', 'photography', 'image', 'picture'] },
  { slug: 'printables', icon: '🖨️', name: 'Printables', matches: ['Printables'], searchTerms: ['printable', 'planner', 'worksheet'] },
  { slug: 'personal-lifestyle', icon: '🌿', name: 'Personal / Lifestyle', matches: ['Personal / Lifestyle', 'Personal & Lifestyle'], searchTerms: ['personal', 'goals', 'habits', 'wellness', 'routine'] },
];

const defaultCategories: DiscoveryCategory[] = defaultCategoryDefinitions.map((category) => ({
  ...category,
  subcategories: (defaultSubcategoryDefinitions[category.slug] ?? []).map((subcategory) => ({
    ...subcategory,
    key: `${category.slug}/${subcategory.slug}`,
  })),
}));

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
      db.query<{ id: string; slug: string; name: string; sort_order: number; search_terms: string[] }>(
        'SELECT id, slug, name, sort_order, search_terms FROM categories WHERE enabled=true ORDER BY sort_order, name'
      ),
      db.query<{ label: string; icon: string; category_names: string[] }>(
        'SELECT label, icon, category_names FROM marketplace_needs WHERE enabled=true ORDER BY sort_order, label'
      ),
      db.query<{ key: string; title: string; subtitle: string; category_names: string[] }>(
        'SELECT key, title, subtitle, category_names FROM discovery_rows WHERE enabled=true ORDER BY sort_order, title'
      ),
    ]);

    let subcategoryRows: { id: string; category_id: string; slug: string; name: string; search_terms: string[] }[] = [];
    let subcategoryTableAvailable = true;
    try {
      const result = await db.query<{ id: string; category_id: string; slug: string; name: string; search_terms: string[] }>(
        `SELECT s.id, s.category_id, s.slug, s.name, s.search_terms
         FROM subcategories s JOIN categories c ON c.id=s.category_id
         WHERE s.enabled=true AND c.enabled=true ORDER BY c.sort_order, s.sort_order, s.name`
      );
      subcategoryRows = result.rows;
    } catch {
      // Existing installs can keep using their category table until the hierarchy migration is applied.
      subcategoryTableAvailable = false;
    }
    const customCategories = categoryResult.rows.map((row) => {
      const fallbackCategory = defaultCategories.find((category) => category.slug === row.slug || category.matches.includes(row.name));
      const databaseSubcategories = subcategoryRows.filter((subcategory) => subcategory.category_id === row.id)
        .map((subcategory) => ({
          key: `${row.slug}/${subcategory.slug}`,
          slug: subcategory.slug,
          name: subcategory.name,
          searchTerms: subcategory.search_terms ?? [],
        }));
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        icon: fallbackCategory?.icon ?? '✦',
        matches: [row.name],
        searchTerms: row.search_terms?.length ? row.search_terms : fallbackCategory?.searchTerms ?? [],
        subcategories: subcategoryTableAvailable ? databaseSubcategories : fallbackCategory?.subcategories ?? [],
      };
    });
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
