import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({ok:true,service:'diginanba-web',environment:process.env.NODE_ENV,version:'0.2.0'});}
