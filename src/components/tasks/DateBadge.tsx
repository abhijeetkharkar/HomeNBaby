import { Typography } from '@mui/material';

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

function isDueSoon(dateStr: string, days = 7): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diff = (due.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${mon} ${day}`;
}

function getStyle(dateStr: string, done?: boolean): { color: string; bgcolor: string } {
  if (done) return { color: '#9e9e9e', bgcolor: '#f5f5f5' };
  if (isOverdue(dateStr)) return { color: '#d32f2f', bgcolor: '#ffebee' };
  if (isDueSoon(dateStr)) return { color: '#e65100', bgcolor: '#fff3e0' };
  return { color: '#78909c', bgcolor: '#f5f5f5' };
}

interface DateBadgeProps {
  date?: string;
  done?: boolean;
  /** 'sm' for nested items, 'md' for subtasks */
  size?: 'sm' | 'md';
}

export function DateBadge({ date, done, size = 'md' }: DateBadgeProps) {
  if (!date) return null;
  const style = getStyle(date, done);
  const isSm = size === 'sm';

  return (
    <Typography
      component="span"
      sx={{
        fontSize: isSm ? '0.6rem' : '0.64rem',
        fontWeight: 500,
        color: style.color,
        bgcolor: style.bgcolor,
        px: 0.6,
        py: 0.1,
        borderRadius: 0.75,
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
        flexShrink: 0,
        border: '1px solid',
        borderColor: style.color + '22',
      }}
    >
      {formatDate(date)}
    </Typography>
  );
}
