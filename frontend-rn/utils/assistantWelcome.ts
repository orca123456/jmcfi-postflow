type WelcomeTicket = { userId: number; ready: boolean };
let ticket: WelcomeTicket | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function queueAssistantWelcome(userId: number) { ticket = { userId, ready: false }; notify(); }
export function readyAssistantWelcome() { if (ticket && !ticket.ready) { ticket = { ...ticket, ready: true }; notify(); } }
export function getAssistantWelcome() { return ticket; }
export function subscribeAssistantWelcome(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function consumeAssistantWelcome(userId: number) {
  if (!ticket?.ready || ticket.userId !== userId) return false;
  ticket = null;
  notify();
  return true;
}
