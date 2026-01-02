"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatusDistributionData {
  name: string;
  value: number;
  color: string;
}

export interface StatusDistributionChartProps {
  data: StatusDistributionData[];
  title?: string;
}

/**
 * Calculate the total count from status distribution data
 */
export function calculateTotalFromDistribution(
  data: StatusDistributionData[]
): number {
  return data.reduce((sum, item) => sum + item.value, 0);
}

/**
 * Validate that the distribution data is accurate
 * (sum of segments equals total projects)
 */
export function validateDistributionAccuracy(
  data: StatusDistributionData[],
  expectedTotal: number
): boolean {
  const actualTotal = calculateTotalFromDistribution(data);
  return actualTotal === expectedTotal;
}

export function StatusDistributionChart({
  data,
  title = "Project Status Distribution",
}: StatusDistributionChartProps) {
  const total = calculateTotalFromDistribution(data);

  return (
    <Card className="w-full" data-testid="status-distribution-chart">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number, name: string) => [
                  `${value} projects`,
                  name,
                ]}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  paddingTop: "20px",
                }}
                formatter={(value, entry) => (
                  <span style={{ color: "hsl(var(--foreground))" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Total Projects: {total}
        </div>
      </CardContent>
    </Card>
  );
}
