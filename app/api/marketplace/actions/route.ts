import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
export const runtime='nodejs';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('service_booking'),listingId:z.string().uuid(),requestedAt:z.string().datetime().optional(),customerNotes:z.string().max(2000).optional(),address:z.record(z.string(),z.unknown()).default({})}),
 z.object({action:z.literal('healthcare_appointment'),providerProfileId:z.string().uuid(),appointmentAt:z.string().datetime().optional(),appointmentMode:z.enum(['in_person','teleconsultation']),patientNote:z.string().max(2000).optional()}),
 z.object({action:z.literal('job_post'),employerAccountId:z.string().uuid(),title:z.string().min(3).max(180),description:z.string().min(30).max(8000),skills:z.array(z.string().max(80)).max(40).default([]),employmentType:z.enum(['full_time','part_time','contract','temporary','internship']).default('full_time'),countryCode:z.string().length(2).default('IN'),region:z.string().max(120).optional(),district:z.string().max(120).optional(),city:z.string().max(120).optional()}),
 z.object({action:z.literal('job_application'),jobPostId:z.string().uuid(),coverNote:z.string().max(4000).optional()}),
 z.object({action:z.literal('candidate_visibility'),visibility:z.enum(['private','searchable','paused'])})
]);
export async function POST(request:Request){
 const session=await auth();const user=session?.user?.id;if(!user)return NextResponse.json({error:'Please sign in to continue.'},{status:401});
 const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Invalid request details.',details:p.error.flatten()},{status:400});const v=p.data;
 try{
  if(v.action==='service_booking'){
   const r=await db.query(`INSERT INTO marketplace_service_bookings(listing_id,customer_user_id,provider_user_id,requested_at,service_address,customer_notes)
    SELECT l.id,$2,b.owner_user_id,$3,$4::jsonb,$5 FROM marketplace_listings l JOIN marketplace_businesses b ON b.id=l.business_id
    WHERE l.id=$1 AND l.listing_type IN ('service','professional_service') AND l.listing_status='published' AND b.verification_status='verified'
    RETURNING id,status,created_at`,[v.listingId,user,v.requestedAt||null,JSON.stringify(v.address),v.customerNotes||null]);
   if(!r.rowCount)return NextResponse.json({error:'This service is not available for booking.'},{status:404});
   return NextResponse.json({booking:r.rows[0],message:'Booking request submitted to the provider.'},{status:201});
  }
  if(v.action==='healthcare_appointment'){
   const r=await db.query(`INSERT INTO healthcare_appointments(provider_profile_id,patient_user_id,appointment_at,appointment_mode,patient_note)
    SELECT id,$2,$3,$4,$5 FROM healthcare_provider_profiles WHERE id=$1 AND verification_status='verified' AND profile_visibility='public' AND appointment_enabled=true
    RETURNING id,status,created_at`,[v.providerProfileId,user,v.appointmentAt||null,v.appointmentMode,v.patientNote||null]);
   if(!r.rowCount)return NextResponse.json({error:'Appointments are not enabled for this provider.'},{status:404});
   return NextResponse.json({appointment:r.rows[0]},{status:201});
  }
  if(v.action==='job_post'){
   const r=await db.query(`INSERT INTO marketplace_job_posts(employer_account_id,title,description,skills,employment_type,country_code,region,district,city)
    SELECT id,$2,$3,$4,$5,$6,$7,$8,$9 FROM employer_accounts WHERE id=$1 AND owner_user_id=$10 AND verification_status='verified'
    RETURNING id,title,status`,[v.employerAccountId,v.title,v.description,v.skills,v.employmentType,v.countryCode,v.region||null,v.district||null,v.city||null,user]);
   if(!r.rowCount)return NextResponse.json({error:'Employer account must be verified before posting a job.'},{status:403});
   return NextResponse.json({job:r.rows[0],message:'Job post saved for moderation.'},{status:201});
  }
  if(v.action==='job_application'){
   const candidate=await db.query("SELECT id FROM candidate_profiles WHERE user_id=$1 AND profile_status <> 'deleted'",[user]);
   if(!candidate.rowCount)return NextResponse.json({error:'Create a candidate profile before applying.'},{status:400});
   const r=await db.query(`INSERT INTO marketplace_job_applications(job_post_id,candidate_profile_id,cover_note)
    SELECT j.id,$2,$3 FROM marketplace_job_posts j WHERE j.id=$1 AND j.status='published'
    ON CONFLICT(job_post_id,candidate_profile_id) DO NOTHING RETURNING id,status`,[v.jobPostId,candidate.rows[0].id,v.coverNote||null]);
   if(!r.rowCount)return NextResponse.json({error:'This job is unavailable or you have already applied.'},{status:409});
   return NextResponse.json({application:r.rows[0]},{status:201});
  }
  if(v.action==='candidate_visibility'){
   const r=await db.query(`UPDATE candidate_profiles SET profile_visibility=$2,profile_status=CASE WHEN $2='paused' THEN 'paused' WHEN profile_status='paused' THEN 'active' ELSE profile_status END,consent_updated_at=now(),updated_at=now() WHERE user_id=$1 RETURNING id,profile_visibility,profile_status`,[user,v.visibility]);
   if(!r.rowCount)return NextResponse.json({error:'Create your candidate profile first.'},{status:404});
   await db.query(`INSERT INTO candidate_profile_consent_events(candidate_profile_id,consent_type,enabled,policy_version) VALUES($1,'searchable_profile',$2,'2026-11-06')`,[r.rows[0].id,v.visibility==='searchable']);
   return NextResponse.json({candidateProfile:r.rows[0]});
  }
 }catch(e){console.error('Marketplace action failed',e);return NextResponse.json({error:'The requested action could not be completed.'},{status:503});}
}
