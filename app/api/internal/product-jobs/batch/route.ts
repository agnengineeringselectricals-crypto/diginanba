import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireProductFactoryAccess } from '@/lib/server/product-factory-access';
import { createProductFactoryJob } from '@/lib/server/product-factory';

export const runtime = 'nodejs';

const requestSchema = z.object({
  batch: z.literal('local-demand-scan-2026-10'),
  count: z.literal(10),
});

const source = (title: string, url: string, observed: string) => ({ title, url, observed });

const opportunities = [
  {
    marketCode: 'IN' as const, locale: 'en-IN',
    brief: 'Research India-local digital-product opportunities for micro and small businesses. Investigate practical AI-assisted marketing, WhatsApp customer communication, bookkeeping/GST workflows, and local-language business templates. Do not assume these are winners: compare current search interest, buyer intent, competitor saturation, local language demand, affordability in INR, and what a downloadable product can solve. Propose a new category if existing categories do not fit. Return up to 3 ranked opportunities, source URLs, observation dates, evidence vs inference, competitor alternatives, product specification, validation plan, and confidence. Never invent search volumes or sales.',
    evidenceSources: [
      source('Best AI tools for small business in India', 'https://startuporiginals.in/news/ai/best-ai-tools-for-small-business', 'Published 2026-10-03; discusses WhatsApp replies, marketing copy, design, GST accounting, and meeting notes as practical small-business AI use cases. This is a secondary article, not a sales dataset.'),
      source('India AI SEO search interest report', 'https://www.pyritedigital.com/blog/ai-seo-trends-india/', 'Published 2026-10-01; reports growth in AI SEO-related keyword interest. Verify the underlying keyword source and current search volume before treating the figures as established.'),
      source('Google Trends Trending Now — India', 'https://trends.google.com/trending?geo=IN&hl=en-US', 'Live country-level trend page; general trending queries include many non-commercial topics, so use product-specific query comparisons rather than general trending rank.')
    ],
  },
  {
    marketCode: 'IN' as const, locale: 'hi-IN',
    brief: 'Find India-specific digital product opportunities that can be genuinely useful in Hindi or bilingual Hindi-English for small retailers, freelancers, households, and local service businesses. Consider but do not limit to UPI reconciliation support, simple cash-flow tracking, customer follow-up scripts, festival-season sales planning, and AI productivity workflows. Validate local demand, user terminology, affordability in INR, and whether a downloadable file is sufficient. Recommend new categories freely when justified. Return ranked opportunities with sources, caveats, and a testable product plan.',
    evidenceSources: [
      source('Google.org MSME digital transformation initiative', 'https://m.economictimes.com/small-biz/sme-sector/google-org-announces-15-million-in-funding-for-indias-msmes-in-partnership-with-the/nudge/articleshow/134940801.cms', 'Published 2026-10-14; signals current institutional focus on MSME AI and digital transformation, but does not prove demand for any specific paid template.'),
      source('Google Trends Trending Now — India', 'https://trends.google.com/trending?geo=IN&hl=en-US', 'Use to inspect current country-level searches; general trends must be filtered for commercial intent.')
    ],
  },
  {
    marketCode: 'IN' as const, locale: 'ta-IN',
    brief: 'Research Tamil Nadu / Tamil-language digital-product opportunities, with a focus on small merchants, tutors, freelancers, local service providers and households. Investigate Tamil-first or Tamil-English bilingual worksheets, business trackers, customer communication kits, and practical AI workflows, but only recommend them if supported by demand evidence. Avoid stereotypes; identify search phrases in Tamil and English, validate seasonality and competition, and explain whether users need a spreadsheet, editable document, printable pack, or web tool. Propose new categories when needed.',
    evidenceSources: [
      source('Google Trends Trending Now — India', 'https://trends.google.com/trending?geo=IN&hl=en-US', 'Country-level starting point only; the agent must validate Tamil and Tamil Nadu query interest separately.'),
      source('India AI SEO search interest report', 'https://www.pyritedigital.com/blog/ai-seo-trends-india/', 'Published 2026-10-01; broad India AI-search signal, not Tamil-specific evidence.')
    ],
  },
  {
    marketCode: 'IN' as const, locale: 'en-IN',
    brief: 'Explore India-local creator and freelancer digital products: AI content workflows, social-media campaign planners, proposal/pricing calculators, client onboarding kits, and other evidence-backed opportunities. Measure current search interest and competition; distinguish tool popularity from willingness to pay for a downloadable product. Include rupee pricing hypotheses only as hypotheses, and suggest new categories if existing taxonomy is too narrow.',
    evidenceSources: [
      source('Best AI tools for small business in India', 'https://startuporiginals.in/news/ai/best-ai-tools-for-small-business', 'Published 2026-10-03; lists local business AI use cases including marketing content.'),
      source('India AI SEO search interest report', 'https://www.pyritedigital.com/blog/ai-seo-trends-india/', 'Published 2026-10-01; reports increasing interest in AI SEO-related terms.')
    ],
  },
  {
    marketCode: 'US' as const, locale: 'en-US',
    brief: 'Research US-local digital products that help small businesses operationalize AI, not just learn about it. Investigate implementation playbooks, workflow templates, AI policy/use-case trackers, onboarding checklists, ROI calculators, and industry-specific kits. Rank opportunities by search demand, buyer intent, competition, currentness, and whether a paid digital download solves a clear problem. Recommend a new category when justified; include evidence links and explicitly distinguish evidence from inference.',
    evidenceSources: [
      source('US Chamber of Commerce 2026 Empowering Small Business report', 'https://www.uschamber.com/technology/2026-empowering-small-business-report', 'Published 2026-10-02; reports AI is creating jobs at 47% of surveyed small businesses, while 6% report AI-enabled headcount reductions. This is an adoption signal, not product sales evidence.'),
      source('Google Trends Trending Now — United States', 'https://trends.google.com/trending?geo=US&hl=en-US', 'Current country-level trends; use product-specific keyword exploration rather than assuming general trending queries imply purchase intent.')
    ],
  },
  {
    marketCode: 'US' as const, locale: 'en-US',
    brief: 'Research US digital-product opportunities for independent sellers and ecommerce operators facing AI-driven customer journeys and price transparency concerns. Consider product feed/SEO audit checklists, AI-search visibility trackers, customer trust and price-change communication templates, inventory/pricing analysis spreadsheets, and seller workflow kits. Verify search interest and competitor supply before ranking. Avoid legal advice; flag regulatory topics for expert review. Propose a new category if appropriate.',
    evidenceSources: [
      source('AI agents bring new headaches to online sellers', 'https://www.wsj.com/business/ai-agents-bring-new-headaches-to-online-sellers-d2dc84b4', 'Published 2026-10-16; describes rising agent-mediated shopping and operational challenges for sellers. Secondary reporting; validate demand for any proposed download.'),
      source('AP report on consumer concerns about AI-assisted pricing', 'https://apnews.com/article/64c446cd117d3be664de4ab570fb9857', 'Published 2026-10-18; reports consumer concerns about dynamic/algorithmic pricing transparency. This signals a problem area, not direct demand for a product.')
    ],
  },
  {
    marketCode: 'US' as const, locale: 'en-US',
    brief: 'Identify US-local digital products for small business cash-flow, staffing, inventory and operations planning in the current economic environment. Consider spreadsheets, calculators, SOP kits, onboarding and training resources, but validate each with search demand and marketplace competition. Clearly separate sourced facts from product hypotheses and never give personalised financial, tax, or legal advice. New categories are allowed.',
    evidenceSources: [
      source('US Chamber of Commerce 2026 Empowering Small Business report', 'https://www.uschamber.com/technology/2026-empowering-small-business-report', 'Published 2026-10-02; examines small-business technology use and effects.'),
      source('The Guardian small business sentiment report', 'https://www.theguardian.com/business/2026/oct/18/small-business-owners-trump-economy', 'Published 2026-10-18; discusses current US small-business sentiment and hiring context; secondary reporting, not keyword-volume evidence.')
    ],
  },
  {
    marketCode: 'UK' as const, locale: 'en-GB',
    brief: 'Research UK-local digital-product opportunities around small-business productivity software, Microsoft 365/Excel workflows, AI adoption, and switching/interoperability needs. Explore practical spreadsheet templates, software migration planners, AI workflow kits and comparison checklists, but validate current search demand and competitor offerings. Use UK spelling, GBP hypotheses, and flag any regulatory claims for qualified review. Create a new category if existing ones do not fit.',
    evidenceSources: [
      source('Reuters: UK competition regulator targets Microsoft business software grip', 'https://www.reuters.com/legal/litigation/uk-competition-regulator-targets-microsofts-business-software-grip-2026-10-16/', 'Published 2026-10-16; reports UK regulatory scrutiny of Excel, Teams and Copilot software markets. This is contextual evidence, not proof of download demand.'),
      source('Google Trends Trending Now — United Kingdom', 'https://trends.google.com/trending?geo=GB&hl=en-GB', 'Current UK trend page; general trending queries may be unrelated to digital products and must be filtered.')
    ],
  },
  {
    marketCode: 'UK' as const, locale: 'en-GB',
    brief: 'Find UK freelancer and microbusiness digital products that address practical workflow pain: invoicing record organisation, cash-flow forecasting, client proposals, project scoping, AI-assisted administration, and productivity. Avoid presenting templates as a substitute for professional tax/legal advice. Check UK-specific terms, dates, GBP, competition, search demand and buyer intent. Propose new categories freely when justified by evidence.',
    evidenceSources: [
      source('Financial Times: IMF upgrades UK outlook as AI drives growth', 'https://www.ft.com/content/4a7a7282-74a5-4d5b-94d6-7190482d88d0', 'Published around 2026-10-13; describes AI-related investment and UK economic context. Macro context only, not a product demand measure.'),
      source('Google Trends Trending Now — United Kingdom', 'https://trends.google.com/trending?geo=GB&hl=en-GB', 'Current UK search trends; validate relevant commercial queries individually.')
    ],
  },
  {
    marketCode: 'UK' as const, locale: 'en-GB',
    brief: 'Investigate UK-local digital products for businesses adapting to AI-assisted search, customer service and ecommerce. Consider website/content audit sheets, AI-use policy and training packs, customer communication templates, and operational calculators. Do not assume a popular technology is automatically a popular paid product: compare query trends, marketplace listings, price points, and underserved audiences. Return up to three ranked ideas with evidence and propose new categories if needed.',
    evidenceSources: [
      source('Reuters: UK competition regulator targets Microsoft business software grip', 'https://www.reuters.com/legal/litigation/uk-competition-regulator-targets-microsofts-business-software-grip-2026-10-16/', 'Published 2026-10-16; UK software market and AI-tool context.'),
      source('Google Trends Trending Now — United Kingdom', 'https://trends.google.com/trending?geo=GB&hl=en-GB', 'Current country trend page; supplement with relevant query comparisons and marketplace competitor evidence.')
    ],
  },
];

export async function POST(request: Request) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid demand-research batch request.' }, { status: 400 });

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
        message: `This research batch already exists (${existingCount} jobs). Refresh the queue rather than creating duplicate work.`,
      });
    }

    const created = [];
    for (let i = 0; i < opportunities.length; i++) {
      const item = opportunities[i];
      const job = await createProductFactoryJob({
        jobType: 'demand_research',
        marketCode: item.marketCode,
        locale: item.locale,
        input: {
          batchKey,
          opportunityIndex: i + 1,
          researchMode: 'evidence_led_local_demand',
          categoryPolicy: 'open_taxonomy_new_categories_allowed',
          brief: item.brief,
          evidenceSources: item.evidenceSources,
          requiredOutput: [
            'Rank up to three candidate digital products for the target market.',
            'For each candidate provide proposed category (existing or new), buyer, problem, suggested deliverable, search-demand evidence, competitor evidence, source URLs and dates, confidence, and validation gaps.',
            'Label every statement as source evidence, inference, or unverified hypothesis.',
            'Do not fabricate search volume, sales, conversion, reviews, or live browsing. If source access or exact query metrics are missing, say so.',
            'Do not force ideas into the existing category list; propose a new category when the evidence warrants it.',
            'This is research only. Do not create/publish product listings or claim that a downloadable file exists.'
          ],
        },
        maxAttempts: 3,
      }, access.userId);
      created.push({ id: job.id, marketCode: item.marketCode, locale: item.locale, opportunityIndex: i + 1 });
    }
    return NextResponse.json({
      ok: true, created: created.length, jobs: created,
      message: 'Queued 10 evidence-led local demand research jobs. These are research tasks, not completed products; review their evidence before commissioning product drafts.',
    }, { status: 201 });
  } catch (error) {
    console.error('[product-factory:batch] failed to queue research jobs', error);
    return NextResponse.json({ error: 'Unable to queue the batch. Verify the Stage 7 product factory migration and database connection.' }, { status: 503 });
  }
}
