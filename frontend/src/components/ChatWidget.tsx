import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../api/client';

/* ─── Conversation flow ───────────────────────────────────────── */

interface ChatStep {
  id: string;
  message: string;
  options?: { label: string; value: string; next: string }[];
  input?: 'email' | 'name' | 'phone';
  next?: string;
  final?: boolean;
}

const STEPS: Record<string, ChatStep> = {
  greeting: {
    id: 'greeting',
    message: "Hi there! I'm here to help you learn about StoreScore. What brings you here today?",
    options: [
      { label: 'I want to see if StoreScore is right for us', value: 'evaluating', next: 'role' },
      { label: 'I have a specific question', value: 'question', next: 'question-topic' },
      { label: 'I want to get started / see pricing', value: 'pricing', next: 'store-count' },
      { label: 'Just browsing', value: 'browsing', next: 'browsing-nudge' },
    ],
  },

  // ── Evaluating path ──────────────────────────────────
  role: {
    id: 'role',
    message: "Great! What's your role?",
    options: [
      { label: 'Owner / Executive', value: 'owner', next: 'store-count' },
      { label: 'Operations / Regional Manager', value: 'ops_manager', next: 'store-count' },
      { label: 'Store Manager', value: 'store_manager', next: 'store-count' },
      { label: 'Other', value: 'other', next: 'store-count' },
    ],
  },

  'store-count': {
    id: 'store-count',
    message: 'How many locations does your organization have?',
    options: [
      { label: '1-5 stores', value: '1-5', next: 'current-process' },
      { label: '6-20 stores', value: '6-20', next: 'current-process' },
      { label: '21-100 stores', value: '21-100', next: 'current-process' },
      { label: '100+ stores', value: '100+', next: 'current-process' },
    ],
  },

  'current-process': {
    id: 'current-process',
    message: 'How are you currently tracking store quality?',
    options: [
      { label: 'Paper checklists', value: 'paper', next: 'pain-point' },
      { label: 'Spreadsheets / Google Forms', value: 'spreadsheets', next: 'pain-point' },
      { label: 'Another software tool', value: 'other_software', next: 'pain-point' },
      { label: "We don't have a process yet", value: 'none', next: 'pain-point' },
    ],
  },

  'pain-point': {
    id: 'pain-point',
    message: "What's the biggest challenge you're facing?",
    options: [
      { label: 'Inconsistent evaluations across locations', value: 'consistency', next: 'collect-name' },
      { label: 'No visibility into follow-up / action items', value: 'follow_up', next: 'collect-name' },
      { label: "Can't see trends or compare stores", value: 'reporting', next: 'collect-name' },
      { label: 'Too time-consuming / manual', value: 'efficiency', next: 'collect-name' },
    ],
  },

  // ── Question path ────────────────────────────────────
  'question-topic': {
    id: 'question-topic',
    message: 'What area are you curious about?',
    options: [
      { label: 'Pricing & plans', value: 'pricing', next: 'pricing-answer' },
      { label: 'Features & capabilities', value: 'features', next: 'features-answer' },
      { label: 'Setup & onboarding', value: 'setup', next: 'setup-answer' },
      { label: 'Something else', value: 'other', next: 'collect-name' },
    ],
  },

  'pricing-answer': {
    id: 'pricing-answer',
    message: "StoreScore offers flexible plans starting at $49/mo for small teams, scaling with your store count. We'd love to walk you through the options and find the right fit. Want someone to reach out?",
    options: [
      { label: "Yes, let's talk", value: 'yes', next: 'collect-name' },
      { label: "I'll check the pricing page", value: 'no', next: 'self-serve-end' },
    ],
  },

  'features-answer': {
    id: 'features-answer',
    message: "StoreScore covers the full loop: scoring templates, mobile walk conduct, AI summaries, photo verification, action items, reports, and team management. Want a personalized walkthrough?",
    options: [
      { label: 'Yes, that would be great', value: 'yes', next: 'collect-name' },
      { label: "I'll explore the tour page", value: 'no', next: 'self-serve-end' },
    ],
  },

  'setup-answer': {
    id: 'setup-answer',
    message: "Most teams are up and running in under 30 minutes. We'll help you set up your first template, import your stores, and invite your team. Want us to walk you through it?",
    options: [
      { label: "Yes, let's set it up", value: 'yes', next: 'collect-name' },
      { label: "I'll try it on my own first", value: 'no', next: 'self-serve-end' },
    ],
  },

  // ── Browsing path ────────────────────────────────────
  'browsing-nudge': {
    id: 'browsing-nudge',
    message: "No problem! Here are some good starting points:",
    options: [
      { label: 'Take the product tour', value: 'tour', next: 'self-serve-end' },
      { label: 'See pricing', value: 'pricing', next: 'self-serve-end' },
      { label: 'Actually, I have a question', value: 'question', next: 'question-topic' },
    ],
  },

  'self-serve-end': {
    id: 'self-serve-end',
    message: "Sounds good! If you change your mind, I'm right here. You can also leave your email and we'll send you some helpful resources.",
    options: [
      { label: "Sure, I'll leave my info", value: 'yes', next: 'collect-name' },
      { label: "No thanks, I'm good", value: 'no', next: 'goodbye' },
    ],
  },

  // ── Contact collection ───────────────────────────────
  'collect-name': {
    id: 'collect-name',
    message: "What's your name?",
    input: 'name',
    next: 'collect-email',
  },

  'collect-email': {
    id: 'collect-email',
    message: "And your work email?",
    input: 'email',
    next: 'collect-phone',
  },

  'collect-phone': {
    id: 'collect-phone',
    message: 'Best phone number to reach you? (optional — press Send to skip)',
    input: 'phone',
    next: 'thankyou',
  },

  thankyou: {
    id: 'thankyou',
    message: "Thank you! Someone from our team will reach out to you shortly. We're a small, responsive team — expect to hear from us within a few hours during business hours.",
    final: true,
  },

  goodbye: {
    id: 'goodbye',
    message: "No problem at all! Feel free to come back anytime. Enjoy exploring StoreScore!",
    final: true,
  },
};

/* ─── Types ───────────────────────────────────────────────────── */

interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
}

/* ─── Component ───────────────────────────────────────────────── */

/* ─── Typing indicator ────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
      </div>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────── */

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('greeting');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [typing, setTyping] = useState(false);
  const [waitingForStep, setWaitingForStep] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simulate typing delay then deliver a bot message
  const deliverBotMessage = useCallback((
    userMessages: ChatMessage[],
    botText: string,
    nextStepId: string,
  ) => {
    // Show user message immediately + start typing indicator
    setMessages(userMessages);
    setTyping(true);
    setWaitingForStep(true);

    // Vary delay by message length to feel natural (800-1800ms)
    const delay = Math.min(1800, 800 + botText.length * 5);

    setTimeout(() => {
      setTyping(false);
      setMessages([...userMessages, { from: 'bot', text: botText }]);
      setCurrentStep(nextStepId);
      setWaitingForStep(false);
    }, delay);
  }, []);

  // Initialize greeting on first open (with typing delay)
  useEffect(() => {
    if (open && messages.length === 0) {
      setTyping(true);
      setWaitingForStep(true);
      setTimeout(() => {
        setTyping(false);
        setMessages([{ from: 'bot', text: STEPS.greeting.message }]);
        setWaitingForStep(false);
      }, 1000);
    }
  }, [open, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Focus input when step has text input
  useEffect(() => {
    if (open && !waitingForStep && STEPS[currentStep]?.input) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, currentStep, waitingForStep]);

  // Hide pulse after first open
  useEffect(() => {
    if (open) setShowPulse(false);
  }, [open]);

  const step = STEPS[currentStep];

  const handleOptionClick = (option: { label: string; value: string; next: string }) => {
    if (waitingForStep) return; // Prevent clicks while typing

    const userMessages: ChatMessage[] = [
      ...messages,
      { from: 'user', text: option.label },
    ];

    setAnswers((prev) => ({ ...prev, [currentStep]: option.value }));

    const nextStep = STEPS[option.next];
    if (nextStep) {
      deliverBotMessage(userMessages, nextStep.message, option.next);
    } else {
      setMessages(userMessages);
    }
  };

  const handleInputSubmit = async () => {
    const step = STEPS[currentStep];
    if (!step?.input || !step.next || waitingForStep) return;

    const value = inputValue.trim();

    // Email validation
    if (step.input === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return;
    }

    // Name is required
    if (step.input === 'name' && !value) return;

    const userMessages: ChatMessage[] = [
      ...messages,
      { from: 'user', text: value || '(skipped)' },
    ];

    const updatedAnswers = { ...answers, [step.input]: value };
    setAnswers(updatedAnswers);
    setInputValue('');

    const nextStep = STEPS[step.next];
    if (nextStep) {
      deliverBotMessage(userMessages, nextStep.message, step.next);
    } else {
      setMessages(userMessages);
    }

    // If we just reached the thank-you step, submit the lead
    if (step.next === 'thankyou' && !submitted) {
      setSubmitted(true);
      try {
        await api.post('/auth/chat-lead/', {
          name: updatedAnswers.name || '',
          email: updatedAnswers.email || '',
          phone: updatedAnswers.phone || '',
          answers: updatedAnswers,
          page: window.location.pathname,
        });
      } catch {
        // Silently fail — we already showed the thank you message
      }
    }
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[340px] sm:w-[380px] max-h-[min(32rem,calc(100vh-8rem))] flex flex-col bg-white rounded-2xl shadow-2xl ring-1 ring-gray-900/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">StoreScore</div>
                <div className="text-[10px] text-white/70">Typically replies in a few hours</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && <TypingIndicator />}

            {/* Options for current step (hidden while typing) */}
            {!typing && !waitingForStep && step && !step.final && step.options && (
              <div className="space-y-1.5 pt-1">
                {step.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleOptionClick(opt)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200/50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Text input for name/email/phone steps */}
          {!typing && !waitingForStep && step && step.input && !step.final && (
            <div className="border-t border-gray-100 px-3 py-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInputSubmit();
                }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  type={step.input === 'email' ? 'email' : step.input === 'phone' ? 'tel' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    step.input === 'name' ? 'Your name...' :
                    step.input === 'email' ? 'you@company.com' :
                    '(555) 123-4567'
                  }
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-all hover:scale-105 flex items-center justify-center"
      >
        {showPulse && (
          <span className="absolute inset-0 rounded-full bg-primary-600 animate-ping opacity-40" />
        )}
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </>
  );
}
