import { db } from './db';
import { RfpDocument, RfpSection, RfpQuestion, AnswerSource } from '@/types/api';

export const projectService = {
  // Project operations
  async createProject(name: string, organizationId: string, description?: string) {
    return db.project.create({
      data: {
        name,
        description,
        organizationId,
      },
    });
  },

  async getProjects(organizationId?: string) {
    // If organizationId is provided, get projects for that organization only
    if (organizationId) {
      return db.project.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          summary: true,
          eligibility: true,
          createdAt: true,
          updatedAt: true,
          organizationId: true
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }
    
    // Otherwise get all projects (mostly for admin purposes)
    return db.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        summary: true,
        eligibility: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async getProject(id: string, includeRelations = false) {
    // Basic project data without expensive relations
    if (!includeRelations) {
      return db.project.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          summary: true,
          eligibility: true,
          createdAt: true,
          updatedAt: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    }
    
    // Full project data with all relations when explicitly requested
    return db.project.findUnique({
      where: { id },
      include: {
        organization: true,
        questions: {
          include: {
            answer: {
              include: {
                sources: true,
              },
            },
          },
        },
      },
    });
  },

  async updateProject(id: string, data: { name?: string; description?: string }) {
    return db.project.update({
      where: { id },
      data,
    });
  },

  async deleteProject(id: string) {
    return db.project.delete({
      where: { id },
    });
  },

  // Question operations
  async saveQuestions(projectId: string, sections: RfpSection[]) {
    console.log(`Starting to save questions for project ${projectId}. Total sections: ${sections.length}`);
    
    // Process each section separately instead of in one large transaction
    let questionsCreated = 0;
    
    try {
      for (const section of sections) {
        console.log(`Processing section: ${section.title} with ${section.questions.length} questions`);
        
        // Process questions in smaller batches of 10 to avoid transaction timeouts
        const BATCH_SIZE = 10;
        for (let i = 0; i < section.questions.length; i += BATCH_SIZE) {
          const batch = section.questions.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch of ${batch.length} questions (${i} to ${i + batch.length - 1})`);
          
          // Use a transaction for each batch
          await db.$transaction(async (tx) => {
            for (const questionItem of batch) {
              try {
                // Check if question already exists to avoid duplicates
                const existing = await tx.question.findFirst({
                  where: {
                    referenceId: questionItem.id,
                    projectId,
                  }
                });
                
                if (!existing) {
                  await tx.question.create({
                    data: {
                      referenceId: questionItem.id,
                      text: questionItem.question,
                      topic: section.title,
                      projectId,
                    },
                  });
                  questionsCreated++;
                } else {
                  console.log(`Question with referenceId ${questionItem.id} already exists, skipping`);
                }
              } catch (error) {
                console.error(`Error creating question ${questionItem.id}:`, error);
                throw error;
              }
            }
          });
          
          console.log(`Batch completed. Total questions created so far: ${questionsCreated}`);
        }
      }
      
      console.log(`All questions saved successfully. Total created: ${questionsCreated}`);
      return true;
    } catch (error) {
      console.error(`Error in saveQuestions for project ${projectId}:`, error);
      throw error;
    }
  },

  async getQuestions(projectId: string, options?: { assignee?: string | null }) {
    console.log("In getQuestions, projectId", projectId);
    console.log(`Fetching questions for project ${projectId}`);
    
    try {
      // Build the where clause with optional assignee filter
      const whereClause: { projectId: string; assignedTo?: string | null } = {
        projectId,
      };
      
      // Apply assignee filter if provided
      if (options?.assignee !== undefined) {
        whereClause.assignedTo = options.assignee;
      }
      
      const questions = await db.question.findMany({
        where: whereClause,
        include: {
          answer: {
            include: {
              sources: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      console.log(`Found ${questions.length} questions for project ${projectId}`);

      // If no questions found, return an empty RFP document structure
      if (questions.length === 0) {
        console.log(`No questions found for project ${projectId}, returning empty document`);
        
        const project = await db.project.findUnique({
          where: { id: projectId },
        });
        
        if (!project) {
          console.log(`Project ${projectId} not found`);
          return null;
        }
        
        return {
          documentId: projectId,
          documentName: project.name,
          sections: [],
          extractedAt: project.createdAt.toISOString(),
        };
      }

      // Convert database format to application format (RfpDocument)
      const groupedByTopic = questions.reduce<Record<string, RfpQuestion[]>>((acc, question) => {
        const topic = question.topic;
        if (!acc[topic]) {
          acc[topic] = [];
        }
        
        // Map database sources to API format
        const sources = question.answer?.sources?.map((source, index) => ({
          id: index + 1,
          fileName: source.fileName,
          filePath: source.filePath || undefined,
          pageNumber: source.pageNumber || undefined,
          documentId: source.documentId || undefined,
          relevance: source.relevance || null,
          textContent: source.textContent || null,
        })) || [];
        
        // Map assignee details
        const assignee = question.assignee ? {
          id: question.assignee.id,
          name: question.assignee.name,
          email: question.assignee.email,
        } : null;
        
        acc[topic].push({
          id: question.id,
          question: question.text,
          answer: question.answer?.text,
          sources: sources.length > 0 ? sources : undefined,
          referenceId: question.referenceId ?? undefined,
          assignee,
        });
        
        return acc;
      }, {});

      // Convert to sections
      const sections: RfpSection[] = Object.entries(groupedByTopic).map(
        ([title, questions], index) => ({
          id: `section_${index + 1}`,
          title,
          questions,
        })
      );

      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        console.log(`Project ${projectId} not found after loading questions`);
        return null;
      }

      // Construct RFP document
      const rfpDocument: RfpDocument = {
        documentId: projectId,
        documentName: project.name,
        sections,
        extractedAt: project.createdAt.toISOString(),
      };

      return rfpDocument;
    } catch (error) {
      console.error(`Error in getQuestions for project ${projectId}:`, error);
      throw error;
    }
  },

  // Summary operations
  async saveSummary(projectId: string, summary: string) {
    try {
      await db.project.update({
        where: { id: projectId },
        data: { summary },
      });
      console.log(`Successfully saved summary for project ${projectId}`);
    } catch (error) {
      console.error(`Error saving summary for project ${projectId}:`, error);
      throw error;
    }
  },

  // Eligibility operations
  async saveEligibility(projectId: string, eligibility: string[]) {
    try {
      await db.project.update({
        where: { id: projectId },
        data: { eligibility },
      });
      console.log(`Successfully saved eligibility for project ${projectId}`);
    } catch (error) {
      console.error(`Error saving eligibility for project ${projectId}:`, error);
      throw error;
    }
  },

  // Answer operations
  async saveAnswers(projectId: string, answers: Record<string, { text: string; sources?: AnswerSource[] }>) {
    console.log(`Saving answers for project ${projectId}. Total answers: ${Object.keys(answers).length}`);
    
    try {
      let answersProcessed = 0;
      const BATCH_SIZE = 5; // Smaller batch size for complex operations
      const questionIds = Object.keys(answers);
      
      // Process in smaller batches
      for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
        const batchIds = questionIds.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch of ${batchIds.length} answers (${i} to ${i + batchIds.length - 1})`);
        
        // Increase the transaction timeout to 30 seconds
        await db.$transaction(async (tx) => {
          for (const questionId of batchIds) {
            const answerData = answers[questionId];
            const text = typeof answerData === 'string' ? answerData : answerData.text;
            const sources = typeof answerData === 'string' ? [] : (answerData.sources || []);
            
            // Check if this question belongs to the project
            const question = await tx.question.findFirst({
              where: {
                id: questionId,
                projectId,
              },
            });

            if (!question) {
              console.log(`Question ${questionId} not found for project ${projectId}, skipping`);
              continue;
            }

            // Check if an answer already exists
            const existingAnswer = await tx.answer.findUnique({
              where: {
                questionId,
              },
              include: {
                sources: true,
              },
            });

            if (existingAnswer) {
              // Update existing answer
              await tx.answer.update({
                where: {
                  id: existingAnswer.id,
                },
                data: {
                  text,
                },
              });
              
              // Delete existing sources
              if (existingAnswer.sources.length > 0) {
                await tx.source.deleteMany({
                  where: {
                    answerId: existingAnswer.id,
                  },
                });
              }
              
              // Create new sources
              if (sources.length > 0) {
                await Promise.all(sources.map(source => 
                  tx.source.create({
                    data: {
                      fileName: source.fileName,
                      filePath: source.filePath || null,
                      pageNumber: source.pageNumber?.toString() || null,
                      documentId: source.documentId || null,
                      relevance: source.relevance ? Math.round(Number(source.relevance)) : null,
                      textContent: source.textContent || null,
                      answerId: existingAnswer.id,
                    },
                  })
                ));
              }
            } else {
              // Create new answer
              const answer = await tx.answer.create({
                data: {
                  text,
                  questionId,
                },
              });
              
              // Create sources
              if (sources.length > 0) {
                await Promise.all(sources.map(source => 
                  tx.source.create({
                    data: {
                      fileName: source.fileName,
                      filePath: source.filePath || null,
                      pageNumber: source.pageNumber?.toString() || null,
                      documentId: source.documentId || null,
                      relevance: source.relevance ? Math.round(Number(source.relevance)) : null,
                      textContent: source.textContent || null,
                      answerId: answer.id,
                    },
                  })
                ));
              }
            }
            
            answersProcessed++;
          }
        }, {
          // Set a longer timeout (30 seconds) for complex transactions with many sources
          timeout: 30000
        });
        
        console.log(`Batch completed. Total answers processed so far: ${answersProcessed}`);
      }
      
      console.log(`All answers saved successfully. Total processed: ${answersProcessed}`);
      return true;
    } catch (error) {
      console.error(`Error in saveAnswers for project ${projectId}:`, error);
      throw error;
    }
  },

  async getAnswers(projectId: string) {
    console.log(`Fetching answers for project ${projectId}`);
    
    try {
      const questions = await db.question.findMany({
        where: {
          projectId,
        },
        include: {
          answer: {
            include: {
              sources: true,
            },
          },
        },
      });

      console.log(`Found ${questions.length} questions for project ${projectId}`);

      // Convert to map of questionId -> answer with sources
      const answers: Record<string, { text: string; sources?: AnswerSource[] }> = {};
      for (const question of questions) {
        if (question.answer) {
          // Map database sources to API format
          const sources = question.answer.sources.map((source, index) => ({
            id: index + 1,
            fileName: source.fileName,
            filePath: source.filePath || undefined,
            pageNumber: source.pageNumber || undefined,
            documentId: source.documentId || undefined,
            relevance: source.relevance || null,
            textContent: source.textContent || null,
          }));
          
          answers[question.id] = {
            text: question.answer.text,
            sources: sources.length > 0 ? sources : undefined,
          };
        }
      }

      console.log(`Returning ${Object.keys(answers).length} answers for project ${projectId}`);
      return answers;
    } catch (error) {
      console.error(`Error in getAnswers for project ${projectId}:`, error);
      throw error;
    }
  },
};

// Helper type for unique constraint
type QuestionId = {
  questionId: string;
}; 