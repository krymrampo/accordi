# Accordi Clean

Lettore pulito e installabile per consultare testi e accordi su richiesta. Il frontend React rimuove pubblicità, popup, immagini e contenuti multimediali; l'API Vercel recupera soltanto le pagine dal dominio autorizzato.

## Sviluppo locale

```bash
npm install
npm run dev
```

L'app locale è disponibile su `http://127.0.0.1:4174`.

## Deploy Vercel

Il repository include `vercel.json` e le funzioni in `api/`, quindi non richiede variabili d'ambiente.

- Build command: `npm run build`
- Output directory: `dist/client`
- Root directory: `./`

## Uso offline su iPhone

1. Aprire il sito pubblicato con Safari.
2. Toccare Condividi.
3. Scegliere **Aggiungi alla schermata Home**.
4. Aprire almeno una volta online ogni brano che si desidera conservare.

Le pagine aperte vengono salvate nel dispositivo. La ricerca offline opera sui brani già salvati. iOS può eliminare la cache se lo spazio disponibile diventa insufficiente o se vengono cancellati i dati di Safari.

## Verifica

```bash
npm test
npm run build
```
