// Dashboard components barrel export
export { StatCard, type StatCardProps } from "./stat-card";
export {
  PerformanceChart,
  type PerformanceChartProps,
  type PerformanceChartData,
} from "./performance-chart";
export {
  StatusDistributionChart,
  type StatusDistributionChartProps,
  type StatusDistributionData,
  calculateTotalFromDistribution,
  validateDistributionAccuracy,
} from "./status-distribution-chart";
export {
  RecentProjectsList,
  type RecentProjectsListProps,
  type RecentProject,
  sortProjectsByRecent,
  getRecentProjects,
} from "./recent-projects-list";
export {
  QuickStats,
  type QuickStatsProps,
  type ProjectStats,
  calculateCompletionRate,
  calculateQuickStats,
} from "./quick-stats";
