import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
type Kind = 'shops'|'services'|'professionals'|'healthcare'|'career';
const kinds = new Set<Kind>(['shops','services','professionals','healthcare','career']);
const businessSchema = z.object({
  businessName:z.string().trim().min(2).max(160), description:z.string().trim().max(4000).default(''),
  phone:z.string().trim().max(40).optional(), email:z.union([z.string().email().max(254),z.literal('')]).optional(), websiteUrl:z.union([z.string().url().max(500),z.literal('')]).optional(),
  countryCode:z.string().length(2).default('IN'), regionCode:z.string().length(2).optional(), region:z.string().max(120).optional(), district:z.string().max(120).optional(),
  city:z.string().max(120).optional(), locality:z.string().max(120).optional(), postalCode:z.string().max(20).optional(),
  addressLine:z.string().max(500).optional(), latitude:z.number().min(-90).max(90).optional(), longitude:z.number().min(-180).max(180).optional()
});
const listingSchema=z.object({
  businessId:z.string().uuid(), title:z.string().trim().min(3).max(180), description:z.string().trim().max(5000).default(''),
  category:z.string().trim().min(2).max(100), listingType:z.enum(['physical_product','service','professional_service','healthcare_service']),
  priceAmount:z.number().nonnegative().max(100000000).optional(), currency:z.string().length(3).optional(), priceUnit:z.string().max(40).optional()
});
const candidateSchema=z.object({
  fullName:z.string().trim().min(2).max(140), headline:z.string().max(180).optional(), summary:z.string().max(5000).optional(),
  skills:z.array(z.string().trim().min(1).max(80)).max(60).default([]), experienceYears:z.number().min(0).max(60).optional(),
  preferredRoles:z.array(z.string().max(100)).max(20).default([]), employmentTypes:z.array(z.enum(['full_time','part_time','contract','temporary','internship'])).max(5).default([]),
  countryCode:z.string().length(2).default('IN'), region:z.string().max(120).optional(), district:z.string().max(120).optional(), city:z.string().max(120).optional(),
  expectedSalaryMin:z.number().nonnegative().optional(), expectedSalaryMax:z.number().nonnegative().optional(), salaryCurrency:z.string().length(3).optional()
}).refine(v=>v.expectedSalaryMin===undefined||v.expectedSalaryMax===undefined||v.expectedSalaryMax>=v.expectedSalaryMin,{message:'Maximum salary must be greater than minimum salary'});
const healthcareSchema=z.object({
  providerType:z.enum(['doctor','dentist','hospital','clinic','diagnostic_lab','pharmacy','other_healthcare']),
  displayName:z.string().trim().min(2).max(160), specialty:z.string().max(140).optional(),
  qualifications:z.array(z.string().max(160)).max(30).default([]), registrationAuthority:z.string().max(160).optional(),
  registrationNumber:z.string().max(160).optional(), consultationModes:z.array(z.enum(['in_person','teleconsultation'])).max(2).default(['in_person']),
  languages:z.array(z.string().max(40)).max(20).default([]), countryCode:z.string().length(2).default('IN'),
  region:z.string().max(120).optional(),district:z.string().max(120).optional(),city:z.string().max(120).optional(),locality:z.string().max(120).optional(),
  clinicAddress:z.string().max(500).optional(),publicPhone:z.string().max(40).optional()
});
const employerSchema=z.object({companyName:z.string().trim().min(2).max(160),websiteUrl:z.union([z.string().url().max(500),z.literal('')]).optional(),contactEmail:z.union([z.string().email().max(254),z.literal('')]).optional(),countryCode:z.string().length(2).default('IN')});
const jobSchema=z.object({
  employerAccountId:z.string().uuid(),title:z.string().trim().min(3).max(180),description:z.string().trim().min(30).max(8000),
  skills:z.array(z.string().max(80)).max(40).default([]),employmentType:z.enum(['full_time','part_time','contract','temporary','internship']).default('full_time'),
  experienceMin:z.number().min(0).max(60).optional(),experienceMax:z.number().min(0).max(60).optional(),
  salaryMin:z.number().nonnegative().optional(),salaryMax:z.number().nonnegative().optional(),salaryCurrency:z.string().length(3).default('INR'),
  countryCode:z.string().length(2).default('IN'),region:z.string().max(120).optional(),district:z.string().max(120).optional(),city:z.string().max(120).optional()
});
const requestSchema=z.object({listingId:z.string().uuid(),requestedAt:z.string().datetime().optional(),customerNotes:z.string().max(2000).optional(),serviceAddress:z.record(z.string(),z.unknown()).default({})});
const appointmentSchema=z.object({providerProfileId:z.string().uuid(),appointmentAt:z.string().datetime().optional(),appointmentMode:z.enum(['in_person','teleconsultation']),patientNote:z.string().max(2000).optional()});
const applySchema=z.object({jobPostId:z.string().uuid(),coverNote:z.string().max(4000).optional()});
async function userId(){const s=await auth();return s?.user?.id||null;}

export async function GET(request:Request, context:{params:Promise<{kind:string}>}) {
 const {kind}=await context.params;if(!kinds.has(kind as Kind))return NextResponse.json({error:'Unknown marketplace area.'},{status:404});
 const user=await userId();const url=new URL(request.url);const q=(url.searchParams.get('q')||'').trim().slice(0,100);
 const category=(url.searchParams.get('category')||'').trim().slice(0,100);const city=(url.searchParams.get('city')||'').trim().slice(0,120);const publicIdQuery=q.toUpperCase().replace(/[^A-Z0-9]/g,'');
 try {
  if(kind==='shops'||kind==='services'||kind==='professionals'){
   const type=kind==='shops'?'shop':kind==='services'?'service':'professional';
   const r=await db.query(`SELECT b.id,b.public_id,b.business_name,b.description,b.country_code,b.region_code,b.region,b.district,b.city,b.locality,b.verification_status,b.average_rating,b.rating_count,
    COALESCE(json_agg(json_build_object('id',l.id,'title',l.title,'description',l.description,'category',l.category,'listingType',l.listing_type,'priceAmount',l.price_amount,'currency',l.currency,'priceUnit',l.price_unit)) FILTER(WHERE l.id IS NOT NULL),'[]') AS listings
    FROM marketplace_businesses b LEFT JOIN marketplace_listings l ON l.business_id=b.id AND l.listing_status='published'
    WHERE b.business_type=$1 AND b.listing_status='published'
    AND ($2='' OR b.business_name ILIKE '%'||$2||'%' OR b.description ILIKE '%'||$2||'%' OR l.title ILIKE '%'||$2||'%' OR l.category ILIKE '%'||$2||'%' OR replace(upper(COALESCE(b.public_id,'')),'-','')=$5)
    AND ($3='' OR EXISTS (SELECT 1 FROM marketplace_listings lc WHERE lc.business_id=b.id AND lc.listing_status='published' AND (lc.category ILIKE '%'||$3||'%' OR lc.title ILIKE '%'||$3||'%')))
    AND ($4='' OR COALESCE(b.city,'') ILIKE '%'||$4||'%' OR COALESCE(b.locality,'') ILIKE '%'||$4||'%' OR COALESCE(b.district,'') ILIKE '%'||$4||'%')
    GROUP BY b.id ORDER BY b.created_at DESC LIMIT 50`,[type,q,category,city,publicIdQuery]);
   return NextResponse.json({items:r.rows});
  }
  if(kind==='healthcare'){
   const r=await db.query(`SELECT id,provider_type,display_name,specialty,qualifications,consultation_modes,languages,country_code,region,district,city,locality,clinic_address,public_phone
    FROM healthcare_provider_profiles WHERE verification_status='verified' AND profile_visibility='public'
    AND ($1='' OR display_name ILIKE '%'||$1||'%' OR specialty ILIKE '%'||$1||'%' OR provider_type ILIKE '%'||$1||'%')
    AND ($2='' OR provider_type ILIKE '%'||$2||'%' OR specialty ILIKE '%'||$2||'%')
    AND ($3='' OR COALESCE(city,'') ILIKE '%'||$3||'%' OR COALESCE(locality,'') ILIKE '%'||$3||'%' OR COALESCE(district,'') ILIKE '%'||$3||'%')
    ORDER BY display_name LIMIT 50`,[q,category,city]);
   return NextResponse.json({providers:r.rows});
  }
  if(kind==='career'){
   const jobs=await db.query(`SELECT j.id,j.title,j.description,j.skills,j.employment_type,j.experience_min,j.experience_max,j.salary_min,j.salary_max,j.salary_currency,j.country_code,j.region,j.district,j.city,e.company_name
    FROM marketplace_job_posts j JOIN employer_accounts e ON e.id=j.employer_account_id
    WHERE j.status='published' AND e.verification_status='verified'
    AND ($1='' OR j.title ILIKE '%'||$1||'%' OR j.description ILIKE '%'||$1||'%' OR $1=ANY(j.skills))
    AND ($2='' OR j.title ILIKE '%'||$2||'%' OR $2=ANY(j.skills))
    AND ($3='' OR COALESCE(j.city,'') ILIKE '%'||$3||'%' OR COALESCE(j.district,'') ILIKE '%'||$3||'%' OR COALESCE(j.region,'') ILIKE '%'||$3||'%')
    ORDER BY j.created_at DESC LIMIT 50`,[q,category,city]);
   let own=null;if(user){const r=await db.query('SELECT id,full_name,headline,summary,skills,experience_years,preferred_roles,employment_types,profile_visibility,profile_status FROM candidate_profiles WHERE user_id=$1',[user]);own=r.rows[0]||null;}
   return NextResponse.json({jobs:jobs.rows,candidateProfile:own});
  }
  return NextResponse.json({error:'Not found'},{status:404});
 }catch(e){console.error('Marketplace discovery failed',e);return NextResponse.json({error:'Marketplace discovery is temporarily unavailable.'},{status:503});}
}

export async function POST(request:Request, context:{params:Promise<{kind:string}>}) {
 const {kind}=await context.params;if(!kinds.has(kind as Kind))return NextResponse.json({error:'Unknown marketplace area.'},{status:404});
 const user=await userId();if(!user)return NextResponse.json({error:'Please sign in to continue.'},{status:401});
 const body=await request.json().catch(()=>null);
 try {
  if(kind==='shops'||kind==='services'||kind==='professionals'){
   const p=businessSchema.safeParse(body);if(!p.success)return NextResponse.json({error:'Please check the business details.',details:p.error.flatten()},{status:400});
   const type=kind==='shops'?'shop':kind==='services'?'service':'professional';const v=p.data;
   if(kind==='shops' && (!v.regionCode || !v.addressLine?.trim())) return NextResponse.json({error:'Shop address and its two-letter state or region code are required.'},{status:400});
   const r=kind==='shops'
    ? await db.query(`INSERT INTO marketplace_businesses(owner_user_id,business_name,business_type,description,phone,email,website_url,country_code,region_code,region,district,city,locality,postal_code,address_line,latitude,longitude,public_id,verification_status,listing_status)
      VALUES($1,$2,'shop',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,allocate_marketplace_public_id($8),'pending','published')
      RETURNING id,public_id,business_name,business_type,verification_status,listing_status,average_rating,rating_count`,
      [user,v.businessName,v.description,v.phone||null,v.email||null,v.websiteUrl||null,v.regionCode,v.region||null,v.district||null,v.city||null,v.locality||null,v.postalCode||null,v.addressLine,v.latitude??null,v.longitude??null])
    : await db.query(`INSERT INTO marketplace_businesses(owner_user_id,business_name,business_type,description,phone,email,website_url,country_code,region,district,city,locality,postal_code,address_line)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,business_name,business_type,verification_status,listing_status`,
      [user,v.businessName,type,v.description,v.phone||null,v.email||null,v.websiteUrl||null,v.countryCode,v.region||null,v.district||null,v.city||null,v.locality||null,v.postalCode||null,v.addressLine||null]);
   return NextResponse.json({business:r.rows[0],message:kind==='shops'?'Your shop is registered and can start listing products now. Verification is separate and does not block basic listing.':'Profile saved as a draft. Complete verification before public listing.'},{status:201});
  }
  if(kind==='healthcare'){
   const p=healthcareSchema.safeParse(body);if(!p.success)return NextResponse.json({error:'Please check the provider details.',details:p.error.flatten()},{status:400});const v=p.data;
   const r=await db.query(`INSERT INTO healthcare_provider_profiles(user_id,provider_type,display_name,specialty,qualifications,registration_authority,registration_number_encrypted,consultation_modes,languages,country_code,region,district,city,locality,clinic_address,public_phone)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id,provider_type,display_name,verification_status,profile_visibility`,
    [user,v.providerType,v.displayName,v.specialty||null,v.qualifications,v.registrationAuthority||null,null,v.consultationModes,v.languages,v.countryCode,v.region||null,v.district||null,v.city||null,v.locality||null,v.clinicAddress||null,v.publicPhone||null]);
   return NextResponse.json({provider:r.rows[0],message:'Healthcare profile saved privately for credential review. It is not publicly listed.'},{status:201});
  }
  if(kind==='career'){
   const p=candidateSchema.safeParse(body);if(!p.success)return NextResponse.json({error:'Please check the candidate details.',details:p.error.flatten()},{status:400});const v=p.data;
   const r=await db.query(`INSERT INTO candidate_profiles(user_id,full_name,headline,summary,skills,experience_years,preferred_roles,employment_types,expected_salary_min,expected_salary_max,salary_currency,country_code,region,district,city)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name,headline=EXCLUDED.headline,summary=EXCLUDED.summary,skills=EXCLUDED.skills,experience_years=EXCLUDED.experience_years,preferred_roles=EXCLUDED.preferred_roles,employment_types=EXCLUDED.employment_types,expected_salary_min=EXCLUDED.expected_salary_min,expected_salary_max=EXCLUDED.expected_salary_max,salary_currency=EXCLUDED.salary_currency,country_code=EXCLUDED.country_code,region=EXCLUDED.region,district=EXCLUDED.district,city=EXCLUDED.city,updated_at=now()
    RETURNING id,full_name,profile_visibility,profile_status`,
    [user,v.fullName,v.headline||null,v.summary||null,v.skills,v.experienceYears??null,v.preferredRoles,v.employmentTypes,v.expectedSalaryMin??null,v.expectedSalaryMax??null,v.salaryCurrency||null,v.countryCode,v.region||null,v.district||null,v.city||null]);
   return NextResponse.json({candidateProfile:r.rows[0],message:'Candidate profile saved privately. You control whether employers can discover it.'},{status:201});
  }
  return NextResponse.json({error:'Use the relevant marketplace action.'},{status:400});
 }catch(e){console.error('Marketplace profile save failed',e);return NextResponse.json({error:'Could not save the profile. Please retry.'},{status:503});}
}

export async function PUT(request:Request, context:{params:Promise<{kind:string}>}) {
 const {kind}=await context.params;const user=await userId();if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});const body=await request.json().catch(()=>null);
 try{
  if(kind==='shops'||kind==='services'||kind==='professionals'){
   const p=listingSchema.safeParse(body);if(!p.success)return NextResponse.json({error:'Invalid listing details.'},{status:400});const v=p.data;
   const publishImmediately=kind==='shops';
   const r=await db.query(`INSERT INTO marketplace_listings(business_id,listing_type,title,slug,description,category,price_amount,currency,price_unit,listing_status)
    SELECT b.id,$2,$3,lower(regexp_replace(trim($3),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),$4,$5,$6,$7,$8,CASE WHEN $10 THEN 'published' ELSE 'draft' END
    FROM marketplace_businesses b WHERE b.id=$1 AND b.owner_user_id=$9 AND b.listing_status<>'rejected'
    RETURNING id,title,listing_status`,[v.businessId,v.listingType,v.title,v.description,v.category,v.priceAmount??null,v.currency??null,v.priceUnit??null,user,publishImmediately]);
   if(!r.rowCount)return NextResponse.json({error:'Business profile not found or not owned by your account.'},{status:404});
   return NextResponse.json({listing:r.rows[0],message:publishImmediately?'Product added to your shop.':'Listing saved as draft for review.'},{status:201});
  }
  if(kind==='career'){
   const p=employerSchema.safeParse(body);if(!p.success)return NextResponse.json({error:'Invalid employer details.'},{status:400});const v=p.data;
   const r=await db.query(`INSERT INTO employer_accounts(owner_user_id,company_name,website_url,contact_email,country_code) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(owner_user_id,company_name) DO UPDATE SET website_url=EXCLUDED.website_url,contact_email=EXCLUDED.contact_email,updated_at=now()
    RETURNING id,company_name,verification_status`,[user,v.companyName,v.websiteUrl||null,v.contactEmail||null,v.countryCode]);
   return NextResponse.json({employer:r.rows[0],message:'Employer account saved. Verification is required before publishing jobs.'},{status:201});
  }
  return NextResponse.json({error:'Unsupported action.'},{status:400});
 }catch(e){console.error('Marketplace listing/employer save failed',e);return NextResponse.json({error:'Could not save this information.'},{status:503});}
}
