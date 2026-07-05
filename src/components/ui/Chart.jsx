'use client';

import { forwardRef, useId } from 'react';
import { ResponsiveContainer } from 'recharts';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const ChartContainer = forwardRef(function ChartContainer(
  { children, className = '', config = {}, style, ...props },
  ref
) {
  const id = useId().replaceAll(':', '');
  const colorVars = Object.fromEntries(
    Object.entries(config)
      .filter(([, item]) => item?.color)
      .map(([key, item]) => [`--color-${key}`, item.color])
  );

  return (
    <div
      className={cx('chart-container', className)}
      data-chart={id}
      ref={ref}
      style={{ ...colorVars, ...style }}
      {...props}
    >
      <ResponsiveContainer>
        {children}
      </ResponsiveContainer>
    </div>
  );
});

export function ChartTooltipContent({
  active,
  config = {},
  label,
  labelFormatter,
  payload,
  valueFormatter,
}) {
  if (!active || !payload?.length) return null;

  const labelText = labelFormatter ? labelFormatter(label, payload) : label;
  const rows = sortPayloadByConfig(payload, config).filter((item) => Number(item.value ?? 0) > 0);

  return (
    <div className="chart-tooltip-content">
      {labelText ? <div className="chart-tooltip-label">{labelText}</div> : null}
      <div className="chart-tooltip-list">
        {rows.map((item) => {
          const key = item.dataKey;
          const entry = config[key] ?? {};
          const color = item.color ?? item.fill ?? entry.color;
          const value = valueFormatter ? valueFormatter(item.value, key, item) : item.value;

          return (
            <div className="chart-tooltip-row" key={key}>
              <span className="chart-tooltip-swatch" style={{ background: color }} />
              <span className="chart-tooltip-name">{entry.label ?? item.name ?? key}</span>
              <strong>{value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendContent({ config = {}, payload }) {
  if (!payload?.length) return null;

  return (
    <div className="chart-legend-content">
      {sortPayloadByConfig(payload, config).map((item) => {
        const key = item.dataKey ?? item.value;
        const entry = config[key] ?? {};
        const color = item.color ?? entry.color;

        return (
          <span className="chart-legend-item" key={key}>
            <span className="chart-legend-swatch" style={{ background: color }} />
            {entry.label ?? item.value}
          </span>
        );
      })}
    </div>
  );
}

function sortPayloadByConfig(payload, config) {
  const order = Object.keys(config);
  return [...payload].sort((a, b) => {
    const keyA = a.dataKey ?? a.value;
    const keyB = b.dataKey ?? b.value;
    const indexA = order.indexOf(keyA);
    const indexB = order.indexOf(keyB);

    return normalizeOrderIndex(indexA) - normalizeOrderIndex(indexB);
  });
}

function normalizeOrderIndex(index) {
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}
