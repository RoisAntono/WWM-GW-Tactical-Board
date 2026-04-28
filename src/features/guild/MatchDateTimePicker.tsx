import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

type MatchDateTimePickerProps = {
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  label?: string;
  className?: string;
};

type CalendarDay = {
  key: string;
  value: string;
  day: number;
  currentMonth: boolean;
  today: boolean;
  selected: boolean;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MatchDateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  label = 'Match Timestamp',
  className,
}: MatchDateTimePickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDateValue(date) ?? startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate));
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth, date), [date, visibleMonth]);

  useEffect(() => {
    if (open) {
      setVisibleMonth(startOfMonth(selectedDate));
    }
  }, [date, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const chooseDate = (value: string) => {
    onDateChange(value);
  };

  const setToday = () => {
    const today = toDateInputValue(new Date());
    onDateChange(today);
    setVisibleMonth(startOfMonth(new Date()));
  };

  const setNow = () => {
    const now = new Date();
    onDateChange(toDateInputValue(now));
    onTimeChange(toTimeInputValue(now));
    setVisibleMonth(startOfMonth(now));
  };

  return (
    <div className={`match-datetime-picker${className ? ` ${className}` : ''}`} ref={pickerRef}>
      <button
        type="button"
        className="match-datetime-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={16} />
        <span>
          <small>{label}</small>
          <strong>{formatTimestamp(date, time)}</strong>
        </span>
      </button>

      {open ? (
        <div className="match-datetime-popover" role="dialog" aria-label={label}>
          <div className="match-calendar-heading">
            <button
              type="button"
              className="icon-button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <strong>{formatMonthLabel(visibleMonth)}</strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="match-calendar-weekdays" aria-hidden="true">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="match-calendar-grid">
            {calendarDays.map((day) => (
              <button
                key={day.key}
                type="button"
                className={[
                  'match-calendar-day',
                  day.currentMonth ? '' : 'is-muted',
                  day.today ? 'is-today' : '',
                  day.selected ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => chooseDate(day.value)}
                aria-pressed={day.selected}
              >
                {day.day}
              </button>
            ))}
          </div>

          <label className="match-time-control">
            <Clock size={15} />
            <span>Time</span>
            <input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
          </label>

          <div className="match-datetime-actions">
            <button type="button" className="ghost-button" onClick={setToday}>
              Today
            </button>
            <button type="button" className="secondary-button" onClick={setNow}>
              Now
            </button>
            <button type="button" className="primary-button" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCalendarDays(month: Date, selectedValue: string): CalendarDay[] {
  const firstOfMonth = startOfMonth(month);
  const startDate = addDays(firstOfMonth, -firstOfMonth.getDay());
  const todayValue = toDateInputValue(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = addDays(startDate, index);
    const value = toDateInputValue(currentDate);

    return {
      key: value,
      value,
      day: currentDate.getDate(),
      currentMonth: currentDate.getMonth() === month.getMonth(),
      today: value === todayValue,
      selected: value === selectedValue,
    };
  });
}

function parseDateValue(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatTimestamp(date: string, time: string): string {
  const parsedDate = parseDateValue(date);
  if (!parsedDate) {
    return 'No match date selected';
  }

  const displayDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedDate);

  return `${displayDate}${time ? `, ${time}` : ', time not set'}`;
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}
