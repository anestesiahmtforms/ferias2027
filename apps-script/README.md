# Serviço Apps Script

`Code.gs` é a fonte canônica do backend do PWA e também alimenta os testes automatizados. `SpreadsheetControl.gs` valida edições diretas na planilha. Para manter os dois arquivos no mesmo projeto Apps Script sem colisão de nomes globais, o backend publicado é gerado como `PWA_Backend.gs`, com o prefixo `pwa_` em seus identificadores internos e `doGet`/`doPost` preservados como pontos de entrada.

## Organização no projeto Apps Script ligado à planilha

- Coloque o conteúdo de `SpreadsheetControl.gs` no arquivo `Código.gs` do projeto ligado à planilha.
- Gere `PWA_Backend.gs` com `node scripts/build-apps-script.mjs` e cole o artefato gerado em um arquivo `PWA_Backend.gs` no mesmo projeto.
- Não cole `Code.gs` diretamente junto a `SpreadsheetControl.gs`; ele é a fonte de build/testes e contém nomes globais não prefixados.
- Depois de mudar `Code.gs`, regenere o artefato e confirme-o com `node scripts/build-apps-script.mjs --check` antes de atualizar o Web App.

## Configuração privada

Nas propriedades do script, configurar:

- `SPREADSHEET_ID`: ID da planilha Google.
- `PIN_SALT`: salt aleatório longo.
- `ADMIN_PIN_HASH`: hash SHA-256 de `PIN_SALT:PIN_ADMINISTRATIVO`.
- `PIN_<SIGLA>`: hash SHA-256 de `PIN_SALT:PIN_DA_SIGLA` para cada sigla.

Os PINs em texto claro não devem ser salvos no repositório, na planilha ou nas respostas da API.

## Publicação

1. No mesmo projeto ligado à planilha `FÉRIAS-2027`, instalar `Código.gs` e o `PWA_Backend.gs` gerado.
2. Configurar as propriedades privadas nesse projeto, incluindo `SPREADSHEET_ID`, `PIN_SALT`, `ADMIN_PIN_HASH` e os 31 hashes `PIN_<SIGLA>`.
3. Instalar ou atualizar o acionador de edição executando `instalarControleFerias` no editor desse projeto.
4. Executar uma vez a rotina administrativa de criação/proteção da aba `AUDITORIA_PWA`, se necessário.
5. Criar ou atualizar a implantação Web App desse mesmo projeto, executando como proprietário e permitindo acesso anônimo.
6. Colocar somente a URL pública dessa implantação em `VITE_APPS_SCRIPT_WEB_APP_URL` no GitHub Actions.

Os dois componentes usam a mesma aba `AUDITORIA_PWA` para sincronizar o início da Fase 2. Não crie um segundo projeto Apps Script para o backend.

As gravações do PWA são validadas no Web App. As edições diretas na planilha usam o controle instalado no mesmo projeto.
