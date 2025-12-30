import { google } from '@ai-sdk/google';
import { streamText, stepCountIs } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { organizationService } from '@/lib/organization-service';
import { db } from '@/lib/db';
import { LlamaIndexService } from '@/lib/llama-index-service';
import { getLlamaCloudApiKey } from '@/lib/env';

export async function POST(request: NextRequest) {
  console.log('🎯 Multi-step API route called');
  
  try {
    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      console.log('❌ GEMINI_API_KEY not configured');
      return new Response('Gemini API key not configured', { status: 500 });
    }
    
    const body = await request.json();
    console.log('📝 Request body:', JSON.stringify(body, null, 2));
    
    // Extract data from useChat format
    const { messages, projectId, indexIds } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('❌ No messages provided');
      return new Response('Messages array is required', { status: 400 });
    }
    
    if (!projectId) {
      console.log('❌ No projectId provided');
      return new Response('Project ID is required', { status: 400 });
    }
    
    if (!indexIds || !Array.isArray(indexIds) || indexIds.length === 0) {
      console.log('❌ No indexIds provided');
      return new Response('At least one index ID is required', { status: 400 });
    }
    
    // Get the user's question from the latest message
    const latestMessage = messages[messages.length - 1];
    const question = latestMessage?.content;
    
    if (!question) {
      console.log('❌ No question content found in latest message');
      return new Response('Question content is required', { status: 400 });
    }
    
    console.log('✅ Request validated:', { question, projectId, indexIds });

    // Get current user and validate permissions
    const currentUser = await organizationService.getCurrentUser();
    console.log('👤 Current user:', currentUser?.id);
    
    if (!currentUser) {
      console.log('❌ No authenticated user found');
      return new Response('Authentication required', { status: 401 });
    }

    // Get project configuration
    console.log('🔍 Fetching project:', projectId);
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: {
            id: true,
            llamaCloudProjectId: true,
            llamaCloudProjectName: true,
            llamaCloudConnectedAt: true,
          },
        },
        projectIndexes: true,
      },
    });

    if (!project) {
      console.log('❌ Project not found:', projectId);
      return new Response('Project not found', { status: 404 });
    }
    
    console.log('✅ Project found:', project.name);

    const isMember = await organizationService.isUserOrganizationMember(
      currentUser.id,
      project.organization.id
    );
    
    if (!isMember) {
      console.log('❌ User not a member of organization');
      return new Response('Access denied', { status: 403 });
    }

    // Search documents using LlamaIndex - retrieve raw documents, don't generate response
    console.log('🔍 Retrieving documents with LlamaIndex...');
    let documentSources: any[] = [];
    
    if (project.organization.llamaCloudProjectId && project.organization.llamaCloudConnectedAt) {
      try {
        console.log('🔑 LlamaCloud API key found, initializing service...');
        
        // Convert index IDs to index names by looking up in project indexes
        const indexNames: string[] = [];
        for (const indexId of indexIds) {
          const projectIndex = project.projectIndexes.find(pi => pi.indexId === indexId);
          if (projectIndex) {
            indexNames.push(projectIndex.indexName);
          } else {
            console.warn(`⚠️ Index ID ${indexId} not found in project indexes, skipping`);
          }
        }
        
        if (indexNames.length === 0) {
          console.log('⚠️ No valid index names found after converting IDs');
        } else {
          console.log(`📋 Using index names: ${indexNames.join(', ')}`);
          
          const apiKey = getLlamaCloudApiKey(currentUser.email);
          const llamaIndexService = new LlamaIndexService({
            apiKey: apiKey,
            projectName: project.organization.llamaCloudProjectName || 'Default',
            indexNames: indexNames,
          });

          console.log('📋 Retrieving documents for question:', question);
          // Use retrieveDocuments to get raw document content without pre-processing
          documentSources = await llamaIndexService.retrieveDocuments(question);
          
          console.log(`✅ Document retrieval completed:`, {
            sourcesFound: documentSources.length,
            sources: documentSources.map(s => ({
              id: s.id,
              fileName: s.fileName,
              pageNumber: s.pageNumber,
              relevance: s.relevance,
              contentLength: s.textContent?.length || 0
            }))
          });
        }
      } catch (error) {
        console.error('⚠️ Document retrieval failed:', error);
      }
    } else {
      console.log('⚠️ No LlamaCloud API key found in organization');
    }

    console.log('🚀 Starting Gemini streaming...');

    // Build document context from raw source content
    const documentContext = documentSources
      .map((source, index) => `[Source ${index + 1}] ${source.fileName} (Page ${source.pageNumber || 'N/A'}):\n${source.textContent || 'No content available'}`)
      .join('\n\n---\n\n');

    // Create system message for RFP-focused reasoning with document context
    const systemMessage = `You are an expert RFP (Request for Proposal) analyst and response specialist. 
    You analyze RFP questions systematically and provide comprehensive, professional responses.
    
    IMPORTANT: You must follow this exact process:
    1. Use the addReasoningStep function EXACTLY 5 times to show your thinking process
    2. After completing all 5 reasoning steps, you MUST provide a comprehensive final answer as regular text (not using any tool)
    
    The 5 reasoning steps should cover:
    1. Analyze what type of information is being requested
    2. Search through the document content below for relevant information  
    3. Extract and synthesize key facts from the documents
    4. Create a professional RFP response structure
    5. Validate the response for completeness and accuracy
    
    DOCUMENT CONTENT FROM ORGANIZATION'S KNOWLEDGE BASE:
    ${documentContext || 'No documents available.'}
    
    CRITICAL INSTRUCTIONS:
    - Base your response ONLY on the document content provided above
    - You MUST reference specific sources using [Source X] format where X is the source number
    - If the information is not in the documents, clearly state that
    - Do NOT make up information that is not in the documents
    
    After completing ALL 5 reasoning steps, you MUST provide a detailed final response as plain text.
    
    Guidelines for final response:
    - Use proper markdown formatting: ## for main headings, ### for subheadings, **bold** for emphasis
    - Include [Source X] citations throughout your response
    - Be specific and quote relevant information from the documents
    - If information is not available, clearly state what is missing
    
    Question: "${question}"
    Retrieved sources: ${documentSources.length} documents found`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemMessage,
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
      stopWhen: stepCountIs(10), // Allow more steps to include final response
      tools: {
        addReasoningStep: {
          description: 'Add a step to the RFP analysis and response generation process. Use this exactly 5 times, then provide your final answer as regular text.',
          inputSchema: z.object({
            title: z.string().describe('The title of the reasoning step (e.g., "Analyzing Question Requirements", "Searching Documents")'),
            content: z.string().describe('The detailed content of the reasoning step. Include specific findings, analysis, and reasoning. Reference sources using [Source X] format.'),
            nextStep: z.enum(['continue', 'finalAnswer']).describe('Use "continue" for steps 1-4, and "finalAnswer" for step 5. After step 5, provide your final response as regular text.'),
          }),
          execute: async (params) => params,
        },
      },
    });

    console.log('📡 Returning streaming response...');
    
    // Use a custom streaming response that includes tool calls
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            if (part.type === 'tool-call') {
              // Send tool call as JSON
              const toolData = {
                type: 'tool-call',
                toolName: part.toolName,
                args: (part as any).input || (part as any).args,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolData)}\n\n`));
            } else if (part.type === 'tool-result') {
              // Send tool result as JSON
              const resultData = {
                type: 'tool-result',
                toolName: part.toolName,
                result: (part as any).result || (part as any).output,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultData)}\n\n`));
            } else if (part.type === 'text-delta') {
              // Send text delta
              const textData = {
                type: 'text-delta',
                text: (part as any).textDelta || (part as any).text,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(textData)}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('💥 Multi-step streaming failed:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 