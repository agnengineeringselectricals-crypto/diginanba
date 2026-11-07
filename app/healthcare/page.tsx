import CustomerDiscoveryPage from '@/components/CustomerDiscoveryPage';

export const metadata = { title: 'Doctors & Healthcare' };

export default function Page() {
  return <CustomerDiscoveryPage
    kind="healthcare"
    title="Doctors & Healthcare"
    intro="Find healthcare support when you need it, from family doctors and specialists to dentists, clinics, hospitals, diagnostic centres and pharmacies."
    categories={['General Physicians','Paediatricians','Cardiologists','Dermatologists','Orthopaedic Doctors','Gynaecologists','Dentists','Eye Specialists','Hospitals & Clinics','Diagnostic Laboratories','Pharmacies','Physiotherapy','Home Nursing','Teleconsultation']}
  />;
}
