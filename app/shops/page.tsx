import CustomerDiscoveryPage from '@/components/CustomerDiscoveryPage';

export const metadata = { title: 'My Shops' };

export default function Page() {
  return <CustomerDiscoveryPage
    kind="shops"
    title="My Shops"
    intro="Find the everyday shops you visit and the things you need nearby. You do not need to own a shop—browse groceries, vegetables, pharmacies, food stores and more."
    categories={[
      'Groceries & Daily Needs',
      'Vegetables & Fruits',
      'Medical Shops & Pharmacy',
      'Food, Bakery & Sweets',
      'Clothing & Footwear',
      'Mobile & Electronics',
      'Electrical & Hardware',
      'Home & Kitchen',
      'Building Materials',
      'Vehicle Spares',
      'Stationery & Books',
      'Beauty & Personal Care',
      'Agriculture & Garden',
      'Pet Supplies',
    ]}
  />;
}
