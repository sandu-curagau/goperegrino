# GoPeregrino

Protótipo navegável para demonstrar uma aplicação de apoio aos peregrinos de Fátima e Santiago. Angular, Ionic e MapLibre; dados e pagamentos simulados, sem backend.

## Desenvolvimento local

Com Node.js 24 instalado:

```sh
npm ci
npm start
```

## Publicação

O workflow `.github/workflows/pages.yml` compila e publica automaticamente no GitHub Pages após cada envio para `main`.

Endereço: https://sandu-curagau.github.io/goperegrino/

Nas definições do repositório, em **Pages**, a origem de publicação é **GitHub Actions**.

Para verificar a compilação localmente:

```sh
npm run build -- --base-href /goperegrino/
```

Os documentos do curso, notas locais, dependências e ficheiros compilados ficam fora do repositório. Os créditos dos mapas e das fontes estão incluídos na aplicação e nos recursos distribuídos.
