# Serviço Apps Script

Este código deve ser usado no projeto Apps Script ligado à planilha `FÉRIAS-2027` e publicado como Web App.

## Configuração privada

Nas propriedades do script, configurar:

- `SPREADSHEET_ID`: ID da planilha Google.
- `PIN_SALT`: salt aleatório longo.
- `ADMIN_PIN_HASH`: hash SHA-256 de `PIN_SALT:PIN_ADMINISTRATIVO`.
- `PIN_<SIGLA>`: hash SHA-256 de `PIN_SALT:PIN_DA_SIGLA` para cada sigla.

Os PINs em texto claro não devem ser salvos no repositório, na planilha ou nas respostas da API.

## Publicação

1. Colar `Code.gs` no projeto Apps Script da planilha.
2. Configurar as propriedades privadas.
3. Executar uma vez a rotina administrativa de criação/proteção da aba `AUDITORIA_PWA`, se necessário.
4. Criar uma implantação como Web App, executando como proprietário e permitindo acesso anônimo.
5. Colocar somente a URL pública da implantação em `VITE_APPS_SCRIPT_WEB_APP_URL` no GitHub Actions.

O Web App é o único componente autorizado a alterar a escala.
