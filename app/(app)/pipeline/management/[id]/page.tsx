import ContactDetailBase from '../../ContactDetailBase';

export default async function ManagementContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetailBase type="management" id={id} />;
}
