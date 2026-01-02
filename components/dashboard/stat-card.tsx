"use client";

import * as React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: "blue" | "emerald" | "amber" | "rose";
}

const colorVariants = {
  blue: {
    gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  emerald: {
    gradient: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    gradient: "from-amber-500 to-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    gradient: "from-rose-500 to-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-600 dark:text-rose-400",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  color = "blue",
}: StatCardProps) {
  const colorClasses = colorVariants[color];

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-lg",
        "border border-border/50"
      )}
      data-testid="stat-card"
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <p
              className="text-sm font-medium text-muted-foreground"
              data-testid="stat-card-title"
            >
              {title}
            </p>
            <p
              className="text-3xl font-bold tracking-tight"
              data-testid="stat-card-value"
            >
              {value}
            </p>
            {subtitle && (
              <p
                className="text-sm text-muted-foreground"
                data-testid="stat-card-subtitle"
              >
                {subtitle}
              </p>
            )}
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  trendUp
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
                data-testid="stat-card-trend"
              >
                {trendUp ? (
                  <TrendingUp
                    className="h-4 w-4"
                    data-testid="trend-up-icon"
                  />
                ) : (
                  <TrendingDown
                    className="h-4 w-4"
                    data-testid="trend-down-icon"
                  />
                )}
                <span data-testid="stat-card-trend-value">{trend}</span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br",
              colorClasses.gradient
            )}
            data-testid="stat-card-icon-container"
          >
            <Icon className="h-6 w-6 text-white" data-testid="stat-card-icon" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
