from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.cuda
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import logging
import os
from dotenv import load_dotenv
import time
import psutil
from typing import Dict, Any
import traceback

# ============================================
# CONFIGURAÇÃO INICIAL
# ============================================

load_dotenv()

app = Flask(__name__)
CORS(app)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Variáveis globais
MODEL = None
TOKENIZER = None
DEVICE = None
MODEL_LOADED = False

# Configurações
BASE_MODEL = "unsloth/llama-3.1-8b-instruct-bnb-4bit"
ADAPTER_PATH = os.getenv('ADAPTER_PATH', './adapters')
MAX_TOKENS = int(os.getenv('MAX_TOKENS', 512))
TEMPERATURE = float(os.getenv('TEMPERATURE', 0.7))
TOP_P = float(os.getenv('TOP_P', 0.9))

# ============================================
# GERENCIAMENTO DE GPU
# ============================================

def check_cuda():
    """Verifica status da GPU CUDA"""
    if not torch.cuda.is_available():
        logger.error("❌ CUDA não está disponível!")
        return False
    
    logger.info(f"✅ GPU disponível: {torch.cuda.get_device_name(0)}")
    logger.info(f"✅ CUDA Capability: {torch.cuda.get_device_capability(0)}")
    logger.info(f"✅ CUDA Version: {torch.version.cuda}")
    return True

def get_gpu_memory():
    """Retorna uso de memória GPU em GB"""
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1e9
        reserved = torch.cuda.memory_reserved() / 1e9
        return {"allocated_gb": round(allocated, 2), "reserved_gb": round(reserved, 2)}
    return {"allocated_gb": 0, "reserved_gb": 0}

def clear_gpu_memory():
    """Limpa memória GPU"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        logger.info("🧹 GPU cache limpo")

# ============================================
# CARREGAMENTO DO MODELO
# ============================================

def load_model():
    """Carrega modelo Llama com adapters LoRA"""
    global MODEL, TOKENIZER, DEVICE, MODEL_LOADED
    
    try:
        logger.info("🚀 Iniciando carregamento do modelo...")
        start_time = time.time()
        
        if not check_cuda():
            logger.error("CUDA não disponível! Usando CPU (muito lento)")
            DEVICE = "cpu"
        else:
            DEVICE = "cuda"
        
        # Carregar modelo base com quantização 4-bit
        logger.info("📦 Carregando modelo base Llama-3.1-8B...")
        MODEL = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL,
            load_in_4bit=True,
            device_map="auto",
            torch_dtype=torch.float16,
            trust_remote_code=True
        )
        
        # Carregar tokenizer
        logger.info("🔤 Carregando tokenizer...")
        TOKENIZER = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
        
        # Carregar adapters LoRA
        logger.info(f"🎯 Carregando LoRA adapters de {ADAPTER_PATH}...")
        MODEL = PeftModel.from_pretrained(MODEL, ADAPTER_PATH)
        
        # Modo inferência
        MODEL.eval()
        
        # Desabilitar gradientes
        for param in MODEL.parameters():
            param.requires_grad = False
        
        load_time = time.time() - start_time
        MODEL_LOADED = True
        
        gpu_mem = get_gpu_memory()
        logger.info(f"✅ Modelo carregado em {load_time:.2f}s")
        logger.info(f"💾 GPU Memory: {gpu_mem['allocated_gb']} GB alocado")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Erro ao carregar modelo: {str(e)}")
        logger.error(traceback.format_exc())
        MODEL_LOADED = False
        return False

# ============================================
# GERAÇÃO DE CÓDIGO
# ============================================

def generate_code(prompt: str, max_tokens: int = None, temperature: float = None) -> Dict[str, Any]:
    """
    Gera código Python a partir de um prompt
    
    Args:
        prompt: Instrução em linguagem natural
        max_tokens: Máximo de tokens a gerar
        temperature: Controle de criatividade (0-1)
    
    Returns:
        Dict com código gerado e metadados
    """
    if not MODEL_LOADED:
        return {
              "success": False,

              "error": "Modelo não carregado",
              "code": ""
          }
      
    try:
        max_tokens = max_tokens or MAX_TOKENS
        temperature = temperature or TEMPERATURE
        
        logger.info(f"📝 Gerando código para: {prompt[:50]}...")
        
        # Montar prompt no formato Llama
        full_prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are a helpful Python programming assistant. Write clear, correct, and well-commented code. Always provide working examples when appropriate.<|eot_id|><|start_header_id|>user<|end_header_id|>

{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

"""
        
        # Tokenizar
        logger.info("🔤 Tokenizando prompt...")
        inputs = TOKENIZER(full_prompt, return_tensors="pt").to(DEVICE)
        
        # Gerar
        logger.info("⚡ Executando geração na GPU...")
        inference_start = time.time()
        
        with torch.no_grad():
            outputs = MODEL.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=TOP_P,
                do_sample=True,
                pad_token_id=TOKENIZER.eos_token_id,
                eos_token_id=TOKENIZER.eos_token_id,
            )
        
        inference_time = (time.time() - inference_start) * 1000  # ms
        
        # Decodificar
        logger.info("📖 Decodificando saída...")
        full_response = TOKENIZER.decode(outputs[0], skip_special_tokens=True)
        
        # Extrair apenas a parte da resposta (pós assistant header)
        if "assistant<|end_header_id|>" in full_response:
            code = full_response.split("assistant<|end_header_id|>")[-1].strip()
        else:
            code = full_response
        
        input_length = inputs["input_ids"].shape[1]
        tokens_generated = outputs[0].shape[0] - input_length

        logger.info(f"✅ Código gerado: {tokens_generated} tokens em {inference_time:.0f}ms")
        
        return {
            "success": True,
            "code": code,
            "tokens_generated": int(tokens_generated),
            "inference_time_ms": round(inference_time, 2),
            "model_loaded": True,
            "gpu_memory": get_gpu_memory()
        }
        
    except Exception as e:
        logger.error(f"❌ Erro na geração: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "code": "",
            "model_loaded": MODEL_LOADED
        }

  # ============================================
  # ENDPOINTS FLASK
  # ============================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "online",
        "model_loaded": MODEL_LOADED,
        "device": str(DEVICE),
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A",
        "gpu_memory": get_gpu_memory()
    })

@app.route('/generate', methods=['POST'])
def generate():
    """Endpoint para gerar código"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Nenhum JSON recebido"}), 400
        
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
            return jsonify({"error": "Prompt vazio"}), 400
        
        max_tokens = data.get('max_tokens', MAX_TOKENS)
        temperature = data.get('temperature', TEMPERATURE)
        
        # Validação
        if len(prompt) > 2000:
            return jsonify({"error": "Prompt muito longo (máx 2000 chars)"}), 400
        
        if not 0 <= temperature <= 1:
            return jsonify({"error": "Temperature deve estar entre 0 e 1"}), 400
        
        # Gerar código
        result = generate_code(prompt, max_tokens, temperature)
        
        if result["success"]:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
    
    except Exception as e:
        logger.error(f"❌ Erro no endpoint /generate: {str(e)}")
        return jsonify({
            "error": str(e),
            "success": False
        }), 500

@app.route('/clear-cache', methods=['POST'])
def clear_cache():
    """Limpa memória GPU"""
    clear_gpu_memory()
    return jsonify({
        "status": "Cache limpo",
        "gpu_memory": get_gpu_memory()
    })

@app.route('/stats', methods=['GET'])
def stats():
    """Retorna estatísticas do servidor"""
    cpu_percent = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    
    return jsonify({
        "model_loaded": MODEL_LOADED,
        "device": str(DEVICE),
        "gpu_memory": get_gpu_memory(),
        "cpu_usage_percent": cpu_percent,
        "ram_usage_percent": ram.percent,
        "ram_available_gb": round(ram.available / 1e9, 2),
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__
    })

# ============================================
# INICIALIZAÇÃO
# ============================================

@app.before_request
def before_request():
    """Executado antes de cada request"""
    pass

if __name__ == '__main__':
    logger.info("🎯 Iniciando IA Server...")
    
    # Carregar modelo na inicialização
    if not load_model():
        logger.error("❌ Falha ao carregar modelo!")
        exit(1)
    
    logger.info("✅ Servidor pronto!")
    logger.info("🚀 Escutando em http://localhost:5000")
    
    # Iniciar servidor
    # Para desenvolvimento
    app.run(host='127.0.0.1', port=5000, debug=False)
    
    # Para produção, usar Gunicorn:
    # gunicorn -w 1 -b 127.0.0.1:5000 app:app --timeout 120
    def generate_code(prompt: str, max_tokens: int = None, temperature: float = None) -> Dict[str, Any]:
      """
      Gera código Python a partir de um prompt
      
      Args:
        prompt: Instrução em linguagem natural
        max_tokens: Máximo de tokens a gerar
        temperature: Controle de criatividade (0-1)
      
      Returns:
        Dict com código gerado e metadados
      """
      if not MODEL_LOADED:
        return {
          "success": False,
          "error": "Modelo não carregado",
          "code": ""
        }
      
      try:
        max_tokens = max_tokens or MAX_TOKENS
        temperature = temperature or TEMPERATURE
        
        logger.info(f"📝 Gerando código para: {prompt[:50]}...")
        
        # Montar prompt no formato Llama
        full_prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

    You are a helpful Python programming assistant. Write clear, correct, and well-commented code. Always provide working examples when appropriate.<|eot_id|><|start_header_id|>user<|end_header_id|>

    {prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

    """
        
        # Tokenizar
        logger.info("🔤 Tokenizando prompt...")
        inputs = TOKENIZER(full_prompt, return_tensors="pt").to(DEVICE)
        input_length = inputs["input_ids"].shape[1]
        
        # Gerar
        logger.info("⚡ Executando geração na GPU...")
        inference_start = time.time()
        
        with torch.no_grad():
          outputs = MODEL.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=TOP_P,
            do_sample=True,
            pad_token_id=TOKENIZER.eos_token_id,
            eos_token_id=TOKENIZER.eos_token_id,
          )
        
        inference_time = (time.time() - inference_start) * 1000  # ms
        
        # Decodificar
        logger.info("📖 Decodificando saída...")
        full_response = TOKENIZER.decode(outputs[0], skip_special_tokens=True)
        
        # Extrair apenas a parte da resposta (pós assistant header)
        if "assistant<|end_header_id|>" in full_response:
          code = full_response.split("assistant<|end_header_id|>")[-1].strip()
        else:
          code = full_response
        
        if "```" in code:
            parts = code.split("```")
            # padrão típico: texto, ``````
            if len(parts) >= 3:
                code_block = parts[2].strip()
            else:
                code_block = parts[-1].strip()

        tokens_generated = outputs[0].shape[0] - input_length

        logger.info(f"✅ Código gerado: {tokens_generated} tokens em {inference_time:.0f}ms")
        
        return {
          "success": True,
          "code": code_block,
          "tokens_generated": int(tokens_generated),
          "inference_time_ms": round(inference_time, 2),
          "model_loaded": True,
          "gpu_memory": get_gpu_memory()
        }
        
      except Exception as e:
        logger.error(f"❌ Erro na geração: {str(e)}")
        logger.error(traceback.format_exc())
        return {
          "success": False,
          "error": str(e),
          "code": "",
          "model_loaded": MODEL_LOADED
        }

    # ============================================
    # ENDPOINTS FLASK
    # ============================================

    @app.route('/health', methods=['GET'])
    def health():
      """Health check endpoint"""
      return jsonify({
        "status": "online",
        "model_loaded": MODEL_LOADED,
        "device": str(DEVICE),
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A",
        "gpu_memory": get_gpu_memory()
      })

    @app.route('/generate', methods=['POST'])
    def generate():
      """Endpoint para gerar código"""
      try:
        data = request.get_json()
        
        if not data:
          return jsonify({"error": "Nenhum JSON recebido"}), 400
        
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
          return jsonify({"error": "Prompt vazio"}), 400
        
        max_tokens = data.get('max_tokens', MAX_TOKENS)
        temperature = data.get('temperature', TEMPERATURE)
        
        # Validação
        if len(prompt) > 2000:
          return jsonify({"error": "Prompt muito longo (máx 2000 chars)"}), 400
        
        if not 0 <= temperature <= 1:
          return jsonify({"error": "Temperature deve estar entre 0 e 1"}), 400
        
        # Gerar código
        result = generate_code(prompt, max_tokens, temperature)
        
        if result["success"]:
          return jsonify(result), 200
        else:
          return jsonify(result), 500
      
      except Exception as e:
        logger.error(f"❌ Erro no endpoint /generate: {str(e)}")
        return jsonify({
          "error": str(e),
          "success": False
        }), 500

    @app.route('/clear-cache', methods=['POST'])
    def clear_cache():
      """Limpa memória GPU"""
      clear_gpu_memory()
      return jsonify({
        "status": "Cache limpo",
        "gpu_memory": get_gpu_memory()
      })

    @app.route('/stats', methods=['GET'])
    def stats():
      """Retorna estatísticas do servidor"""
      cpu_percent = psutil.cpu_percent(interval=1)
      ram = psutil.virtual_memory()
      
      return jsonify({
        "model_loaded": MODEL_LOADED,
        "device": str(DEVICE),
        "gpu_memory": get_gpu_memory(),
        "cpu_usage_percent": cpu_percent,
        "ram_usage_percent": ram.percent,
        "ram_available_gb": round(ram.available / 1e9, 2),
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__
      })

    # ============================================
    # INICIALIZAÇÃO
    # ============================================

    @app.before_request
    def before_request():
      """Executado antes de cada request"""
      pass

    if __name__ == '__main__':
      logger.info("🎯 Iniciando IA Server...")
      
      # Carregar modelo na inicialização
      if not load_model():
        logger.error("❌ Falha ao carregar modelo!")
        exit(1)
      
      logger.info("✅ Servidor pronto!")
      logger.info("🚀 Escutando em http://localhost:5000")
      
      # Iniciar servidor
      # Para desenvolvimento
      app.run(host='127.0.0.1', port=5000, debug=False)
      
      # Para produção, usar Gunicorn:
      # gunicorn -w 1 -b 127.0.0.1:5000 app:app --timeout 120