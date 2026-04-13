/**
 * WebSocket Server for Real-Time Chat Streaming
 * Provides bi-directional communication for streaming AI responses
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { aiOrchestrator } from './services/aiOrchestrator';
import { storage } from './pgStorage';
import { sessionStore, SESSION_SECRET } from './index';
import type { SessionData } from 'express-session';
import cookie from 'cookie';
import signature from 'cookie-signature';
import { AnalyticsProcessor } from './services/analyticsProcessor';
import { addTitleGenerationJob, addAnalyticsJob } from './services/hybridJobQueue';
import { AIResponseCache, CachedAIResponse } from './services/hybridCache';

interface ChatStreamMessage {
  type: 'start' | 'chunk' | 'end' | 'error';
  conversationId?: string;
  messageId?: string;
  content?: string;
  error?: string;
  metadata?: any;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  userTier: string;
}

/**
 * Extract and validate session from WebSocket request
 */
async function validateSession(req: IncomingMessage): Promise<{ userId: string; userTier: string } | null> {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionCookie = cookies['cagpt.sid'];
    
    if (!sessionCookie) {
      console.log('[WebSocket] No session cookie');
      return null;
    }

    // Unsign the session cookie
    const sid = signature.unsign(sessionCookie.slice(2), SESSION_SECRET); // Remove 's:' prefix
    
    if (!sid) {
      console.log('[WebSocket] Invalid session signature');
      return null;
    }

    // Get session from store
    return new Promise((resolve) => {
      sessionStore.get(sid as string, (err: any, session: SessionData | null | undefined) => {
        if (err || !session) {
          console.log('[WebSocket] Session not found or error:', err);
          resolve(null);
          return;
        }

        // Extract userId from session
        const userId = (session as any).userId;
        
        if (!userId) {
          console.log('[WebSocket] No userId in session');
          resolve(null);
          return;
        }

        // Get user to retrieve tier
        storage.getUser(userId).then(user => {
          if (!user) {
            console.log('[WebSocket] User not found in database');
            resolve(null);
            return;
          }
          
          resolve({
            userId: user.id,
            userTier: user.subscriptionTier
          });
        }).catch(err => {
          console.error('[WebSocket] Error fetching user:', err);
          resolve(null);
        });
      });
    });
  } catch (error) {
    console.error('[WebSocket] Session validation error:', error);
    return null;
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/chat',
    // Verify client has a session cookie before accepting connection
    verifyClient: (info: { req: IncomingMessage }) => {
      const cookies = cookie.parse(info.req.headers.cookie || '');
      return !!cookies['cagpt.sid'];
    }
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    console.log('[WebSocket] Client connecting from:', req.socket.remoteAddress);

    // SECURITY: Validate session and extract userId server-side
    const sessionUser = await validateSession(req);
    
    if (!sessionUser) {
      console.log('[WebSocket] Authentication failed - closing connection');
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Authentication required. Please log in.' 
      }));
      ws.close(1008, 'Authentication required'); // Policy violation
      return;
    }

    // Attach authenticated user to WebSocket connection
    const authenticatedWs = ws as AuthenticatedWebSocket;
    authenticatedWs.userId = sessionUser.userId;
    authenticatedWs.userTier = sessionUser.userTier;
    
    console.log('[WebSocket] Authenticated user:', sessionUser.userId);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'chat') {
          await handleChatStream(authenticatedWs, message);
        } else if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('[WebSocket] Message handling error:', error);
        sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected:', sessionUser.userId);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Send initial connection success
    ws.send(JSON.stringify({ type: 'connected', userId: sessionUser.userId }));
  });

  console.log('[WebSocket] Server initialized on /ws/chat with session authentication');
  return wss;
}

async function handleChatStream(ws: AuthenticatedWebSocket, message: any) {
  const { 
    conversationId, 
    query, 
    profileId = null,
    chatMode: rawChatMode = 'standard',
    documentAttachment
  } = message;

  // Validate chat mode - only allow supported modes, log warning for unknown ones
  const knownChatModes = ['standard', 'deep-research', 'checklist', 'workflow', 'audit-plan', 'calculation'];
  const chatMode = rawChatMode || 'standard';
  
  if (chatMode !== 'standard' && !knownChatModes.includes(chatMode)) {
    console.log(`[WebSocket] Unknown chat mode '${chatMode}' - passing through to orchestrator`);
  }

  try {
    // Validate required fields
    if (!query) {
      sendError(ws, 'Missing query');
      return;
    }

    // Process document attachment if present (same logic as API route)
    let attachmentBuffer: Buffer | undefined;
    let attachmentMetadata: { filename: string; mimeType: string; documentType?: string } | undefined;
    
    if (documentAttachment) {
      try {
        // Security validation: Check attachment size and type
        const ALLOWED_MIME_TYPES = [
          // Azure Document Intelligence supported formats
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/tiff',
          'image/tif',
          // Spreadsheet formats for financial data
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv', // .csv
          'text/plain' // .txt
        ];
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
        
        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(documentAttachment.type)) {
          sendError(ws, 'Invalid file type. Allowed types: PDF, PNG, JPEG, TIFF, Excel (XLSX, XLS), CSV, TXT');
          return;
        }
        
        // Convert base64 data to Buffer
        attachmentBuffer = Buffer.from(documentAttachment.data, 'base64');
        
        // Validate size
        if (attachmentBuffer.byteLength > MAX_SIZE_BYTES) {
          sendError(ws, 'File too large. Maximum size is 10MB');
          return;
        }
        
        attachmentMetadata = {
          filename: documentAttachment.filename,
          mimeType: documentAttachment.type,
          documentType: documentAttachment.type // Use MIME type as document type for now
        };
        
        console.log(`[WebSocket] Document attachment validated: ${documentAttachment.filename} (${attachmentBuffer.byteLength} bytes)`);
      } catch (error) {
        console.error('[WebSocket] Error processing document attachment:', error);
        sendError(ws, 'Invalid document attachment data');
        return;
      }
    }

    // SECURITY: Use session-derived userId and userTier only
    // Never trust client-provided authentication data
    const userId = ws.userId;
    const userTier = ws.userTier;

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        sendError(ws, 'Conversation not found or unauthorized');
        return;
      }
    } else {
      // Create new conversation with temporary title
      conversation = await storage.createConversation({
        userId,
        title: 'New Conversation', // Will be auto-generated after first message
        metadata: null,
        profileId
      });
    }

    // Get conversation history
    const history = await storage.getConversationMessages(conversation.id);
    const conversationHistory = history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Save user message
    const userMessage = await storage.createMessage({
      conversationId: conversation.id,
      role: 'user',
      content: query,
      modelUsed: null,
      routingDecision: null,
      calculationResults: null,
      tokensUsed: null
    });

    // Process user message analytics (non-blocking)
    AnalyticsProcessor.processMessage({
      messageId: userMessage.id,
      conversationId: conversation.id,
      userId,
      role: 'user',
      content: query,
      previousMessages: conversationHistory
    }).catch(err => console.error('[WebSocket] Analytics error:', err));

    // Send start signal
    send(ws, {
      type: 'start',
      conversationId: conversation.id,
      messageId: userMessage.id
    });

    // Check cache first for non-file queries
    let fullResponse = '';
    let result: any;
    let fromCache = false;
    
    // Only use cache if no document attachment (document analysis should always be fresh)
    if (!attachmentBuffer) {
      const cachedResponse = await AIResponseCache.getFullResponse(query, chatMode, userTier);
      if (cachedResponse) {
        console.log(`[WebSocket] Cache HIT - returning cached response with visualization`);
        fromCache = true;
        fullResponse = cachedResponse.response;
        result = {
          response: cachedResponse.response,
          modelUsed: cachedResponse.modelUsed + ' (cached)',
          metadata: cachedResponse.metadata || {
            showInOutputPane: true,
            visualization: cachedResponse.visualization
          },
          calculationResults: cachedResponse.calculationResults,
          tokensUsed: 0 // No tokens used for cached response
        };
        // Ensure visualization is in metadata
        if (cachedResponse.visualization && result.metadata) {
          result.metadata.visualization = cachedResponse.visualization;
        }
      }
    }
    
    // If not cached, call the orchestrator
    if (!fromCache) {
      result = await aiOrchestrator.processQuery(
        query,
        conversationHistory,
        userTier,
        userId,
        { 
          chatMode,
          attachment: attachmentBuffer && attachmentMetadata ? {
            buffer: attachmentBuffer,
            filename: attachmentMetadata.filename,
            mimeType: attachmentMetadata.mimeType,
            documentType: attachmentMetadata.documentType
          } : undefined
        }
      );
      fullResponse = result.response;
      
      // Cache the response for future use (only if no attachment)
      if (!attachmentBuffer && result.metadata) {
        const toCache: CachedAIResponse = {
          response: result.response,
          modelUsed: result.modelUsed,
          visualization: result.metadata.visualization,
          metadata: result.metadata,
          calculationResults: result.calculationResults,
          tokensUsed: result.tokensUsed,
          cachedAt: Date.now()
        };
        // Don't await - cache in background
        AIResponseCache.setFullResponse(query, chatMode, userTier, toCache)
          .catch(err => console.error('[WebSocket] Cache store error:', err));
      }
    }

    // For now, send the complete response
    // TODO: Implement true streaming with provider support
    fullResponse = result.response;

    // Send response chunks (simulated streaming)
    const chunkSize = 50;
    for (let i = 0; i < fullResponse.length; i += chunkSize) {
      const chunk = fullResponse.slice(i, i + chunkSize);
      send(ws, {
        type: 'chunk',
        content: chunk
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // DEBUG: Log visualization data before saving
    console.log('[WebSocket] Result metadata:', {
      showInOutputPane: result.metadata.showInOutputPane,
      hasVisualization: !!result.metadata.visualization,
      visualizationType: result.metadata.visualization?.type,
      fullVisualization: result.metadata.visualization
    });
    
    // Build metadata object - only include fields with actual data
    const metadata: any = {};
    
    if (result.metadata.showInOutputPane) {
      metadata.showInOutputPane = true;
    }
    
    if (result.metadata.visualization) {
      metadata.visualization = result.metadata.visualization;
      console.log('[WebSocket] Adding visualization to metadata:', metadata.visualization);
    }
    
    // Check if Excel data exists (orchestrator returns excelWorkbook, not excelData)
    const excelData = result.excelWorkbook || result.excelData;
    const hasExcel = !!(excelData?.buffer || result.spreadsheetData);
    if (hasExcel) {
      metadata.hasExcel = true;
      metadata.spreadsheetData = result.spreadsheetData;
      console.log('[WebSocket] Message has Excel data:', {
        hasBuffer: !!excelData?.buffer,
        filename: excelData?.filename,
        hasSpreadsheetData: !!result.spreadsheetData
      });
    }
    
    // Save assistant message with metadata (including visualization and Excel flag)
    const assistantMessage = await storage.createMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: fullResponse,
      modelUsed: result.modelUsed,
      routingDecision: result.routingDecision,
      calculationResults: result.calculationResults,
      tokensUsed: result.tokensUsed,
      metadata: {
        ...metadata,
        excelFilename: excelData?.filename,
        excelBuffer: excelData?.buffer ? Buffer.from(excelData.buffer).toString('base64') : undefined,
        ...(Object.keys(metadata).length > 0 ? metadata : {})
      }
    });
    
    console.log('[WebSocket] Saved message with metadata:', assistantMessage.metadata);

    // Process assistant message analytics (non-blocking, queued)
    // Queue analytics processing
    addAnalyticsJob({
      messageId: assistantMessage.id,
      conversationId: conversation.id,
      userId,
      role: 'assistant',
      content: fullResponse,
      previousMessages: [...conversationHistory, { role: 'user', content: query }]
    });

    // Auto-generate conversation title and metadata if this is the first message
    if (conversationHistory.length === 0 && conversation.title === 'New Conversation') {
      addTitleGenerationJob(conversation.id, query);
    }

    // Send end signal with metadata (including visualization)
    send(ws, {
      type: 'end',
      messageId: assistantMessage.id,
      metadata: {
        tokensUsed: result.tokensUsed,
        modelUsed: result.modelUsed,
        processingTimeMs: result.processingTimeMs,
        showInOutputPane: result.metadata.showInOutputPane,
        visualization: result.metadata.visualization
      }
    });

  } catch (error: any) {
    console.error('[WebSocket] Chat stream error:', error);
    sendError(ws, error.message || 'An error occurred while processing your request');
  }
}

function send(ws: WebSocket, message: ChatStreamMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, error: string) {
  send(ws, { type: 'error', error });
}
