# Manda Money — Web (Vue)

Versão web do app Manda Money, convertida do original em React Native/Expo
para rodar como um site estático no GitHub Pages.

## O que mudou em relação ao app original

- **Câmera**: leitura de QR Code (NFC-e) e foto pro OCR agora usam a câmera
  do navegador (`getUserMedia`) em vez do `expo-camera`. Funciona em
  celulares com Chrome/Safari, mas **exige HTTPS** — GitHub Pages já serve
  em HTTPS, então funciona sem configuração extra. Só não funciona em
  `http://localhost` puro sem `https`, dependendo do navegador (Chrome
  libera câmera em `localhost` mesmo sem HTTPS para desenvolvimento).
- **Notificações**: como GitHub Pages é hospedagem estática (sem servidor
  rodando push), não dá pra usar push notification de verdade. Em vez
  disso, o sininho 🔔 mostra itens novos e solicitações de pagamento ou
  contestação consultadas no Apps Script quando o painel é aberto. Os itens
  novos são guardados no `localStorage` do navegador; solicitações ficam na
  planilha e aparecem em outros dispositivos.
- **Backend**: continua usando o mesmo Google Apps Script (`API_URL`) do
  app original; fluxos que dependem de novas ações exigem atualizar e
  reimplantar o script.

## Marcar participantes que já pagaram no caixa

Na revisão de uma compra, cada item permite marcar os participantes que já
pagaram a parte deles diretamente no mercado. Essa marcação não cria saldo
pendente para essas pessoas e é salva junto com o item.

Para a marcação persistir, atualize a aba `Compras_Itens` no Google Sheets e
o Apps Script:

1. Na primeira linha da coluna I de `Compras_Itens`, adicione o cabeçalho
   `Pago_Direto_Por`. Os itens já registrados podem permanecer como estão.
2. Em `getItems()`, acrescente `paidWith` ao objeto de cada item:

   ```js
   paidWith: String(row[8] || '').split('|').filter(Boolean),
   ```

3. Em `saveItems(data)`, depois de montar `participants`, leia e valide a
   nova lista:

   ```js
   const paidWith = Array.isArray(item.paidWith)
     ? item.paidWith.map(String).filter((id) =>
         participants.includes(id) && id !== String(item.buyerId)
       )
     : [];
   ```

4. No `appendRow` de `saveItems`, acrescente `paidWith.join('|')` depois de
   `participants.join('|')`. No loop que cria saldos, exclua também quem já
   pagou diretamente:

   ```js
   participants
     .filter((id) => id !== String(item.buyerId) && !paidWith.includes(id))
     .forEach((debtorId) => {
       addOrUpdateBalance(balancesSheet, debtorId, String(item.buyerId), share);
     });
   ```

5. Salve e atualize a implantação do Apps Script para que a URL da API passe
   a executar a versão nova.

## Detalhar e contestar saldos

Cada saldo pode ser expandido para ver os itens e os valores que o compõem.
O devedor pode contestar um item pendente; o credor recebe uma solicitação no
painel de notificações e pode aceitá-la ou recusá-la. Ao aceitar, o valor da
parte daquele item é subtraído do saldo; ao recusar, o saldo não muda.

O Apps Script precisa manter uma relação entre cada item e a linha de saldo
que recebeu sua parte. Isso evita incluir no detalhamento compras antigas que
já foram quitadas:

1. Copie o conteúdo de [`apps-script/contestations.gs`](./apps-script/contestations.gs)
   para o projeto Apps Script que já contém `SHEET_ID` e `response()`.
2. Em `addOrUpdateBalance`, retorne o ID do saldo atualizado ou criado. No
   caso de atualizar uma linha pendente, antes do `return` existente retorne:

   ```js
   return String(rows[existingIndex][0]);
   ```

   Na criação, gere o ID antes do `appendRow`, use-o na primeira coluna e
   retorne-o:

   ```js
   const balanceId = Utilities.getUuid();
   sheet.appendRow([balanceId, String(debtorId), String(creditorId), Number(value), 'Pendente', '']);
   return balanceId;
   ```

3. Em `saveItems(data)`, no ponto em que cria o saldo para cada participante
   devedor, registre também a relação. Substitua a chamada a
   `addOrUpdateBalance(...)` por:

   ```js
   const balanceId = addOrUpdateBalance(
     balancesSheet,
     debtorId,
     String(item.buyerId),
     share
   );
   recordBalanceItem(
     file,
     balanceId,
     String(item.id),
     debtorId,
     String(item.buyerId),
     share
   );
   ```

   Mantenha a exclusão dos participantes informados em `paidWith` conforme
   a seção anterior.
4. Em `doGet(e)`, adicione os casos:

   ```js
   if (action === 'balanceItems') return getBalanceItems(e.parameter.balanceId, e.parameter.userId);
   if (action === 'disputes') return getDisputes(e.parameter.userId);
   if (action === 'contestNotifications') return contestNotifications(e.parameter.userId);
   ```

5. Em `doPost(e)`, adicione:

   ```js
   if (data.action === 'requestContest') return requestContest(data);
   if (data.action === 'resolveContest') return resolveContest(data);
   ```

6. Para relacionar os saldos e compras que já existem, execute uma única vez
   `backfillBalanceItems()` no editor do Apps Script **antes de usar
   contestações**. A migração presume que as linhas de compras e saldos foram
   acrescentadas em ordem cronológica. Ela cria a aba `Saldo_Itens`; não a
   execute novamente depois de preenchida.
7. Em `requestPayment(data)`, altere a condição `available` para aceitar
   somente o status pendente. Isso impede solicitar pagamento enquanto uma
   contestação daquele saldo aguarda resposta:

   ```js
   const available = status === 'pendente';
   ```

   A função `requestContest` também só aceita saldos pendentes. A aba
   `Contestacoes` e seus cabeçalhos são criados automaticamente na primeira
   solicitação.
8. Salve e atualize a implantação do Apps Script. Sem essa implantação, as
   ações de contestação retornarão erro, embora o restante do app continue
   funcionando.

Datas ISO retornadas pela planilha são normalizadas para `dd/MM/yyyy` ao
carregar itens, para que a tela inicial e o histórico usem o mesmo formato
após um novo login.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Pra testar a câmera no celular durante o
desenvolvimento, você vai precisar de HTTPS local (ex: `vite --host` com um
túnel como ngrok, ou `mkcert` pra gerar certificado local) — em produção no
GitHub Pages isso já vem resolvido.

## Deploy no GitHub Pages

1. Crie um repositório no GitHub e suba este projeto:
   ```bash
   git init
   git add .
   git commit -m "Manda Money web"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```
2. No repositório, vá em **Settings → Pages** e em "Build and deployment"
   escolha a fonte **GitHub Actions** (o workflow em
   `.github/workflows/deploy.yml` já está pronto e roda sozinho a cada push
   na branch `main`).
3. Depois do primeiro push, o Actions builda o projeto e publica. A URL
   final aparece em Settings → Pages, algo como
   `https://SEU_USUARIO.github.io/SEU_REPO/`.

Não precisa editar `vite.config.js` — o `base: './'` já gera caminhos
relativos que funcionam em qualquer subpasta.

## Variáveis de ambiente (opcional)

O app aceita duas variáveis de ambiente, ambas opcionais — sem elas, usa os
valores atuais já embutidos no código (o link do Apps Script que você já
tinha, e `http://localhost:8000` para o OCR):

- `VITE_API_URL`: link do seu Google Apps Script (o `API_URL`).
- `VITE_OCR_URL`: URL pública do serviço de OCR, se ele estiver hospedado
  em algum lugar acessível pela internet.

**Em desenvolvimento local**: copie `.env.example` para `.env` e preencha.
Esse arquivo é ignorado pelo git (está no `.gitignore`), então nunca sobe
pro GitHub.

**Em produção (GitHub Pages)**: como o `.env` não vai pro repositório, o
GitHub Actions precisa receber os valores por outro caminho — secrets do
repositório:

1. No GitHub, vá em **Settings → Secrets and variables → Actions**.
2. Clique **New repository secret** e cadastre `VITE_API_URL` (se quiser
   trocar o link do Apps Script sem mexer no código) e/ou `VITE_OCR_URL`.
3. O workflow em `.github/workflows/deploy.yml` já está configurado pra
   ler esses secrets e injetar no build automaticamente a cada push.

Se você nunca for trocar essas URLs, pode simplesmente não cadastrar os
secrets — o build usa os valores padrão do código normalmente.