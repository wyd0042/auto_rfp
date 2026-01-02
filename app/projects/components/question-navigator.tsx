"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, CheckCircle, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { RfpSection, AssignmentStats, UserAssignmentCount } from "@/types/api"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Interface for answer data
interface AnswerData {
  text: string;
  sources?: any[];
}

// Define possible question statuses
type QuestionStatus = "unanswered" | "complete";

/**
 * Question with assignee for statistics computation
 */
export interface QuestionForStats {
  id: string;
  assignee?: { id: string } | null;
}

/**
 * Organization member for statistics computation
 */
export interface MemberForStats {
  userId: string;
  userName: string | null;
  userEmail: string;
}

/**
 * Computed assignment statistics
 */
export interface ComputedAssignmentStats {
  totalQuestions: number;
  unassignedCount: number;
  assignmentsByUser: UserAssignmentCount[];
}

/**
 * Pure function to compute assignment statistics from questions and members
 * This function is exported for property-based testing
 * 
 * @param questions - Array of questions with optional assignee
 * @param members - Array of organization members
 * @returns Computed assignment statistics
 */
export function computeAssignmentStats(
  questions: QuestionForStats[],
  members: MemberForStats[]
): ComputedAssignmentStats {
  const totalQuestions = questions.length;
  const unassignedCount = questions.filter(q => !q.assignee).length;

  // Count assignments per user
  const assignmentCounts = new Map<string, number>();
  for (const question of questions) {
    if (question.assignee?.id) {
      const currentCount = assignmentCounts.get(question.assignee.id) || 0;
      assignmentCounts.set(question.assignee.id, currentCount + 1);
    }
  }

  // Build the assignments by user array (including members with zero assignments)
  const assignmentsByUser: UserAssignmentCount[] = members.map(member => ({
    userId: member.userId,
    userName: member.userName,
    userEmail: member.userEmail,
    count: assignmentCounts.get(member.userId) || 0,
  }));

  return {
    totalQuestions,
    unassignedCount,
    assignmentsByUser,
  };
}

/**
 * Validates that assignment statistics are accurate
 * Returns true if stats are valid, false otherwise
 * 
 * @param stats - The computed statistics to validate
 * @param questions - The source questions
 * @returns true if statistics are accurate
 */
export function validateAssignmentStats(
  stats: ComputedAssignmentStats,
  questions: QuestionForStats[]
): boolean {
  // Total should match question count
  if (stats.totalQuestions !== questions.length) {
    return false;
  }

  // Unassigned count should match questions without assignee
  const actualUnassigned = questions.filter(q => !q.assignee).length;
  if (stats.unassignedCount !== actualUnassigned) {
    return false;
  }

  // Sum of all user counts + unassigned should equal total
  const sumOfUserCounts = stats.assignmentsByUser.reduce((sum, user) => sum + user.count, 0);
  if (sumOfUserCounts + stats.unassignedCount !== stats.totalQuestions) {
    return false;
  }

  // Each user's count should match actual assignments
  for (const userStat of stats.assignmentsByUser) {
    const actualCount = questions.filter(q => q.assignee?.id === userStat.userId).length;
    if (userStat.count !== actualCount) {
      return false;
    }
  }

  return true;
}

interface QuestionNavigatorProps {
  onSelectQuestion: (id: string) => void;
  sections: RfpSection[];
  answers: Record<string, AnswerData>;
  unsavedQuestions?: Set<string>;
  searchQuery?: string;
  projectId?: string;
}

export function QuestionNavigator({ 
  onSelectQuestion, 
  sections,
  answers,
  unsavedQuestions = new Set(),
  searchQuery = "",
  projectId
}: QuestionNavigatorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [showStats, setShowStats] = useState(false)

  // Initialize expanded sections
  useEffect(() => {
    if (sections.length > 0) {
      const initialState: Record<string, boolean> = {};
      sections.forEach((section, index) => {
        // Expand the first two sections by default
        initialState[section.id] = index < 2;
      });
      setExpandedSections(initialState);
    }
  }, [sections]);

  // Fetch assignment statistics
  useEffect(() => {
    if (!projectId) return;

    const fetchAssignmentStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/assignment-stats`);
        if (response.ok) {
          const stats = await response.json();
          setAssignmentStats(stats);
        } else {
          console.error("Failed to fetch assignment stats");
          setAssignmentStats(null);
        }
      } catch (error) {
        console.error("Error fetching assignment stats:", error);
        setAssignmentStats(null);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchAssignmentStats();
  }, [projectId, sections]); // Re-fetch when sections change (indicates data refresh)

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  // Get question status based on answers
  const getQuestionStatus = (questionId: string): QuestionStatus => {
    const answer = answers[questionId];
    
    // Simple binary logic: either answered or unanswered
    if (!answer || !answer.text || answer.text.trim() === "") {
      return "unanswered";
    }
    
    return "complete";
  };

  // Filter sections and questions based on search query
  const filteredSections = sections.map(section => {
    // If no search query, return all questions
    if (!searchQuery) return section;
    
    // Filter questions that match the search query
    const filteredQuestions = section.questions.filter(question => 
      question.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Return section with filtered questions
    return {
      ...section,
      questions: filteredQuestions
    };
  }).filter(section => section.questions.length > 0);

  // Get truncated text that tries to end at a natural break
  const getTruncatedText = (text: string, maxLength: number = 70) => {
    if (text.length <= maxLength) return text;
    
    // Try to end at a natural break
    const breakPoint = text.substring(0, maxLength).lastIndexOf(' ');
    if (breakPoint > maxLength * 0.7) { // Only use breakpoint if it's not too short
      return text.substring(0, breakPoint) + '...';
    }
    
    return text.substring(0, maxLength) + '...';
  };

  return (
    <TooltipProvider>
      <div className="space-y-2 text-sm">
        {/* Assignment Statistics Section */}
        {projectId && (
          <div className="mb-4">
            <button
              className="flex w-full items-center justify-between rounded-md p-2 font-medium hover:bg-muted bg-muted/50"
              onClick={() => setShowStats(!showStats)}
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assignment Stats
              </span>
              {showStats ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </button>
            {showStats && (
              <div className="ml-2 mt-2 space-y-2 pl-2 border-l-2 border-muted">
                {isLoadingStats ? (
                  <div className="text-muted-foreground text-xs py-2">Loading stats...</div>
                ) : assignmentStats ? (
                  <>
                    {/* Unassigned count */}
                    <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50">
                      <span className="text-muted-foreground">Unassigned</span>
                      <span className="font-medium text-amber-600">{assignmentStats.unassignedCount}</span>
                    </div>
                    {/* Per-member counts */}
                    {assignmentStats.assignmentsByUser.map((userStat: UserAssignmentCount) => (
                      <Tooltip key={userStat.userId}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50 cursor-default">
                            <span className="truncate max-w-[150px]">
                              {userStat.userName || userStat.userEmail}
                            </span>
                            <span className="font-medium">{userStat.count}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{userStat.userName || "No name"}</p>
                          <p className="text-xs text-muted-foreground">{userStat.userEmail}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {/* Total */}
                    <div className="flex items-center justify-between py-1 px-2 rounded-md border-t border-muted mt-2 pt-2">
                      <span className="font-medium">Total</span>
                      <span className="font-medium">{assignmentStats.totalQuestions}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground text-xs py-2">Unable to load stats</div>
                )}
              </div>
            )}
          </div>
        )}

        {filteredSections.map((section) => (
        <div key={section.id} className="space-y-1">
          <button
            className="flex w-full items-center justify-between rounded-md p-2 font-medium hover:bg-muted"
            onClick={() => toggleSection(section.id)}
          >
            <span className="text-left pr-2 flex-1">{getTruncatedText(section.title, 85)}</span>
            {expandedSections[section.id] ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
          </button>
          {expandedSections[section.id] && (
            <div className="ml-2 space-y-1 pl-2">
              {section.questions.map((question) => {
                const status = getQuestionStatus(question.id);
                const isUnsaved = unsavedQuestions.has(question.id);
                
                return (
                  <button
                    key={question.id}
                    className={cn(
                      "flex w-full text-left items-start p-2 rounded-md text-sm hover:bg-muted",
                      isUnsaved && "bg-amber-50"
                    )}
                    onClick={() => onSelectQuestion(question.id)}
                  >
                    <div className="flex w-full">
                      <div className="flex-shrink-0 w-5 h-5 mt-0.5 mr-2">
                        {status === "complete" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Question answered</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {status === "unanswered" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Question not yet answered</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className={cn(
                        "flex-1 mr-2",
                        status === "complete" && "text-muted-foreground",
                        isUnsaved && "font-medium text-amber-700"
                      )}>
                        {getTruncatedText(question.question)}
                        {isUnsaved && <span className="ml-1 text-amber-600">*</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
    </TooltipProvider>
  )
}
