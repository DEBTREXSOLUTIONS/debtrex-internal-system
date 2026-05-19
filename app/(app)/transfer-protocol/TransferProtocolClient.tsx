"use client";
import { useState } from 'react';
import { Users, BookUser, Hash, ListOrdered } from 'lucide-react';
import ExtensionsTab from './tabs/ExtensionsTab';
import ContactsTab from './tabs/ContactsTab';
import QueuesTab from './tabs/QueuesTab';

type TabKey = 'extensions' | 'contacts' | 'queues';

const TABS: { key: TabKey; label: string; icon: any; desc: string }[] = [
  { key: 'extensions', label: 'Extensions', icon: Hash, desc: 'Short dial codes for each agent' },
  { key: 'contacts', label: 'Internal Contacts', icon: BookUser, desc: 'Directory of internal + external transfer targets' },
  { key: 'queues', label: 'Queues', icon: ListOrdered, desc: 'Inbound routing groups with ring strategy' },
];

export default function TransferProtocolClient() {
  const [tab, setTab] = useState<TabKey>('extensions');

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h2 className="font-condensed text-2xl font-black uppercase">Transfer Protocol</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Configure how calls flow between agents, queues, and external contacts.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px flex-shrink-0 ${
                active
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
              title={t.desc}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === 'extensions' && <ExtensionsTab />}
        {tab === 'contacts' && <ContactsTab />}
        {tab === 'queues' && <QueuesTab />}
      </div>
    </div>
  );
}
