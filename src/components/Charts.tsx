import { useId, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
interface Props {
  title: string;
  description: string;
  data: ChartRow[];
  activity?: boolean;
  unit?: string;
  players?: PlayerId[];
  max?: number;
  step?: boolean;
}
export default function ChartCard({
  title,
  description,
  data,
  activity = false,
  unit = "P/M",
  players = PLAYERS.map((p) => p.id),
  max,
  step = false,
}: Props) {
  const [hidden, setHidden] = useState<PlayerId[]>([]);
  const id = useId();
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
            {p.dataKey === "count"
              ? "Matcher"
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
              <small>{row[`${p.dataKey as PlayerId}_count`]} matcher</small>
            )}
          </div>
        ))}
      </div>
    );
  };
  const axes = (
    <>
      <CartesianGrid stroke="#354b60" vertical={false} strokeDasharray="3 5" />
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
        tick={{ fill: "#a5b7c9", fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        minTickGap={32}
      />
      <YAxis
        width={35}
        tick={{ fill: "#a5b7c9", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        domain={max ? [0, max] : ["auto", "auto"]}
        allowDecimals={!activity}
      />
      <Tooltip
        content={tooltip}
        cursor={{ stroke: "#a5b7c9", strokeDasharray: "3 3" }}
      />
    </>
  );
  return (
    <section className="card chart-card" aria-labelledby={id}>
      <div className="chart-heading">
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="chart-unit">{activity ? "Matcher" : unit}</span>
      </div>
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
        <Empty title="Inget diagramunderlag">
          Det finns inga matcher för det här urvalet.
        </Empty>
      ) : (
        <>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240} minWidth={0}>
              {activity ? (
                <BarChart
                  data={chartData}
                  accessibilityLayer
                  margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
                >
                  {axes}
                  <Bar
                    dataKey="count"
                    name="Matcher"
                    fill="#bef26d"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive={false}
                  />
                </BarChart>
              ) : (
                <LineChart
                  data={chartData}
                  accessibilityLayer
                  margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
                >
                  {axes}
                  {PLAYERS.filter(
                    (p) => players.includes(p.id) && !hidden.includes(p.id),
                  ).map((p) => (
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
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <details className="chart-data">
            <summary>Visa diagramdata som tabell</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Datum / periodstart</th>
                    {activity ? (
                      <th>Matcher</th>
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
                        <td>{row.count}</td>
                      ) : (
                        players.map((p) => (
                          <td key={p}>
                            {format(row[p])}
                            <small>{row[`${p}_count`]} matcher</small>
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
