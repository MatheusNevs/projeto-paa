# 🤖 Gerador de Código Python com IA

Sistema completo de geração de código Python usando **Llama 3.1 8B** com fine-tuning via LoRA, interface web moderna em Next.js.

## 📋 Sobre o Projeto

Este projeto implementa um assistente de IA especializado em programação Python, capaz de:
- 💬 Manter conversas contextualizadas sobre código
- 🔧 Gerar código Python correto e bem comentado
- ⚡ Processar requisições com baixa latência (otimizado para GPU)
- 🎨 Interface web moderna e responsiva

### Arquitetura

```
projeto-final/
├── ia-server/          # Backend Python - Servidor de IA
│   ├── app.py          # API Flask com inferência do modelo
│   ├── adapters/       # LoRA adapters fine-tuned
│   ├── requirements.txt
│   └── .env            # Configurações
│
└── web/                # Frontend/Backend Next.js
    ├── app/            # Aplicação Next.js 15
    ├── components/     # Componentes React
    └── .env            # Configurações
```

## 🚀 Tecnologias

### Backend IA (ia-server)
- **Python 3.12+**
- **PyTorch 2.1+** com CUDA
- **Transformers 4.36+** (Hugging Face)
- **PEFT** para LoRA adapters
- **Flask 3.0** para API REST
- **bitsandbytes** para quantização 4-bit

### Frontend (web)
- **Next.js 16.0** (App Router)
- **React 19.2**
- **TypeScript 5**
- **Tailwind CSS 4**
- **react-markdown** para formatação
- **react-syntax-highlighter** para highlight de código

## 📦 Instalação

### Pré-requisitos

- **Python 3.12+**
- **Node.js 18+** e npm
- **CUDA 12.0+** e GPU NVIDIA compatível (recomendado)
- **16GB+ RAM**
- **8GB+ VRAM** na GPU

### 1. Clone o repositório

```bash
git clone https://github.com/MatheusNevs/projeto-paa.git
cd projeto-paa
```

### 2. Configurar Backend IA

```bash
cd ia-server

# Criar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# ou
.venv\Scripts\activate     # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env conforme necessário
```

> **⚠️ IMPORTANTE:** A pasta `adapters/` não está incluída no repositório devido ao tamanho dos arquivos (160MB). 
> Você precisa obter os adapters LoRA treinados e colocá-los na pasta `ia-server/adapters/` antes de executar o servidor.
> Os adapters devem conter os arquivos: `adapter_config.json`, `adapter_model.safetensors`, e arquivos do tokenizer.

**Conteúdo do `.env`:**
```env
# Caminhos
ADAPTER_PATH=./adapters

# Geração
MAX_TOKENS=512
TEMPERATURE=0.7
TOP_P=0.9

# Flask
FLASK_ENV=production
FLASK_DEBUG=False
```

### 3. Configurar Frontend

```bash
cd ../web

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env conforme necessário
```

**Conteúdo do `.env`:**
```env
# URL do servidor IA Python (ia-server)
IA_SERVER_URL=http://localhost:5000

# Chave de API (opcional)
IA_API_KEY=dev-key
```

## 🎯 Como Usar

### Iniciar o Servidor IA

```bash
cd ia-server
source .venv/bin/activate
python app.py
```

O servidor estará disponível em `http://localhost:5000`

### Iniciar a Interface Web

```bash
cd web
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

### Uso da Interface

1. Acesse `http://localhost:3000`
2. Digite sua pergunta ou pedido de código no campo de texto
3. Clique em "Enviar" ou pressione Enter
4. Aguarde a IA gerar o código
5. O código será exibido com syntax highlighting
6. Continue a conversa para refinar o código

## 🔧 API Endpoints

### Backend IA (porta 5000)

#### `GET /health`
Verifica status do servidor e modelo

**Resposta:**
```json
{
  "status": "online",
  "model_loaded": true,
  "device": "cuda",
  "gpu_available": true,
  "gpu_name": "NVIDIA GeForce RTX 3090",
  "gpu_memory": {
    "allocated_gb": 5.2,
    "reserved_gb": 6.0
  }
}
```

#### `POST /generate`
Gera código a partir de prompt ou histórico de mensagens

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Crie uma função para calcular fibonacci"},
    {"role": "assistant", "content": "def fibonacci(n): ..."},
    {"role": "user", "content": "Adicione memoização"}
  ],
  "max_tokens": 512,
  "temperature": 0.7
}
```

**Resposta:**
```json
{
  "success": true,
  "code": "def fibonacci(n, memo={}):\n    ...",
  "tokens_generated": 156,
  "inference_time_ms": 1234.56,
  "model_loaded": true,
  "gpu_memory": {
    "allocated_gb": 5.2,
    "reserved_gb": 6.0
  }
}
```

#### `GET /stats`
Estatísticas do servidor

#### `POST /clear-cache`
Limpa cache da GPU

## ⚡ Características Técnicas

### Modelo
- 📦 **Llama 3.1 8B Instruct** (4-bit quantizado)
- 🎯 **LoRA Adapters** fine-tuned para Python
- 🔄 **Conversação contextualizada** (até 10 mensagens)
- ⚙️ **Quantização 4-bit** (bitsandbytes) para eficiência de memória

## 📊 Especificações do Modelo

- **Base:** `unsloth/llama-3.1-8b-instruct-bnb-4bit`
- **Quantização:** 4-bit (bitsandbytes)
- **LoRA Config:**
  - `r=16`
  - `lora_alpha=16`
  - Targets: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`
- **Memória GPU:** ~6GB VRAM
- **Contexto:** Até 8192 tokens

## 🎨 Interface

A interface web oferece:
- 💬 Chat em tempo real com a IA
- 🎨 Syntax highlighting para código Python
- 📋 Botão de copiar código
- 📊 Indicador de performance (tempo de inferência)
- 🔄 Histórico de conversação
- 📱 Design responsivo
- 🌙 Tema tech/terminal


## 📄 Licença

Este projeto foi desenvolvido como trabalho acadêmico para a disciplina de Projeto e Análise de Algoritmos (PAA) na Universidade de Brasília (UnB).
