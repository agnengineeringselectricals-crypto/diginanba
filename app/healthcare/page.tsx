import CustomerDiscoveryPage from '@/components/CustomerDiscoveryPage';

export const metadata = { title: 'Doctors & Healthcare' };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; city?: string }> }) {
  const params = await searchParams;
  const initialQuery = typeof params.q === 'string' ? params.q.slice(0, 100) : '';
  const initialCity = typeof params.city === 'string' ? params.city.slice(0, 120) : '';
  return <CustomerDiscoveryPage
    kind="healthcare"
    title="Doctors & Healthcare"
    intro="Find healthcare support when you need it, from family doctors and specialists to dentists, clinics, hospitals, diagnostic centres and pharmacies."
    categories={['General Physicians','Paediatricians','Cardiologists','Dermatologists','Orthopaedic Doctors','Gynaecologists','Dentists','Eye Specialists','Hospitals & Clinics','Diagnostic Laboratories','Pharmacies','Physiotherapy','Home Nursing','Teleconsultation']}
    initialQuery={initialQuery}
    initialCity={initialCity}
  />;
}
