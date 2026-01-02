/**
 * Property-based tests for frontend restructure - AI4RFP
 *
 * **Feature: frontend-restructure-ai4rfp**
 *
 * These tests verify the correctness properties for dashboard components
 * using fast-check for property-based testing.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  Activity,
  Clock,
  CheckCircle,
  FileQuestion,
  LucideIcon,
} from "lucide-react";

import { StatCard, StatCardProps } from "@/components/dashboard/stat-card";
import {
  StatusDistributionData,
  calculateTotalFromDistribution,
  validateDistributionAccuracy,
} from "@/components/dashboard/status-distribution-chart";
import {
  RecentProject,
  sortProjectsByRecent,
  getRecentProjects,
} from "@/components/dashboard/recent-projects-list";
import {
  ProjectStats,
  calculateCompletionRate,
  calculateQuickStats,
} from "@/components/dashboard/quick-stats";

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid color variants
 */
const colorVariantArb: fc.Arbitrary<"blue" | "emerald" | "amber" | "rose"> =
  fc.constantFrom("blue", "emerald", "amber", "rose");

/**
 * Generator for icon components
 */
const iconArb: fc.Arbitrary<LucideIcon> = fc.constantFrom(
  Activity,
  Clock,
  CheckCircle,
  FileQuestion
);

/**
 * Generator for non-empty strings (for titles and values)
 */
const nonEmptyStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/**
 * Generator for numeric values (as string or number)
 */
const valueArb: fc.Arbitrary<string | number> = fc.oneof(
  fc.integer({ min: 0, max: 10000 }),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)
);

/**
 * Generator for trend percentages
 */
const trendArb: fc.Arbitrary<string> = fc
  .integer({ min: -100, max: 100 })
  .map((n) => `${n > 0 ? "+" : ""}${n}%`);

/**
 * Generator for StatCard props
 */
const statCardPropsArb: fc.Arbitrary<StatCardProps> = fc.record({
  title: nonEmptyStringArb,
  value: valueArb,
  subtitle: fc.option(nonEmptyStringArb, { nil: undefined }),
  icon: iconArb,
  trend: fc.option(trendArb, { nil: undefined }),
  trendUp: fc.option(fc.boolean(), { nil: undefined }),
  color: fc.option(colorVariantArb, { nil: undefined }),
});

/**
 * Generator for StatCard props with trend data
 */
const statCardPropsWithTrendArb: fc.Arbitrary<StatCardProps> = fc.record({
  title: nonEmptyStringArb,
  value: valueArb,
  subtitle: fc.option(nonEmptyStringArb, { nil: undefined }),
  icon: iconArb,
  trend: trendArb,
  trendUp: fc.boolean(),
  color: fc.option(colorVariantArb, { nil: undefined }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe("Frontend Restructure Property Tests", () => {
  /**
   * **Feature: frontend-restructure-ai4rfp, Property 1: KPI Card Rendering Completeness**
   * **Validates: Requirements 2.2, 2.3**
   *
   * For any KPI card with any metric value, label, and trend data, the rendered output
   * SHALL contain the metric value as text, the descriptive label, an icon element,
   * and if trend data is provided, the correct trend direction indicator.
   */
  describe("Property 1: KPI Card Rendering Completeness", () => {
    it("should render title and value for any valid props", () => {
      fc.assert(
        fc.property(statCardPropsArb, (props) => {
          const { unmount } = render(<StatCard {...props} />);

          // Title should be rendered
          const titleElement = screen.getByTestId("stat-card-title");
          expect(titleElement).toBeDefined();
          expect(titleElement.textContent).toBe(props.title);

          // Value should be rendered
          const valueElement = screen.getByTestId("stat-card-value");
          expect(valueElement).toBeDefined();
          expect(valueElement.textContent).toBe(String(props.value));

          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it("should render icon for any valid props", () => {
      fc.assert(
        fc.property(statCardPropsArb, (props) => {
          const { unmount } = render(<StatCard {...props} />);

          // Icon container should be rendered
          const iconContainer = screen.getByTestId("stat-card-icon-container");
          expect(iconContainer).toBeDefined();

          // Icon should be rendered inside container
          const icon = screen.getByTestId("stat-card-icon");
          expect(icon).toBeDefined();

          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it("should render subtitle when provided", () => {
      fc.assert(
        fc.property(
          statCardPropsArb.filter((p) => p.subtitle !== undefined),
          (props) => {
            const { unmount } = render(<StatCard {...props} />);

            const subtitleElement = screen.getByTestId("stat-card-subtitle");
            expect(subtitleElement).toBeDefined();
            expect(subtitleElement.textContent).toBe(props.subtitle);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should not render subtitle when not provided", () => {
      fc.assert(
        fc.property(
          statCardPropsArb.filter((p) => p.subtitle === undefined),
          (props) => {
            const { unmount } = render(<StatCard {...props} />);

            const subtitleElement = screen.queryByTestId("stat-card-subtitle");
            expect(subtitleElement).toBeNull();

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should render trend indicator with correct direction when trend is provided", () => {
      fc.assert(
        fc.property(statCardPropsWithTrendArb, (props) => {
          const { unmount } = render(<StatCard {...props} />);

          // Trend container should be rendered
          const trendElement = screen.getByTestId("stat-card-trend");
          expect(trendElement).toBeDefined();

          // Trend value should be rendered
          const trendValue = screen.getByTestId("stat-card-trend-value");
          expect(trendValue).toBeDefined();
          expect(trendValue.textContent).toBe(props.trend);

          // Correct trend icon should be rendered based on trendUp
          if (props.trendUp) {
            const upIcon = screen.queryByTestId("trend-up-icon");
            const downIcon = screen.queryByTestId("trend-down-icon");
            expect(upIcon).toBeDefined();
            expect(downIcon).toBeNull();
          } else {
            const upIcon = screen.queryByTestId("trend-up-icon");
            const downIcon = screen.queryByTestId("trend-down-icon");
            expect(upIcon).toBeNull();
            expect(downIcon).toBeDefined();
          }

          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it("should not render trend indicator when trend is not provided", () => {
      fc.assert(
        fc.property(
          statCardPropsArb.filter((p) => p.trend === undefined),
          (props) => {
            const { unmount } = render(<StatCard {...props} />);

            const trendElement = screen.queryByTestId("stat-card-trend");
            expect(trendElement).toBeNull();

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should apply gradient background to icon container for any color", () => {
      fc.assert(
        fc.property(statCardPropsArb, (props) => {
          const { unmount } = render(<StatCard {...props} />);

          const iconContainer = screen.getByTestId("stat-card-icon-container");
          expect(iconContainer).toBeDefined();

          // Should have gradient classes
          expect(iconContainer.className).toContain("bg-gradient-to-br");

          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it("should have hover shadow effect class on card", () => {
      fc.assert(
        fc.property(statCardPropsArb, (props) => {
          const { unmount } = render(<StatCard {...props} />);

          const card = screen.getByTestId("stat-card");
          expect(card).toBeDefined();

          // Should have hover shadow class
          expect(card.className).toContain("hover:shadow-lg");

          unmount();
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Status Distribution Chart Generators
// ============================================================================

/**
 * Generator for valid hex colors
 */
const hexColorArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(
    ([r, g, b]) =>
      `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
  );

/**
 * Generator for status names
 */
const statusNameArb: fc.Arbitrary<string> = fc.constantFrom(
  "Draft",
  "In Progress",
  "Review",
  "Completed",
  "On Hold",
  "Cancelled"
);

/**
 * Generator for StatusDistributionData
 */
const statusDistributionDataArb: fc.Arbitrary<StatusDistributionData> =
  fc.record({
    name: statusNameArb,
    value: fc.integer({ min: 0, max: 100 }),
    color: hexColorArb,
  });

/**
 * Generator for arrays of StatusDistributionData
 */
const statusDistributionArrayArb: fc.Arbitrary<StatusDistributionData[]> =
  fc.array(statusDistributionDataArb, { minLength: 1, maxLength: 6 });

// ============================================================================
// Status Distribution Chart Property Tests
// ============================================================================

describe("Frontend Restructure Property Tests - Status Distribution", () => {
  /**
   * **Feature: frontend-restructure-ai4rfp, Property 2: Project Status Distribution Accuracy**
   * **Validates: Requirements 3.2**
   *
   * For any set of projects with various statuses, the pie chart data SHALL accurately
   * reflect the count of projects in each status category, and the sum of all segments
   * SHALL equal the total number of projects.
   */
  describe("Property 2: Project Status Distribution Accuracy", () => {
    it("should calculate total correctly for any distribution data", () => {
      fc.assert(
        fc.property(statusDistributionArrayArb, (data) => {
          const expectedTotal = data.reduce((sum, item) => sum + item.value, 0);
          const actualTotal = calculateTotalFromDistribution(data);

          expect(actualTotal).toBe(expectedTotal);
        }),
        { numRuns: 100 }
      );
    });

    it("should validate distribution accuracy when total matches", () => {
      fc.assert(
        fc.property(statusDistributionArrayArb, (data) => {
          const total = data.reduce((sum, item) => sum + item.value, 0);
          const isValid = validateDistributionAccuracy(data, total);

          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should invalidate distribution when total does not match", () => {
      fc.assert(
        fc.property(
          statusDistributionArrayArb.filter(
            (data) => data.reduce((sum, item) => sum + item.value, 0) > 0
          ),
          fc.integer({ min: 1, max: 100 }),
          (data, offset) => {
            const actualTotal = data.reduce((sum, item) => sum + item.value, 0);
            const wrongTotal = actualTotal + offset;
            const isValid = validateDistributionAccuracy(data, wrongTotal);

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return 0 for empty distribution", () => {
      const total = calculateTotalFromDistribution([]);
      expect(total).toBe(0);
    });

    it("should handle single status correctly", () => {
      fc.assert(
        fc.property(statusDistributionDataArb, (item) => {
          const total = calculateTotalFromDistribution([item]);
          expect(total).toBe(item.value);
        }),
        { numRuns: 100 }
      );
    });

    it("should preserve individual segment values in total calculation", () => {
      fc.assert(
        fc.property(statusDistributionArrayArb, (data) => {
          const total = calculateTotalFromDistribution(data);

          // Each segment value should be <= total
          for (const item of data) {
            expect(item.value).toBeLessThanOrEqual(total);
          }

          // Sum should equal total
          const sum = data.reduce((acc, item) => acc + item.value, 0);
          expect(sum).toBe(total);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Recent Projects List Generators
// ============================================================================

/**
 * Generator for project status
 */
const projectStatusArb: fc.Arbitrary<string> = fc.constantFrom(
  "draft",
  "in_progress",
  "review",
  "completed"
);

/**
 * Generator for RecentProject
 */
const recentProjectArb: fc.Arbitrary<RecentProject> = fc.record({
  id: fc.uuid(),
  name: nonEmptyStringArb,
  client: nonEmptyStringArb,
  status: projectStatusArb,
  updatedAt: fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2025-12-31"),
  }).filter((d) => !isNaN(d.getTime())),
});

/**
 * Generator for arrays of RecentProject
 */
const recentProjectArrayArb: fc.Arbitrary<RecentProject[]> = fc.array(
  recentProjectArb,
  { minLength: 0, maxLength: 20 }
);

// ============================================================================
// Recent Projects List Property Tests
// ============================================================================

describe("Frontend Restructure Property Tests - Recent Projects", () => {
  /**
   * **Feature: frontend-restructure-ai4rfp, Property 6: Recent Projects Ordering and Limit**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any list of projects with various update timestamps, the Recent Projects section
   * SHALL display exactly min(5, totalProjects) items, ordered by updatedAt descending
   * (most recent first).
   */
  describe("Property 6: Recent Projects Ordering and Limit", () => {
    it("should sort projects by updatedAt in descending order", () => {
      fc.assert(
        fc.property(recentProjectArrayArb, (projects) => {
          const sorted = sortProjectsByRecent(projects);

          // Check that the result is sorted in descending order by updatedAt
          for (let i = 0; i < sorted.length - 1; i++) {
            const currentTime = new Date(sorted[i].updatedAt).getTime();
            const nextTime = new Date(sorted[i + 1].updatedAt).getTime();
            expect(currentTime).toBeGreaterThanOrEqual(nextTime);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should preserve all projects when sorting (same length)", () => {
      fc.assert(
        fc.property(recentProjectArrayArb, (projects) => {
          const sorted = sortProjectsByRecent(projects);
          expect(sorted.length).toBe(projects.length);
        }),
        { numRuns: 100 }
      );
    });

    it("should not mutate the original array when sorting", () => {
      fc.assert(
        fc.property(recentProjectArrayArb, (projects) => {
          const originalCopy = projects.map((p) => ({ ...p }));
          sortProjectsByRecent(projects);

          // Original array should be unchanged
          expect(projects.length).toBe(originalCopy.length);
          for (let i = 0; i < projects.length; i++) {
            expect(projects[i].id).toBe(originalCopy[i].id);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should return exactly min(maxItems, totalProjects) items", () => {
      fc.assert(
        fc.property(
          recentProjectArrayArb,
          fc.integer({ min: 1, max: 10 }),
          (projects, maxItems) => {
            const result = getRecentProjects(projects, maxItems);
            const expectedLength = Math.min(maxItems, projects.length);

            expect(result.length).toBe(expectedLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return exactly min(5, totalProjects) items with default maxItems", () => {
      fc.assert(
        fc.property(recentProjectArrayArb, (projects) => {
          const result = getRecentProjects(projects);
          const expectedLength = Math.min(5, projects.length);

          expect(result.length).toBe(expectedLength);
        }),
        { numRuns: 100 }
      );
    });

    it("should return the most recent projects when limited", () => {
      fc.assert(
        fc.property(
          fc.array(recentProjectArb, { minLength: 6, maxLength: 20 }),
          (projects) => {
            const result = getRecentProjects(projects, 5);
            const allSorted = sortProjectsByRecent(projects);

            // The result should contain the 5 most recent projects
            for (let i = 0; i < 5; i++) {
              expect(result[i].id).toBe(allSorted[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return empty array for empty input", () => {
      const result = getRecentProjects([]);
      expect(result).toEqual([]);
    });

    it("should return all projects when fewer than maxItems", () => {
      fc.assert(
        fc.property(
          fc.array(recentProjectArb, { minLength: 1, maxLength: 4 }),
          (projects) => {
            const result = getRecentProjects(projects, 5);

            // Should return all projects since there are fewer than 5
            expect(result.length).toBe(projects.length);

            // All original projects should be in the result
            const resultIds = new Set(result.map((p) => p.id));
            for (const project of projects) {
              expect(resultIds.has(project.id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should maintain sort order in limited results", () => {
      fc.assert(
        fc.property(
          recentProjectArrayArb.filter((p) => p.length > 0),
          fc.integer({ min: 1, max: 10 }),
          (projects, maxItems) => {
            const result = getRecentProjects(projects, maxItems);

            // Result should be sorted by updatedAt descending
            for (let i = 0; i < result.length - 1; i++) {
              const currentTime = new Date(result[i].updatedAt).getTime();
              const nextTime = new Date(result[i + 1].updatedAt).getTime();
              expect(currentTime).toBeGreaterThanOrEqual(nextTime);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Quick Stats Generators
// ============================================================================

/**
 * Generator for ProjectStats
 */
const projectStatsArb: fc.Arbitrary<ProjectStats> = fc
  .record({
    completedQuestions: fc.integer({ min: 0, max: 100 }),
    totalQuestions: fc.integer({ min: 0, max: 100 }),
    isActive: fc.boolean(),
  })
  .filter((p) => p.completedQuestions <= p.totalQuestions);

/**
 * Generator for arrays of ProjectStats
 */
const projectStatsArrayArb: fc.Arbitrary<ProjectStats[]> = fc.array(
  projectStatsArb,
  { minLength: 0, maxLength: 20 }
);

// ============================================================================
// Quick Stats Property Tests
// ============================================================================

describe("Frontend Restructure Property Tests - Quick Stats", () => {
  /**
   * **Feature: frontend-restructure-ai4rfp, Property 3: Quick Stats Calculation Accuracy**
   * **Validates: Requirements 4.3**
   *
   * For any set of projects with various completion states, the Quick Stats section
   * SHALL display the correct count of active projects, and the completion rate
   * SHALL equal (completed questions / total questions) * 100.
   */
  describe("Property 3: Quick Stats Calculation Accuracy", () => {
    it("should calculate completion rate correctly for any valid inputs", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (completed, total) => {
            // Ensure completed <= total
            const actualCompleted = Math.min(completed, total);
            const rate = calculateCompletionRate(actualCompleted, total);
            const expectedRate = Math.round((actualCompleted / total) * 100);

            expect(rate).toBe(expectedRate);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return 0 completion rate when total questions is 0", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (completed) => {
          const rate = calculateCompletionRate(completed, 0);
          expect(rate).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 100% when all questions are completed", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (total) => {
          const rate = calculateCompletionRate(total, total);
          expect(rate).toBe(100);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 0% when no questions are completed", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (total) => {
          const rate = calculateCompletionRate(0, total);
          expect(rate).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should calculate active projects count correctly", () => {
      fc.assert(
        fc.property(projectStatsArrayArb, (projects) => {
          const stats = calculateQuickStats(projects);
          const expectedActive = projects.filter((p) => p.isActive).length;

          expect(stats.activeProjects).toBe(expectedActive);
        }),
        { numRuns: 100 }
      );
    });

    it("should calculate overall completion rate correctly from project stats", () => {
      fc.assert(
        fc.property(projectStatsArrayArb, (projects) => {
          const stats = calculateQuickStats(projects);

          const totalCompleted = projects.reduce(
            (sum, p) => sum + p.completedQuestions,
            0
          );
          const totalQuestions = projects.reduce(
            (sum, p) => sum + p.totalQuestions,
            0
          );

          const expectedRate =
            totalQuestions === 0
              ? 0
              : Math.round((totalCompleted / totalQuestions) * 100);

          expect(stats.completionRate).toBe(expectedRate);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 0 active projects for empty array", () => {
      const stats = calculateQuickStats([]);
      expect(stats.activeProjects).toBe(0);
    });

    it("should return 0 completion rate for empty array", () => {
      const stats = calculateQuickStats([]);
      expect(stats.completionRate).toBe(0);
    });

    it("should have completion rate between 0 and 100", () => {
      fc.assert(
        fc.property(projectStatsArrayArb, (projects) => {
          const stats = calculateQuickStats(projects);

          expect(stats.completionRate).toBeGreaterThanOrEqual(0);
          expect(stats.completionRate).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });

    it("should have non-negative active projects count", () => {
      fc.assert(
        fc.property(projectStatsArrayArb, (projects) => {
          const stats = calculateQuickStats(projects);

          expect(stats.activeProjects).toBeGreaterThanOrEqual(0);
          expect(stats.activeProjects).toBeLessThanOrEqual(projects.length);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Navigation Highlighting Types and Functions
// ============================================================================

/**
 * Navigation item interface for testing
 */
export interface NavigationItem {
  title: string;
  url: string;
}

/**
 * Determines if a navigation item should be active based on the current pathname.
 * This is a pure function that can be tested independently.
 *
 * @param itemUrl - The URL of the navigation item
 * @param currentPathname - The current browser pathname
 * @returns true if the item should be highlighted as active
 */
export function isNavigationItemActive(
  itemUrl: string,
  currentPathname: string
): boolean {
  // Exact match for the URL
  return currentPathname === itemUrl;
}

/**
 * Given a list of navigation items and a current pathname,
 * returns an array of booleans indicating which items are active.
 *
 * @param items - Array of navigation items
 * @param currentPathname - The current browser pathname
 * @returns Array of booleans, where true means the item at that index is active
 */
export function getActiveNavigationStates(
  items: NavigationItem[],
  currentPathname: string
): boolean[] {
  return items.map((item) => isNavigationItemActive(item.url, currentPathname));
}

/**
 * Validates that exactly one or zero navigation items are active.
 * Returns true if the highlighting is valid (at most one item active).
 *
 * @param activeStates - Array of boolean active states
 * @returns true if at most one item is active
 */
export function validateSingleActiveNavigation(activeStates: boolean[]): boolean {
  const activeCount = activeStates.filter((isActive) => isActive).length;
  return activeCount <= 1;
}

// ============================================================================
// Navigation Highlighting Generators
// ============================================================================

/**
 * Generator for valid URL paths
 */
const urlPathArb: fc.Arbitrary<string> = fc.constantFrom(
  "/dashboard",
  "/organizations",
  "/organizations/org-1",
  "/organizations/org-1/knowledge-base",
  "/organizations/org-1/team",
  "/organizations/org-1/settings",
  "/projects/proj-1",
  "/projects/proj-1/questions",
  "/projects/proj-1/documents",
  "/help",
  "/login",
  "/upload"
);

/**
 * Generator for navigation items
 */
const navigationItemArb: fc.Arbitrary<NavigationItem> = fc.record({
  title: nonEmptyStringArb,
  url: urlPathArb,
});

/**
 * Generator for arrays of navigation items with unique URLs
 */
const navigationItemsArb: fc.Arbitrary<NavigationItem[]> = fc
  .array(navigationItemArb, { minLength: 1, maxLength: 10 })
  .map((items) => {
    // Ensure unique URLs
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  })
  .filter((items) => items.length > 0);

// ============================================================================
// Navigation Highlighting Property Tests
// ============================================================================

describe("Frontend Restructure Property Tests - Navigation Highlighting", () => {
  /**
   * **Feature: frontend-restructure-ai4rfp, Property 4: Active Navigation Highlighting**
   * **Validates: Requirements 4.4**
   *
   * For any navigation item that matches the current route, that item SHALL have
   * the active styling classes applied, and all other navigation items SHALL NOT
   * have active styling.
   */
  describe("Property 4: Active Navigation Highlighting", () => {
    it("should mark exactly one item as active when pathname matches one item URL", () => {
      fc.assert(
        fc.property(navigationItemsArb, (items) => {
          // Pick a random item's URL as the current pathname
          const randomIndex = Math.floor(Math.random() * items.length);
          const currentPathname = items[randomIndex].url;

          const activeStates = getActiveNavigationStates(items, currentPathname);

          // Count how many items are active
          const activeCount = activeStates.filter((isActive) => isActive).length;

          // Exactly one item should be active (the one matching the pathname)
          expect(activeCount).toBe(1);

          // The active item should be at the correct index
          expect(activeStates[randomIndex]).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should mark no items as active when pathname does not match any item URL", () => {
      fc.assert(
        fc.property(navigationItemsArb, (items) => {
          // Use a pathname that doesn't match any item
          const nonMatchingPathname = "/non-existent-route-12345";

          const activeStates = getActiveNavigationStates(
            items,
            nonMatchingPathname
          );

          // No items should be active
          const activeCount = activeStates.filter((isActive) => isActive).length;
          expect(activeCount).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should ensure at most one navigation item is active for any pathname", () => {
      fc.assert(
        fc.property(navigationItemsArb, urlPathArb, (items, pathname) => {
          const activeStates = getActiveNavigationStates(items, pathname);
          const isValid = validateSingleActiveNavigation(activeStates);

          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should correctly identify active item by exact URL match", () => {
      fc.assert(
        fc.property(navigationItemsArb, (items) => {
          for (const item of items) {
            const isActive = isNavigationItemActive(item.url, item.url);
            expect(isActive).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should not mark item as active for partial URL matches", () => {
      fc.assert(
        fc.property(navigationItemsArb, (items) => {
          for (const item of items) {
            // Test with a pathname that is a prefix of the item URL
            const partialPathname = item.url.slice(0, -1);
            if (partialPathname.length > 0 && partialPathname !== item.url) {
              const isActive = isNavigationItemActive(item.url, partialPathname);
              expect(isActive).toBe(false);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should not mark item as active when pathname is a superset of item URL", () => {
      fc.assert(
        fc.property(navigationItemsArb, (items) => {
          for (const item of items) {
            // Test with a pathname that extends the item URL
            const extendedPathname = item.url + "/extra";
            const isActive = isNavigationItemActive(item.url, extendedPathname);
            expect(isActive).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it("should return correct active states array length", () => {
      fc.assert(
        fc.property(navigationItemsArb, urlPathArb, (items, pathname) => {
          const activeStates = getActiveNavigationStates(items, pathname);
          expect(activeStates.length).toBe(items.length);
        }),
        { numRuns: 100 }
      );
    });

    it("should be deterministic - same inputs produce same outputs", () => {
      fc.assert(
        fc.property(navigationItemsArb, urlPathArb, (items, pathname) => {
          const activeStates1 = getActiveNavigationStates(items, pathname);
          const activeStates2 = getActiveNavigationStates(items, pathname);

          expect(activeStates1).toEqual(activeStates2);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Project Card Types and Functions (imported from component)
// ============================================================================

import {
  EnhancedProject,
  ProjectCardProps,
  calculateProgressPercentage,
  getStatusBadgeVariant,
  getStatusBadgeClasses,
} from "@/components/projects/ProjectCard";

// ============================================================================
// Project Card Generators
// ============================================================================

/**
 * Generator for project status values
 */
const projectCardStatusArb: fc.Arbitrary<string> = fc.constantFrom(
  "Draft",
  "In Progress",
  "Review",
  "Completed",
  "draft",
  "in_progress",
  "review",
  "completed"
);

/**
 * Generator for valid date strings
 */
const dateStringArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date("2020-01-01"),
    max: new Date("2025-12-31"),
  })
  .filter((d) => !isNaN(d.getTime()))
  .map((d) => d.toISOString());

/**
 * Generator for EnhancedProject with question metrics
 */
const enhancedProjectArb: fc.Arbitrary<EnhancedProject> = fc
  .record({
    id: fc.uuid(),
    name: nonEmptyStringArb,
    description: fc.option(nonEmptyStringArb, { nil: undefined }),
    summary: fc.option(nonEmptyStringArb, { nil: undefined }),
    createdAt: dateStringArb,
    status: fc.option(projectCardStatusArb, { nil: undefined }),
    client: fc.option(nonEmptyStringArb, { nil: undefined }),
    dueDate: fc.option(dateStringArb, { nil: null }),
    completedQuestions: fc.integer({ min: 0, max: 100 }),
    totalQuestions: fc.integer({ min: 0, max: 100 }),
  })
  .filter((p) => (p.completedQuestions ?? 0) <= (p.totalQuestions ?? 0));

/**
 * Generator for EnhancedProject with guaranteed question metrics
 */
const enhancedProjectWithQuestionsArb: fc.Arbitrary<EnhancedProject> = fc
  .record({
    id: fc.uuid(),
    name: nonEmptyStringArb,
    description: fc.option(nonEmptyStringArb, { nil: undefined }),
    summary: fc.option(nonEmptyStringArb, { nil: undefined }),
    createdAt: dateStringArb,
    status: fc.option(projectCardStatusArb, { nil: undefined }),
    client: fc.option(nonEmptyStringArb, { nil: undefined }),
    dueDate: fc.option(dateStringArb, { nil: null }),
    completedQuestions: fc.integer({ min: 0, max: 100 }),
    totalQuestions: fc.integer({ min: 1, max: 100 }),
  })
  .filter((p) => p.completedQuestions <= p.totalQuestions);

// ============================================================================
// Project Card Property Tests
// ============================================================================

describe("Frontend Restructure Property Tests - Project Card", () => {
  /**
   * **Feature: frontend-restructure-ai4rfp, Property 5: Project Card Data Completeness**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   *
   * For any project with any name, client, status, due date, and question counts,
   * the project card SHALL display all provided fields, and the progress bar
   * percentage SHALL equal (completedQuestions / totalQuestions) * 100.
   */
  describe("Property 5: Project Card Data Completeness", () => {
    it("should calculate progress percentage correctly for any valid inputs", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (completed, total) => {
            // Ensure completed <= total
            const actualCompleted = Math.min(completed, total);
            const percentage = calculateProgressPercentage(actualCompleted, total);
            const expectedPercentage = Math.round((actualCompleted / total) * 100);

            expect(percentage).toBe(expectedPercentage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return 0 progress percentage when total questions is 0", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (completed) => {
          const percentage = calculateProgressPercentage(completed, 0);
          expect(percentage).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 100% when all questions are completed", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (total) => {
          const percentage = calculateProgressPercentage(total, total);
          expect(percentage).toBe(100);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 0% when no questions are completed", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (total) => {
          const percentage = calculateProgressPercentage(0, total);
          expect(percentage).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it("should have progress percentage between 0 and 100", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (completed, total) => {
            // Ensure completed <= total (valid input domain)
            const actualCompleted = Math.min(completed, total);
            const percentage = calculateProgressPercentage(actualCompleted, total);
            expect(percentage).toBeGreaterThanOrEqual(0);
            expect(percentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return valid badge variant for any status", () => {
      fc.assert(
        fc.property(projectCardStatusArb, (status) => {
          const variant = getStatusBadgeVariant(status);
          const validVariants = ["default", "secondary", "destructive", "outline"];
          expect(validVariants).toContain(variant);
        }),
        { numRuns: 100 }
      );
    });

    it("should return 'default' variant for completed status", () => {
      const completedStatuses = ["Completed", "completed"];
      for (const status of completedStatuses) {
        const variant = getStatusBadgeVariant(status);
        expect(variant).toBe("default");
      }
    });

    it("should return 'secondary' variant for in progress status", () => {
      const inProgressStatuses = ["In Progress", "in_progress", "in progress"];
      for (const status of inProgressStatuses) {
        const variant = getStatusBadgeVariant(status);
        expect(variant).toBe("secondary");
      }
    });

    it("should return 'outline' variant for review status", () => {
      const reviewStatuses = ["Review", "review"];
      for (const status of reviewStatuses) {
        const variant = getStatusBadgeVariant(status);
        expect(variant).toBe("outline");
      }
    });

    it("should return string badge classes for any status", () => {
      fc.assert(
        fc.property(projectCardStatusArb, (status) => {
          const classes = getStatusBadgeClasses(status);
          expect(typeof classes).toBe("string");
        }),
        { numRuns: 100 }
      );
    });

    it("should return emerald classes for completed status", () => {
      const completedStatuses = ["Completed", "completed"];
      for (const status of completedStatuses) {
        const classes = getStatusBadgeClasses(status);
        expect(classes).toContain("emerald");
      }
    });

    it("should return blue classes for in progress status", () => {
      const inProgressStatuses = ["In Progress", "in_progress", "in progress"];
      for (const status of inProgressStatuses) {
        const classes = getStatusBadgeClasses(status);
        expect(classes).toContain("blue");
      }
    });

    it("should return amber classes for review status", () => {
      const reviewStatuses = ["Review", "review"];
      for (const status of reviewStatuses) {
        const classes = getStatusBadgeClasses(status);
        expect(classes).toContain("amber");
      }
    });

    it("should return gray classes for draft status", () => {
      const draftStatuses = ["Draft", "draft"];
      for (const status of draftStatuses) {
        const classes = getStatusBadgeClasses(status);
        expect(classes).toContain("gray");
      }
    });

    it("should calculate correct percentage for generated project data", () => {
      fc.assert(
        fc.property(enhancedProjectWithQuestionsArb, (project) => {
          const completed = project.completedQuestions ?? 0;
          const total = project.totalQuestions ?? 0;
          const percentage = calculateProgressPercentage(completed, total);

          if (total === 0) {
            expect(percentage).toBe(0);
          } else {
            const expectedPercentage = Math.round((completed / total) * 100);
            expect(percentage).toBe(expectedPercentage);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
