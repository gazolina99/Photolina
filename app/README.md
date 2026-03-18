# Photolina Desktop App

Same Photolina editor as the website — no login, free forever.

## Run locally

```bash
cd app
npm install
npm start
```

## Build downloadable app (Windows)

```bash
cd app
npm install
npm run build
```

The portable `.exe` will be in `app/dist/`.  
For an installer instead, run: `npm run build:installer`

## Build from project root

From the Photolina folder:

```bash
cd app && npm install && npm run build
```

Then find **Photolina 1.0.0.exe** (portable) or the installer in `app/dist/`.
