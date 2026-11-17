import { useId, useState } from "react";
import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { TooltipContentProps, TooltipValueType } from "recharts";
import { PLAYERS, dateLabel, format } from "../lib/domain";
import type { PlayerId } from "../lib/domain";
import type { ChartRow } from "../lib/statistics";
import { Empty } from "./ui";
import { useStatisticsBuild } from "./StatisticsMotion";
interface Props {
  title: string;
  description?: string;
  data: ChartRow[];
  activity?: boolean;
  activityMetric?: "breaks" | "matches";
  matchSample?: boolean;
  controls?: ReactNode;
  unit?: string;
  players?: PlayerId[];
  max?: number;
  step?: boolean;
  height?: number;
  filled?: boolean;
  build?: boolean;
}
export default function ChartCard({
  title,
  description,
  data,
  activity = false,
  activityMetric = "breaks",
  matchSample = false,
  controls,
  unit = "P/R",
  players = PLAYERS.map((p) => p.id),
  max,
  step = false,
  height = 240,
  filled = false,
  build = false,
}: Props) {
  const { ref, ready, motion } = useStatisticsBuild<HTMLElement>(build);
  const animate = build && ready && motion;
  const [hidden, setHidden] = useState<PlayerId[]>([]);
  const activityLabel = activityMetric === "breaks" ? "Raster" : "Matcher";
  const activityKey = activityMetric === "breaks" ? "count" : "matchesPlayed";
  const sample = (row: ChartRow, p: PlayerId) =>
    `${row[`${p}_count`]} raster${matchSample ? ` · ${row[`${p}_matches`]} matcher` : ""}`;
  const id = useId();
  const TrendChart = filled ? ComposedChart : LineChart;
  const gradientId = (p: PlayerId) => `trend-${id.replace(/:/g, "")}-${p}`;
  const chartData = data.map((row) => ({
    ...row,
    time: Date.parse(row.date + "T12:00:00Z"),
  }));
  const crossesYears =
    data.length > 1 &&
    data[0].date.slice(0, 4) !== data.at(-1)!.date.slice(0, 4);
  const label = (timestamp: number) =>
    new Intl.DateTimeFormat("sv-SE", {
      day: "numeric",
      month: "short",
      ...(crossesYears ? { year: "2-digit" as const } : {}),
      timeZone: "UTC",
    }).format(new Date(timestamp));
  const tooltip = ({
    active,
    payload,
  }: TooltipContentProps<TooltipValueType, number | string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <strong>{row?.date ? dateLabel(row.date) : ""}</strong>
        {payload.map((p) => (
          <div key={String(p.dataKey)}>
            {activity
              ? activityLabel
              : PLAYERS.find((x) => x.id === p.dataKey)?.name}
            :{" "}
            <b>
              {format(
                typeof p.value === "number" ? p.value : null,
                activity ? 0 : 2,
              )}
            </b>{" "}
            {activity ? "" : unit}
            {!activity && row && (
              <small>{sample(row, p.dataKey as PlayerId)}</small>
            )}
          </div>
        ))}
      </div>
    );
  };
  const axes = (
    <>
      <CartesianGrid
        stroke="var(--line)"
        vertical={false}
        strokeDasharray="3 5"
      />
      <XAxis
        dataKey="time"
        type="number"
        scale="time"
        domain={
          chartData.length === 1
            ? [chartData[0].time - 86400000, chartData[0].time + 86400000]
            : ["dataMin", "dataMax"]
        }
        ticks={chartData.map((row) => row.time)}
        padding={{ left: 12, right: 12 }}
        tickFormatter={label}
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        minTickGap={32}
      />
      <YAxis
        width={35}
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        domain={max ? [0, max] : activity ? [0, "auto"] : ["auto", "auto"]}
        allowDecimals={!activity}
      />
      <Tooltip
        content={tooltip}
        payloadUniqBy={(entry) => entry.dataKey}
        cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
      />
    </>
  );
  return (
    <section
      ref={ref}
      className={`card chart-card${build ? " stats-build stats-chart-build" : ""}`}
      data-built={ready || undefined}
      aria-labelledby={id}
    >
      <div className="chart-heading">
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span className="chart-unit">{activity ? activityLabel : unit}</span>
      </div>
      {controls}
      {!activity && (
        <div className="chart-legend" aria-label="Visa eller dölj spelare">
          {PLAYERS.filter((p) => players.includes(p.id)).map((p) => (
            <button
              key={p.id}
              aria-pressed={!hidden.includes(p.id)}
              onClick={() =>
                setHidden((h) =>
                  h.includes(p.id) ? h.filter((x) => x !== p.id) : [...h, p.id],
                )
              }
              className={hidden.includes(p.id) ? "hidden-series" : ""}
            >
              <i style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      {!data.length ? (
        <Empty title="Inga raster i urvalet" />
      ) : (
        <>
          <div className="chart-container" style={{ height }}>
            <ResponsiveContainer
              key={ready ? "ready" : "waiting"}
              width="100%"
              height={height}
              minWidth={0}
            >
              {activity ? (
                <BarChart
                  data={chartData}
                  accessibilityLayer
                  margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
                >
                  {axes}
                  <Bar
                    dataKey={activityKey}
                    name={activityLabel}
                    fill="var(--accent)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive={animate}
                    animationDuration={760}
                    animationEasing="ease-out"
                  />
                </BarChart>
              ) : (
                <TrendChart
                  data={chartData}
                  accessibilityLayer
                  margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
                >
                  {filled && (
                    <defs>
                      {PLAYERS.map((p) => (
                        <linearGradient
                          key={p.id}
                          id={gradientId(p.id)}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={p.color}
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="100%"
                            stopColor={p.color}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      ))}
                    </defs>
                  )}
                  {axes}
                  {filled &&
                    PLAYERS.filter(
                      (p) => players.includes(p.id) && !hidden.includes(p.id),
                    ).map((p) => (
                      <Area
                        key={`area-${p.id}`}
                        type={step ? "stepAfter" : "linear"}
                        dataKey={p.id}
                        stroke="none"
                        fill={`url(#${gradientId(p.id)})`}
                        tooltipType="none"
                        legendType="none"
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  {PLAYERS.filter(
                    (p) => players.includes(p.id) && !hidden.includes(p.id),
                  ).map((p, index) => (
                    <Line
                      key={p.id}
                      dataKey={p.id}
                      name={p.name}
                      stroke={p.color}
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                      type={step ? "stepAfter" : "linear"}
                      isAnimationActive={animate}
                      animationBegin={index * 60}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  ))}
                </TrendChart>
              )}
            </ResponsiveContainer>
          </div>
          <details className="chart-data">
            <summary>Visa som tabell</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Datum / periodstart</th>
                    {activity ? (
                      <th>{activityLabel}</th>
                    ) : (
                      players.map((p) => (
                        <th key={p}>
                          {PLAYERS.find((x) => x.id === p)!.name}
                          <small>{unit} · underlag</small>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.date}>
                      <th>{row.date}</th>
                      {activity ? (
                        <td>{row[activityKey]}</td>
                      ) : (
                        players.map((p) => (
                          <td key={p}>
                            {format(row[p])}
                            <small>{sample(row, p)}</small>
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
