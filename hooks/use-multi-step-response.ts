import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

export interface ReasoningStep {
  title: string;
  content: string;
  nextStep?: 'continue' | 'finalAnswer';
}

export interface DocumentSource {
  id: number;
  fileName: string;
  pageNumber?: string;
  relevance?: number;
  textContent?: string;
}

export interface UseMultiStepResponseOptions {
  projectId: string;
  indexIds: string[];
  onComplete?: (finalResponse: string, steps: ReasoningStep[], sources: DocumentSource[]) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: Array<{
    toolName: string;
    state: string;
    result?: any;
  }>;
}

export function useMultiStepResponse({ 
  projectId, 
  indexIds, 
  onComplete 
}: UseMultiStepResponseOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [completedSteps, setCompletedSteps] = useState<ReasoningStep[]>([]);
  const [extractedSources, setExtractedSources] = useState<DocumentSource[]>([]);
  const [realDocumentSources, setRealDocumentSources] = useState<DocumentSource[]>([]);
  const [finalResponseText, setFinalResponseText] = useState('');

  const generateResponse = useCallback(async (question: string) => {
    console.log('🔍 generateResponse called with:', { question, projectId, indexIds });
    
    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please provide a question to analyze.",
        variant: "destructive",
      });
      return;
    }

    console.log('📡 Starting multi-step generation...');
    setIsGenerating(true);
    setCompletedSteps([]);
    setExtractedSources([]);
    setRealDocumentSources([]);
    setFinalResponseText('');
    setMessages([]);

    // First, get document sources using the same approach as normal generation
    try {
      console.log('🔍 Pre-fetching document sources...');
      const sourcesResponse = await fetch('/api/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          selectedIndexIds: indexIds,
          useAllIndexes: false,
          projectId: projectId
        }),
      });
      
      if (sourcesResponse.ok) {
        const sourcesResult = await sourcesResponse.json();
        console.log('✅ Pre-fetched sources:', sourcesResult.sources);
        
        // Convert to our DocumentSource format
        const documentSources: DocumentSource[] = sourcesResult.sources.map((source: any) => ({
          id: source.id,
          fileName: source.fileName,
          pageNumber: source.pageNumber,
          relevance: source.relevance,
          textContent: source.textContent
        }));
        
        setRealDocumentSources(documentSources);
      } else {
        console.warn('⚠️ Failed to pre-fetch sources, will use citation extraction');
      }
    } catch (error) {
      console.warn('⚠️ Error pre-fetching sources:', error);
    }
    
    // Use fetch to call the multi-step API
    try {
      const response = await fetch('/api/generate-response-multistep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: question }],
          projectId,
          indexIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullText = '';
      const steps: ReasoningStep[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('✅ Stream completed');
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              console.log('📥 Received event:', parsed.type);
              
              if (parsed.type === 'tool-result' && parsed.toolName === 'addReasoningStep') {
                const step: ReasoningStep = parsed.result;
                steps.push(step);
                setCompletedSteps([...steps]);
                console.log('🔧 Added reasoning step:', step.title);
              } else if (parsed.type === 'text-delta') {
                fullText += parsed.text;
                setFinalResponseText(fullText);
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      console.log('✅ Stream completed, full text length:', fullText.length, 'steps:', steps.length);
      
      // Extract sources from the response content
      const citationSources = extractSourcesFromContent(fullText);
      setExtractedSources(citationSources);
      
      // Use real document sources if available
      const finalSources = realDocumentSources.length > 0 ? realDocumentSources : citationSources;
      
      // Call completion callback
      if (onComplete && fullText) {
        onComplete(fullText, steps, finalSources);
      }
      
      setIsGenerating(false);
    } catch (error) {
      console.error('❌ Failed to generate response:', error);
      setIsGenerating(false);
      toast({
        title: "Error",
        description: "Failed to generate response. Please try again.",
        variant: "destructive",
      });
    }
  }, [projectId, indexIds, onComplete, realDocumentSources]);


  // Extract sources from response content by parsing [Source X] citations
  const extractSourcesFromContent = (content: string): DocumentSource[] => {
    console.log('📄 Extracting sources from content:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + '...',
      hasSourcePattern: content.includes('[Source')
    });
    
    const sources: DocumentSource[] = [];
    const sourcePattern = /\[Source (\d+)\]/g;
    const matches = content.matchAll(sourcePattern);
    
    const uniqueSourceIds = new Set<number>();
    
    for (const match of matches) {
      const sourceId = parseInt(match[1]);
      console.log('🔗 Found source citation:', sourceId);
      if (!uniqueSourceIds.has(sourceId)) {
        uniqueSourceIds.add(sourceId);
        sources.push({
          id: sourceId,
          fileName: `Source ${sourceId}`,
          pageNumber: 'N/A',
          relevance: undefined,
          textContent: undefined,
        });
      }
    }
    
    console.log('📄 Final extracted sources:', sources);
    return sources;
  };

  const reset = useCallback(() => {
    setIsGenerating(false);
    setCompletedSteps([]);
    setExtractedSources([]);
    setRealDocumentSources([]);
    setFinalResponseText('');
    setMessages([]);
  }, []);

  return {
    generateResponse,
    isGenerating,
    currentSteps: completedSteps,
    finalResponse: finalResponseText,
    completedSteps,
    sources: realDocumentSources.length > 0 ? realDocumentSources : extractedSources,
    messages,
    reset,
  };
}
