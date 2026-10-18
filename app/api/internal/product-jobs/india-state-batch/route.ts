import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireProductFactoryAccess } from '@/lib/server/product-factory-access';
import { createProductFactoryJob } from '@/lib/server/product-factory';

export const runtime = 'nodejs';

const requestSchema = z.object({
  batch: z.literal('india-national-state-demand-scan-2026-10'),
});

const states = [
  { name: 'Andhra Pradesh', code: 'AP', languages: 'Telugu, Urdu, and English where relevant', locale: 'te-IN' },
  { name: 'Arunachal Pradesh', code: 'AR', languages: 'English, Hindi, and locally relevant tribal languages; identify the actual language needs by district rather than assuming one language', locale: 'en-IN' },
  { name: 'Assam', code: 'AS', languages: 'Assamese, Bengali in relevant areas, Bodo, and English where relevant', locale: 'as-IN' },
  { name: 'Bihar', code: 'BR', languages: 'Hindi, Urdu, Maithili, Bhojpuri, and other locally relevant languages based on evidence', locale: 'hi-IN' },
  { name: 'Chhattisgarh', code: 'CG', languages: 'Hindi, Chhattisgarhi, and locally relevant tribal languages', locale: 'hi-IN' },
  { name: 'Goa', code: 'GA', languages: 'Konkani, Marathi, Hindi, and English', locale: 'kok-IN' },
  { name: 'Gujarat', code: 'GJ', languages: 'Gujarati, Hindi, and English where relevant', locale: 'gu-IN' },
  { name: 'Haryana', code: 'HR', languages: 'Hindi, Haryanvi, Punjabi in relevant communities, and English where relevant', locale: 'hi-IN' },
  { name: 'Himachal Pradesh', code: 'HP', languages: 'Hindi, locally relevant Pahari varieties, and English where relevant', locale: 'hi-IN' },
  { name: 'Jharkhand', code: 'JH', languages: 'Hindi, Santali, Urdu, and other locally relevant regional languages', locale: 'hi-IN' },
  { name: 'Karnataka', code: 'KA', languages: 'Kannada, Urdu, Tulu, Telugu, Tamil, and English where locally relevant', locale: 'kn-IN' },
  { name: 'Kerala', code: 'KL', languages: 'Malayalam, English, and other languages used by target audiences where evidence supports them', locale: 'ml-IN' },
  { name: 'Madhya Pradesh', code: 'MP', languages: 'Hindi and locally relevant regional/tribal languages where supported by evidence', locale: 'hi-IN' },
  { name: 'Maharashtra', code: 'MH', languages: 'Marathi, Hindi, Urdu, Gujarati in relevant communities, and English where relevant', locale: 'mr-IN' },
  { name: 'Manipur', code: 'MN', languages: 'Meitei (Manipuri), English, and other locally relevant languages', locale: 'mni-IN' },
  { name: 'Meghalaya', code: 'ML', languages: 'Khasi, Garo, English, and other locally relevant languages', locale: 'en-IN' },
  { name: 'Mizoram', code: 'MZ', languages: 'Mizo, English, and locally relevant languages', locale: 'lus-IN' },
  { name: 'Nagaland', code: 'NL', languages: 'English, Nagamese, and locally relevant Naga languages; identify district/community needs', locale: 'en-IN' },
  { name: 'Odisha', code: 'OD', languages: 'Odia, Hindi, and locally relevant tribal languages', locale: 'or-IN' },
  { name: 'Punjab', code: 'PB', languages: 'Punjabi, Hindi, and English where relevant', locale: 'pa-IN' },
  { name: 'Rajasthan', code: 'RJ', languages: 'Hindi, Rajasthani varieties, and English where relevant', locale: 'hi-IN' },
  { name: 'Sikkim', code: 'SK', languages: 'Nepali, English, Bhutia, Lepcha, and other locally relevant languages', locale: 'ne-IN' },
  { name: 'Tamil Nadu', code: 'TN', languages: 'Tamil and English; also validate other languages used by the target buyer segment', locale: 'ta-IN' },
  { name: 'Telangana', code: 'TS', languages: 'Telugu, Urdu, Hindi, and English where relevant', locale: 'te-IN' },
  { name: 'Tripura', code: 'TR', languages: 'Bengali, Kokborok, and English where relevant', locale: 'bn-IN' },
  { name: 'Uttar Pradesh', code: 'UP', languages: 'Hindi, Urdu, Awadhi, Bhojpuri, Braj, and other locally relevant language variants', locale: 'hi-IN' },
  { name: 'Uttarakhand', code: 'UK-STATE', languages: 'Hindi, Garhwali, Kumaoni, and English where relevant', locale: 'hi-IN' },
  { name: 'West Bengal', code: 'WB', languages: 'Bengali, Nepali in relevant areas, Hindi, and English where relevant', locale: 'bn-IN' },
];

const commonRequirements = [
  'Research state-level needs and nationwide India needs separately; state results must not simply repeat national assumptions.',
  'Investigate urgent and frequently searched problems with current, query-level evidence. Compare Google Trends/search suggestions where accessible, marketplace listings, competitor prices/reviews, government or industry sources, and relevant local sources.',
  'Look for evidence of commercial intent and willingness to pay, not just general popularity. Rank up to three candidate digital products, or explicitly return no validated opportunity when evidence is weak.',
  'For each candidate include buyer segment, specific problem, proposed deliverable, suggested INR price range clearly labelled as a hypothesis, search phrases in relevant scripts/languages, evidence URLs and dates, competitors, confidence, and validation gaps.',
  'Label claims as source evidence, inference, or unverified hypothesis. Never fabricate search volumes, sales, reviews, trend scores, or source observations. State when live source access or reliable metrics are unavailable.',
  'Allow new product categories when evidence supports them. Recommend the right format (spreadsheet, editable document, printable, calculator, mini-course, or software) based on the actual problem.',
  'Research-only: do not create a listing, publish a product, or claim a product file has been generated. Results require human review before product creation.',
].join(' ');

export async function POST(request: Request) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid India state research batch request.' }, { status: 400 });

  const batchKey = parsed.data.batch;
  try {
    const existing = await db.query(
      `SELECT COUNT(*)::int AS count FROM product_factory_jobs WHERE input_json->>'batchKey'=$1`,
      [batchKey],
    );
    const existingCount = Number(existing.rows[0]?.count ?? 0);
    if (existingCount > 0) {
      return NextResponse.json({
        ok: true, created: 0, existing: existingCount,
        message: `This India national/state batch already exists (${existingCount} jobs). Refresh the queue to avoid duplicate work.`,
      });
    }

    const targets = [
      {
        name: 'India nationwide',
        code: 'IN-NATIONAL',
        locale: 'en-IN',
        languages: 'English plus state and regional languages as indicated by search evidence; compare across states rather than treating India as one language market',
        brief: 'Nationwide India opportunity scan. Identify urgent, high-intent, frequently searched digital-tool needs across the country, compare demand and competition by state/region, and separate national-scale opportunities from state-specific ones. Explore broad sectors without assuming any is a winner. ' + commonRequirements,
      },
      ...states.map(state => ({
        name: state.name,
        code: state.code,
        locale: state.locale,
        languages: state.languages,
        brief: `State-level digital product demand scan for ${state.name}, India. Identify needs specific to this state and compare them with nationwide patterns. Research relevant languages/scripts: ${state.languages}. Search across major local occupations, industries, small businesses, education, agriculture where relevant, local services, public-service workflows, seasonal demand, and AI/productivity needs without stereotyping or assuming all apply. Use district/city-level distinctions when evidence warrants them. ${commonRequirements}`,
      })),
    ];

    const created = [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const job = await createProductFactoryJob({
        jobType: 'demand_research',
        marketCode: 'IN',
        locale: target.locale,
        input: {
          batchKey,
          opportunityIndex: i + 1,
          targetScope: target.name,
          targetCode: target.code,
          researchMode: 'india_nationwide_plus_statewise_evidence_led_demand',
          targetLanguages: target.languages,
          categoryPolicy: 'open_taxonomy_new_categories_allowed',
          brief: target.brief,
          evidenceSources: [
            { title: 'Google Trends India', url: 'https://trends.google.com/trending?geo=IN&hl=en-IN', observed: 'Live trend page; not proof of commercial demand. Compare specific terms and related queries when accessible.' },
            { title: 'Google Trends Explore', url: 'https://trends.google.com/trends/explore?geo=IN', observed: 'Use state/subregion filters and compare equivalent local-language queries; record the timeframe and geography actually inspected.' },
            { title: 'Open Government Data Platform India', url: 'https://data.gov.in/', observed: 'Potential source for state/sector context; cite only datasets actually inspected.' },
            { title: 'Relevant regional marketplace search', url: 'https://www.google.com/search?q=digital+products+India', observed: 'Starting point only. Search state-specific and local-language terms; record actual competitor listings, dates, prices and review counts when accessible.' },
          ],
          requiredOutput: [
            'State-specific or nationwide scope must be clearly identified; do not conflate state and national findings.',
            'Rank up to three evidence-supported product opportunities and allow a new category where needed.',
            'Provide exact search phrases in the target languages/scripts, geography and timeframe checked, source URLs/dates, competitor evidence, buyer/problem, deliverable, INR pricing hypothesis, confidence, and gaps.',
            'Separate source evidence, inference, and unverified hypotheses. Do not fabricate live search volume, sales, reviews, or browsing results.',
            'Research only; no product publishing and no claim that files were generated.'
          ],
        },
        maxAttempts: 3,
      }, access.userId);
      created.push({ id: job.id, scope: target.name, targetCode: target.code, locale: target.locale });
    }
    return NextResponse.json({
      ok: true, created: created.length, jobs: created,
      message: 'Queued 29 India demand research jobs: one nationwide scan plus one for each of the 28 states. They remain research-only and require evidence review before product drafting.',
    }, { status: 201 });
  } catch (error) {
    console.error('[product-factory:india-state-batch] failed to queue research jobs', error);
    return NextResponse.json({ error: 'Unable to queue the India research batch. Verify the product factory migration and database connection.' }, { status: 503 });
  }
}
