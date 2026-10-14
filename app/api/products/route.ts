import {NextResponse} from 'next/server'; import {getProducts} from '@/lib/catalog';
export async function GET(req:Request){const u=new URL(req.url);const requestedMarket=u.searchParams.get('market');const market=requestedMarket==='UK'||requestedMarket==='IN'?requestedMarket:'US';const q=u.searchParams.get('q')||'';return NextResponse.json({market,products:await getProducts(market,q)});}
