"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserSection } from "@/components/user-section";
import { OrganizationProjectSwitcher } from "@/components/organization-project-switcher";
import { QuickStats, calculateQuickStats, type ProjectStats } from "@/components/dashboard/quick-stats";
import { useOrganization } from "@/context/organization-context";
import { 
  FileText, 
  Home, 
  Settings, 
  Users,
  HelpCircle,
  Building2,
  FolderOpen,
  MessageSquare,
  BookOpen,
  LayoutDashboard
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * AI4RFP Logo component with gradient styling
 */
function AI4RFPLogo() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  
  return (
    <div className="flex items-center gap-3 px-2 py-3" data-testid="ai4rfp-branding">
      <div 
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-blue-500 to-cyan-400 text-white font-bold text-sm shadow-md"
        data-testid="ai4rfp-logo"
      >
        AI
      </div>
      {!collapsed && (
        <div className="flex flex-col group-data-[collapsible=icon]:hidden" data-testid="ai4rfp-text">
          <span className="font-bold text-lg leading-tight" data-testid="ai4rfp-brand-name">AI4RFP</span>
          <span className="text-xs text-muted-foreground" data-testid="ai4rfp-subtitle">RFP Response Platform</span>
        </div>
      )}
    </div>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { currentProject, currentOrganization } = useOrganization();
  
  // State for quick stats
  const [quickStats, setQuickStats] = useState({
    activeProjects: 0,
    avgResponseTime: 0,
    completionRate: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch projects and calculate quick stats
  const fetchQuickStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await fetch("/api/projects");
      const data = await response.json();

      if (data.success && data.data) {
        const projectStats: ProjectStats[] = data.data.map((project: {
          questions?: Array<{
            id: string;
            answer?: { id: string; text: string } | null;
          }>;
        }) => {
          const totalQuestions = project.questions?.length || 0;
          const completedQuestions = project.questions?.filter(
            (q) => q.answer && q.answer.text
          ).length || 0;
          
          return {
            completedQuestions,
            totalQuestions,
            isActive: true, // Consider all projects as active for now
          };
        });

        const stats = calculateQuickStats(projectStats);
        setQuickStats(stats);
      }
    } catch (error) {
      console.error("Failed to fetch quick stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch stats on mount and when organization changes
  useEffect(() => {
    fetchQuickStats();
  }, [fetchQuickStats, currentOrganization]);

  // Determine current context based on URL and context
  const getRouteContext = () => {
    // Check if we're in a project-specific route
    if (pathname.includes('/projects/') && currentProject) {
      return {
        type: 'project',
        id: currentProject.id,
        name: currentProject.name
      };
    }
    
    
    // Check if we're in an organization-specific route
    if ((pathname.includes('/org/') || pathname.includes('/organizations/')) && currentOrganization) {
      return {
        type: 'organization', 
        id: currentOrganization.id,
        name: currentOrganization.name,
        slug: currentOrganization.slug
      };
    }
    
    return { type: 'global' };
  };

  const routeContext = getRouteContext();

  // Extract orgId from URL if we're in org routes
  const getOrgIdFromPath = () => {
    const orgMatch = pathname.match(/\/org\/([^\/]+)/);
    if (orgMatch) return orgMatch[1];
    
    const slugMatch = pathname.match(/\/organizations\/([^\/]+)/);
    if (slugMatch) return slugMatch[1];
    
    return null;
  };


  // Organization-level navigation items
  const getOrganizationNavigationItems = (orgId: string) => [
    {
      title: "Organization",
      items: [
        {
          title: "Projects",
          url: `/organizations/${orgId}`,
          icon: FolderOpen,
        },
        {
          title: "Knowledge Base",
          url: `/organizations/${orgId}/knowledge-base`,
          icon: BookOpen,
        },
        {
          title: "Team",
          url: `/organizations/${orgId}/team`,
          icon: Users,
        },
        {
          title: "Settings",
          url: `/organizations/${orgId}/settings`,
          icon: Settings,
        },
      ],
    },
  ];

  // Project-scoped navigation items  
  const getProjectNavigationItems = (projectId: string) => [
    {
      title: "Project",
      items: [
        {
          title: "Dashboard",
          url: `/projects/${projectId}`,
          icon: Home,
        },
        {
          title: "Questions",
          url: `/projects/${projectId}/questions`,
          icon: MessageSquare,
        },
        {
          title: "Documents",
          url: `/projects/${projectId}/documents`,
          icon: FileText,
        },
      ],
    },
  ];

  // Get navigation items based on current context
  const getNavigationItems = () => {
    if (routeContext.type === 'project' && currentProject) {
      return getProjectNavigationItems(currentProject.id);
    } else if (routeContext.type === 'organization') {
      const orgId = getOrgIdFromPath();
      if (orgId) {
        return getOrganizationNavigationItems(orgId);
      }
    }
    return [];
  };

  const contextNavigationItems = getNavigationItems();

  // Global navigation items - always visible
  const globalNavigationItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  return (
    <Sidebar variant="inset" collapsible="icon" className="border-r h-full">
      <SidebarHeader>
        <AI4RFPLogo />
        <SidebarSeparator className="my-2" />
        <OrganizationProjectSwitcher />
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <SidebarMenu>
          {/* Global navigation - Dashboard first */}
          <SidebarMenuSub>
            {globalNavigationItems.map((item) => (
              <SidebarMenuSubItem key={item.title}>
                <SidebarMenuSubButton 
                  asChild 
                  isActive={pathname === item.url}
                  data-testid={`nav-item-${item.title.toLowerCase()}`}
                >
                  <Link href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
          <SidebarSeparator className="my-2" />

          {/* Context-specific navigation (organization or project) */}
          {contextNavigationItems.map((group) => (
            <div key={group.title}>
              <SidebarMenuSub>
                {group.items.map((item) => (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton 
                      asChild 
                      isActive={
                        pathname === item.url ||
                        (item.url.includes('?') && pathname === item.url.split('?')[0] && 
                         typeof window !== 'undefined' && window.location.search.includes(item.url.split('?')[1]))
                      }
                    >
                      <Link href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
              <SidebarSeparator className="my-2" />
            </div>
          ))}

          
          {/* Context indicator */}
          {routeContext.type === 'global' && (
            <div className="px-4 py-2">
              <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Building2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="font-medium mb-1">No Context Selected</p>
                <p className="text-xs">Choose an organization or project to access specific tools</p>
              </div>
            </div>
          )}
        </SidebarMenu>
        
        {/* Quick Stats Section */}
        {!statsLoading && (
          <QuickStats
            activeProjects={quickStats.activeProjects}
            avgResponseTime={quickStats.avgResponseTime}
            completionRate={quickStats.completionRate}
          />
        )}
      </SidebarContent>

      <SidebarFooter>
        <UserSection />
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/help">
                <HelpCircle className="size-4" />
                <span>Help & Support</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

interface SidebarLayoutProps {
  children: ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        
        <AppSidebar />
        
        {/* Main content area with independent scrolling */}
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          {/* Fixed header */}
          <header className="flex h-16 shrink-0 items-center border-b bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
            </div>
          </header>
          
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
        
      </SidebarProvider>
    </TooltipProvider>
  );
} 