import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import { ScoreBin } from '../types/analyzer';

interface ScoreChartProps {
  title: string;
  subtitle: string;
  bins: ScoreBin[];
  maxMarks: number;
  colorScheme?: 'indigo' | 'emerald' | 'blue' | 'purple' | 'amber' | 'technical';
  height?: number;
}

export const ScoreChart: React.FC<ScoreChartProps> = ({
  title,
  subtitle,
  bins,
  maxMarks,
  colorScheme = 'blue',
  height = 240,
}) => {
  const totalStudentsInBins = bins.reduce((sum, b) => sum + b.count, 0);

  const getBarColor = (count: number) => {
    if (count === 0) return '#f1f5f9';
    switch (colorScheme) {
      case 'emerald':
        return '#059669'; // Emerald-600
      case 'amber':
        return '#d97706'; // Amber-600
      case 'purple':
        return '#7c3aed'; // Purple-600
      case 'indigo':
        return '#4f46e5';
      case 'blue':
      default:
        return '#2563eb';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: ScoreBin = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 pointer-events-none z-50">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Marks Range</span>
            <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40">
              {data.rangeLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-slate-300">Students Scored:</span>
            <span className="font-bold text-white font-mono">
              {data.count} <span className="text-slate-400 font-normal">({data.percentage}%)</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1">
            Max Scale: {maxMarks} Marks
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between relative shadow-xs hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3">
        <div>
          <div className="col-header text-[11px] text-slate-400 font-semibold">{title}</div>
          <h4 className="text-sm font-bold text-slate-900">{subtitle}</h4>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-semibold border border-slate-200">
          Max: {maxMarks}
        </span>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bins}
            margin={{ top: 20, right: 15, left: -10, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="rangeLabel"
              tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={32}
              label={{ value: 'Marks Range →', position: 'insideBottomRight', offset: -5, fontSize: 9, fill: '#64748b', fontWeight: 600 }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              label={{ value: 'Students', angle: -90, position: 'insideLeft', offset: 12, fontSize: 9, fill: '#64748b', fontWeight: 600 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)', radius: 6 }} />
            <Bar
              dataKey="count"
              radius={[6, 6, 0, 0]}
              animationDuration={600}
            >
              <LabelList
                dataKey="count"
                position="top"
                formatter={(val: number) => (val > 0 ? val : '')}
                style={{ fill: '#475569', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
              />
              {bins.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.count)}
                  className="transition-all duration-200 hover:opacity-85"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>Total Scored: <strong className="text-slate-900 font-semibold">{totalStudentsInBins}</strong></span>
        <span>Granularity: <strong className="text-slate-900 font-semibold">{bins.length} Bins</strong></span>
      </div>
    </div>
  );
};


