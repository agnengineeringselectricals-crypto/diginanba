import CustomerDiscoveryPage from '@/components/CustomerDiscoveryPage';

export const metadata = { title: 'My Services' };

export default function Page() {
  return <CustomerDiscoveryPage
    kind="services"
    title="My Services"
    intro="Find a service when you need one. Whether it is an electrician for a wiring problem, a plumber for a leak or someone to repair an appliance, discover help in your area."
    categories={[
      'Electricians & Electrical Repair',
      'Plumbers & Pipe Work',
      'Carpenters & Furniture Repair',
      'Painting & Waterproofing',
      'AC & Appliance Repair',
      'House Cleaning',
      'Pest Control',
      'Masonry & Construction',
      'Civil & Building Work',
      'Vehicle Mechanics',
      'Tyre & Puncture Repair',
      'Computer & Mobile Repair',
      'Transport & Packers',
      'Tailoring & Alterations',
      'Beauty & Personal Care',
      'Tutoring & Training',
      'Catering & Event Services',
      'Gardening & Landscaping',
    ]}
  />;
}
