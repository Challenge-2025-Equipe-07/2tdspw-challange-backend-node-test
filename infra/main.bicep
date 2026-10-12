// Free-tier host for this Nest API: Linux F1 App Service + PostgreSQL Flexible Server B1ms.
// The password is a secure parameter. It is not stored in main.bicepparam.

@description('Azure region. This student subscription only allows eastus2, chilecentral, southafricanorth, canadacentral, and spaincentral.')
param location string = 'chilecentral'

@description('PostgreSQL admin login. Azure rejects admin, administrator, root, guest, public, and azure_superuser.')
param postgresAdminLogin string = 'vetiadmin'

@description('PostgreSQL admin password. Set POSTGRES_ADMIN_PASSWORD before deploying. Do not commit it.')
@secure()
param postgresAdminPassword string

@description('Your public IPv4, so prisma migrate deploy can run from this machine. Set CLIENT_IP (curl -4 ifconfig.me).')
param clientIp string

@description('Left empty here. Fill with az webapp config appsettings set after deploy. A later Bicep deploy resets Firebase and CHAT_WEBHOOK_SECRET to empty.')
param firebaseProjectId string = ''

@description('Service account JSON. Same rule as firebaseProjectId: do not commit it.')
@secure()
param firebaseServiceAccount string = ''

@description('Shared secret for POST /notifications/chat. Same rule as firebaseProjectId: do not commit it.')
@secure()
param chatWebhookSecret string = ''

var nameSuffix = uniqueString(resourceGroup().id)
var postgresName = 'veti-pg-${nameSuffix}'
var planName = 'plan-veti-${nameSuffix}'
var siteName = 'veti-api-${nameSuffix}'

// uriComponent keeps a password that contains @ or # a valid URL.
var databaseUrl = 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/veti?sslmode=require'

// Burstable B1ms is the size covered by the 12-month student allowance (750 hours, 32 GB).
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// 0.0.0.0 to 0.0.0.0 is the special rule "allow Azure services", which is how the Web App reaches the database.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Your laptop is not an Azure service. This rule is what lets migrate deploy connect.
resource allowClient 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowClient'
  properties: {
    startIpAddress: clientIp
    endIpAddress: clientIp
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'veti'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// reserved: true is what makes this plan Linux. F1 is the free App Service tier.
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: 'F1'
    tier: 'Free'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: siteName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'npm run start:prod'
    }
  }
}

// These keys are process.env inside the Node process. PORT is injected by App Service and is not listed.
resource appSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: site
  name: 'appsettings'
  properties: {
    NODE_ENV: 'production'
    DATABASE_URL: databaseUrl
    FIREBASE_PROJECT_ID: firebaseProjectId
    FIREBASE_SERVICE_ACCOUNT: firebaseServiceAccount
    CHAT_WEBHOOK_SECRET: chatWebhookSecret
    // The zip already contains node_modules and dist. Skip Oryx so the free plan does not rebuild.
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'false'
  }
}

output webAppName string = site.name
output webAppUrl string = 'https://${site.properties.defaultHostName}'
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output postgresAdminLogin string = postgresAdminLogin
