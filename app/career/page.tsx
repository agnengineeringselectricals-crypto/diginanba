import CustomerDiscoveryPage from '@/components/CustomerDiscoveryPage';

export const metadata = { title: 'My Career' };

export default function Page() {
  return <CustomerDiscoveryPage
    kind="career"
    title="My Career"
    intro="Explore job opportunities by role, skill and location. Find full-time, part-time, contract and internship opportunities that match what you are looking for."
    categories={['Engineering Jobs','Electrical Jobs','Civil Jobs','IT & Software','Accounting & Finance','Administration','Sales & Marketing','Technicians & Trades','Healthcare Jobs','Teaching & Training','Work From Home','Internships','Part-time Jobs','Government Exam Preparation']}
  />;
}
