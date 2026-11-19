# Dockerfile for VampirePlatform V5
FROM python:3.12-slim

# Evita criação de arquivos .pyc e garante logs em tempo real no console
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia a aplicação
COPY app/ ./app/

# Cria um usuário não-root para segurança
RUN useradd -m -u 1000 vampire && \
    chown -R vampire:vampire /app

USER vampire

# Porta padrão do Uvicorn / FastAPI
EXPOSE 8000

# Healthcheck para monitorar o status do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

# Comando de inicialização
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
