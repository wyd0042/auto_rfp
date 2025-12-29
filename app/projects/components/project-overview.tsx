"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Calendar, CheckCircle2, Clock, FileText, FolderOpen, MessageSquare, Users, Download, Info, Trash2, Settings, Upload } from "lucide-react"
import { ProjectTimeline } from "./project-timeline"
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog"
import { RfpDocument } from "@/types/api"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useOrganization } from "@/context/organization-context"

interface ProjectOverviewProps {
  onViewQuestions: () => void;
  projectId: string;
  orgId?: string | null;
}

export function ProjectOverview({ onViewQuestions, projectId, orgId }: ProjectOverviewProps) {
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [rfpDocument, setRfpDocument] = useState<RfpDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectionsExpanded, setSectionsExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { refreshData } = useOrganization()

  useEffect(() => {
    const fetchProjectData = async () => {
      console.log("ProjectOverview: fetchProjectData called with projectId:", projectId);
      setLoading(true)
      try {
        // Fetch project details
        console.log("ProjectOverview: Making API call to /api/projects/" + projectId);
        const projectResponse = await fetch(`/api/projects/${projectId}`)
        console.log("ProjectOverview: Response status:", projectResponse.status);
        if (!projectResponse.ok) {
          throw new Error("Failed to fetch project details")
        }
        const projectData = await projectResponse.json()
        console.log("ProjectOverview: Received project data:", projectData);
        setProject(projectData)

        // Fetch RFP document with questions
        const rfpResponse = await fetch(`/api/questions/${projectId}`)
        if (!rfpResponse.ok) {
          throw new Error("Failed to fetch RFP questions")
        }
        
        const rfpData = await rfpResponse.json()
        setRfpDocument(rfpData)
      } catch (err) {
        console.error("Error fetching project data:", err)
        setError("Failed to load project data")
      } finally {
        setLoading(false)
      }
    }

    fetchProjectData()
  }, [projectId])

  // Calculate project metrics
  const getTotalQuestions = () => rfpDocument?.sections.reduce((total, section) => total + section.questions.length, 0) || 0
  const getAnsweredQuestions = () => {
    if (!rfpDocument) return 0
    return rfpDocument.sections.reduce((total, section) => {
      return total + section.questions.filter(q => q.answer).length
    }, 0)
  }

  const totalQuestions = getTotalQuestions()
  const answeredQuestions = getAnsweredQuestions()
  const completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0

  if (loading) {
    return (
      <div className="space-y-6 p-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-16 mb-1" />
                <Skeleton className="h-3 w-32 mb-3" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Skeleton className="h-20 w-full" />
        
        <div className="grid gap-4 md:grid-cols-7">
          <div className="md:col-span-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="md:col-span-3">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!project) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Project Not Found</AlertTitle>
        <AlertDescription>The requested project could not be found.</AlertDescription>
      </Alert>
    )
  }

  // Format dates
  const createdAt = new Date(project.createdAt)
  const updatedAt = new Date(project.updatedAt)
  const createdAtFormatted = format(createdAt, 'MMM d, yyyy')
  const updatedAtFormatted = format(updatedAt, 'MMM d, yyyy')
  const updatedAtRelative = formatDistanceToNow(updatedAt, { addSuffix: true })

  // Determine which sections to show
  const initialSectionsToShow = 4
  const sortedSections = rfpDocument?.sections ? [...rfpDocument.sections].sort((a, b) => {
    const aAnswered = a.questions.filter(q => q.answer).length
    const bAnswered = b.questions.filter(q => q.answer).length
    const aTotal = a.questions.length
    const bTotal = b.questions.length
    const aPercentage = aTotal > 0 ? aAnswered / aTotal : 0
    const bPercentage = bTotal > 0 ? bAnswered / bTotal : 0
    return bPercentage - aPercentage // Sort by completion percentage (descending)
  }) : []
  
  const sectionsToShow = sectionsExpanded ? sortedSections : sortedSections.slice(0, initialSectionsToShow)
  const hasMoreSections = sortedSections.length > initialSectionsToShow

  const unansweredQuestions = totalQuestions - answeredQuestions

  const handleDeleteProject = async () => {
    try {
      setIsDeleting(true)
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete project')
      }

      toast({
        title: 'Success',
        description: `Project "${project.name}" has been deleted successfully.`,
      })

      setShowDeleteDialog(false)
      
      // Refresh the organization context to update the switcher
      await refreshData()
      
      // Navigate back to organization page
      if (orgId) {
        router.push(`/organizations/${orgId}`)
      } else {
        router.push('/organizations')
      }
      
    } catch (error) {
      console.error('Error deleting project:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-12">
      {/* Action buttons */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm"
            onClick={() => router.push(`/upload?projectId=${projectId}`)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload RFP Document
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Project
          </Button>
        </div>
      </div>

      {/* RFP Summary */}
      {project.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              RFP Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {project.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Vendor Eligibility */}
      {project.eligibility && project.eligibility.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vendor Eligibility Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {project.eligibility.map((requirement: string, index: number) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">
                    {requirement}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Consolidated Project Summary */}
      <Card>
        <CardContent>
          {/* Main metrics row */}
          <div className="flex flex-wrap items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Questions:</span>
              <span className="font-semibold">{answeredQuestions}/{totalQuestions}</span>
              <Badge variant={completionPercentage === 100 ? "default" : "secondary"} className="text-xs">
                {completionPercentage}% complete
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sections:</span>
              <span className="font-semibold">{rfpDocument?.sections.length || 0}</span>
            </div>

            {unansweredQuestions === 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">All Complete</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <Progress value={completionPercentage} className="h-2" />
          </div>

          {/* Project details row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-1">
              <span>ID:</span>
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{project.id.slice(0, 12)}...</code>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Created {createdAtFormatted}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Updated {updatedAtRelative}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Section */}
      <ProjectTimeline projectId={projectId} />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description="This will permanently delete the project and all its associated data."
        itemName={project.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
