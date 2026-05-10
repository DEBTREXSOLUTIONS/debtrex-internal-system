import ContactDetailBase from '../../ContactDetailBase';

export default async function SalesContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetailBase type="sales" id={id} />;
}
