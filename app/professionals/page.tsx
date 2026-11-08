import CustomerDiscoveryPage from '@/components/CustomerDiscoveryPage';

export const metadata = { title: 'My Professionals' };

export default function Page() {
  return <CustomerDiscoveryPage
    kind="professionals"
    title="My Professionals"
    intro="Find qualified people for the work you need done: engineers, architects, accountants, lawyers, consultants and other specialists. You are here to find expertise, not to register as a professional."
    categories={['Electrical Engineers','Civil Engineers','Mechanical Engineers','Architects','Structural Consultants','Chartered Accountants','Tax Consultants','Lawyers','Business Consultants','IT Professionals','Designers','Safety Consultants','Surveyors','Project Managers']}
  />;
}
