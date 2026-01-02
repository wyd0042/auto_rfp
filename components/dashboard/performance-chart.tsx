"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PerformanceChartData {
  month: string;
  responseTime: number;
  completionRate: number;
}

export interface PerformanceChartProps {
  data: PerformanceChartData[];
  title?: string;
}

export function PerformanceChart({
  data,
  title = "Performance Trends",
}: PerformanceChartProps) {
  return (
    <Card className="w-full" data-testid="performance-chart">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs text-muted-foreground"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="left"
                className="text-xs text-muted-foreground"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "Response Time (min)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-xs text-muted-foreground"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                domain={[0, 100]}
                label={{
                  value: "Completion Rate (%)",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "20px",
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="responseTime"
                name="Response Time"
                stroke="hsl(var(--chart-1, 220 70% 50%))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-1, 220 70% 50%))", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="completionRate"
                name="Completion Rate"
                stroke="hsl(var(--chart-2, 160 60% 45%))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-2, 160 60% 45%))", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
