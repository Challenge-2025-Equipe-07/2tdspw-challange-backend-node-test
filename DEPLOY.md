# Deploy to Azure

Creates a Linux App Service (F1) and a PostgreSQL Flexible Server (Burstable B1ms) from [infra/main.bicep](infra/main.bicep), applies the Prisma migrations, and publishes this API.

Run the commands from the repository root. The password and your IP are read from the environment by [infra/main.bicepparam](infra/main.bicepparam). They are not stored in that file.

## 1. Select the subscription

```bash
az account show --query "{name:name,id:id}" --output json
```

You should see `2TDSPW-546113-CAMILO_MICHELETTO` and `22d97a05-d599-4949-a977-04132c4080e3`. If another subscription is active:

```bash
az account set --subscription 22d97a05-d599-4949-a977-04132c4080e3
```

## 2. Create the resource group

```bash
az group create --name rg-veti --location chilecentral
```

`az group list --query "[?name=='rg-veti'].name" --output tsv` prints `rg-veti`. The group is empty until the next step.

## 3. Set the two values the template requires

The password must be 8–128 characters and include three of: uppercase, lowercase, number, symbol.

```bash
export POSTGRES_ADMIN_PASSWORD='choose-a-password'
export CLIENT_IP="$(curl -4 -s ifconfig.me)"
echo "$CLIENT_IP"
```

`CLIENT_IP` must be an IPv4 address, such as `203.0.113.10`. That address is added to the Postgres firewall so this machine can run migrations. The Web App is allowed separately.

## 4. Preview, then create

```bash
az deployment group what-if \
  --resource-group rg-veti \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

The preview lists resources to create and does not create them. When it looks right:

```bash
az deployment group create \
  --resource-group rg-veti \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --query "properties.outputs" \
  --output json
```

Save the four outputs: `webAppName`, `webAppUrl`, `postgresHost`, `postgresAdminLogin`. The password is not printed. Provisioning the database often takes several minutes.

## 5. Create the tables

Set `POSTGRES_HOST` to the `postgresHost` value from the deployment output. Do not leave angle brackets in the URL. If the password contains `@`, `#`, or `%`, encode those characters (`@` becomes `%40`).

```bash
export POSTGRES_HOST='veti-pg-xxxxxxxx.postgres.database.azure.com'
export DATABASE_URL="postgresql://vetiadmin:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}:5432/veti?sslmode=require"
npx prisma migrate deploy --config prisma7.config.ts
```

This applies the migrations in `prisma/migrations`. Do not use `npm run prisma:migrate` here. That script is `migrate dev`, for local development.

## 6. Build and zip the API

Build on this machine. The free App Service plan has a small daily CPU quota, and the template sets `SCM_DO_BUILD_DURING_DEPLOYMENT` to `false` so Azure does not rebuild the zip.

```bash
npm ci
npx prisma generate --config prisma7.config.ts
npm run build

rm -rf /tmp/veti-zip
mkdir /tmp/veti-zip
cp -R dist package.json package-lock.json node_modules /tmp/veti-zip
cd /tmp/veti-zip
npm prune --omit=dev
zip -r /tmp/veti-api.zip .
```

`npm run build` copies `src/generated` into `dist/generated`. The running process loads the Prisma client from there.

## 7. Publish the zip

Use `webAppName` from the deployment outputs.

```bash
az webapp deploy \
  --resource-group rg-veti \
  --name <webAppName> \
  --src-path /tmp/veti-api.zip \
  --type zip
```

## 8. Check that it is up

```bash
curl https://<webAppName>.azurewebsites.net/
```

The public route returns `Hello World!`. Any other route without `Authorization: Bearer <Firebase ID token>` returns 401, because `NODE_ENV` is `production`.

The first request after idle time can take a few seconds. The F1 plan sleeps when it receives no traffic.

## 9. Add Firebase and the chat webhook secret

```bash
az webapp config appsettings set \
  --resource-group rg-veti \
  --name <webAppName> \
  --settings \
    FIREBASE_PROJECT_ID='your-project-id' \
    FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}' \
    CHAT_WEBHOOK_SECRET='choose-a-long-secret' \
    VAPID_PUBLIC_KEY='your-public-key' \
    VAPID_PRIVATE_KEY='your-private-key' \
    VAPID_SUBJECT='mailto:you@example.com'
```

Paste the service account JSON as one line. `CHAT_WEBHOOK_SECRET` is the value the RAG caller sends as `x-chat-webhook-secret` on `POST /notifications/chat`. `VAPID_SUBJECT` is a `mailto:` or `https:` URL. Generate the key pair with `npx web-push generate-vapid-keys` and keep the private key out of the repository. A later `az deployment group create` writes these settings back to empty, because the template defaults are empty. Run this command again after any infrastructure redeploy.

## 10. Delete it when the month is over

```bash
az group delete --name rg-veti --yes
```

A stopped PostgreSQL server still counts against the monthly free hours until the resource group is deleted.