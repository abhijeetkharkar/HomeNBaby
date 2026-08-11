import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { useBabyLogs } from '../../hooks/useBabyLogs';
import { DailySummary } from '../../types/baby';

// ── Compact date label for X-axis ────────────────────────────────────────────
function shortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return format(d, 'M/d');        // "7/15"
  } catch { return dateStr; }
}

function dayLabel(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return format(d, 'EEE M/d');    // "Tue 7/15"
  } catch { return dateStr; }
}

// ── Styled summary stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card sx={{
      background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
      border: `1px solid ${color}30`,
      borderRadius: 3,
      boxShadow: 'none',
    }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1.2, mt: 0.3 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared chart styling ─────────────────────────────────────────────────────
const CHART_MARGIN = { top: 8, right: 8, left: -20, bottom: 0 };
const GRID_PROPS = { strokeDasharray: '3 3', vertical: false, stroke: '#f0e6ea' };
const AXIS_STYLE = { fontSize: 11, fill: '#8a7e76', fontFamily: 'Inter, sans-serif' };
const TOOLTIP_STYLE = { contentStyle: { borderRadius: 8, border: '1px solid #f0e6ea', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 } };

const COLORS = {
  wet: '#f57f17',
  dirty: '#e65100',
  feed: '#c2185b',
  feedLine: '#880e4f',
  sleep: '#512da8',
  sleepFill: '#7c6bc4',
};

export function DashboardView() {
  const [range, setRange] = useState<'week' | 'month'>('month');
  const { fetchSummary, loading } = useBabyLogs();
  const [rawData, setRawData] = useState<DailySummary[]>([]);

  useEffect(() => {
    const to = format(new Date(), 'yyyy-MM-dd');
    const from = range === 'week'
      ? format(subDays(new Date(), 7), 'yyyy-MM-dd')
      : format(subDays(new Date(), 30), 'yyyy-MM-dd');

    fetchSummary(from, to).then(res => setRawData(res || []));
  }, [range, fetchSummary]);

  // Transform API data → chart-ready rows
  const chartData = useMemo(() =>
    rawData.map(d => {
      const wet = d.diaperCount?.wet ?? 0;
      const dirty = d.diaperCount?.dirty ?? 0;
      // Consider it a 'tracked' diaper day if at least 3 changes were logged
      const diaperGood = (wet + dirty) >= 3;

      const feedCount = d.feedCount ?? 0;
      const feedMin = d.feedTotalMinutes ?? 0;
      // Consider it a 'tracked' feed day if at least 3 feeds were logged
      const feedGood = feedCount >= 3;

      const sleepHrs = Math.round((d.sleepTotalHours ?? 0) * 10) / 10;
      // Consider it a 'tracked' sleep day if at least 8 hours were logged
      const sleepGood = sleepHrs >= 8;

      return {
        date: d.date,
        label: range === 'week' ? dayLabel(d.date) : shortDate(d.date),
        wet: diaperGood ? wet : null,
        dirty: diaperGood ? dirty : null,
        feedCount: feedGood ? feedCount : null,
        feedMin: feedGood ? feedMin : null,
        sleepHrs: sleepGood ? sleepHrs : null,
        vitD: d.vitaminD,
        massage: d.massage,
        bath: d.bath,
        tummyTime: d.tummyTimeCount ?? 0,
      };
    }),
    [rawData, range],
  );

  // Only include days that have at least SOME good data for averages
  const averages = useMemo(() => {
    const diaperDays = chartData.filter(d => d.wet !== null);
    const feedDays = chartData.filter(d => d.feedCount !== null);
    const sleepDays = chartData.filter(d => d.sleepHrs !== null);
    const tummyDays = chartData.filter(d => d.tummyTime > 0);

    const avg = (arr: (number | null)[]) => {
      const valid = arr.filter((x): x is number => x !== null);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    };

    return {
      avgWet: avg(diaperDays.map(d => d.wet)),
      avgDirty: avg(diaperDays.map(d => d.dirty)),
      avgFeeds: avg(feedDays.map(d => d.feedCount)),
      avgFeedMin: avg(feedDays.map(d => d.feedMin)),
      avgSleep: avg(sleepDays.map(d => d.sleepHrs)),
      avgTummy: avg(tummyDays.map(d => d.tummyTime)),
      diaperDayCount: diaperDays.length,
      feedDayCount: feedDays.length,
      sleepDayCount: sleepDays.length,
      tummyDayCount: tummyDays.length,
    };
  }, [chartData]);

  const fmt = (n: number, decimals = 1) => n.toFixed(decimals);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
        <Typography variant="h5" fontWeight="bold" color="primary.main">
          Dashboard
        </Typography>
        <ToggleButtonGroup
          value={range}
          exclusive
          onChange={(_, val) => val && setRange(val)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 2, py: 0.5, fontSize: '0.8rem', fontWeight: 600, textTransform: 'none',
              '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } },
            },
          }}
        >
          <ToggleButton value="week">7 Days</ToggleButton>
          <ToggleButton value="month">30 Days</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={6}><CircularProgress sx={{ color: 'primary.main' }} /></Box>
      ) : (
        <>
          {/* ── Averages Summary Cards ── */}
          <Grid container spacing={1.5} mb={3}>
            <Grid item xs={6} sm={2.4}>
              <StatCard
                label="Avg Sleep / Day"
                value={averages.sleepDayCount ? `${fmt(averages.avgSleep)}h` : '—'}
                sub={averages.sleepDayCount ? `${averages.sleepDayCount} days with data` : 'No sleep data'}
                color={COLORS.sleep}
              />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <StatCard
                label="Avg Feeds / Day"
                value={averages.feedDayCount ? fmt(averages.avgFeeds, 0) : '—'}
                sub={averages.feedDayCount ? `~${fmt(averages.avgFeedMin, 0)} min total` : undefined}
                color={COLORS.feed}
              />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <StatCard
                label="Avg Wet / Day"
                value={averages.diaperDayCount ? fmt(averages.avgWet) : '—'}
                sub={averages.diaperDayCount ? `${averages.diaperDayCount} days tracked` : 'No data'}
                color={COLORS.wet}
              />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <StatCard
                label="Avg Dirty / Day"
                value={averages.diaperDayCount ? fmt(averages.avgDirty) : '—'}
                sub={averages.diaperDayCount ? `${averages.diaperDayCount} days tracked` : 'No data'}
                color={COLORS.dirty}
              />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <StatCard
                label="Avg Tummy / Day"
                value={averages.tummyDayCount ? fmt(averages.avgTummy) : '—'}
                sub={averages.tummyDayCount ? `${averages.tummyDayCount} days tracked` : 'No data'}
                color="#2e7d32"
              />
            </Grid>
          </Grid>

          {/* ── Charts ── */}
          <Grid container spacing={2.5}>
            {/* Diapers */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f0e6ea' }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary" mb={1.5}>
                    🧷 Diapers
                  </Typography>
                  <Box height={240}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={CHART_MARGIN}>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                        <RechartsTooltip {...TOOLTIP_STYLE} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="wet" stackId="d" fill={COLORS.wet} name="Wet" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="dirty" stackId="d" fill={COLORS.dirty} name="Dirty" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Sleep */}
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f0e6ea' }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary" mb={1.5}>
                    😴 Sleep (hours)
                  </Typography>
                  <Box height={240}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={CHART_MARGIN}>
                        <defs>
                          <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.sleepFill} stopOpacity={0.35}/>
                            <stop offset="95%" stopColor={COLORS.sleepFill} stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} unit="h" />
                        <RechartsTooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v}h`, 'Sleep']} />
                        <Area type="monotone" dataKey="sleepHrs" stroke={COLORS.sleep} strokeWidth={2.5} fillOpacity={1} fill="url(#sleepGrad)" dot={{ r: 3, fill: COLORS.sleep, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Feeding */}
            <Grid item xs={12}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f0e6ea' }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary" mb={1.5}>
                    🤱 Feeding
                  </Typography>
                  <Box height={260}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={CHART_MARGIN}>
                        <defs>
                          <linearGradient id="feedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLORS.feed} stopOpacity={0.9}/>
                            <stop offset="100%" stopColor={COLORS.feed} stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" tick={AXIS_STYLE} tickLine={false} axisLine={false} label={{ value: 'min', position: 'insideTopLeft', offset: 10, style: { fontSize: 10, fill: '#8a7e76' } }} />
                        <YAxis yAxisId="right" orientation="right" tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: 'sessions', position: 'insideTopRight', offset: 10, style: { fontSize: 10, fill: '#8a7e76' } }} />
                        <RechartsTooltip {...TOOLTIP_STYLE} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="feedMin" fill="url(#feedGrad)" name="Total Minutes" radius={[4, 4, 0, 0]} barSize={range === 'month' ? 8 : 20} />
                        <Line yAxisId="right" type="monotone" dataKey="feedCount" stroke={COLORS.feedLine} strokeWidth={2} dot={{ r: 3, fill: COLORS.feedLine, strokeWidth: 0 }} name="Sessions" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
