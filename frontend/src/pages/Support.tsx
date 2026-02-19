import { useEffect, useState, type FormEvent } from 'react';
import { getTickets, createTicket, addTicketMessage, type SupportTicket } from '../api/support';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  high: { label: 'High', color: 'text-red-600' },
};

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Create form state
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newCategory, setNewCategory] = useState('other');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      const data = await getTickets();
      setTickets(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const ticket = await createTicket({
        subject: newSubject,
        description: newDescription,
        priority: newPriority,
        category: newCategory,
      });
      setTickets((prev) => [ticket, ...prev]);
      setShowCreate(false);
      setSelectedTicket(ticket);
      setNewSubject('');
      setNewDescription('');
      setNewPriority('medium');
      setNewCategory('other');
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setSending(true);
    try {
      const msg = await addTicketMessage(selectedTicket.id, replyText.trim());
      setSelectedTicket((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev
      );
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicket.id
            ? { ...t, messages: [...t.messages, msg] }
            : t
        )
      );
      setReplyText('');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="mt-1 text-sm text-gray-500">Submit a ticket and we'll get back to you.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedTicket(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket list */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
          <div className="divide-y divide-gray-100 max-h-[calc(100vh-220px)] overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No tickets yet. Create one to get started.
              </div>
            ) : tickets.map((ticket) => {
              const st = STATUS_LABELS[ticket.status] || STATUS_LABELS.open;
              return (
                <button
                  key={ticket.id}
                  onClick={() => { setSelectedTicket(ticket); setShowCreate(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedTicket?.id === ticket.id ? 'bg-primary-50 border-l-2 border-primary-600' : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">{ticket.subject}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(ticket.created_at).toLocaleDateString()} &middot; {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail / Create panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6">
          {showCreate ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">New Ticket</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Brief summary of your issue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="bug">Bug</option>
                    <option value="ui_feedback">UI Feedback</option>
                    <option value="enhancement">Enhancement Request</option>
                    <option value="question">Question</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  rows={5}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Describe your issue in detail..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? 'Submitting...' : 'Submit Ticket'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : selectedTicket ? (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{selectedTicket.user?.full_name || 'System'}</span>
                    <span>&middot;</span>
                    <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                    <span>&middot;</span>
                    <span className={PRIORITY_LABELS[selectedTicket.priority]?.color || ''}>
                      {PRIORITY_LABELS[selectedTicket.priority]?.label || selectedTicket.priority}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_LABELS[selectedTicket.status]?.color || ''}`}>
                  {STATUS_LABELS[selectedTicket.status]?.label || selectedTicket.status}
                </span>
              </div>

              {/* Message thread */}
              <div className="space-y-4 max-h-[calc(100vh-420px)] overflow-y-auto mb-4">
                {selectedTicket.messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                      {msg.user?.first_name?.[0] || 'S'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {msg.user?.full_name || 'System'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply form */}
              {selectedTicket.status !== 'closed' && (
                <form onSubmit={handleReply} className="border-t border-gray-200 pt-4">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400">
              Select a ticket or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
