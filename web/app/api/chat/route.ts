import { NextRequest, NextResponse } from 'next/server';

// Configuração
const IA_SERVER_URL = process.env.IA_SERVER_URL || 'http://localhost:5000';
const API_KEY = process.env.IA_API_KEY || 'dev-key';

interface GenerateRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

interface GenerateResponse {
  success: boolean;
  code?: string;
  tokens_generated?: number;
  inference_time_ms?: number;
  gpu_memory?: {
    allocated_gb: number;
    reserved_gb: number;
  };
  error?: string;
}

/**
 * POST /api/chat
 * Recebe prompt do usuário e retorna código gerado pela IA
 */
export async function POST(request: NextRequest) {
  try {
    // Validação de headers
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type deve ser application/json' },
        { status: 400 }
      );
    }

    // Parse do body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'JSON inválido' },
        { status: 400 }
      );
    }

    const { prompt, max_tokens, temperature } = body;

    // Validações
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt é obrigatório e deve ser string' },
        { status: 400 }
      );
    }

    if (prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt não pode estar vazio' },
        { status: 400 }
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: 'Prompt muito longo (máx 2000 caracteres)' },
        { status: 400 }
      );
    }

    if (temperature && (temperature < 0 || temperature > 1)) {
      return NextResponse.json(
        { error: 'Temperature deve estar entre 0 e 1' },
        { status: 400 }
      );
    }

    console.log(`[API] Recebido prompt: ${prompt.substring(0, 50)}...`);

    // Fazer requisição para IA Server
    console.log(`[API] Enviando para IA Server: ${IA_SERVER_URL}/generate`);

    const iaResponse = await fetch(`${IA_SERVER_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        max_tokens: max_tokens || 512,
        temperature: temperature || 0.7,
      }),
      // signal: AbortSignal.timeout(45000), // Timeout 45s
    });

    if (!iaResponse.ok) {
      console.error(`[API] IA Server retornou ${iaResponse.status}`);
      const errorText = await iaResponse.text();
      
      return NextResponse.json(
        {
          error: `IA Server error: ${iaResponse.status}`,
          details: errorText,
          success: false,
        },
        { status: iaResponse.status }
      );
    }

    const iaData: GenerateResponse = await iaResponse.json();

    console.log(`[API] Resposta sucesso: ${iaData.tokens_generated} tokens em ${iaData.inference_time_ms}ms`);

    // Retornar resposta
    return NextResponse.json(
      {
        success: true,
        code: iaData.code,
        tokens_generated: iaData.tokens_generated,
        inference_time_ms: iaData.inference_time_ms,
        gpu_memory: iaData.gpu_memory,
      },
      { status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[API] Erro ao processar chat:`, error);

    // Erro de timeout
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Timeout: IA Server demorou muito (45s max)' },
        { status: 504 }
      );
    }

    // Erro de conexão
    if (errorMessage.includes('Failed to fetch')) {
      return NextResponse.json(
        {
          error: 'Não conseguiu conectar ao IA Server',
          hint: `Verifique se Flask está rodando em ${IA_SERVER_URL}`,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Erro interno: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/health
 * Health check para verificar status do backend
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar conexão com IA Server
    const iaHealth = await fetch(`${IA_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    return NextResponse.json({
      status: 'ok',
      backend: 'online',
      ia_server: iaHealth?.ok ? 'online' : 'offline',
      ia_server_url: IA_SERVER_URL,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Backend check failed' },
      { status: 500 }
    );
  }
}
