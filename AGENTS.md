# GoPeregrino, protótipo

## O que é
Protótipo navegável da aplicação GoPeregrino, uma aplicação para peregrinos a pé dos caminhos de Fátima e de Santiago, em Portugal. Junta o mapa do caminho e a reserva de alojamento (Booking.com e alojamentos parceiros). É para apresentar o plano de negócio a um júri: tem de parecer uma aplicação real e acabada, mas NÃO há backend. Todos os dados são fictícios, em ficheiros JSON em `public/data/`.

## Stack
- Angular (versão instalada), componentes standalone, signals, nova sintaxe de controlo (@if, @for), sem NgModules.
- Ionic 9 para Angular, com componentes standalone importados de `@ionic/angular`, modo "ios" forçado para ficar igual em todo o lado.
- Mapa: MapLibre GL JS com o estilo gratuito do OpenFreeMap (https://tiles.openfreemap.org/styles/liberty), sem chave de API.
- Meteorologia: Open-Meteo (gratuito, sem chave), com valores fictícios de reserva se o pedido falhar.
- Sem bibliotecas de tradução: um serviço próprio com dicionários JSON.
- Encaminhamento com hash (`withHashLocation()`), por causa do GitHub Pages.

## Regras
- Textos em português de Portugal (nunca do Brasil): "aplicação" e não "aplicativo", "telemóvel" e não "celular", "ecrã" e não "tela", "utilizador" e não "usuário".
- Cores da marca: azul-escuro #003058 (principal) e amarelo #F2A602 (destaque). Fundo branco. Letra: Inter ou a do sistema.
- Aspeto moderno e limpo, mais simples do que a Buen Camino: o mapa no centro, poucos botões, cartões com cantos arredondados, ícones Ionicons.
- No computador (ecrã com mais de 900 px de largura), a aplicação aparece dentro de uma moldura de telemóvel de 390 x 844 px, centrada, e à direita fica o "Painel de demonstração". No telemóvel, ocupa o ecrã inteiro e o painel abre num botão flutuante discreto.
- Todo o estado (caminho escolhido, posição simulada, premium, reservas, carimbos, idioma) fica num serviço com signals e é guardado no localStorage. Há um botão "Repor demonstração" que limpa tudo.
- Nada pode dar erro na consola. Depois de cada alteração, `ng build` tem de passar sem erros.
- Não inventar funcionalidades fora desta lista.
