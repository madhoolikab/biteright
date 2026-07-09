import { format, startOfWeek } from 'date-fns'

export function useToday(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function useCurrentWeekStart(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function isEvening(): boolean {
  return new Date().getHours() >= 19
}
