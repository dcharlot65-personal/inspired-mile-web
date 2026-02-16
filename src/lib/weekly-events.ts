/**
 * Weekly Events — Date-based rotating bonus events.
 * No backend needed — purely time-based.
 */

export interface WeeklyEvent {
  id: string;
  name: string;
  description: string;
  bonusType: string;
  multiplier: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ...6=Sat
  icon: string;
  color: string;
}

export const WEEKLY_EVENTS: WeeklyEvent[] = [
  {
    id: 'trivia-tuesday',
    name: 'Trivia Tuesday',
    description: '2x XP from trivia questions today!',
    bonusType: 'trivia',
    multiplier: 2,
    dayOfWeek: 2,
    icon: '\uD83E\uDDE0',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'world-wednesday',
    name: 'World Wednesday',
    description: 'Free city variant attempt today!',
    bonusType: 'variant',
    multiplier: 1,
    dayOfWeek: 3,
    icon: '\uD83C\uDF0D',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'challenge-thursday',
    name: 'Challenge Thursday',
    description: 'Bonus quote challenges available today!',
    bonusType: 'challenge',
    multiplier: 2,
    dayOfWeek: 4,
    icon: '\uD83D\uDCDC',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'battle-weekend-sat',
    name: 'Battle Weekend',
    description: '2x XP from battles this weekend!',
    bonusType: 'battle',
    multiplier: 2,
    dayOfWeek: 6,
    icon: '\u2694\uFE0F',
    color: 'from-red-500 to-crimson-500',
  },
  {
    id: 'battle-weekend-sun',
    name: 'Battle Weekend',
    description: '2x XP from battles this weekend!',
    bonusType: 'battle',
    multiplier: 2,
    dayOfWeek: 0,
    icon: '\u2694\uFE0F',
    color: 'from-red-500 to-crimson-500',
  },
];

/** Get today's active event (if any) */
export function getTodaysEvent(): WeeklyEvent | null {
  const today = new Date().getDay();
  return WEEKLY_EVENTS.find(e => e.dayOfWeek === today) ?? null;
}

/** Get the next upcoming event */
export function getNextEvent(): { event: WeeklyEvent; daysUntil: number } {
  const today = new Date().getDay();
  let minDays = 7;
  let nextEvent = WEEKLY_EVENTS[0];

  for (const event of WEEKLY_EVENTS) {
    let daysUntil = (event.dayOfWeek - today + 7) % 7;
    if (daysUntil === 0) daysUntil = 7; // Next week if today
    if (daysUntil < minDays) {
      minDays = daysUntil;
      nextEvent = event;
    }
  }

  return { event: nextEvent, daysUntil: minDays };
}

/** Check if a bonus applies to a given activity type */
export function getActiveMultiplier(activityType: string): number {
  const event = getTodaysEvent();
  if (!event) return 1;
  return event.bonusType === activityType ? event.multiplier : 1;
}

/** Get time until midnight (next day's event) */
export function getTimeUntilNextDay(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/** Format countdown as "Xh Ym" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now!';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
