"use client";

import * as React from "react";
import { Activity, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface QuickStatsProps {
  activeProjects: number;
  avgResponseTime: number;
  completionRate: number;
}

export interface ProjectStats {
  completedQuestions: number;
  totalQuestions: number;
  isActive: boolean;
}

/**
 * Calculate the completion rate from project stats
 * Returns a percentage (0-100)
 */
export function calculateCompletionRate(
  completedQuestions: number,
  totalQuestions: number
): number {
  if (totalQuestions === 0) {
    return 0;
  }
  return Math.round((completedQuestions / totalQuestions) * 100);
}

/**
 * Calculate quick stats from an array of project stats
 */
export function calculateQuickStats(projects: ProjectStats[]): QuickStatsProps {
  const activeProjects = projects.filter((p) => p.isActive).length;

  const totalCompleted = projects.reduce(
    (sum, p) => sum + p.completedQuestions,
    0
  );
  const totalQuestions = projects.reduce(
    (sum, p) => sum + p.totalQuestions,
    0
  );

  const completionRate = calculateCompletionRate(totalCompleted, totalQuestions);

  // For now, avgResponseTime is a placeholder - would be calculated from actual response data
  const avgResponseTime = 0;

  return {
    activeProjects,
    avgResponseTime,
    completionRate,
  };
}

export function QuickStats({
  activeProjects,
  avgResponseTime,
  completionRate,
}: QuickStatsProps) {
  return (
    <div
      className="space-y-3 px-3 py-4"
      data-testid="quick-stats"
    >
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
        Quick Stats
      </h3>
      <div className="space-y-2">
        <div
          className={cn(
            "flex items-center justify-between px-2 py-2 rounded-md",
            "bg-muted/50"
          )}
          data-testid="quick-stats-active"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            data-testid="quick-stats-active-value"
          >
            {activeProjects}
          </Badge>
        </div>

        <div
          className={cn(
            "flex items-center justify-between px-2 py-2 rounded-md",
            "bg-muted/50"
          )}
          data-testid="quick-stats-response-time"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">Avg Time</span>
          </div>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            data-testid="quick-stats-response-time-value"
          >
            {avgResponseTime}min
          </Badge>
        </div>

        <div
          className={cn(
            "flex items-center justify-between px-2 py-2 rounded-md",
            "bg-muted/50"
          )}
          data-testid="quick-stats-completion"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-muted-foreground">Complete</span>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
            data-testid="quick-stats-completion-value"
          >
            {completionRate}%
          </Badge>
        </div>
      </div>
    </div>
  );
}
