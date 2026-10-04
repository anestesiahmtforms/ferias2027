# Escala de férias 2027

Aplicação web exclusiva da equipe SAHMT para consulta e escolha protegida das férias de 2027. O uso normal é abrir o endereço no navegador; instalação no Android/iPhone é opcional e não é necessária.

## Arquitetura

- Interface: GitHub Pages, mobile-first, acessível diretamente pelo navegador (recursos PWA opcionais).
- Serviço: Web App Apps Script executado com a conta proprietária da planilha.
- Fonte administrativa: planilha Google `FÉRIAS-2027`.
- Auditoria: aba protegida `AUDITORIA_PWA`.

O navegador nunca recebe PINs, hashes ou a permissão de edição da planilha.

## Desenvolvimento

```bash
npm install
npm test
npm run build
```

## Publicação

No repositório, cadastrar o segredo `VITE_APPS_SCRIPT_WEB_APP_URL` com a URL da implantação do Web App Apps Script. O workflow constrói e publica o diretório `dist` no GitHub Pages.

No Apps Script, configurar as propriedades privadas descritas em [`apps-script/README.md`](apps-script/README.md) e publicar o Web App com acesso anônimo, executando como a conta proprietária.
