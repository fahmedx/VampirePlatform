# 🩸 VampirePlatform V5

Plataforma Web e Mesa Virtual para jogar **Vampiro: A Máscara (5ª Edição - V5)** com seus amigos em tempo real, baseada e aprimorada a partir do projeto `VampyreBot`.

---

## 🚀 Funcionalidades

- **Sessões e Salas em Tempo Real**:
  - Salas privadas identificadas por código (ex: `ELYSIUM-42`).
  - Lista de coterie ao vivo: todos os jogadores conectados na sala veem os outros membros, clãs e status.
  - Distinção entre **Jogador** e **Narrador (Storyteller)**.
- **Mecânica Oficial de Dados V5**:
  - Parada de Dados dividida automaticamente entre **Dados Normais** (pretos/dourados) e **Dados de Fome** (vermelhos sangue).
  - D10: Sucessos em 6-9, Críticos em 10.
  - Pares de 10s garantem +2 sucessos extras cada.
  - **Crítico Bestial (Messy Critical)**: Acionado quando há um sucesso crítico com presença de 10 nos dados de Fome.
  - **Falha Bestial (Bestial Failure)**: Acionado quando o teste falha e há pelo menos um resultado 1 nos dados de Fome.
  - **Sucesso Crítico** e **Sucesso Regular** calculados com margem.
- **Teste de Sangue (Rouse Check)**:
  - 1 clique para rolar o teste de sangue místico.
  - Se falhar (1 a 5), o nível de fome do personagem sobe automaticamente de 0 até 5 e é sincronizado com toda a mesa via WebSockets.
- **Torre de Dados Secreta (Dice Tower)**:
  - Permite ao jogador ou narrador fazer rolagens secretas onde apenas o Narrador (e o autor) vê os dados e resultados.
- **Interface Gótica e Imersiva**:
  - Tema dark/noir com estética de *Vampiro: A Máscara*.
  - Medidor de Fome interativo com 5 gotas de sangue clicáveis.
  - Dados animados e estilizados com badges de *CRIT*, *BESTA*, *SUC* e *1☠️*.

---

## 🛠️ Como Executar

### Opção 1: Via Docker (Recomendado)

Você pode subir a aplicação em container sem precisar configurar Python localmente:

```bash
# Com Docker Compose:
docker compose up -d

# Ou via comando docker direto:
docker run -d --name vampire_platform -p 8000:8000 vampire-platform:latest
```

Para rebuildar a imagem caso faça alterações no código:
```bash
docker compose build
```

---

### Opção 2: Localmente (sem Docker)

Dentro da pasta `VampirePlatform`:

```bash
# Via script facilitador
./run.sh

# Ou diretamente pelo uvicorn do ambiente virtual
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Acesse no navegador:
👉 **`http://localhost:8000`** (ou use o IP da sua máquina na rede local para seus amigos acessarem!).

---

## 📂 Estrutura do Projeto

```
VampirePlatform/
├── app/
│   ├── main.py               # Servidor FastAPI e rotas WebSockets
│   ├── models/
│   │   ├── dice.py           # Modelos de dados e enumerações de resultado
│   │   └── room.py           # Modelos de jogador e estado da sala
│   ├── services/
│   │   ├── dice_engine.py    # Motor de cálculo e regras V5
│   │   └── room_manager.py   # Gerenciador de conexões e transmissões ao vivo
│   ├── static/
│   │   ├── css/style.css     # Estilos góticos e visual dos dados
│   │   └── js/app.js         # Cliente WebSocket reativo e controles de UI
│   └── templates/
│       └── index.html        # Página da mesa virtual
├── run.sh                    # Script de inicialização
└── venv/                     # Ambiente virtual Python
```

## 🎲 Teste a mesa virtual

https://vampireplatform-2.onrender.com/
