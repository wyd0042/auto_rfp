"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Clock,
  CheckCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  StatCard,
  PerformanceChart,
  StatusDistributionChart,
  RecentProjectsList,
  type PerformanceChartData,
  type StatusDistributionData,
  type RecentProject,
} from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ProjectWithStats {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  questions?: Array<{
    id: string;
    answer?: {
      id: string;
      text: string;
    } | null;
  }>;
}

interface DashboardStats {
  activeProjects: number;
  totalProjects: number;
  avgResponseTime: number;
  completionRate: number;
  questionsAnswered: number;
  totalQuestions: number;
}

// Status colors for the pie chart
const STATUS_COLORS = {
  draft: "#9ca3af",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  completed: "#10b981",
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();

      if (data.success) {
        setProjects(data.data);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch projects",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Calculate dashboard statistics
  const calculateStats = useCallback((): DashboardStats => {
    const totalProjects = projects.length;
    // For now, consider all projects as "active" since we don't have a status field
    const activeProjects = totalProjects;

    let totalQuestions = 0;
    let questionsAnswered = 0;

    projects.forEach((project) => {
      if (project.questions) {
        totalQuestions += project.questions.length;
        questionsAnswered += project.questions.filter(
          (q) => q.answer && q.answer.text
        ).length;
      }
    });

    const completionRate =
      totalQuestions > 0
        ? Math.round((questionsAnswered / totalQuestions) * 100)
        : 0;

    // Placeholder for avg response time - would need actual timing data
    const avgResponseTime = 8;

    return {
      activeProjects,
      totalProjects,
      avgResponseTime,
      completionRate,
      questionsAnswered,
      totalQuestions,
    };
  }, [projects]);

  // Generate performance chart data (mock data for now - would come from actual metrics)
  const generatePerformanceData = useCallback((): PerformanceChartData[] => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((month, index) => ({
      month,
      responseTime: Math.max(5, 12 - index * 0.8 + Math.random() * 2),
      completionRate: Math.min(100, 50 + index * 8 + Math.random() * 5),
    }));
  }, []);

  // Calculate status distribution
  const calculateStatusDistribution =
    useCallback((): StatusDistributionData[] => {
      // Since projects don't have a status field, we'll derive status from completion
      const statusCounts = {
        draft: 0,
        in_progress: 0,
        review: 0,
        completed: 0,
      };

      projects.forEach((project) => {
        if (!project.questions || project.questions.length === 0) {
          statusCounts.draft++;
        } else {
          const answered = project.questions.filter(
            (q) => q.answer && q.answer.text
          ).length;
          const total = project.questions.length;
          const percentage = (answered / total) * 100;

          if (percentage === 0) {
            statusCounts.draft++;
          } else if (percentage < 50) {
            statusCounts.in_progress++;
          } else if (percentage < 100) {
            statusCounts.review++;
          } else {
            statusCounts.completed++;
          }
        }
      });

      return [
        { name: "Draft", value: statusCounts.draft, color: STATUS_COLORS.draft },
        {
          name: "In Progress",
          value: statusCounts.in_progress,
          color: STATUS_COLORS.in_progress,
        },
        {
          name: "Review",
          value: statusCounts.review,
          color: STATUS_COLORS.review,
        },
        {
          name: "Completed",
          value: statusCounts.completed,
          color: STATUS_COLORS.completed,
        },
      ].filter((item) => item.value > 0);
    }, [projects]);

  // Convert projects to recent projects format
  const getRecentProjects = useCallback((): RecentProject[] => {
    return projects.map((project) => {
      // Derive status from completion percentage
      let status = "draft";
      if (project.questions && project.questions.length > 0) {
        const answered = project.questions.filter(
          (q) => q.answer && q.answer.text
        ).length;
        const total = project.questions.length;
        const percentage = (answered / total) * 100;

        if (percentage === 0) {
          status = "draft";
        } else if (percentage < 50) {
          status = "in_progress";
        } else if (percentage < 100) {
          status = "review";
        } else {
          status = "completed";
        }
      }

      return {
        id: project.id,
        name: project.name,
        client: project.organization?.name || "Unknown",
        status,
        updatedAt: new Date(project.updatedAt),
      };
    });
  }, [projects]);

  const stats = calculateStats();
  const performanceData = generatePerformanceData();
  const statusDistribution = calculateStatusDistribution();
  const recentProjects = getRecentProjects();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (projects.length === 0) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="py-6 px-4 sm:px-6 pt-20">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your RFP projects and performance metrics
            </p>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Projects"
              value={stats.activeProjects}
              subtitle={`${stats.totalProjects} total`}
              icon={FolderOpen}
              trend="+12%"
              trendUp={true}
              color="blue"
            />
            <StatCard
              title="Avg Response Time"
              value={`${stats.avgResponseTime}min`}
              subtitle="Per question"
              icon={Clock}
              trend="-8%"
              trendUp={true}
              color="amber"
            />
            <StatCard
              title="Completion Rate"
              value={`${stats.completionRate}%`}
              subtitle="Questions answered"
              icon={CheckCircle}
              trend="+5%"
              trendUp={true}
              color="emerald"
            />
            <StatCard
              title="Questions Answered"
              value={stats.questionsAnswered}
              subtitle={`${stats.totalQuestions} total`}
              icon={MessageSquare}
              trend="+23%"
              trendUp={true}
              color="rose"
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PerformanceChart
              data={performanceData}
              title="Performance Trends"
            />
            <StatusDistributionChart
              data={statusDistribution}
              title="Project Status Distribution"
            />
          </div>

          {/* Recent Projects */}
          <RecentProjectsList projects={recentProjects} maxItems={5} />
        </div>
      </div>
    </div>
  );
}

// Skeleton loader component for loading state
function DashboardSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="py-6 px-4 sm:px-6 pt-20">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>

          {/* KPI Cards skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts skeleton */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-40 mb-4" />
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          </div>

          {/* Recent projects skeleton */}
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-36 mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Empty state component
function DashboardEmptyState() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="py-6 px-4 sm:px-6 pt-20">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your RFP projects and performance metrics
            </p>
          </div>

          {/* Empty state card */}
          <Card className="text-center p-12">
            <CardContent className="space-y-4">
              <FolderOpen className="mx-auto h-16 w-16 text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold">No projects yet</h3>
                <p className="text-muted-foreground mt-2">
                  Create your first project to see dashboard analytics and
                  performance metrics.
                </p>
              </div>
              <Button
                onClick={() => (window.location.href = "/organizations")}
                className="mt-4"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Go to Organizations
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
